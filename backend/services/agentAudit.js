'use strict';

// Comprehensive Audit Logging for Agent Actions
// Logs all agent-related activities for compliance and security review

const { safeQuery } = require('../db/pool');

const AUDIT_ACTIONS = {
  // Authentication
  'agent.login.success': 'Agent login successful',
  'agent.login.failed': 'Agent login failed',
  'agent.login.2fa_required': '2FA required for agent login',
  'agent.logout': 'Agent logout',
  'agent.token_refresh': 'Agent token refreshed',
  
  // Session management
  'agent.session.start': 'Agent session started',
  'agent.session.resume': 'Agent session resumed',
  'agent.session.stop': 'Agent session stopped gracefully',
  'agent.session.force_logout': 'Agent session force logged out',
  'agent.session.timeout': 'Agent session timed out',
  
  // Heartbeat
  'agent.heartbeat': 'Agent heartbeat received',
  'agent.heartbeat.sequence_invalid': 'Invalid heartbeat sequence',
  'agent.heartbeat.rate_limited': 'Heartbeat rate limited',
  
  // Device management
  'agent.device.enrolled': 'New device enrolled',
  'agent.device.fingerprint_verified': 'Device fingerprint verified',
  'agent.device.fingerprint_mismatch': 'Device fingerprint mismatch',
  'agent.device.hw_id_changed': 'Device hardware ID changed',
  'agent.device.revoked': 'Device revoked',
  'agent.device.revoked_fingerprint': 'Device revoked due to fingerprint mismatches',
  
  // Screenshots
  'agent.screenshot.upload': 'Screenshot uploaded',
  'agent.screenshot.hash_mismatch': 'Screenshot hash verification failed',
  
  // Security anomalies
  'agent.anomaly.impossible_travel': 'Impossible travel detected',
  'agent.anomaly.sequence_gap': 'Heartbeat sequence gap',
  'agent.anomaly.ip_mismatch': 'IP mismatch (non-office network)',
  'agent.anomaly.fingerprint_mismatch': 'Hardware fingerprint mismatch',
  'agent.anomaly.timeout': 'Session timeout',
  'agent.anomaly.screenshot_hash_mismatch': 'Screenshot hash mismatch',
  'agent.anomaly.extension_missing': 'Browser extension missing',
  'agent.anomaly.config_tamper': 'Config tampering detected',
  
  // Settings
  'agent.settings.changed': 'Agent settings changed',
  'agent.incognito.enforced': 'Incognito restriction enforced',
  'agent.incognito.reverted': 'Incognito restriction reverted',
};

// Log an agent action
async function logAgentAction({ 
  action, 
  employeeId, 
  deviceId, 
  sessionId, 
  ip, 
  location, 
  details, 
  severity = 'info',
  userAgent 
}) {
  try {
    await safeQuery(
      `INSERT INTO agent_audit_log 
       (action, employee_id, device_id, session_id, ip, location, details, severity, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [action, employeeId, deviceId, sessionId, ip, location ? JSON.stringify(location) : null, 
       details ? JSON.stringify(details) : null, severity, userAgent]
    );
  } catch (err) {
    // Never throw - audit logging failures shouldn't break the main flow
    console.error('[audit] Failed to log agent action:', err.message);
  }
}

// Get audit logs with filtering
async function getAgentAuditLogs({ 
  employeeId, 
  deviceId, 
  action, 
  severity, 
  from, 
  to, 
  limit = 100, 
  offset = 0 
}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;
  
  if (employeeId) {
    conditions.push(`employee_id = $${paramIndex++}`);
    params.push(employeeId);
  }
  if (deviceId) {
    conditions.push(`device_id = $${paramIndex++}`);
    params.push(deviceId);
  }
  if (action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(action);
  }
  if (severity) {
    conditions.push(`severity = $${paramIndex++}`);
    params.push(severity);
  }
  if (from) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(to);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  params.push(limit, offset);
  
  const { rows } = await safeQuery(
    `SELECT * FROM agent_audit_log 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    params
  );
  
  return rows;
}

// Get audit statistics
async function getAgentAuditStats({ employeeId, from, to }) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;
  
  if (employeeId) {
    conditions.push(`employee_id = $${paramIndex++}`);
    params.push(employeeId);
  }
  if (from) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(to);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const { rows } = await safeQuery(
    `SELECT 
       action,
       severity,
       COUNT(*) as count,
       MIN(created_at) as first_occurrence,
       MAX(created_at) as last_occurrence
     FROM agent_audit_log
     ${whereClause}
     GROUP BY action, severity
     ORDER BY count DESC`,
    params
  );
  
  return rows;
}

// Initialize audit log table
const INIT_AUDIT_TABLE = `
CREATE TABLE IF NOT EXISTS agent_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action          VARCHAR(100) NOT NULL,
  employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
  device_id       UUID REFERENCES agent_devices(id) ON DELETE SET NULL,
  session_id      UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  ip              INET,
  location        JSONB,
  details         JSONB,
  severity        VARCHAR(20) DEFAULT 'info',  -- info, warning, critical
  user_agent      TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_employee ON agent_audit_log (employee_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_device ON agent_audit_log (device_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_action ON agent_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_agent_audit_severity ON agent_audit_log (severity);
CREATE INDEX IF NOT EXISTS idx_agent_audit_created ON agent_audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_agent_audit_session ON agent_audit_log (session_id);
`;

module.exports = { 
  logAgentAction, 
  getAgentAuditLogs, 
  getAgentAuditStats,
  AUDIT_ACTIONS,
  INIT_AUDIT_TABLE
};