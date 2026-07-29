'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { safeQuery } = require('../db/pool');
const { signToken, authenticate } = require('../middleware/auth');
const { sendEmail, APP_BASE_URL } = require('../services/email');
const { logAction } = require('../services/auditLog');
const { hashToken, generateDeviceToken, generateOtp, ipAllowed } = require('../services/deviceSecurity');
const {
  encryptSecret, decryptSecret, generateSecret, generateQrCodeDataUrl,
  verifyTotp, generateBackupCodes, hashBackupCode,
} = require('../services/twoFactor');

const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60 * 1000; // ~13 months (Chrome's cookie cap)
const PENDING_DEVICE_COOKIE_MAX_AGE = 10 * 60 * 1000;

/**
 * Frontend (Vercel) and backend (Render) are different domains, so these
 * are cross-site requests from the browser's point of view. Cookies with
 * sameSite: 'lax' are NOT sent on cross-site fetch/XHR calls — only on
 * top-level navigations — so with 'lax' in production, trusted-device
 * recognition and cookie-based auth would silently never work; every
 * login would look like a brand-new device forever.
 *
 * sameSite: 'none' is required for cross-site cookies to be sent at all,
 * but browsers mandate 'secure: true' alongside it (cookie only sent over
 * HTTPS) — which is exactly what Vercel + Render give you by default, so
 * this is safe to require unconditionally in production.
 *
 * In local dev, frontend and backend are both on localhost (different
 * ports, same registrable domain) — browsers treat that as same-site, so
 * 'lax' still works there, and 'none' would additionally require HTTPS
 * locally which most dev setups don't have. Hence the split by NODE_ENV.
 */
function cookieOptions(maxAge) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    ...(maxAge ? { maxAge } : {}),
  };
}

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
    const { email, password, totpToken, backupCode } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { rows: [staff] } = await safeQuery(`SELECT * FROM staff_accounts WHERE email = $1`, [email.toLowerCase()]);
    if (!staff || !staff.is_active) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, staff.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // ── IP allow-list (opt-in per account) ──────────────────────────────
    if (staff.ip_allowlist_enabled) {
      const { rows: allowRows } = await safeQuery(
        `SELECT ip_or_cidr FROM login_ip_allowlist WHERE staff_account_id = $1`,
        [staff.id]
      );
      if (!ipAllowed(req.ip, allowRows.map((r) => r.ip_or_cidr))) {
        await logAction({
          staffId: staff.id, action: 'login.blocked_ip_not_allowlisted',
          entity: 'staff_accounts', entityId: staff.id, ipAddress: req.ip,
        });
        return res.status(403).json({ error: 'Login blocked: this network is not on the approved list for this account.' });
      }
    }

    // ── TOTP 2FA (opt-in per account) — checked BEFORE device-lock on
    // purpose: a stolen password alone is never enough, and a stolen
    // password + a stolen trusted-device cookie still isn't enough
    // either, since this runs first regardless of whether the device is
    // recognized. ─────────────────────────────────────────────────────
    if (staff.two_fa_enabled) {
      let valid = false;
      if (totpToken) {
        valid = verifyTotp(decryptSecret(staff.two_fa_secret), totpToken);
      } else if (backupCode) {
        const hash = hashBackupCode(backupCode);
        const { rows: [codeRow] } = await safeQuery(
          `SELECT id FROM two_fa_backup_codes WHERE staff_account_id = $1 AND code_hash = $2 AND used_at IS NULL`,
          [staff.id, hash]
        );
        if (codeRow) {
          valid = true;
          await safeQuery(`UPDATE two_fa_backup_codes SET used_at = NOW() WHERE id = $1`, [codeRow.id]);
          await logAction({ staffId: staff.id, action: '2fa.backup_code_used', entity: 'staff_accounts', entityId: staff.id, ipAddress: req.ip });
        }
      }

      if (!valid) {
        if (!totpToken && !backupCode) {
          return res.status(202).json({ twoFactorRequired: true, message: 'Enter your 6-digit authenticator code.' });
        }
        await logAction({ staffId: staff.id, action: 'login.blocked_bad_2fa_code', entity: 'staff_accounts', entityId: staff.id, ipAddress: req.ip });
        return res.status(401).json({ error: 'Invalid authenticator code' });
      }
    }

    // ── Trusted-device lock (opt-in per account) ────────────────────────
    if (staff.device_lock_enabled) {
      const cookieToken = req.cookies?.trusted_device_id;
      let known = null;
      if (cookieToken) {
        const { rows } = await safeQuery(
          `SELECT id FROM trusted_devices WHERE staff_account_id = $1 AND device_token_hash = $2 AND revoked_at IS NULL`,
          [staff.id, hashToken(cookieToken)]
        );
        known = rows[0] || null;
      }

      if (!known) {
        // Unrecognized browser/device — don't issue a session. Instead
        // send an OTP to the account's email and ask the caller to
        // confirm via /verify-device before we'll log them in here.
        const pendingToken = generateDeviceToken();
        const otp = generateOtp();
        await safeQuery(
          `INSERT INTO device_approval_requests (staff_account_id, device_token_hash, otp_hash, user_agent, request_ip, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [staff.id, hashToken(pendingToken), hashToken(otp), req.headers['user-agent'] || null, req.ip, new Date(Date.now() + 10 * 60 * 1000)]
        );
        await sendEmail({
          to: staff.email,
          subject: 'Approve new device — EtherTrack ERP',
          html: `
            <div style="font-family:sans-serif">
              <p>A sign-in attempt was made on your EtherTrack account from a browser/device we don't recognize.</p>
              <p>Approval code: <b style="font-size:20px;letter-spacing:2px">${otp}</b></p>
              <p>This code expires in 10 minutes. Enter it where you're signing in to approve this device.</p>
              <p style="color:#666;font-size:12px">If this wasn't you, change your password immediately — do not share this code with anyone.</p>
            </div>
          `,
        });
        await logAction({
          staffId: staff.id, action: 'login.new_device_otp_sent',
          entity: 'staff_accounts', entityId: staff.id, ipAddress: req.ip,
        });
        res.cookie('pending_device_id', pendingToken, cookieOptions(PENDING_DEVICE_COOKIE_MAX_AGE));
        return res.status(202).json({
          deviceApprovalRequired: true,
          message: 'New device detected. Enter the approval code sent to your email to finish signing in.',
        });
      }

      await safeQuery(
        `UPDATE trusted_devices SET last_seen_at = NOW() WHERE staff_account_id = $1 AND device_token_hash = $2`,
        [staff.id, hashToken(cookieToken)]
      );
    }

    const token = signToken(staff);
    await safeQuery(`UPDATE staff_accounts SET last_login = NOW() WHERE id = $1`, [staff.id]);

    res.cookie('internal_ops_token', token, cookieOptions(8 * 60 * 60 * 1000));
    res.json({ token, staff: { id: staff.id, email: staff.email, role: staff.role, employee_id: staff.employee_id } });
  } catch (err) {
    console.error('[auth:login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, (req, res) => res.json({ staff: req.staff }));

router.post('/logout', (req, res) => {
  res.clearCookie('internal_ops_token', cookieOptions());
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

// ── verify-device — completes the OTP challenge from /login when a
// device-locked account signs in from an unrecognized browser. On
// success this issues the normal session AND marks the device trusted
// so future logins from this browser skip the OTP step. ────────────────
router.post('/verify-device', authRateLimit, async (req, res) => {
  try {
    const { email, otp, label } = req.body;
    const pendingToken = req.cookies?.pending_device_id;
    if (!email || !otp || !pendingToken) {
      return res.status(400).json({ error: 'Missing approval code or device session — please try logging in again.' });
    }

    const { rows: [staff] } = await safeQuery(`SELECT * FROM staff_accounts WHERE email = $1`, [email.toLowerCase()]);
    if (!staff) return res.status(400).json({ error: 'Approval request expired or not found — please log in again.' });

    const deviceTokenHash = hashToken(pendingToken);
    const { rows: [reqRow] } = await safeQuery(
      `SELECT * FROM device_approval_requests
       WHERE staff_account_id = $1 AND device_token_hash = $2 AND verified_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [staff.id, deviceTokenHash]
    );
    if (!reqRow) return res.status(400).json({ error: 'Approval request expired or not found — please log in again.' });
    if (reqRow.attempts >= 5) return res.status(429).json({ error: 'Too many incorrect attempts — request a new code by logging in again.' });

    if (reqRow.otp_hash !== hashToken(otp)) {
      await safeQuery(`UPDATE device_approval_requests SET attempts = attempts + 1 WHERE id = $1`, [reqRow.id]);
      return res.status(400).json({ error: 'Incorrect code' });
    }

    await safeQuery(`UPDATE device_approval_requests SET verified_at = NOW() WHERE id = $1`, [reqRow.id]);
    await safeQuery(
      `INSERT INTO trusted_devices (staff_account_id, device_token_hash, label, user_agent, approved_ip)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (staff_account_id, device_token_hash) DO UPDATE SET revoked_at = NULL, last_seen_at = NOW()`,
      [staff.id, deviceTokenHash, label || null, req.headers['user-agent'] || null, req.ip]
    );

    const token = signToken(staff);
    await safeQuery(`UPDATE staff_accounts SET last_login = NOW() WHERE id = $1`, [staff.id]);
    await logAction({ staffId: staff.id, action: 'login.device_approved', entity: 'staff_accounts', entityId: staff.id, ipAddress: req.ip });

    res.cookie('internal_ops_token', token, cookieOptions(8 * 60 * 60 * 1000));
    res.cookie('trusted_device_id', pendingToken, cookieOptions(DEVICE_COOKIE_MAX_AGE));
    res.clearCookie('pending_device_id', cookieOptions());
    res.json({ token, staff: { id: staff.id, email: staff.email, role: staff.role, employee_id: staff.employee_id } });
  } catch (err) {
    console.error('[auth:verify-device]', err);
    res.status(500).json({ error: 'Device verification failed' });
  }
});

// ── 2FA: setup — generates a new secret and QR code but does NOT enable
// 2FA yet. Enabling happens in /2fa/confirm once the caller proves they
// can actually generate a valid code, so a typo'd/mis-scanned setup can
// never accidentally lock the account out. ─────────────────────────────
router.post('/2fa/setup', authenticate, async (req, res) => {
  try {
    const secret = generateSecret(req.staff.email);
    const qrCodeDataUrl = await generateQrCodeDataUrl(secret.otpauth_url);

    // Stored immediately (encrypted) so /2fa/confirm can verify against
    // it, but two_fa_enabled stays false until confirm succeeds.
    await safeQuery(
      `UPDATE staff_accounts SET two_fa_secret = $1, two_fa_enabled = false WHERE id = $2`,
      [encryptSecret(secret.base32), req.staff.id]
    );

    res.json({ qrCodeDataUrl, manualEntryKey: secret.base32 });
  } catch (err) {
    console.error('[auth:2fa:setup]', err);
    res.status(500).json({ error: 'Failed to start 2FA setup' });
  }
});

// ── 2FA: confirm — proves the caller's authenticator app is actually
// working, turns 2FA on, and issues one-time backup codes. Codes are
// shown ONCE here — only their hashes are stored, so if you navigate
// away without saving them, they cannot be recovered, only regenerated
// (which invalidates the old set). ──────────────────────────────────────
router.post('/2fa/confirm', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    const { rows: [staff] } = await safeQuery(`SELECT two_fa_secret FROM staff_accounts WHERE id = $1`, [req.staff.id]);
    if (!staff?.two_fa_secret) return res.status(400).json({ error: 'Call /2fa/setup first' });

    if (!verifyTotp(decryptSecret(staff.two_fa_secret), token)) {
      return res.status(400).json({ error: 'Incorrect code — check the time on your phone and try again' });
    }

    await safeQuery(`UPDATE staff_accounts SET two_fa_enabled = true WHERE id = $1`, [req.staff.id]);

    // Fresh backup codes replace any old ones every time 2FA is (re)confirmed.
    await safeQuery(`DELETE FROM two_fa_backup_codes WHERE staff_account_id = $1`, [req.staff.id]);
    const codes = generateBackupCodes(8);
    for (const code of codes) {
      await safeQuery(
        `INSERT INTO two_fa_backup_codes (staff_account_id, code_hash) VALUES ($1,$2)`,
        [req.staff.id, hashBackupCode(code)]
      );
    }

    await logAction({ staffId: req.staff.id, action: '2fa.enabled', entity: 'staff_accounts', entityId: req.staff.id, ipAddress: req.ip });
    res.json({ ok: true, backupCodes: codes });
  } catch (err) {
    console.error('[auth:2fa:confirm]', err);
    res.status(500).json({ error: 'Failed to confirm 2FA' });
  }
});

router.get('/2fa/status', authenticate, (req, res) => {
  res.json({ enabled: !!req.staff.two_fa_enabled });
});

// ── 2FA: disable — requires the CURRENT password plus a still-valid TOTP
// code, so a hijacked logged-in session (e.g. an unattended laptop) can't
// silently turn 2FA off on its own — the attacker would need to also
// know the password. ─────────────────────────────────────────────────
router.post('/2fa/disable', authenticate, async (req, res) => {
  try {
    const { password, token } = req.body;
    if (!password || !token) return res.status(400).json({ error: 'password and token are required' });

    const { rows: [staff] } = await safeQuery(`SELECT password_hash, two_fa_secret FROM staff_accounts WHERE id = $1`, [req.staff.id]);
    const passwordOk = await bcrypt.compare(password, staff.password_hash);
    if (!passwordOk) return res.status(401).json({ error: 'Incorrect password' });

    if (!staff.two_fa_secret || !verifyTotp(decryptSecret(staff.two_fa_secret), token)) {
      return res.status(400).json({ error: 'Incorrect authenticator code' });
    }

    await safeQuery(`UPDATE staff_accounts SET two_fa_enabled = false, two_fa_secret = NULL WHERE id = $1`, [req.staff.id]);
    await safeQuery(`DELETE FROM two_fa_backup_codes WHERE staff_account_id = $1`, [req.staff.id]);
    await logAction({ staffId: req.staff.id, action: '2fa.disabled', entity: 'staff_accounts', entityId: req.staff.id, ipAddress: req.ip });

    res.json({ ok: true });
  } catch (err) {
    console.error('[auth:2fa:disable]', err);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// ── security settings — self-service only; every route here reads/writes
// req.staff's OWN account (from the authenticated JWT), never an id from
// the request body, so one account can't lock or unlock another's login. ─
router.get('/security-settings', authenticate, async (req, res) => {
  try {
    const { rows: devices } = await safeQuery(
      `SELECT id, label, user_agent, approved_ip, approved_at, last_seen_at, revoked_at
       FROM trusted_devices WHERE staff_account_id = $1 ORDER BY last_seen_at DESC`,
      [req.staff.id]
    );
    const { rows: ips } = await safeQuery(
      `SELECT id, ip_or_cidr, label, created_at FROM login_ip_allowlist WHERE staff_account_id = $1 ORDER BY created_at DESC`,
      [req.staff.id]
    );
    res.json({
      deviceLockEnabled: req.staff.device_lock_enabled,
      ipAllowlistEnabled: req.staff.ip_allowlist_enabled,
      devices,
      ipAllowlist: ips,
    });
  } catch (err) {
    console.error('[auth:security-settings:get]', err);
    res.status(500).json({ error: 'Failed to load security settings' });
  }
});

router.patch('/security-settings', authenticate, async (req, res) => {
  try {
    const { deviceLockEnabled, ipAllowlistEnabled } = req.body;

    // Guard rail: if turning on IP allow-listing, require at least one
    // entry already saved — otherwise the very next login (including
    // this one, from a different network tomorrow) locks the account out.
    if (ipAllowlistEnabled === true) {
      const { rows } = await safeQuery(`SELECT 1 FROM login_ip_allowlist WHERE staff_account_id = $1 LIMIT 1`, [req.staff.id]);
      if (rows.length === 0) {
        return res.status(400).json({ error: 'Add at least one IP/CIDR to your allow-list before enabling it.' });
      }
    }
    // Same guard for device lock — approve the current device first (via
    // /verify-device) so you don't lock yourself out of your only session.
    if (deviceLockEnabled === true) {
      const { rows } = await safeQuery(`SELECT 1 FROM trusted_devices WHERE staff_account_id = $1 AND revoked_at IS NULL LIMIT 1`, [req.staff.id]);
      if (rows.length === 0 && !req.cookies?.trusted_device_id) {
        return res.status(400).json({ error: 'Approve at least one device before enabling device lock — log out and back in to trigger approval.' });
      }
    }

    const fields = [];
    const values = [];
    if (typeof deviceLockEnabled === 'boolean') { fields.push(`device_lock_enabled = $${fields.length + 1}`); values.push(deviceLockEnabled); }
    if (typeof ipAllowlistEnabled === 'boolean') { fields.push(`ip_allowlist_enabled = $${fields.length + 1}`); values.push(ipAllowlistEnabled); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.staff.id);
    await safeQuery(`UPDATE staff_accounts SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
    await logAction({ staffId: req.staff.id, action: 'security_settings.updated', entity: 'staff_accounts', entityId: req.staff.id, newValue: req.body, ipAddress: req.ip });

    res.json({ ok: true });
  } catch (err) {
    console.error('[auth:security-settings:patch]', err);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
});

router.post('/ip-allowlist', authenticate, async (req, res) => {
  try {
    const { ipOrCidr, label } = req.body;
    if (!ipOrCidr) return res.status(400).json({ error: 'ipOrCidr is required' });
    const { rows: [entry] } = await safeQuery(
      `INSERT INTO login_ip_allowlist (staff_account_id, ip_or_cidr, label) VALUES ($1,$2,$3) RETURNING *`,
      [req.staff.id, ipOrCidr.trim(), label || null]
    );
    await logAction({ staffId: req.staff.id, action: 'ip_allowlist.added', entity: 'login_ip_allowlist', entityId: entry.id, newValue: entry, ipAddress: req.ip });
    res.status(201).json({ entry });
  } catch (err) {
    console.error('[auth:ip-allowlist:post]', err);
    res.status(500).json({ error: 'Failed to add IP' });
  }
});

router.delete('/ip-allowlist/:id', authenticate, async (req, res) => {
  try {
    await safeQuery(`DELETE FROM login_ip_allowlist WHERE id = $1 AND staff_account_id = $2`, [req.params.id, req.staff.id]);
    await logAction({ staffId: req.staff.id, action: 'ip_allowlist.removed', entity: 'login_ip_allowlist', entityId: req.params.id, ipAddress: req.ip });
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth:ip-allowlist:delete]', err);
    res.status(500).json({ error: 'Failed to remove IP' });
  }
});

router.delete('/trusted-devices/:id', authenticate, async (req, res) => {
  try {
    await safeQuery(
      `UPDATE trusted_devices SET revoked_at = NOW() WHERE id = $1 AND staff_account_id = $2`,
      [req.params.id, req.staff.id]
    );
    await logAction({ staffId: req.staff.id, action: 'trusted_device.revoked', entity: 'trusted_devices', entityId: req.params.id, ipAddress: req.ip });
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth:trusted-devices:delete]', err);
    res.status(500).json({ error: 'Failed to revoke device' });
  }
});

module.exports = router;