#!/usr/bin/env node
'use strict';

// Cron job to close stale agent sessions server-side
// Runs every 5 minutes via cron/systemd/Windows Task Scheduler
// This ensures sessions are closed even if agent never sends another request

require('dotenv').config();
const { Pool } = require('pg');

const STALE_SESSION_MINUTES = 10;

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function closeAllStaleSessions() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows } = await client.query(
      `UPDATE agent_sessions
       SET status = 'closed', clock_out = last_heartbeat_at, end_reason = 'timeout'
       WHERE status = 'open'
         AND last_heartbeat_at < NOW() - ($1 || ' minutes')::interval
       RETURNING id, employee_id, work_date, device_id, last_heartbeat_at, heartbeat_seq`,
      [STALE_SESSION_MINUTES]
    );
    
    for (const row of rows) {
      await client.query(
        `UPDATE attendance_records SET clock_out = last_heartbeat_at
         WHERE employee_id = $1 AND work_date = $2`,
        [row.employee_id, row.work_date]
      );
      
      // Log timeout anomaly
      await client.query(
        `INSERT INTO heartbeat_anomaly_log (session_id, employee_id, device_id, anomaly_type, severity, details, ip)
         VALUES ($1, $2, $3, 'timeout', 'warning', $4, $5)`,
        [row.id, row.employee_id, row.device_id, { 
          lastHeartbeatAt: row.last_heartbeat_at, 
          staleMinutes: STALE_SESSION_MINUTES,
          heartbeatSeq: row.heartbeat_seq 
        }, 'system']
      );
    }
    
    await client.query('COMMIT');
    
    if (rows.length > 0) {
      console.log(`[${new Date().toISOString()}] Closed ${rows.length} stale session(s)`);
      for (const row of rows) {
        console.log(`  - Session ${row.id} (employee ${row.employee_id}, device ${row.device_id}) timed out after ${STALE_SESSION_MINUTES}min`);
      }
    }
    
    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[${new Date().toISOString()}] Error closing stale sessions:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting stale session cleanup...`);
  try {
    const count = await closeAllStaleSessions();
    console.log(`[${new Date().toISOString()}] Done. Closed ${count} session(s).`);
    process.exit(0);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Fatal:`, err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();