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
 * @param {string} [params.requestId] - for request tracing
 * @param {object} [params.metadata] - additional context
 */
async function logAction({ staffId, action, entity, entityId, oldValue, newValue, ipAddress, requestId, metadata }) {
  try {
    await safeQuery(
      `INSERT INTO audit_log (staff_id, action, entity, entity_id, old_value, new_value, ip_address, request_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [staffId || null, action, entity || null, entityId || null,
       oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null,
       ipAddress || null, requestId || null, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    // Audit logging must never break the actual action it's logging
    console.error('[auditLog] failed to write entry:', err.message);
  }
}

/**
 * Log security-specific events with standardized action names
 */
const SECURITY_ACTIONS = {
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILED_PASSWORD: 'auth.login_failed_password',
  LOGIN_FAILED_2FA: 'auth.login_failed_2fa',
  LOGIN_FAILED_DEVICE: 'auth.login_failed_device',
  LOGIN_BLOCKED_IP: 'auth.login_blocked_ip',
  LOGIN_BLOCKED_LOCKOUT: 'auth.login_blocked_lockout',
  LOGIN_BLOCKED_BRUTE_FORCE: 'auth.login_blocked_brute_force',
  LOGIN_NEW_DEVICE: 'auth.login_new_device',
  LOGOUT: 'auth.logout',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'auth.password_reset_completed',
  PASSWORD_CHANGED: 'auth.password_changed',
  TWO_FA_ENABLED: 'auth.two_fa_enabled',
  TWO_FA_DISABLED: 'auth.two_fa_disabled',
  BACKUP_CODE_USED: 'auth.backup_code_used',
  DEVICE_APPROVED: 'auth.device_approved',
  DEVICE_REVOKED: 'auth.device_revoked',
  IP_ALLOWLIST_ADDED: 'auth.ip_allowlist_added',
  IP_ALLOWLIST_REMOVED: 'auth.ip_allowlist_removed',
  SESSION_REVOKED: 'auth.session_revoked',
  ALL_SESSIONS_REVOKED: 'auth.all_sessions_revoked',
  ROLE_CHANGED: 'auth.role_changed',
  ACCOUNT_DEACTIVATED: 'auth.account_deactivated',
  ACCOUNT_REACTIVATED: 'auth.account_reactivated',
};

/**
 * Log a security event with standardized format
 */
async function logSecurityEvent({ action, staffId, entity, entityId, ipAddress, requestId, metadata, success = true }) {
  const actionName = SECURITY_ACTIONS[action] || `security.${action}`;
  await logAction({
    staffId,
    action: `${actionName}_${success ? 'success' : 'failure'}`,
    entity,
    entityId,
    metadata: { ...metadata, success },
    ipAddress,
    requestId,
  });
}

/**
 * Log authentication events
 */
async function logAuthEvent({ event, staffId, ipAddress, requestId, metadata, success = true }) {
  const actionMap = {
    login: 'auth.login',
    logout: 'auth.logout',
    password_reset_request: 'auth.password_reset_request',
    password_reset: 'auth.password_reset',
    password_change: 'auth.password_change',
    two_fa_enable: 'auth.two_fa_enable',
    two_fa_disable: 'auth.two_fa_disable',
    two_fa_verify: 'auth.two_fa_verify',
    backup_code_use: 'auth.backup_code_use',
    device_approve: 'auth.device_approve',
    device_revoke: 'auth.device_revoke',
    ip_allowlist_add: 'auth.ip_allowlist_add',
    ip_allowlist_remove: 'auth.ip_allowlist_remove',
    session_revoke: 'auth.session_revoke',
    all_sessions_revoke: 'auth.all_sessions_revoke',
  };
  const action = actionMap[event] || `auth.${event}`;
  await logAction({
    staffId,
    action: `${action}_${success ? 'success' : 'failure'}`,
    entity: 'staff_accounts',
    entityId: staffId,
    metadata: { ...metadata, event },
    ipAddress,
    requestId,
  });
}

module.exports = {
  logAction,
  logSecurityEvent,
  logAuthEvent,
  SECURITY_ACTIONS,
};