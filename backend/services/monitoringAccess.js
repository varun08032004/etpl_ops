'use strict';

const { safeQuery } = require('../db/pool');

// Per the product decision for this module: owner/admin, anyone with the
// department-granted 'hr' role, AND any department head (any department,
// not just their own) can see everyone's monitoring data — this sits
// inside HR the way Attendance/Recruitment/Performance do. Everyone else
// only ever sees their own (enforced separately, per-route, by comparing
// against req.staff.employee_id).
async function canViewAllMonitoring(staff) {
  if (['owner', 'admin'].includes(staff.role)) return true;
  if ((staff.effectiveRoles || []).includes('hr')) return true;
  if (!staff.employee_id) return false;

  const { rows } = await safeQuery(
    `SELECT 1 FROM departments WHERE head_employee_id = $1 LIMIT 1`,
    [staff.employee_id]
  );
  return rows.length > 0;
}

// Express middleware wrapping the same check, for routes that mutate
// monitoring data (productivity rules, settings, devices) rather than just
// read it — same allowed group (founder/owner, admin, HR, any HOD),
// everyone else gets a 403. requireRole('hr') alone doesn't cover HODs,
// which is why this exists instead of reusing that middleware here.
function requireMonitoringAdmin(req, res, next) {
  if (!req.staff) return res.status(401).json({ error: 'Not authenticated' });
  canViewAllMonitoring(req.staff)
    .then((allowed) => {
      if (!allowed) return res.status(403).json({ error: 'Only founder, admin, HR, or a department head can manage this' });
      next();
    })
    .catch(next);
}

module.exports = { canViewAllMonitoring, requireMonitoringAdmin };
