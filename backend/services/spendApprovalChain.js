
'use strict';
// services/spendApprovalChain.js
//
// RENAMED from services/approvalChain.js — that filename was already taken
// by the org-governance chain (buildEmployeeActionChain, buildDepartmentChain,
// etc. — approving deletion of departments/teams/staff accounts). This is a
// DIFFERENT system: amount-threshold-based approval for expense_claims and
// purchase_requests (L1 Reporting Manager -> L2 Finance -> L3 Owner), keyed
// off the approval_thresholds table. Do not merge these two files — they
// serve genuinely different approval flows with different shapes.

const { safeQuery } = require('../db/pool');

async function getLevelsRequired(requestType, amount) {
  const { rows: [band] } = await safeQuery(
    `SELECT levels_required FROM approval_thresholds
     WHERE request_type = $1 AND min_amount <= $2 AND (max_amount IS NULL OR max_amount > $2)
     ORDER BY min_amount DESC LIMIT 1`,
    [requestType, amount]
  );
  return band ? band.levels_required : 3; // fail safe: unknown amount band requires full chain, not auto-approve
}

// entityOwnerEmployeeId is the employee the claim/request is FOR (the
// claimant, or the requester) — works identically for expense_claims and
// purchase_requests since both map to this common field by the caller.
async function canActAtLevel(level, entityOwnerEmployeeId, staff) {
  if (staff.role === 'owner') return true; // Founder can act at any level, always
  if (level === 1) {
    if (staff.role === 'admin') return true;
    const { rows: [emp] } = await safeQuery(`SELECT manager_id FROM employees WHERE id = $1`, [entityOwnerEmployeeId]);
    return emp && emp.manager_id === staff.employee_id;
  }
  if (level === 2) return ['admin', 'finance'].includes(staff.role);
  if (level === 3) return false; // only owner, handled above
  return false;
}

module.exports = { getLevelsRequired, canActAtLevel };