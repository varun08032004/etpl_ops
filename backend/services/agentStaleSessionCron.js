'use strict';

const cron = require('node-cron');
const { pool, safeQuery } = require('../db/pool');

// Runs every 5 minutes - checks ALL employees for stale agent sessions
// If agent hasn't sent heartbeat in 10 min, mark session closed
// Attendance marked as 'agent_offline' (reviewable, not auto-absent)
const STALE_MINUTES = 10;
const GRACE_MINUTES = 5; // extra grace after stale detection before marking attendance
const CRON_EXPRESSION = '*/5 * * * *'; // every 5 minutes

// Maintenance windows (UTC) - agent offline during these is expected
// Format: [{ name, dayOfWeek (0=Sun), startHour, startMin, endHour, endMin, timezone }]
const MAINTENANCE_WINDOWS = [
  // Example: Windows updates typically Tue 2-4 AM local
  // { name: 'Windows Patch Tuesday', dayOfWeek: 2, startHour: 2, startMin: 0, endHour: 4, endMin: 0, timezone: 'UTC' },
];

function isInMaintenanceWindow() {
  const now = new Date();
  for (const w of MAINTENANCE_WINDOWS) {
    const dayMatch = w.dayOfWeek === undefined || w.dayOfWeek === now.getUTCDay();
    if (!dayMatch) continue;
    const start = new Date(now); start.setUTCHours(w.startHour, w.startMin, 0, 0);
    const end = new Date(now); end.setUTCHours(w.endHour, w.endMin, 0, 0);
    if (now >= start && now <= end) return w.name;
  }
  return null;
}

async function checkAllStaleSessions() {
  const maintenanceWindow = isInMaintenanceWindow();
  if (maintenanceWindow) {
    console.log(`[agentStaleCron] Skipping - maintenance window: ${maintenanceWindow}`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find all open sessions older than threshold
    const { rows: staleSessions } = await client.query(
      `SELECT id, employee_id, work_date, last_heartbeat_at
       FROM agent_sessions
       WHERE status = 'open'
         AND last_heartbeat_at < NOW() - ($1 || ' minutes')::interval`,
      [STALE_MINUTES]
    );

    for (const session of staleSessions) {
      // Close the agent session
      await client.query(
        `UPDATE agent_sessions
         SET status = 'closed', clock_out = last_heartbeat_at, end_reason = 'timeout'
         WHERE id = $1`,
        [session.id]
      );

      // Update attendance record - mark as agent_offline (NOT absent)
      // HR reviews these - could be restart, update, power loss, etc.
      await client.query(
        `UPDATE attendance_records
         SET clock_out = $1, status = 'agent_offline', notes = COALESCE(notes, '') || ' [Agent offline - session auto-closed after ' || $2 || ' min stale]'
         WHERE employee_id = $3 AND work_date = $4 AND status NOT IN ('exited', 'on_leave', 'agent_offline')`,
        [session.last_heartbeat_at, STALE_MINUTES, session.employee_id, session.work_date]
      );

      console.log(`[agentStaleCron] Closed stale session ${session.id} for employee ${session.employee_id} on ${session.work_date}`);
    }

    // Also check for employees who NEVER started agent today but should have
    const { rows: missingAgents } = await client.query(
      `SELECT e.id, e.full_name, ar.work_date
       FROM employees e
       JOIN attendance_records ar ON ar.employee_id = e.id
       WHERE e.status = 'active'
         AND ar.work_date = CURRENT_DATE
         AND ar.status NOT IN ('exited', 'on_leave', 'agent_offline')
         AND NOT EXISTS (
           SELECT 1 FROM agent_sessions s
           WHERE s.employee_id = e.id AND s.work_date = CURRENT_DATE
         )
         AND CURRENT_TIME > '09:30'::time` // after expected start time
    );

    for (const missing of missingAgents) {
      await client.query(
        `UPDATE attendance_records
         SET status = 'agent_offline', notes = COALESCE(notes, '') || ' [No agent session started by 09:30]'
         WHERE employee_id = $1 AND work_date = $2`,
        [missing.id, missing.work_date]
      );
      console.log(`[agentStaleCron] Marked agent_offline for employee ${missing.id} (${missing.full_name}) - no session started`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[agentStaleCron] Error:', err.message);
  } finally {
    client.release();
  }
}

// Self-start the cron when required
if (require.main === module || process.env.AGENT_STALE_CRON_ENABLED === 'true') {
  cron.schedule(CRON_EXPRESSION, checkAllStaleSessions);
  console.log(`[agentStaleCron] Scheduled: every 5 minutes (stale threshold: ${STALE_MINUTES} min)`);
}

module.exports = { checkAllStaleSessions, STALE_MINUTES, GRACE_MINUTES, MAINTENANCE_WINDOWS };