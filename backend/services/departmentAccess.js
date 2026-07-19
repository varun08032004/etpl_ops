'use strict';
// services/departmentAccess.js
//
// A department can "grant" one or more functional roles (finance, hr,
// legal_hod, compliance_hod...) to everyone who belongs to it. This is
// resolved once per request (in authenticate(), see middleware/auth.js) and
// attached to req.staff as:
//   staff.effectiveRoles = ['finance']              // roles granted by their department
//   staff.deptAccess = { departmentId, departmentName, isHOD, grantedRoles }
//
// requireRole(...) then checks effectiveRoles in addition to the real login
// role, so every existing requireRole('finance') gate across the app works
// for department members automatically — no per-route changes needed.
//
// isHOD additionally powers the multi-stage approval chain (services/
// approvalChain.js already resolves Team Head → Department Head → CEO →
// Founder using departments.head_employee_id / teams.team_head_id) — that
// mechanism is untouched by this file; this file only handles day-to-day
// module access, not approval authority.

const { safeQuery } = require('../db/pool');

async function getMyDepartmentAccess(staff) {
  // Owner/admin already bypass every requireRole() check — no need to grant
  // anything extra, and no need for a DB round trip on every request for them.
  if (['owner', 'admin'].includes(staff.role)) {
    return { departmentId: null, departmentName: null, isHOD: false, grantedRoles: [] };
  }

  if (!staff.employee_id) {
    return { departmentId: null, departmentName: null, isHOD: false, grantedRoles: [] };
  }

  const { rows: [emp] } = await safeQuery(`SELECT department_id FROM employees WHERE id = $1`, [staff.employee_id]);
  if (!emp?.department_id) {
    return { departmentId: null, departmentName: null, isHOD: false, grantedRoles: [] };
  }

  const { rows: [dept] } = await safeQuery(
    `SELECT id, name, head_employee_id, granted_roles FROM departments WHERE id = $1`,
    [emp.department_id]
  );
  if (!dept) {
    return { departmentId: null, departmentName: null, isHOD: false, grantedRoles: [] };
  }

  return {
    departmentId: dept.id,
    departmentName: dept.name,
    isHOD: dept.head_employee_id === staff.employee_id,
    grantedRoles: dept.granted_roles || [],
  };
}

module.exports = { getMyDepartmentAccess };