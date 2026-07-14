'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { registerApprovalAction, createApprovalRequest } = require('../services/approvals');

router.use(authenticate);

// The actual deactivation, run either immediately (owner) or later by
// approveRequest() once the Founder signs off (admin-initiated path).
async function deactivateStaffAccount(targetId) {
  const { rows } = await safeQuery(
    `UPDATE staff_accounts SET is_active = false WHERE id = $1 RETURNING id, email, is_active`,
    [targetId]
  );
  return rows[0];
}
registerApprovalAction('staff_account.deactivate', deactivateStaffAccount);

// Only owner/admin can see the team's login list (requireRole lets owner/admin through
// regardless of the roles listed, per the RBAC helper — 'admin' here is just the floor).
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT sa.id, sa.email, sa.role, sa.is_active, sa.last_login, sa.created_at,
              e.full_name AS employee_name
       FROM staff_accounts sa
       LEFT JOIN employees e ON e.id = sa.employee_id
       ORDER BY sa.created_at DESC`
    );
    res.json({ staff: rows });
  } catch (err) {
    console.error('[staff-accounts:list]', err);
    res.status(500).json({ error: 'Failed to fetch staff accounts' });
  }
});

// Create a login for a team member. Only owner (or admin, for non-owner roles) can do this.
// Additions are never gated behind approval — only destructive actions are.
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { email, password, role, employee_id } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'email, password, and role are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    // Only an existing owner can grant the owner role to someone else — an admin
    // creating accounts can't hand out owner-level access.
    if (role === 'owner' && req.staff.role !== 'owner') {
      return res.status(403).json({ error: 'Only an owner can create another owner account' });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows: [staff] } = await safeQuery(
      `INSERT INTO staff_accounts (email, password_hash, role, employee_id)
       VALUES ($1,$2,$3,$4) RETURNING id, email, role, employee_id, is_active, created_at`,
      [email.toLowerCase(), hash, role, employee_id || null]
    );
    res.status(201).json({ staff });
  } catch (err) {
    console.error('[staff-accounts:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    res.status(500).json({ error: 'Failed to create staff account' });
  }
});

// Deactivate a login. Owner: happens immediately (same as before).
// Admin: creates a pending approval request instead — the account stays
// active until the Founder approves it via /api/approvals/:id/approve.
router.post('/:id/deactivate', requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.staff.id) {
      return res.status(400).json({ error: "You can't deactivate your own account" });
    }

    if (req.staff.role === 'owner') {
      const staff = await deactivateStaffAccount(req.params.id);
      if (!staff) return res.status(404).json({ error: 'Account not found' });
      return res.json({ staff });
    }

    // Admin path: request instead of act.
    const { rows: [target] } = await safeQuery(`SELECT id, email FROM staff_accounts WHERE id = $1`, [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Account not found' });

    const request = await createApprovalRequest({
      actionType: 'staff_account.deactivate',
      targetType: 'staff_account',
      targetId: target.id,
      targetLabel: target.email,
      requestedBy: req.staff.id,
      reason: req.body.reason || null,
    });

    res.status(202).json({
      pending: true,
      request,
      message: `Deactivation of ${target.email} requested — awaiting Founder approval.`,
    });
  } catch (err) {
    console.error('[staff-accounts:deactivate]', err);
    res.status(500).json({ error: 'Failed to process deactivation' });
  }
});

// Reactivate — always immediate, for everyone who can reach this route.
// Restoring access is an addition, not a destructive action.
router.post('/:id/reactivate', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE staff_accounts SET is_active = true WHERE id = $1 RETURNING id, email, is_active`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });
    res.json({ staff: rows[0] });
  } catch (err) {
    console.error('[staff-accounts:reactivate]', err);
    res.status(500).json({ error: 'Failed to reactivate account' });
  }
});

// Link (or re-link) a login to an employee record — this is what makes
// /employees/me, /me/payslips, /me/leave etc. work for that person.
// Additive/corrective, not destructive — immediate for admin/owner, no
// approval workflow needed.
router.post('/:id/link-employee', requireRole('admin'), async (req, res) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });

    const { rows: emp } = await safeQuery(`SELECT id, full_name FROM employees WHERE id = $1`, [employee_id]);
    if (!emp.length) return res.status(404).json({ error: 'Employee not found' });

    const { rows } = await safeQuery(
      `UPDATE staff_accounts SET employee_id = $1 WHERE id = $2 RETURNING id, email, employee_id`,
      [employee_id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });

    res.json({ staff: rows[0], employee: emp[0] });
  } catch (err) {
    console.error('[staff-accounts:link-employee]', err);
    res.status(500).json({ error: 'Failed to link employee' });
  }
});

// Reset someone else's password (e.g. they're locked out) — owner/admin only
router.post('/:id/reset-password', requireRole('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await safeQuery(
      `UPDATE staff_accounts SET password_hash = $1 WHERE id = $2 RETURNING id, email`,
      [hash, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });
    res.json({ staff: rows[0] });
  } catch (err) {
    console.error('[staff-accounts:reset-password]', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Link (or unlink) an existing login to an employee record — this is what was
// missing before: the create form already accepted employee_id, but there
// was never a way to set/fix it after the fact. Not destructive, so immediate.
router.post('/:id/link-employee', requireRole('admin'), async (req, res) => {
  try {
    const { employee_id } = req.body; // null/omitted = unlink
    if (employee_id) {
      const { rows: [emp] } = await safeQuery(`SELECT id FROM employees WHERE id = $1`, [employee_id]);
      if (!emp) return res.status(404).json({ error: 'Employee not found' });
    }
    const { rows } = await safeQuery(
      `UPDATE staff_accounts SET employee_id = $1 WHERE id = $2 RETURNING id, email, employee_id`,
      [employee_id || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });
    res.json({ staff: rows[0] });
  } catch (err) {
    console.error('[staff-accounts:link-employee]', err);
    res.status(500).json({ error: 'Failed to link employee' });
  }
});

module.exports = router;