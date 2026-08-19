'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { safeQuery, withTransaction } = require('../db/pool');
const { getMyDepartmentAccess } = require('../services/departmentAccess');

const JWT_SECRET = process.env.INTERNAL_OPS_JWT_SECRET;
const REFRESH_SECRET = process.env.INTERNAL_OPS_REFRESH_SECRET || JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('[internal-ops:auth] FATAL: INTERNAL_OPS_JWT_SECRET must be set in production');
}

// Token expiry configuration
const ACCESS_TOKEN_EXPIRY = '30m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(maxAge) {
  const isProd = process.env.NODE_ENV === 'production';
  // In development (localhost), use lax + non-secure for cookies to work
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  return {
    httpOnly: true,
    secure: isProd && !isDev,  // Secure only in production
    sameSite: isProd && !isDev ? 'none' : 'lax',  // 'none' only with secure in prod
    ...(maxAge ? { maxAge } : {}),
  };
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.internal_ops_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'NO_TOKEN' });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET || 'dev-only-insecure-secret');
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }

  try {
    const { rows } = await safeQuery(
      `SELECT id, email, role, employee_id, is_active, ai_access_level FROM staff_accounts WHERE id = $1`,
      [decoded.sub]
    );
    const staff = rows[0];
    if (!staff || !staff.is_active) return res.status(401).json({ error: 'Account inactive or not found' });

    const deptAccess = await getMyDepartmentAccess(staff);
    staff.effectiveRoles = deptAccess.grantedRoles;
    staff.deptAccess = deptAccess;

    req.staff = staff;
    next();
  } catch (err) {
    console.error('[auth] DB/downstream error during authenticate (token was valid):', err.message);
    return res.status(503).json({ error: 'Temporarily unavailable — please retry.' });
  }
}

function signAccessToken(staff) {
  return jwt.sign({ sub: staff.id, role: staff.role }, JWT_SECRET || 'dev-only-insecure-secret', {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function signRefreshToken(staff) {
  return jwt.sign({ sub: staff.id, type: 'refresh' }, REFRESH_SECRET || 'dev-only-insecure-secret', {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

async function storeRefreshToken(staffId, token, userAgent, ip) {
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_COOKIE_MAX_AGE);
  await safeQuery(
    `INSERT INTO refresh_tokens (staff_account_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [staffId, tokenHash, userAgent || null, ip || null, expiresAt]
  );
}

async function revokeRefreshToken(staffId, tokenHash) {
  await safeQuery(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE staff_account_id = $1 AND token_hash = $2`,
    [staffId, tokenHash]
  );
}

async function revokeAllRefreshTokens(staffId) {
  await safeQuery(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE staff_account_id = $1 AND revoked_at IS NULL`,
    [staffId]
  );
}

async function enforceSessionLimit(staffId, maxSessions = 5) {
  const limit = parseInt(process.env.MAX_CONCURRENT_SESSIONS || String(maxSessions), 10);
  const { rows } = await safeQuery(
    `SELECT COUNT(*) AS count FROM refresh_tokens WHERE staff_account_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [staffId]
  );
  const currentCount = parseInt(rows[0].count, 10);
  if (currentCount >= limit) {
    // Revoke oldest sessions to make room
    const excess = currentCount - limit + 1;
    await safeQuery(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE staff_account_id = $1 AND revoked_at IS NULL
       AND created_at = (
         SELECT created_at FROM refresh_tokens
         WHERE staff_account_id = $1 AND revoked_at IS NULL
         ORDER BY created_at ASC
         LIMIT 1
       )`,
      [staffId]
    );
  }
}

async function validateRefreshToken(token) {
  const tokenHash = hashRefreshToken(token);
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET || 'dev-only-insecure-secret');
    const { rows } = await safeQuery(
      `SELECT rt.*, sa.is_active FROM refresh_tokens rt
       JOIN staff_accounts sa ON sa.id = rt.staff_account_id
       WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
      [tokenHash]
    );
    if (!rows.length || !rows[0].is_active) return null;
    return { staffId: decoded.sub, tokenHash, staff: rows[0] };
  } catch {
    return null;
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.staff) return res.status(401).json({ error: 'Not authenticated' });
    const effectiveRoles = req.staff.effectiveRoles || [];
    if (
      ['owner', 'admin'].includes(req.staff.role) ||
      allowedRoles.includes(req.staff.role) ||
      allowedRoles.some((r) => effectiveRoles.includes(r))
    ) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions for this action' });
  };
}

function requireDepartmentHead(...departmentNames) {
  return async (req, res, next) => {
    if (!req.staff) return res.status(401).json({ error: 'Not authenticated' });
    if (['owner', 'admin'].includes(req.staff.role)) return next();

    if (!req.staff.employee_id) {
      return res.status(403).json({ error: 'No linked employee record for this account' });
    }

    try {
      const { rows } = await safeQuery(
        `SELECT 1 FROM departments WHERE name = ANY($1) AND head_employee_id = $2`,
        [departmentNames, req.staff.employee_id]
      );
      if (rows.length) return next();
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    } catch (err) {
      console.error('[auth:requireDepartmentHead]', err);
      return res.status(500).json({ error: 'Failed to verify department headship' });
    }
  };
}

module.exports = {
  authenticate,
  requireRole,
  requireDepartmentHead,
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  validateRefreshToken,
  enforceSessionLimit,
  cookieOptions,
  hashRefreshToken,
};