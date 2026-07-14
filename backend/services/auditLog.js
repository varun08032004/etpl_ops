// ─────────────────────────────────────────────────────────────────────────
// services/auditLog.js
//
// Writes to the audit_log table, which has existed since the original
// schema but was never actually wired up anywhere. Deliberately scoped to
// high-signal security-relevant actions (staff account changes, role
// changes, employee exits) rather than every single action in the system —
// logging everything would bury the actions that actually matter to review
// under routine CRUD noise.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const { safeQuery } = require('../db/pool');

/**
 * @param {object} params
 * @param {string} params.staffId - who did it
 * @param {string} params.action - short verb phrase, e.g. 'staff_account.role_changed'
 * @param {string} [params.entity] - e.g. 'staff_accounts'
 * @param {string} [params.entityId]
 * @param {object} [params.oldValue]
 * @param {object} [params.newValue]
 * @param {string} [params.ipAddress]
 */
async function logAction({ staffId, action, entity, entityId, oldValue, newValue, ipAddress }) {
  try {
    await safeQuery(
      `INSERT INTO audit_log (staff_id, action, entity, entity_id, old_value, new_value, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [staffId || null, action, entity || null, entityId || null,
       oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress || null]
    );
  } catch (err) {
    // Audit logging must never break the actual action it's logging
    console.error('[auditLog] failed to write entry:', err.message);
  }
}

module.exports = { logAction };