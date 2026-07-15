'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');
const { registerApprovalAction, createApprovalRequest } = require('../services/approvals');

router.use(authenticate);

// The actual deactivation, run either immediately (owner, below) or later
// by approveRequest() once the Founder signs off (the admin-initiated path).
// The executed deactivation gets logged inside approveRequest() (via
// services/approvals.js) for the admin path, and explicitly here for the
// owner-immediate path — both end up in the audit log either way.
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

    await logAction({ staffId: req.staff.id, action: 'staff_account.created', entity: 'staff_accounts', entityId: staff.id, newValue: { email: staff.email, role: staff.role } });

    res.status(201).json({ staff });
  } catch (err) {
    console.error('[staff-accounts:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    res.status(500).json({ error: 'Failed to create staff account' });
  }
});

// Deactivate a login. Owner: happens immediately (same as before), logged
// directly. Admin: creates a pending approval request instead — the account
// stays active until the Founder approves it via /api/approvals/:id/approve,
// at which point services/approvals.js logs the executed deactivation.
router.post('/:id/deactivate', requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.staff.id) {
      return res.status(400).json({ error: "You can't deactivate your own account" });
    }

    if (req.staff.role === 'owner') {
      const staff = await deactivateStaffAccount(req.params.id);
      if (!staff) return res.status(404).json({ error: 'Account not found' });
      await logAction({ staffId: req.staff.id, action: 'staff_account.deactivated', entity: 'staff_accounts', entityId: staff.id, newValue: { email: staff.email } });
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

// Reactivate — always immediate. Restoring access is an addition, not a
// destructive action, so it stays outside the approval flow.
router.post('/:id/reactivate', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE staff_accounts SET is_active = true WHERE id = $1 RETURNING id, email, is_active`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });

    await logAction({ staffId: req.staff.id, action: 'staff_account.reactivated', entity: 'staff_accounts', entityId: rows[0].id, newValue: { email: rows[0].email } });

    res.json({ staff: rows[0] });
  } catch (err) {
    console.error('[staff-accounts:reactivate]', err);
    res.status(500).json({ error: 'Failed to reactivate account' });
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

    await logAction({ staffId: req.staff.id, action: 'staff_account.password_reset', entity: 'staff_accounts', entityId: rows[0].id });

    res.json({ staff: rows[0] });
  } catch (err) {
    console.error('[staff-accounts:reset-password]', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Change someone's role. Only owner can grant/revoke 'owner'; admin can
// change everything else. Kept immediate + audit-logged, not approval-gated —
// this is an edit, not a deletion, matching the "no approval needed for
// additions/edits" rule.
router.put('/:id/role', requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['owner', 'admin', 'hr', 'finance', 'manager', 'employee'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    if (role === 'owner' && req.staff.role !== 'owner') {
      return res.status(403).json({ error: 'Only an owner can grant owner-level access' });
    }
    if (req.params.id === req.staff.id) {
      return res.status(400).json({ error: "You can't change your own role" });
    }

    const { rows: [before] } = await safeQuery(`SELECT id, email, role FROM staff_accounts WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Account not found' });

    if (before.role === 'owner' && req.staff.role !== 'owner') {
      return res.status(403).json({ error: "Only an owner can change another owner's role" });
    }

    const { rows: [updated] } = await safeQuery(
      `UPDATE staff_accounts SET role = $1 WHERE id = $2 RETURNING id, email, role`,
      [role, req.params.id]
    );

    await logAction({
      staffId: req.staff.id, action: 'staff_account.role_changed', entity: 'staff_accounts', entityId: updated.id,
      oldValue: { role: before.role }, newValue: { role: updated.role },
    });

    res.json({ staff: updated });
  } catch (err) {
    console.error('[staff-accounts:role]', err);
    res.status(500).json({ error: 'Failed to change role' });
  }
});

// Link (or unlink) an existing login to an employee record — not destructive,
// stays immediate.
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