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
const { signAgentToken, authenticateAgent } = require('../middleware/agentAuth');
const storage = require('../services/storage');
const { verifyTotp, decryptSecret, hashBackupCode } = require('../services/twoFactor');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }); // 8MB/screenshot

// A stale session (agent crashed / laptop battery died — no graceful
// "Stop Work" or "force-logout" call ever arrives) is auto-closed the next
// time we see ANY request that touches sessions, once its last heartbeat is
// older than this. Keeps "who's online right now" honest without needing a
// cron job in this small a deployment.
const STALE_SESSION_MINUTES = 10;

async function closeStaleSessions(employeeId) {
  const { rows } = await safeQuery(
    `UPDATE agent_sessions
     SET status = 'closed', clock_out = last_heartbeat_at, end_reason = 'timeout'
     WHERE employee_id = $1 AND status = 'open'
       AND last_heartbeat_at < NOW() - ($2 || ' minutes')::interval
     RETURNING id, work_date`,
    [employeeId, STALE_SESSION_MINUTES]
  );
  for (const row of rows) {
    await safeQuery(
      `UPDATE attendance_records SET clock_out = (SELECT last_heartbeat_at FROM agent_sessions WHERE id = $1)
       WHERE employee_id = $2 AND work_date = $3`,
      [row.id, employeeId, row.work_date]
    );
  }
  return rows;
}

// ── login — agent's own auth, reuses staff_accounts credentials ────────────
// Body: { email, password, company_code, device_name, os, agent_version, totp_token, backup_code }
router.post('/login', async (req, res) => {
  try {
    const { email, password, company_code, device_name, os, agent_version, totp_token, backup_code } = req.body;
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

    const { rows: [device] } = await safeQuery(
      `INSERT INTO agent_devices (employee_id, device_name, os, agent_version, status, last_seen_at)
       VALUES ($1,$2,$3,$4,'active',NOW())
       ON CONFLICT (employee_id, device_name) DO UPDATE SET
         os = EXCLUDED.os, agent_version = EXCLUDED.agent_version,
         status = 'active', last_seen_at = NOW()
       RETURNING id, status`,
      [staff.employee_id, device_name, os || null, agent_version || null]
    );
    if (device.status !== 'active') return res.status(403).json({ error: 'This device has been revoked' });

    const token = signAgentToken({ staffId: staff.id, employeeId: staff.employee_id, deviceId: device.id });
    res.json({ token, employee_id: staff.employee_id, device_id: device.id });
  } catch (err) {
    console.error('[agent:login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.use(authenticateAgent);

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
    const openSession = await closeStaleSessions(req.agent.employeeId)
      .then(() => safeQuery(
        `SELECT id, clock_in, work_date, active_seconds, idle_seconds FROM agent_sessions WHERE employee_id = $1 AND status = 'open' ORDER BY clock_in DESC LIMIT 1`,
        [req.agent.employeeId]
      ))
      .then(({ rows }) => rows[0] || null);

    const todayTotals = openSession ? await getTodayTotals(req.agent.employeeId, openSession.work_date) : null;

    res.json({ employee, settings, open_session: openSession, today_totals: todayTotals });
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
      `SELECT id, clock_in, work_date, active_seconds, idle_seconds FROM agent_sessions WHERE employee_id = $1 AND status = 'open' ORDER BY clock_in DESC LIMIT 1`,
      [req.agent.employeeId]
    );
    if (existing) {
      const todayTotals = await getTodayTotals(req.agent.employeeId, existing.work_date);
      return res.json({
        session_id: existing.id, clock_in: existing.clock_in, resumed: true,
        active_seconds: existing.active_seconds, idle_seconds: existing.idle_seconds, today_totals: todayTotals,
      });
    }

    const now = new Date();
    const workDate = now.toISOString().slice(0, 10);

    const result = await withTransaction(async (client) => {
      const { rows: [session] } = await client.query(
        `INSERT INTO agent_sessions (employee_id, device_id, work_date, clock_in, last_heartbeat_at, status)
         VALUES ($1,$2,$3,$4,$4,'open') RETURNING id, clock_in`,
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
    res.json({ session_id: result.id, clock_in: result.clock_in, resumed: false, active_seconds: 0, idle_seconds: 0, today_totals: todayTotals });
  } catch (err) {
    console.error('[agent:session:start]', err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// ── periodic sync (default: every 30s) ──────────────────────────────────
// Body: {
//   session_id,
//   current_app, current_window_title, current_domain,   // for the live dashboard
//   active_seconds_delta, idle_seconds_delta,             // since last heartbeat
//   app_segments: [{ app_name, window_title, started_at, ended_at, duration_seconds }],
//   website_segments: [{ domain, started_at, ended_at, duration_seconds }],
//   idle_periods: [{ started_at, ended_at, duration_seconds }],
// }
router.post('/session/heartbeat', async (req, res) => {
  try {
    const {
      session_id, current_app, current_window_title, current_domain,
      active_seconds_delta = 0, idle_seconds_delta = 0,
      app_segments = [], website_segments = [], idle_periods = [],
    } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });

    const { rows: [session] } = await safeQuery(
      `SELECT id, work_date FROM agent_sessions WHERE id = $1 AND employee_id = $2 AND status = 'open'`,
      [session_id, req.agent.employeeId]
    );
    if (!session) return res.status(404).json({ error: 'No open session with that id — call /session/start again' });

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

      await client.query(
        `UPDATE agent_sessions SET
           active_seconds = active_seconds + $2, idle_seconds = idle_seconds + $3,
           last_heartbeat_at = NOW(), current_app = $4, current_window_title = $5, current_domain = $6
         WHERE id = $1`,
        [session_id, active_seconds_delta, idle_seconds_delta, current_app || null, current_window_title || null, current_domain || null]
      );
      await client.query(
        `UPDATE attendance_records SET
           active_seconds = active_seconds + $3, idle_seconds = idle_seconds + $4
         WHERE employee_id = $1 AND work_date = $2`,
        [req.agent.employeeId, session.work_date, active_seconds_delta, idle_seconds_delta]
      );
      await client.query(`UPDATE agent_devices SET last_seen_at = NOW() WHERE id = $1`, [req.agent.deviceId]);
    });

    // Return the authoritative post-update totals — the agent seeds its
    // display from these rather than trusting its own running count, which
    // is what was causing the dashboard/tray numbers to drift apart.
    const { rows: [updated] } = await safeQuery(
      `SELECT active_seconds, idle_seconds FROM agent_sessions WHERE id = $1`,
      [session_id]
    );
    const todayTotals = await getTodayTotals(req.agent.employeeId, session.work_date);
    res.json({ ok: true, active_seconds: updated.active_seconds, idle_seconds: updated.idle_seconds, today_totals: todayTotals });
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
    const { rows: [settings] } = await safeQuery(`SELECT screenshots_enabled FROM monitoring_settings WHERE id = 1`);
    if (!settings?.screenshots_enabled) return res.status(403).json({ error: 'Screenshots are disabled company-wide' });

    const { session_id, captured_at } = req.body;
    if (!session_id || !req.file) return res.status(400).json({ error: 'session_id and image file are required' });

    const { rows: [session] } = await safeQuery(
      `SELECT id FROM agent_sessions WHERE id = $1 AND employee_id = $2`,
      [session_id, req.agent.employeeId]
    );
    if (!session) return res.status(404).json({ error: 'No such session' });

    const ext = (req.file.mimetype || '').includes('png') ? 'png' : 'jpg';
    const storagePath = `${req.agent.employeeId}/${session_id}/${crypto.randomUUID()}.${ext}`;
    await storage.uploadFile(storagePath, req.file.buffer, req.file.mimetype, storage.SCREENSHOTS_BUCKET);

    await safeQuery(
      `INSERT INTO screenshots (session_id, employee_id, captured_at, storage_path) VALUES ($1,$2,$3,$4)`,
      [session_id, req.agent.employeeId, captured_at || new Date(), storagePath]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[agent:screenshot]', err);
    res.status(500).json({ error: 'Failed to upload screenshot' });
  }
});

module.exports = router;
