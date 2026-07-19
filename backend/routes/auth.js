'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { safeQuery } = require('../db/pool');
const { signToken, authenticate } = require('../middleware/auth');
const { sendEmail, APP_BASE_URL } = require('../services/email');

// Login and forgot-password get a much tighter limit than the app-wide one
// in server.js — these are the two routes credential-stuffing / enumeration
// attacks actually target. 20 attempts / 15 min / IP is generous for a real
// user who fat-fingers a password a few times, punishing for a brute-force
// script.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please wait a few minutes and try again.' },
});

router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { rows: [staff] } = await safeQuery(`SELECT * FROM staff_accounts WHERE email = $1`, [email.toLowerCase()]);
    if (!staff || !staff.is_active) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, staff.password_hash);
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

// ── forgot password — always responds the same way whether or not the email
// exists, so this can't be used to enumerate valid accounts. Token is a
// random 32-byte value; only its SHA-256 hash is stored, so a DB leak alone
// can't be used to reset anyone's password. Expires in 15 minutes. ─────────
router.post('/forgot-password', authRateLimit, async (req, res) => {
  const genericResponse = { message: 'If that email is registered, a password reset link has been sent to it.' };
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const { rows: [account] } = await safeQuery(
      `SELECT id, email FROM staff_accounts WHERE email = $1 AND is_active = true`,
      [email.toLowerCase()]
    );

    if (account) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await safeQuery(
        `INSERT INTO password_reset_tokens (staff_account_id, token_hash, expires_at, requested_ip)
         VALUES ($1,$2,$3,$4)`,
        [account.id, tokenHash, expiresAt.toISOString(), req.ip || null]
      );

      const resetUrl = `${APP_BASE_URL}/reset-password?token=${rawToken}`;
      await sendEmail({
        to: account.email,
        subject: 'Reset your EtherTrack password',
        html: `
          <div style="font-family:sans-serif">
            <p>Someone (hopefully you) requested a password reset for your EtherTrack account.</p>
            <p><a href="${resetUrl}">Click here to set a new password</a> — this link expires in 15 minutes.</p>
            <p style="color:#666;font-size:12px">If you didn't request this, you can safely ignore this email — your password won't change unless you click the link above and set a new one.</p>
          </div>
        `,
      });
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('[auth:forgot-password]', err);
    // Still return the generic message — don't leak whether something broke
    // vs. the email just not existing.
    res.json(genericResponse);
  }
});

// ── reset password — consumes the token, sets the new password, and
// invalidates every other outstanding reset token for that account so an
// old, forgotten link can't be replayed after a successful reset. ──────────
router.post('/reset-password', authRateLimit, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows: [resetRow] } = await safeQuery(
      `SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash]
    );
    if (!resetRow) return res.status(400).json({ error: 'This reset link is invalid or has expired — request a new one.' });

    const hash = await bcrypt.hash(password, 12);
    await safeQuery(`UPDATE staff_accounts SET password_hash = $1 WHERE id = $2`, [hash, resetRow.staff_account_id]);
    // Kill every pending reset link for this account, not just the one used —
    // if several were requested, none of the others should stay usable.
    await safeQuery(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE staff_account_id = $1 AND used_at IS NULL`,
      [resetRow.staff_account_id]
    );

    res.json({ message: 'Password updated — you can now sign in with your new password.' });
  } catch (err) {
    console.error('[auth:reset-password]', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
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