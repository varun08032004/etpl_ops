'use strict';
// services/approvals.js
//
// Generic "destructive action needs founder sign-off" workflow, layered on
// top of the audit log rather than replacing it: creating a request,
// approving it, and rejecting it each write an audit_log entry (via
// logAction), so the Admin > Audit Log page shows the full lifecycle of a
// gated action — not just the eventual executed change.
//
// Any module wires in a destructive action by calling registerApprovalAction()
// once at startup with an executor function, then calling
// createApprovalRequest() instead of performing the action directly when the
// actor isn't the owner. Only approveRequest() (owner-only, enforced by the
// route, not this service) actually runs the executor.

const { safeQuery } = require('../db/pool');
const { logAction } = require('./auditLog');

const executors = {};

/**
 * Registers the function that actually performs an action_type once approved.
 * @param {string} actionType
 * @param {(targetId: string, payload: object|null) => Promise<any>} executorFn
 */
function registerApprovalAction(actionType, executorFn) {
  executors[actionType] = executorFn;
}

async function createApprovalRequest({ actionType, targetType, targetId, targetLabel, requestedBy, reason, payload }) {
  const { rows: [request] } = await safeQuery(
    `INSERT INTO approval_requests (action_type, target_type, target_id, target_label, requested_by, reason, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [actionType, targetType, targetId, targetLabel || null, requestedBy, reason || null, payload ? JSON.stringify(payload) : null]
  );

  await logAction({
    staffId: requestedBy,
    action: `${actionType}.requested`,
    entity: targetType,
    entityId: targetId,
    newValue: { targetLabel, reason: reason || null },
  });

  return request;
}

async function approveRequest(requestId, reviewedBy) {
  const { rows: [request] } = await safeQuery(`SELECT * FROM approval_requests WHERE id = $1`, [requestId]);
  if (!request) throw Object.assign(new Error('Approval request not found'), { status: 404 });
  if (request.status !== 'pending') {
    throw Object.assign(new Error(`Request already ${request.status}`), { status: 400 });
  }

  const executor = executors[request.action_type];
  if (!executor) {
    throw new Error(`No executor registered for action_type "${request.action_type}" — is that module loaded?`);
  }

  const result = await executor(request.target_id, request.payload);

  const { rows: [updated] } = await safeQuery(
    `UPDATE approval_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2 RETURNING *`,
    [reviewedBy, requestId]
  );

  await logAction({
    staffId: reviewedBy,
    action: `${request.action_type}.approved`,
    entity: request.target_type,
    entityId: request.target_id,
    oldValue: { requestedBy: request.requested_by, reason: request.reason },
    newValue: { targetLabel: request.target_label },
  });

  return { request: updated, result };
}

async function rejectRequest(requestId, reviewedBy, reason) {
  const { rows: [request] } = await safeQuery(`SELECT * FROM approval_requests WHERE id = $1`, [requestId]);
  if (!request) throw Object.assign(new Error('Approval request not found'), { status: 404 });
  if (request.status !== 'pending') {
    throw Object.assign(new Error(`Request already ${request.status}`), { status: 400 });
  }

  const { rows: [updated] } = await safeQuery(
    `UPDATE approval_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2 WHERE id = $3 RETURNING *`,
    [reviewedBy, reason || null, requestId]
  );

  await logAction({
    staffId: reviewedBy,
    action: `${request.action_type}.rejected`,
    entity: request.target_type,
    entityId: request.target_id,
    oldValue: { requestedBy: request.requested_by },
    newValue: { targetLabel: request.target_label, rejectionReason: reason || null },
  });

  return updated;
}

async function listRequests({ status } = {}) {
  const params = [];
  let where = '';
  if (status) { params.push(status); where = `WHERE ar.status = $1`; }

  const { rows } = await safeQuery(
    `SELECT ar.*, req.email AS requested_by_email, rev.email AS reviewed_by_email
     FROM approval_requests ar
     LEFT JOIN staff_accounts req ON req.id = ar.requested_by
     LEFT JOIN staff_accounts rev ON rev.id = ar.reviewed_by
     ${where}
     ORDER BY ar.created_at DESC LIMIT 200`,
    params
  );
  return rows;
}

module.exports = {
  registerApprovalAction,
  createApprovalRequest,
  approveRequest,
  rejectRequest,
  listRequests,
};