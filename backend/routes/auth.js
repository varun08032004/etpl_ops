'use strict';

const jwt = require('jsonwebtoken');
const { safeQuery } = require('../db/pool');
const { getMyDepartmentAccess } = require('../services/departmentAccess');

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

    // Layer on whatever roles their department grants (e.g. an 'employee'
    // login in a department with granted_roles=['finance'] picks up every
    // requireRole('finance') gate automatically) — see services/
    // departmentAccess.js. This is separate from requireDepartmentHead below,
    // which checks actual headship of a named department, not role-granting.
    const deptAccess = await getMyDepartmentAccess(staff);
    staff.effectiveRoles = deptAccess.grantedRoles;
    staff.deptAccess = deptAccess;

    req.staff = staff; // { id, email, role, employee_id, effectiveRoles, deptAccess }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Usage: router.post('/x', authenticate, requireRole('admin', 'finance'), handler)
 * Passes if: caller is owner/admin, OR their real login role is in allowedRoles,
 * OR one of their department-granted roles (req.staff.effectiveRoles) is in
 * allowedRoles. requireRole() with NO arguments still means "owner/admin
 * only" — an empty allowedRoles list can never match via effectiveRoles either.
 */
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

/**
 * Usage: router.put('/x', authenticate, requireDepartmentHead('Legal & Compliance'), handler)
 *
 * Passes if the account is owner/admin (same bypass as requireRole), OR if
 * req.staff.employee_id matches the head_employee_id of ANY of the named
 * departments. This checks departments.head_employee_id dynamically rather
 * than relying on fixed role names — so adding a new department never
 * requires a role/enum change, just an UPDATE on that department's row.
 *
 * Accepts multiple department names so a route can be opened to several
 * HODs at once, e.g. requireDepartmentHead('Legal & Compliance', 'Finance').
 */
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

function signToken(staff) {
  return jwt.sign({ sub: staff.id, role: staff.role }, JWT_SECRET || 'dev-only-insecure-secret', {
    expiresIn: '8h',
  });
}

module.exports = { authenticate, requireRole, requireDepartmentHead, signToken };