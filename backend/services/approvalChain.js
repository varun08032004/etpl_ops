'use strict';
// services/approvalChain.js
//
// Resolves who has to sign off on a gated action, in order:
//   Team Head  →  Department Head  →  CEO (any admin)  →  Founder
//
// A stage is included only if it's occupied by someone with an active login
// who ISN'T the person requesting the action (you can't approve your own
// request). If your org doesn't have team heads / department heads set up
// yet, those stages simply don't appear — the chain collapses down to
// whatever roles actually exist, and Founder is always the last, guaranteed
// stage so nothing can get stuck with nobody able to approve it.

const { safeQuery } = require('../db/pool');

async function staffForEmployee(employeeId, excludeStaffId) {
  if (!employeeId) return null;
  const { rows: [s] } = await safeQuery(
    `SELECT id FROM staff_accounts WHERE employee_id = $1 AND is_active = true`,
    [employeeId]
  );
  if (!s || s.id === excludeStaffId) return null;
  return s;
}

async function adminStage(excludeStaffId) {
  const { rows } = await safeQuery(
    `SELECT id FROM staff_accounts WHERE role = 'admin' AND is_active = true AND id != $1`,
    [excludeStaffId]
  );
  return rows.length ? { level: 'ceo', label: 'CEO', staff_ids: rows.map((r) => r.id) } : null;
}

async function founderStage() {
  const { rows } = await safeQuery(`SELECT id FROM staff_accounts WHERE role = 'owner' AND is_active = true`);
  // Founder stage is always present even if the staff_ids list is momentarily
  // empty (shouldn't happen in practice — there should always be an owner
  // login) so a request never has "nowhere to go".
  return { level: 'founder', label: 'Founder', staff_ids: rows.map((r) => r.id) };
}

async function buildChainFromHeadIds(headEmployeeIdsInOrder, levelMeta, requestedByStaffId) {
  const stages = [];
  for (let i = 0; i < headEmployeeIdsInOrder.length; i++) {
    const approver = await staffForEmployee(headEmployeeIdsInOrder[i], requestedByStaffId);
    if (approver) stages.push({ level: levelMeta[i].level, label: levelMeta[i].label, staff_ids: [approver.id] });
  }
  const admin = await adminStage(requestedByStaffId);
  if (admin) stages.push(admin);
  stages.push(await founderStage());
  return stages;
}

/** Chain for an action taken against a specific employee (exit, reinstate-gated actions, etc). */
async function buildEmployeeActionChain(employeeId, requestedByStaffId) {
  const { rows: [emp] } = await safeQuery(`SELECT department_id, team_id FROM employees WHERE id = $1`, [employeeId]);
  const heads = [];
  const meta = [];

  if (emp?.team_id) {
    const { rows: [team] } = await safeQuery(`SELECT team_head_id FROM teams WHERE id = $1`, [emp.team_id]);
    if (team?.team_head_id && team.team_head_id !== employeeId) {
      heads.push(team.team_head_id);
      meta.push({ level: 'team_head', label: 'Team Head' });
    }
  }
  if (emp?.department_id) {
    const { rows: [dept] } = await safeQuery(`SELECT head_employee_id FROM departments WHERE id = $1`, [emp.department_id]);
    if (dept?.head_employee_id && dept.head_employee_id !== employeeId) {
      heads.push(dept.head_employee_id);
      meta.push({ level: 'department_head', label: 'Department Head' });
    }
  }
  return buildChainFromHeadIds(heads, meta, requestedByStaffId);
}

/** Chain for deleting a department — Department Head → CEO → Founder. */
async function buildDepartmentChain(departmentId, requestedByStaffId) {
  const { rows: [dept] } = await safeQuery(`SELECT head_employee_id FROM departments WHERE id = $1`, [departmentId]);
  const heads = dept?.head_employee_id ? [dept.head_employee_id] : [];
  const meta = dept?.head_employee_id ? [{ level: 'department_head', label: 'Department Head' }] : [];
  return buildChainFromHeadIds(heads, meta, requestedByStaffId);
}

/** Chain for deleting a team — Team Head → Department Head → CEO → Founder. */
async function buildTeamChain(teamId, requestedByStaffId) {
  const { rows: [team] } = await safeQuery(`SELECT team_head_id, department_id FROM teams WHERE id = $1`, [teamId]);
  const heads = [];
  const meta = [];
  if (team?.team_head_id) { heads.push(team.team_head_id); meta.push({ level: 'team_head', label: 'Team Head' }); }
  if (team?.department_id) {
    const { rows: [dept] } = await safeQuery(`SELECT head_employee_id FROM departments WHERE id = $1`, [team.department_id]);
    if (dept?.head_employee_id) { heads.push(dept.head_employee_id); meta.push({ level: 'department_head', label: 'Department Head' }); }
  }
  return buildChainFromHeadIds(heads, meta, requestedByStaffId);
}

/** Chain for deactivating a login — piggybacks on the linked employee's chain if there is one. */
async function buildStaffAccountChain(staffAccountId, requestedByStaffId) {
  const { rows: [target] } = await safeQuery(`SELECT employee_id FROM staff_accounts WHERE id = $1`, [staffAccountId]);
  if (target?.employee_id) return buildEmployeeActionChain(target.employee_id, requestedByStaffId);
  const stages = [];
  const admin = await adminStage(requestedByStaffId);
  if (admin) stages.push(admin);
  stages.push(await founderStage());
  return stages;
}

module.exports = {
  buildEmployeeActionChain,
  buildDepartmentChain,
  buildTeamChain,
  buildStaffAccountChain,
};