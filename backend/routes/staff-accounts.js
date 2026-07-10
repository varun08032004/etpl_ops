'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

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
    res.status(201).json({ staff });
  } catch (err) {
    console.error('[staff-accounts:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    res.status(500).json({ error: 'Failed to create staff account' });
  }
});

// Deactivate a login (never hard-delete — keeps audit trail on who-did-what intact)
router.post('/:id/deactivate', requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.staff.id) {
      return res.status(400).json({ error: "You can't deactivate your own account" });
    }
    const { rows } = await safeQuery(
      `UPDATE staff_accounts SET is_active = false WHERE id = $1 RETURNING id, email, is_active`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });
    res.json({ staff: rows[0] });
  } catch (err) {
    console.error('[staff-accounts:deactivate]', err);
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

// Reactivate
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

module.exports = router;
