'use strict';
// services/approvals.js
//
// Multi-stage "destructive action needs sign-off" workflow. A request carries
// a `chain` (built by services/approvalChain.js) — an ordered list of stages,
// each with the staff_ids allowed to act at that stage. approveRequest()
// checks the reviewer is in the CURRENT stage; if it's the last stage, the
// action actually executes; otherwise it just advances to the next stage and
// stays pending. rejectRequest() can be called by anyone in the current
// stage and ends the request outright.
//
// Every module wires in a destructive action by calling registerApprovalAction()
// once at startup with an executor function, then calling
// createApprovalRequest() (with a chain) instead of performing the action
// directly when the actor isn't authorized to do it immediately.

const { safeQuery } = require('../db/pool');
const { logAction } = require('./auditLog');
const { notifyStaff, notifyMany } = require('./notifications');

const executors = {};

function registerApprovalAction(actionType, executorFn) {
  executors[actionType] = executorFn;
}

async function createApprovalRequest({ actionType, targetType, targetId, targetLabel, requestedBy, reason, payload, chain }) {
  if (!chain || !chain.length) {
    throw new Error(`createApprovalRequest for ${actionType} was called without a resolved chain`);
  }

  const { rows: [request] } = await safeQuery(
    `INSERT INTO approval_requests (action_type, target_type, target_id, target_label, requested_by, reason, payload, chain, current_stage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0) RETURNING *`,
    [actionType, targetType, targetId, targetLabel || null, requestedBy, reason || null, payload ? JSON.stringify(payload) : null, JSON.stringify(chain)]
  );

  await logAction({
    staffId: requestedBy,
    action: `${actionType}.requested`,
    entity: targetType,
    entityId: targetId,
    newValue: { targetLabel, reason: reason || null, chain: chain.map((s) => s.level) },
  });

  await notifyMany(chain[0].staff_ids, {
    type: 'approval.requested',
    title: `${chain[0].label} approval needed: ${actionType.replace('.', ' ')} — ${targetLabel || targetType}`,
    body: reason ? `Reason given: "${reason}"` : undefined,
    link: '/team',
  });

  return request;
}

function currentStageOf(request) {
  const chain = request.chain || [];
  return chain[request.current_stage] || null;
}

function isAuthorizedForStage(stage, staffId) {
  return !!stage && Array.isArray(stage.staff_ids) && stage.staff_ids.includes(staffId);
}

async function approveRequest(requestId, reviewedBy) {
  const { rows: [request] } = await safeQuery(`SELECT * FROM approval_requests WHERE id = $1`, [requestId]);
  if (!request) throw Object.assign(new Error('Approval request not found'), { status: 404 });
  if (request.status !== 'pending') {
    throw Object.assign(new Error(`Request already ${request.status}`), { status: 400 });
  }

  const stage = currentStageOf(request);
  if (!isAuthorizedForStage(stage, reviewedBy)) {
    throw Object.assign(new Error('You are not the current approver for this request'), { status: 403 });
  }

  const isFinalStage = request.current_stage >= request.chain.length - 1;

  if (!isFinalStage) {
    const nextStageIndex = request.current_stage + 1;
    const { rows: [updated] } = await safeQuery(
      `UPDATE approval_requests SET current_stage = $1 WHERE id = $2 RETURNING *`,
      [nextStageIndex, requestId]
    );

    await logAction({
      staffId: reviewedBy, action: `${request.action_type}.stage_approved`, entity: request.target_type, entityId: request.target_id,
      oldValue: { stage: stage.level }, newValue: { nextStage: request.chain[nextStageIndex].level, targetLabel: request.target_label },
    });

    await notifyMany(request.chain[nextStageIndex].staff_ids, {
      type: 'approval.requested',
      title: `${request.chain[nextStageIndex].label} approval needed: ${request.action_type.replace('.', ' ')} — ${request.target_label || request.target_type}`,
      body: `Already cleared ${stage.label}.`,
      link: '/team',
    });

    return { request: updated, result: null, finalized: false };
  }

  // Final stage — actually run the action.
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
    staffId: reviewedBy, action: `${request.action_type}.approved`, entity: request.target_type, entityId: request.target_id,
    oldValue: { requestedBy: request.requested_by, reason: request.reason }, newValue: { targetLabel: request.target_label },
  });

  await notifyStaff({
    staffId: request.requested_by, type: 'approval.approved',
    title: `Approved: ${request.action_type.replace('.', ' ')} — ${request.target_label || request.target_type}`,
    link: '/team',
  });

  return { request: updated, result, finalized: true };
}

async function rejectRequest(requestId, reviewedBy, reason) {
  const { rows: [request] } = await safeQuery(`SELECT * FROM approval_requests WHERE id = $1`, [requestId]);
  if (!request) throw Object.assign(new Error('Approval request not found'), { status: 404 });
  if (request.status !== 'pending') {
    throw Object.assign(new Error(`Request already ${request.status}`), { status: 400 });
  }

  const stage = currentStageOf(request);
  if (!isAuthorizedForStage(stage, reviewedBy)) {
    throw Object.assign(new Error('You are not the current approver for this request'), { status: 403 });
  }

  const { rows: [updated] } = await safeQuery(
    `UPDATE approval_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2 WHERE id = $3 RETURNING *`,
    [reviewedBy, reason || null, requestId]
  );

  await logAction({
    staffId: reviewedBy, action: `${request.action_type}.rejected`, entity: request.target_type, entityId: request.target_id,
    oldValue: { requestedBy: request.requested_by }, newValue: { targetLabel: request.target_label, rejectionReason: reason || null },
  });

  await notifyStaff({
    staffId: request.requested_by, type: 'approval.rejected',
    title: `Rejected: ${request.action_type.replace('.', ' ')} — ${request.target_label || request.target_type}`,
    body: reason || undefined,
    link: '/team',
  });

  return updated;
}

/** Requests where the given staff member is an eligible approver at the CURRENT stage. */
async function listPendingForStaff(staffId) {
  const { rows } = await safeQuery(
    `SELECT ar.*, req.email AS requested_by_email
     FROM approval_requests ar LEFT JOIN staff_accounts req ON req.id = ar.requested_by
     WHERE ar.status = 'pending' ORDER BY ar.created_at DESC LIMIT 200`
  );
  return rows.filter((r) => isAuthorizedForStage((r.chain || [])[r.current_stage], staffId));
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
  listPendingForStaff,
};