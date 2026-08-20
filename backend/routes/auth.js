'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { safeQuery } = require('../db/pool');
const {
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  revokeAllRefreshTokens,
  validateRefreshToken,
  revokeRefreshToken,
  enforceSessionLimit,
  cookieOptions,
  authenticate,
} = require('../middleware/auth');
const { sendEmail, APP_BASE_URL } = require('../services/email');
const { logAction } = require('../services/auditLog');
const { hashToken, generateDeviceToken, generateOtp, ipAllowed } = require('../services/deviceSecurity');
const {
  encryptSecret, decryptSecret, generateSecret, generateQrCodeDataUrl,
  verifyTotp, generateBackupCodes, hashBackupCode,
} = require('../services/twoFactor');
const { validateBody } = require('../middleware/validation');
const { z } = require('zod');

const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60 * 1000; // ~13 months (Chrome's cookie cap)
const PENDING_DEVICE_COOKIE_MAX_AGE = 10 * 60 * 1000;

const ACCESS_COOKIE_MAX_AGE = 30 * 60 * 1000; // 30 minutes
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Validation schemas
const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }).toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  totpToken: z.string().length(6).optional(),
  backupCode: z.string().optional(),
});

const verifyDeviceSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }).toLowerCase(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  label: z.string().max(100).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }).toLowerCase(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const securitySettingsSchema = z.object({
  deviceLockEnabled: z.boolean().optional(),
  ipAllowlistEnabled: z.boolean().optional(),
}).refine((data) => data.deviceLockEnabled !== undefined || data.ipAllowlistEnabled !== undefined, {
  message: 'At least one setting must be provided',
});

const ipAllowlistSchema = z.object({
  ipOrCidr: z.string().min(1, 'IP/CIDR is required'),
  label: z.string().max(100).optional(),
});

const bootstrapSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }).toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const twoFaConfirmSchema = z.object({
  token: z.string().length(6, 'TOTP code must be 6 digits'),
});

const twoFaDisableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  token: z.string().length(6, 'TOTP code must be 6 digits'),
});

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

router.post('/login', authRateLimit, validateBody(loginSchema), async (req, res) => {
  console.log('[auth:login] Request body:', { email: req.body?.email, hasPassword: !!req.body?.password });
  try {
    const { email, password, totpToken, backupCode } = req.body;

    const { rows: [staff] } = await safeQuery(`SELECT * FROM staff_accounts WHERE email = $1`, [email.toLowerCase()]);
    console.log('[auth:login] Staff found:', !!staff, 'active:', staff?.is_active);
    if (!staff || !staff.is_active) {
      // Record failed attempt for non-existent/inactive accounts (to prevent enumeration)
      await safeQuery(
        `INSERT INTO failed_login_attempts (staff_account_id, ip_address, user_agent, success)
         VALUES ($1, $2, $3, FALSE)
         ON CONFLICT DO NOTHING`,
        [staff?.id || '00000000-0000-0000-0000-000000000000', req.ip, req.headers['user-agent'] || null]
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ── Brute-force protection: check for account lockout ────────────────────
    const lockoutConfig = {
      maxAttempts: 5,
      lockoutMinutes: 30,
      windowMinutes: 15,
    };
    const { rows: [lockout] } = await safeQuery(
      `SELECT lockout_until FROM failed_login_attempts
       WHERE staff_account_id = $1 AND lockout_until > NOW()
       ORDER BY lockout_until DESC LIMIT 1`,
      [staff.id]
    );
    if (lockout) {
      await logAction({
        staffId: staff.id, action: 'login.blocked_account_locked',
        entity: 'staff_accounts', entityId: staff.id, ipAddress: req.ip,
      });
      const minsLeft = Math.ceil((new Date(lockout.lockout_until) - Date.now()) / 60000);
      return res.status(429).json({ error: `Account temporarily locked. Try again in ${minsLeft} minutes.` });
    }

    // Check recent failed attempts
    const { rows: [recentFails] } = await safeQuery(
      `SELECT COUNT(*) AS count FROM failed_login_attempts
       WHERE staff_account_id = $1 AND attempt_time > NOW() - INTERVAL '${lockoutConfig.windowMinutes} minutes' AND success = FALSE`,
      [staff.id]
    );
    if (parseInt(recentFails.count, 10) >= lockoutConfig.maxAttempts) {
      const lockoutUntil = new Date(Date.now() + lockoutConfig.lockoutMinutes * 60000);
      await safeQuery(
        `INSERT INTO failed_login_attempts (staff_account_id, ip_address, user_agent, success, lockout_until)
         VALUES ($1, $2, $3, FALSE, $4)`,
        [staff.id, req.ip, req.headers['user-agent'] || null, lockoutUntil]
      );
      await logAction({
        staffId: staff.id, action: 'login.account_locked_brute_force',
        entity: 'staff_accounts', entityId: staff.id, ipAddress: req.ip,
      });
      return res.status(429).json({ error: `Too many failed attempts. Account locked for ${lockoutConfig.lockoutMinutes} minutes.` });
    }

    console.log('[auth:login] Password hash:', staff.password_hash.substring(0, 20) + '...');
    const ok = await bcrypt.compare(password, staff.password_hash);
    console.log('[auth:login] bcrypt.compare result:', ok);
    if (!ok) {
      // Record failed attempt
      await safeQuery(
        `INSERT INTO failed_login_attempts (staff_account_id, ip_address, user_agent, success)
         VALUES ($1, $2, $3, FALSE)`,
        [staff.id, req.ip, req.headers['user-agent'] || null]
      );
      await logAction({
        staffId: staff.id, action: 'login.failed_password',
        entity: 'staff_accounts', entityId: staff.id, ipAddress: req.ip,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Success — clear failed attempts
    await safeQuery(
      `UPDATE failed_login_attempts SET success = TRUE WHERE staff_account_id = $1 AND success = FALSE`,
      [staff.id]
    );

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

    console.log('[auth:login] Generating tokens...');
    const accessToken = signAccessToken(staff);
    console.log('[auth:login] Access token generated');
    const refreshToken = signRefreshToken(staff);
    console.log('[auth:login] Refresh token generated');
    await enforceSessionLimit(staff.id);
    console.log('[auth:login] Session limit enforced');
    await storeRefreshToken(staff.id, refreshToken, req.headers['user-agent'] || null, req.ip);
    console.log('[auth:login] Refresh token stored');
    await safeQuery(`UPDATE staff_accounts SET last_login = NOW() WHERE id = $1`, [staff.id]);
    console.log('[auth:login] Last login updated');

    res.cookie('internal_ops_token', accessToken, cookieOptions(ACCESS_COOKIE_MAX_AGE));
    console.log('[auth:login] Access token cookie set');
    res.cookie('internal_ops_refresh', refreshToken, cookieOptions(REFRESH_COOKIE_MAX_AGE));
    console.log('[auth:login] Refresh token cookie set');
    // Also return access token in body for Bearer token auth (works when cookies blocked)
    res.json({ 
      accessToken, 
      staff: { id: staff.id, email: staff.email, role: staff.role, employee_id: staff.employee_id } 
    });
    console.log('[auth:login] Response sent successfully');
  } catch (err) {
    console.error('[auth:login]', err);
    res.status(500).json({ error: 'Login failed', details: err.message, stack: err.stack });
  }
});

router.post('/verify-device', authRateLimit, validateBody(verifyDeviceSchema), async (req, res) => {
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

    const accessToken = signAccessToken(staff);
    const refreshToken = signRefreshToken(staff);
    await enforceSessionLimit(staff.id);
    await storeRefreshToken(staff.id, refreshToken, req.headers['user-agent'] || null, req.ip);
    await safeQuery(`UPDATE staff_accounts SET last_login = NOW() WHERE id = $1`, [staff.id]);
    await logAction({ staffId: staff.id, action: 'login.device_approved', entity: 'staff_accounts', entityId: staff.id, ipAddress: req.ip });

    res.cookie('internal_ops_token', accessToken, cookieOptions(ACCESS_COOKIE_MAX_AGE));
    res.cookie('internal_ops_refresh', refreshToken, cookieOptions(REFRESH_COOKIE_MAX_AGE));
    res.cookie('trusted_device_id', pendingToken, cookieOptions(DEVICE_COOKIE_MAX_AGE));
    res.clearCookie('pending_device_id', cookieOptions());
    res.json({ 
      accessToken, 
      staff: { id: staff.id, email: staff.email, role: staff.role, employee_id: staff.employee_id } 
    });
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

    await logAuthEvent({ event: 'two_fa_setup', staffId: req.staff.id, ipAddress: req.ip, requestId: req.id });

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
router.post('/2fa/confirm', authenticate, validateBody(twoFaConfirmSchema), async (req, res) => {
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

    await logAuthEvent({ event: 'two_fa_enable', staffId: req.staff.id, ipAddress: req.ip, requestId: req.id });
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
router.post('/2fa/disable', authenticate, validateBody(twoFaDisableSchema), async (req, res) => {
  try {
    const { password, token } = req.body;

    const { rows: [staff] } = await safeQuery(`SELECT password_hash, two_fa_secret FROM staff_accounts WHERE id = $1`, [req.staff.id]);
    const passwordOk = await bcrypt.compare(password, staff.password_hash);
    if (!passwordOk) return res.status(401).json({ error: 'Incorrect password' });

    if (!staff.two_fa_secret || !verifyTotp(decryptSecret(staff.two_fa_secret), token)) {
      return res.status(400).json({ error: 'Incorrect authenticator code' });
    }

    await safeQuery(`UPDATE staff_accounts SET two_fa_enabled = false, two_fa_secret = NULL WHERE id = $1`, [req.staff.id]);
    await safeQuery(`DELETE FROM two_fa_backup_codes WHERE staff_account_id = $1`, [req.staff.id]);
    await logAuthEvent({ event: 'two_fa_disable', staffId: req.staff.id, ipAddress: req.ip, requestId: req.id });

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

router.patch('/security-settings', authenticate, validateBody(securitySettingsSchema), async (req, res) => {
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

router.post('/ip-allowlist', authenticate, validateBody(ipAllowlistSchema), async (req, res) => {
  try {
    const { ipOrCidr, label } = req.body;
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

router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows: [staff] } = await safeQuery(
      `SELECT sa.id, sa.email, sa.role, sa.employee_id, sa.two_fa_enabled, sa.last_login, sa.created_at,
              e.full_name, e.department_id,
              d.name as department_name
       FROM staff_accounts sa
       LEFT JOIN employees e ON e.id = sa.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE sa.id = $1`,
      [req.staff.id]
    );
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    res.json({
      id: staff.id,
      email: staff.email,
      fullName: staff.full_name,
      role: staff.role,
      employeeId: staff.employee_id,
      departmentId: staff.department_id,
      department: staff.department_name,
      avatarUrl: null,
      twoFactorEnabled: staff.two_fa_enabled,
      lastLogin: staff.last_login,
      createdAt: staff.created_at,
      effectiveRoles: req.staff.effectiveRoles || [],
      deptAccess: req.staff.deptAccess || {}
    });
  } catch (err) {
    console.error('[auth:me] ERROR:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

module.exports = router;