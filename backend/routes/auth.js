'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { safeQuery } = require('../db/pool');
const { signToken, authenticate } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { rows: [staff] } = await safeQuery(`SELECT * FROM staff_accounts WHERE email = $1`, [email.toLowerCase()]);
    console.log('DEBUG staff found:', staff ? { id: staff.id, email: staff.email, is_active: staff.is_active, hash: staff.password_hash } : null);
    if (!staff || !staff.is_active) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, staff.password_hash);
    console.log('DEBUG bcrypt.compare result:', ok);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(staff);
    await safeQuery(`UPDATE staff_accounts SET last_login = NOW() WHERE id = $1`, [staff.id]);

    res.cookie('internal_ops_token', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000,
    });
    res.json({ token, staff: { id: staff.id, email: staff.email, role: staff.role, employee_id: staff.employee_id } });
  } catch (err) {
    console.error('[auth:login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, (req, res) => res.json({ staff: req.staff }));

router.post('/logout', (req, res) => {
  res.clearCookie('internal_ops_token');
  res.json({ ok: true });
});

// One-time bootstrap: create the first owner account. Disable/remove this route after first use.
router.post('/bootstrap-owner', async (req, res) => {
  try {
    if (process.env.ALLOW_BOOTSTRAP !== 'true') {
      return res.status(403).json({ error: 'Bootstrap disabled. Set ALLOW_BOOTSTRAP=true temporarily to use this once.' });
    }
    const { email, password } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'email and password (min 8 chars) required' });
    }
    const { rows: existing } = await safeQuery(`SELECT id FROM staff_accounts WHERE role = 'owner'`);
    if (existing.length) return res.status(409).json({ error: 'An owner account already exists' });

    const hash = await bcrypt.hash(password, 12);
    const { rows: [staff] } = await safeQuery(
      `INSERT INTO staff_accounts (email, password_hash, role) VALUES ($1,$2,'owner') RETURNING id, email, role`,
      [email.toLowerCase(), hash]
    );
    res.status(201).json({ staff });
  } catch (err) {
    console.error('[auth:bootstrap]', err);
    res.status(500).json({ error: 'Bootstrap failed' });
  }
});

module.exports = router;