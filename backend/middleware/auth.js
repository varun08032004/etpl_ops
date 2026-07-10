'use strict';

const jwt = require('jsonwebtoken');
const { safeQuery } = require('../db/pool');

const JWT_SECRET = process.env.INTERNAL_OPS_JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('[internal-ops:auth] FATAL: INTERNAL_OPS_JWT_SECRET must be set in production');
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.internal_ops_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = jwt.verify(token, JWT_SECRET || 'dev-only-insecure-secret');

    const { rows } = await safeQuery(
      `SELECT id, email, role, employee_id, is_active FROM staff_accounts WHERE id = $1`,
      [decoded.sub]
    );
    const staff = rows[0];
    if (!staff || !staff.is_active) return res.status(401).json({ error: 'Account inactive or not found' });

    req.staff = staff; // { id, email, role, employee_id }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Usage: router.post('/x', authenticate, requireRole('admin', 'finance'), handler) */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.staff) return res.status(401).json({ error: 'Not authenticated' });
    // owner/admin can act as any role
    if (['owner', 'admin'].includes(req.staff.role) || allowedRoles.includes(req.staff.role)) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions for this action' });
  };
}

function signToken(staff) {
  return jwt.sign({ sub: staff.id, role: staff.role }, JWT_SECRET || 'dev-only-insecure-secret', {
    expiresIn: '8h',
  });
}

module.exports = { authenticate, requireRole, signToken };
