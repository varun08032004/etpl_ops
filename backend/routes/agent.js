'use strict';

// Everything the desktop agent (.exe) talks to. Deliberately separate from
// routes/attendance.js and routes/monitoring.js, which are the
// dashboard-facing side of this feature — this file has NO `authenticate`
// (portal JWT) anywhere; every route here is either public (login) or
// gated by authenticateAgent (agent JWT). See middleware/agentAuth.js for
// why the two token types don't mix.

const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcrypt');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { signAgentToken, authenticateAgent, authenticateAgentHeartbeat, generateHwId } = require('../middleware/agentAuth');
const storage = require('../services/storage');
const { verifyTotp, decryptSecret, hashBackupCode } = require('../services/twoFactor');
const { logAgentAction, AUDIT_ACTIONS } = require('../services/agentAudit');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }); // 8MB/screenshot

// A stale session (agent crashed / laptop battery died — no graceful
// "Stop Work" or "force-logout" call ever arrives) is auto-closed the next
// time we see ANY request that touches sessions, once its last heartbeat is
// older than this. Keeps "who's online right now" honest without needing a
// cron job in this small a deployment.
const STALE_SESSION_MINUTES = 10;

// Enhanced stale session detection with anomaly logging
async function closeStaleSessions(employeeId) {
  const { rows } = await safeQuery(
    `UPDATE agent_sessions
     SET status = 'closed', clock_out = last_heartbeat_at, end_reason = 'timeout'
     WHERE employee_id = $1 AND status = 'open'
       AND last_heartbeat_at < NOW() - ($2 || ' minutes')::interval
     RETURNING id, work_date, employee_id, device_id, last_heartbeat_at, heartbeat_seq`,
    [employeeId, STALE_SESSION_MINUTES]
  );
  for (const row of rows) {
    await safeQuery(
      `UPDATE attendance_records SET clock_out = (SELECT last_heartbeat_at FROM agent_sessions WHERE id = $1)
       WHERE employee_id = $2 AND work_date = $3`,
      [row.id, employeeId, row.work_date]
    );
    
    // Log timeout anomaly
    await safeQuery(
      `INSERT INTO heartbeat_anomaly_log (session_id, employee_id, device_id, anomaly_type, severity, details, ip)
       VALUES ($1, $2, $3, 'timeout', 'warning', $4, $5)`,
      [row.id, row.employee_id, row.device_id, { 
        lastHeartbeatAt: row.last_heartbeat_at, 
        staleMinutes: STALE_SESSION_MINUTES,
        heartbeatSeq: row.heartbeat_seq 
      }, 'system']
    );
  }
  return rows;
}

// Close ALL stale sessions across all employees (for cron job)
async function closeAllStaleSessions() {
  const { rows } = await safeQuery(
    `UPDATE agent_sessions
     SET status = 'closed', clock_out = last_heartbeat_at, end_reason = 'timeout'
     WHERE status = 'open'
       AND last_heartbeat_at < NOW() - ($1 || ' minutes')::interval
     RETURNING id, employee_id, work_date, device_id, last_heartbeat_at, heartbeat_seq`,
    [STALE_SESSION_MINUTES]
  );
  for (const row of rows) {
    await safeQuery(
      `UPDATE attendance_records SET clock_out = last_heartbeat_at
       WHERE employee_id = $1 AND work_date = $2`,
      [row.employee_id, row.work_date]
    );
    
    // Log timeout anomaly
    await safeQuery(
      `INSERT INTO heartbeat_anomaly_log (session_id, employee_id, device_id, anomaly_type, severity, details, ip)
       VALUES ($1, $2, $3, 'timeout', 'warning', $4, $5)`,
      [row.id, row.employee_id, row.device_id, { 
        lastHeartbeatAt: row.last_heartbeat_at, 
        staleMinutes: STALE_SESSION_MINUTES,
        heartbeatSeq: row.heartbeat_seq 
      }, 'system']
    );
  }
  return rows;
}

// ── login — agent's own auth, reuses staff_accounts credentials ────────────
// Body: { email, password, company_code, device_name, os, agent_version, totp_token, backup_code,
//         hw_id_components: { cpuId, motherboardSerial, diskSerial, macAddresses } }
router.post('/login', async (req, res) => {
  try {
    const { email, password, company_code, device_name, os, agent_version, totp_token, backup_code, hw_id_components } = req.body;
    if (!email || !password || !device_name) {
      return res.status(400).json({ error: 'email, password, and device_name are required' });
    }

    const expectedCode = process.env.AGENT_COMPANY_CODE;
    if (expectedCode && company_code !== expectedCode) {
      return res.status(401).json({ error: 'Invalid company code' });
    }

    const { rows: [staff] } = await safeQuery(
      `SELECT * FROM staff_accounts WHERE email = $1`,
      [email.toLowerCase()]
    );
    if (!staff || !staff.is_active) return res.status(401).json({ error: 'Invalid credentials' });
    if (!staff.employee_id) return res.status(403).json({ error: 'This login is not linked to an employee record' });

    const ok = await bcrypt.compare(password, staff.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Same 2FA requirement as the web portal — a password alone was never
    // enough for founder/admin/hr accounts there, so it shouldn't become
    // the weaker path in here just because it's a different client.
    if (staff.two_fa_enabled) {
      let valid = false;
      if (totp_token) {
        valid = verifyTotp(decryptSecret(staff.two_fa_secret), totp_token);
      } else if (backup_code) {
        const hash = hashBackupCode(backup_code);
        const { rows: [codeRow] } = await safeQuery(
          `SELECT id FROM two_fa_backup_codes WHERE staff_account_id = $1 AND code_hash = $2 AND used_at IS NULL`,
          [staff.id, hash]
        );
        if (codeRow) {
          valid = true;
          await safeQuery(`UPDATE two_fa_backup_codes SET used_at = NOW() WHERE id = $1`, [codeRow.id]);
        }
      }
      if (!valid) {
        if (!totp_token && !backup_code) {
          return res.status(202).json({ two_factor_required: true, message: 'Enter your 6-digit authenticator code.' });
        }
        return res.status(401).json({ error: 'Invalid authenticator code' });
      }
    }

    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    let hwId = null;
    let isFirstEnrollment = false;

    if (hw_id_components) {
      hwId = generateHwId(hw_id_components);
    }

    const { rows: [device] } = await safeQuery(
      `INSERT INTO agent_devices (employee_id, device_name, os, agent_version, status, last_seen_at, hw_id, hw_id_components, enrolled_at, fingerprint_verified_at, last_known_ip)
       VALUES ($1,$2,$3,$4,'active',NOW(),$5,$6,NOW(),NOW(),$7)
       ON CONFLICT (employee_id, device_name) DO UPDATE SET
         os = EXCLUDED.os, agent_version = EXCLUDED.agent_version,
         status = 'active', last_seen_at = NOW(),
         hw_id = CASE 
           WHEN agent_devices.hw_id IS NULL THEN EXCLUDED.hw_id
           WHEN agent_devices.hw_id != EXCLUDED.hw_id THEN agent_devices.hw_id  -- Keep original, log mismatch
           ELSE agent_devices.hw_id
         END,
         hw_id_components = CASE 
           WHEN agent_devices.hw_id IS NULL THEN EXCLUDED.hw_id_components
           ELSE agent_devices.hw_id_components
         END,
         last_known_ip = EXCLUDED.last_known_ip
       RETURNING id, status, hw_id`,
      [staff.employee_id, device_name, os || null, agent_version || null, hwId, hw_id_components ? JSON.stringify(hw_id_components) : null, clientIp]
    );

    if (device.status !== 'active') return res.status(403).json({ error: 'This device has been revoked' });

    // Check if this is a new enrollment (no previous HWID)
    if (!device.hw_id && hwId) {
      isFirstEnrollment = true;
      await safeQuery(
        `UPDATE agent_devices SET hw_id = $1, hw_id_components = $2, enrolled_at = NOW(), fingerprint_verified_at = NOW() WHERE id = $3`,
        [hwId, hw_id_components ? JSON.stringify(hw_id_components) : null, device.id]
      );
      await safeQuery(
        `INSERT INTO device_enrollment_log (device_id, employee_id, action, hw_id, ip, metadata)
         VALUES ($1, $2, 'enrolled', $3, $4, $5)`,
        [device.id, staff.employee_id, hwId, clientIp, { os, agent_version, isFirstEnrollment: true }]
      );
    } else if (device.hw_id && hwId && device.hw_id !== hwId) {
      // HWID changed - log mismatch
      await safeQuery(
        `INSERT INTO device_enrollment_log (device_id, employee_id, action, hw_id, ip, metadata)
         VALUES ($1, $2, 'hw_id_changed', $3, $4, $5)`,
        [device.id, staff.employee_id, hwId, clientIp, { previousHwId: device.hw_id }]
      );
    }

    const token = signAgentToken({ staffId: staff.id, employeeId: staff.employee_id, deviceId: device.id });
    
    // Audit log: successful login
    await logAgentAction({
      action: AUDIT_ACTIONS['agent.login.success'],
      employeeId: staff.employee_id,
      deviceId: device.id,
      ip: clientIp,
      details: { 
        isFirstEnrollment, 
        os, 
        agentVersion: agent_version,
        hasHwId: !!hwId,
        twoFactorUsed: staff.two_fa_enabled 
      },
      severity: 'info',
      userAgent: req.get('user-agent'),
    });
    
    res.json({ token, employee_id: staff.employee_id, device_id: device.id, first_enrollment: isFirstEnrollment });
  } catch (err) {
    console.error('[agent:login]', err);
    
    // Audit log: failed login
    await logAgentAction({
      action: AUDIT_ACTIONS['agent.login.failed'],
      employeeId: staff?.employee_id || null,
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      details: { error: err.message, email: email?.toLowerCase() },
      severity: 'warning',
      userAgent: req.get('user-agent'),
    });
    
    res.status(500).json({ error: 'Login failed' });
  }
});

// Apply standard auth to all routes except heartbeat (which needs sequence validation)
router.use((req, res, next) => {
  if (req.path === '/session/heartbeat') {
    return authenticateAgentHeartbeat(req, res, next);
  }
  return authenticateAgent(req, res, next);
});

// Get company timezone for work date calculation
let cachedTimezone = null;
let timezoneCachedAt = 0;
const TIMEZONE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCompanyTimezone() {
  const now = Date.now();
  if (cachedTimezone && (now - timezoneCachedAt) < TIMEZONE_CACHE_TTL_MS) {
    return cachedTimezone;
  }
  const { rows: [settings] } = await safeQuery(`SELECT company_timezone FROM monitoring_settings WHERE id = 1`);
  cachedTimezone = settings?.company_timezone || 'Asia/Kolkata';
  timezoneCachedAt = now;
  return cachedTimezone;
}

// Get current work date in company timezone
async function getCurrentWorkDate() {
  const timezone = await getCompanyTimezone();
  // Use PostgreSQL to get current date in company timezone
  const { rows: [result] } = await safeQuery(
    `SELECT (NOW() AT TIME ZONE $1)::date AS work_date`,
    [timezone]
  );
  return result.work_date;
}

// Today's cumulative worked/idle time ACROSS all of today's sessions (not
// just the currently-open one) — this is what "continue from where you
// stopped" actually means: if you did Session 1 (40m) then Session 2,
// the tray and dashboard should both show 40m+ as the day's total from
// the moment Session 2 starts, not restart the clock at 0.
async function getTodayTotals(employeeId, workDate) {
  const { rows: [totals] } = await safeQuery(
    `SELECT COALESCE(SUM(active_seconds),0)::int AS active_seconds, COALESCE(SUM(idle_seconds),0)::int AS idle_seconds
     FROM agent_sessions WHERE employee_id = $1 AND work_date = $2`,
    [employeeId, workDate]
  );
  return totals;
}

// ── agent config — pulled on boot and before every "Start Work" ────────────
router.get('/me', async (req, res) => {
  try {
    const { rows: [employee] } = await safeQuery(
      `SELECT full_name, work_email, employee_code FROM employees WHERE id = $1`,
      [req.agent.employeeId]
    );
    const { rows: [settings] } = await safeQuery(`SELECT * FROM monitoring_settings WHERE id = 1`);
    
    // Fetch office networks for work mode detection
    const { rows: officeNetworks } = await safeQuery(
      `SELECT id, name, cidr FROM office_networks WHERE id = ANY($1)`,
      [settings.allowed_office_network_ids || []]
    );
    
    const openSession = await closeStaleSessions(req.agent.employeeId)
      .then(() => safeQuery(
        `SELECT id, clock_in, work_date, active_seconds, idle_seconds, heartbeat_seq FROM agent_sessions WHERE employee_id = $1 AND status = 'open' ORDER BY clock_in DESC LIMIT 1`,
        [req.agent.employeeId]
      ))
      .then(({ rows }) => rows[0] || null);

    const todayTotals = openSession ? await getTodayTotals(req.agent.employeeId, openSession.work_date) : null;

    res.json({ employee, settings, office_networks: officeNetworks, open_session: openSession, today_totals: todayTotals });
  } catch (err) {
    console.error('[agent:me]', err);
    res.status(500).json({ error: 'Failed to load agent config' });
  }
});

// ── start work ───────────────────────────────────────────────────────────
router.post('/session/start', async (req, res) => {
  try {
    await closeStaleSessions(req.agent.employeeId);

    const { rows: [existing] } = await safeQuery(
      `SELECT id, clock_in, work_date, active_seconds, idle_seconds, heartbeat_seq FROM agent_sessions WHERE employee_id = $1 AND status = 'open' ORDER BY clock_in DESC LIMIT 1`,
      [req.agent.employeeId]
    );
    if (existing) {
      const todayTotals = await getTodayTotals(req.agent.employeeId, existing.work_date);
      return res.json({
        session_id: existing.id, clock_in: existing.clock_in, resumed: true,
        active_seconds: existing.active_seconds, idle_seconds: existing.idle_seconds, today_totals: todayTotals,
        next_heartbeat_seq: (existing.heartbeat_seq || 0) + 1
      });
    }

    const now = new Date();
    const workDate = await getCurrentWorkDate();

    const result = await withTransaction(async (client) => {
      const { rows: [session] } = await client.query(
        `INSERT INTO agent_sessions (employee_id, device_id, work_date, clock_in, last_heartbeat_at, last_heartbeat_received_at, status, heartbeat_seq)
         VALUES ($1,$2,$3,$4,$4,$4,'open',0) RETURNING id, clock_in`,
        [req.agent.employeeId, req.agent.deviceId, workDate, now]
      );
      await client.query(
        `INSERT INTO attendance_records (employee_id, work_date, status, clock_in, source)
         VALUES ($1,$2,'present',$3,'agent')
         ON CONFLICT (employee_id, work_date) DO UPDATE SET clock_in = EXCLUDED.clock_in, source = 'agent'`,
        [req.agent.employeeId, workDate, now]
      );
      return session;
    });

    // A brand-new session's own counters start at 0, but if the employee
    // already worked an earlier session today (Session 1 closed, this is
    // Session 2), today_totals still carries that forward — this is the
    // number the tray should actually display, not result's own 0.
    const todayTotals = await getTodayTotals(req.agent.employeeId, workDate);
    res.json({ session_id: result.id, clock_in: result.clock_in, resumed: false, active_seconds: 0, idle_seconds: 0, today_totals: todayTotals, next_heartbeat_seq: 1 });
  } catch (err) {
    console.error('[agent:session:start]', err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// ── periodic sync (default: every 30s) ──────────────────────────────────
// Body: {
//   session_id,
//   heartbeat_seq,              // monotonically increasing sequence (required)
//   work_mode,                  // 'office' | 'wfh' | 'hybrid' (optional, from client)
//   current_app, current_window_title, current_domain,   // for the live dashboard
//   active_seconds_delta, idle_seconds_delta,             // since last heartbeat
//   app_segments: [{ app_name, window_title, started_at, ended_at, duration_seconds }],
//   website_segments: [{ domain, started_at, ended_at, duration_seconds }],
//   idle_periods: [{ started_at, ended_at, duration_seconds }],
// }
router.post('/session/heartbeat', async (req, res) => {
  try {
    const {
      session_id, heartbeat_seq,
      work_mode,
      current_app, current_window_title, current_domain,
      active_seconds_delta = 0, idle_seconds_delta = 0,
      app_segments = [], website_segments = [], idle_periods = [],
    } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });
    if (typeof heartbeat_seq !== 'number') return res.status(400).json({ error: 'heartbeat_seq is required' });

    // req.agent.sessionId and req.agent.heartbeatSeq are set by authenticateAgentHeartbeat
    // and already validated - but double-check session ownership
    if (req.agent.sessionId !== session_id) {
      return res.status(403).json({ error: 'Session ID mismatch' });
    }

    const { rows: [session] } = await safeQuery(
      `SELECT id, work_date FROM agent_sessions WHERE id = $1 AND employee_id = $2 AND status = 'open'`,
      [session_id, req.agent.employeeId]
    );
    if (!session) return res.status(404).json({ error: 'No open session with that id — call /session/start again' });

    // Auto-detect work_mode from server-side IP if not provided by client
    let finalWorkMode = work_mode;
    if (!finalWorkMode) {
      const { rows: [device] } = await safeQuery(`SELECT is_office_network FROM agent_devices WHERE id = $1`, [req.agent.deviceId]);
      finalWorkMode = device?.is_office_network ? 'office' : 'wfh';
    }

    await withTransaction(async (client) => {
      for (const seg of app_segments.slice(0, 500)) {
        await client.query(
          `INSERT INTO app_usage_segments (session_id, employee_id, app_name, window_title, started_at, ended_at, duration_seconds)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [session_id, req.agent.employeeId, seg.app_name, seg.window_title || null, seg.started_at, seg.ended_at, seg.duration_seconds]
        );
      }
      for (const seg of website_segments.slice(0, 500)) {
        await client.query(
          `INSERT INTO website_usage_segments (session_id, employee_id, domain, started_at, ended_at, duration_seconds)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [session_id, req.agent.employeeId, seg.domain, seg.started_at, seg.ended_at, seg.duration_seconds]
        );
      }
      for (const seg of idle_periods.slice(0, 200)) {
        await client.query(
          `INSERT INTO idle_periods (session_id, employee_id, started_at, ended_at, duration_seconds)
           VALUES ($1,$2,$3,$4,$5)`,
          [session_id, req.agent.employeeId, seg.started_at, seg.ended_at || null, seg.duration_seconds || null]
        );
      }

      // Update session with new sequence number, server receipt timestamp, and work_mode
      await client.query(
        `UPDATE agent_sessions SET
           active_seconds = active_seconds + $2, idle_seconds = idle_seconds + $3,
           last_heartbeat_at = NOW(), last_heartbeat_received_at = NOW(),
           heartbeat_seq = $7, current_app = $4, current_window_title = $5, current_domain = $6,
           work_mode = $8
         WHERE id = $1`,
        [session_id, active_seconds_delta, idle_seconds_delta, current_app || null, current_window_title || null, current_domain || null, heartbeat_seq, finalWorkMode]
      );
      await client.query(
        `UPDATE attendance_records SET
           active_seconds = active_seconds + $3, idle_seconds = idle_seconds + $4
         WHERE employee_id = $1 AND work_date = $2`,
        [req.agent.employeeId, session.work_date, active_seconds_delta, idle_seconds_delta]
      );
      await client.query(`UPDATE agent_devices SET last_seen_at = NOW() WHERE id = $1`, [req.agent.deviceId]);
    });

    // Return the authoritative post-update totals + next expected sequence
    const { rows: [updated] } = await safeQuery(
      `SELECT active_seconds, idle_seconds, heartbeat_seq FROM agent_sessions WHERE id = $1`,
      [session_id]
    );
    const todayTotals = await getTodayTotals(req.agent.employeeId, session.work_date);
    res.json({ 
      ok: true, 
      active_seconds: updated.active_seconds, 
      idle_seconds: updated.idle_seconds, 
      today_totals: todayTotals,
      next_heartbeat_seq: updated.heartbeat_seq + 1
    });
  } catch (err) {
    console.error('[agent:session:heartbeat]', err);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// ── stop work (graceful "Logout" click) ─────────────────────────────────
router.post('/session/stop', async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });

    const { rows: [session] } = await safeQuery(
      `SELECT id, work_date FROM agent_sessions WHERE id = $1 AND employee_id = $2 AND status = 'open'`,
      [session_id, req.agent.employeeId]
    );
    if (!session) return res.status(404).json({ error: 'No open session with that id' });

    const now = new Date();
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE agent_sessions SET status = 'closed', clock_out = $2, end_reason = 'logout', last_heartbeat_at = $2 WHERE id = $1`,
        [session_id, now]
      );
      await client.query(
        `UPDATE attendance_records SET clock_out = $3 WHERE employee_id = $1 AND work_date = $2`,
        [req.agent.employeeId, session.work_date, now]
      );
    });

    res.json({ ok: true, clock_out: now });
  } catch (err) {
    console.error('[agent:session:stop]', err);
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

// ── force logout — agent calls this best-effort on OS shutdown/log-off ────
// (e.g. Electron's session-end / power-monitor 'shutdown' event). For a
// hard crash where even this doesn't fire, closeStaleSessions() above
// catches it on the employee's next /me or /session/start call.
router.post('/session/force-logout', async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });
    const now = new Date();

    const { rows: [session] } = await safeQuery(
      `UPDATE agent_sessions SET status = 'closed', clock_out = $3, end_reason = 'force_logout', last_heartbeat_at = $3
       WHERE id = $1 AND employee_id = $2 AND status = 'open' RETURNING work_date`,
      [session_id, req.agent.employeeId, now]
    );
    if (session[0]) {
      await safeQuery(
        `UPDATE attendance_records SET clock_out = $3 WHERE employee_id = $1 AND work_date = $2`,
        [req.agent.employeeId, session[0].work_date, now]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[agent:session:force-logout]', err);
    res.status(500).json({ error: 'Failed to force-logout session' });
  }
});

// ── screenshot upload (optional feature) ───────────────────────────────
router.post('/screenshot', upload.single('image'), async (req, res) => {
  try {
    const { rows: [settings] } = await safeQuery(`SELECT * FROM monitoring_settings WHERE id = 1`);
    if (!settings?.screenshots_enabled) return res.status(403).json({ error: 'Screenshots are disabled company-wide' });

    const { session_id, captured_at, monitor_index = 0, monitor_name = 'Primary', hash } = req.body;
    if (!session_id || !req.file) return res.status(400).json({ error: 'session_id and image file are required' });

    const { rows: [session] } = await safeQuery(
      `SELECT id FROM agent_sessions WHERE id = $1 AND employee_id = $2`,
      [session_id, req.agent.employeeId]
    );
    if (!session) return res.status(404).json({ error: 'No such session' });

    // Verify hash if provided and verification is enabled
    if (hash && settings.screenshot_hash_verification) {
      const crypto = require('crypto');
      const computedHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      if (computedHash !== hash) {
        // Log hash mismatch anomaly
        await safeQuery(
          `INSERT INTO heartbeat_anomaly_log (session_id, employee_id, device_id, anomaly_type, severity, details, ip)
           VALUES ($1, $2, $3, 'screenshot_hash_mismatch', 'critical', $4, $5)`,
          [session_id, req.agent.employeeId, req.agent.deviceId, { expected: hash, computed: computedHash }, req.ip]
        );
        return res.status(400).json({ error: 'Screenshot hash verification failed' });
      }
    }

    const ext = (req.file.mimetype || '').includes('png') ? 'png' : 'jpg';
    const storagePath = `${req.agent.employeeId}/${session_id}/${crypto.randomUUID()}_monitor${monitor_index}.${ext}`;
    await storage.uploadFile(storagePath, req.file.buffer, req.file.mimetype, storage.SCREENSHOTS_BUCKET);

    await safeQuery(
      `INSERT INTO screenshots (session_id, employee_id, captured_at, storage_path, monitor_index, monitor_name, hash, watermark_applied) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [session_id, req.agent.employeeId, captured_at || new Date(), storagePath, monitor_index, monitor_name, hash, settings.screenshot_watermark_enabled]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[agent:screenshot]', err);
    res.status(500).json({ error: 'Failed to upload screenshot' });
  }
});

module.exports = router;
