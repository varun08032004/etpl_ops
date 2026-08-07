'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { canViewAllMonitoring, requireMonitoringAdmin } = require('../services/monitoringAccess');
const { getRules, summarizeProductivity, computeProductivityScore } = require('../services/productivity');
const { logAction } = require('../services/auditLog');
const storage = require('../services/storage');

router.use(authenticate);

function today() {
  return new Date().toISOString().slice(0, 10);
}

// A session is "online" if we've heard from it inside 2x the configured
// heartbeat interval — one missed beat is normal jitter, two in a row means
// the laptop's probably actually gone.
async function heartbeatWindowSeconds() {
  const { rows: [s] } = await safeQuery(`SELECT heartbeat_interval_seconds FROM monitoring_settings WHERE id = 1`);
  return (s?.heartbeat_interval_seconds || 30) * 2;
}

// ── live — today's status for everyone (or just the requester's own row) ──
router.get('/live', async (req, res) => {
  try {
    const canViewAll = await canViewAllMonitoring(req.staff);
    const windowSeconds = await heartbeatWindowSeconds();
    const workDate = today();

    if (!canViewAll && !req.staff.employee_id) return res.json({ employees: [] });
    const employeeFilter = canViewAll ? '' : 'AND e.id = $3';
    const params = canViewAll ? [windowSeconds, workDate] : [windowSeconds, workDate, req.staff.employee_id];

    const { rows } = await safeQuery(
      `SELECT
         e.id AS employee_id, e.full_name, e.employee_code, d.name AS department,
         s.id AS session_id, s.clock_in, s.clock_out, s.status AS session_status, s.end_reason,
         s.current_app, s.current_window_title, s.current_domain,
         (s.status = 'open' AND s.last_heartbeat_at > NOW() - ($1 * INTERVAL '1 second')) AS is_online,
         COALESCE(t.active_seconds, 0) AS active_seconds,
         COALESCE(t.idle_seconds, 0) AS idle_seconds,
         COALESCE(t.session_count, 0) AS session_count
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN LATERAL (
         SELECT * FROM agent_sessions
         WHERE employee_id = e.id AND work_date = $2
         ORDER BY clock_in DESC LIMIT 1
       ) s ON true
       LEFT JOIN LATERAL (
         -- Today's TOTAL across every session (not just the latest) — this
         -- is what "continue from where you stopped" means: Session 1
         -- closed at 40m, Session 2 started, the number shown is 40m+,
         -- never reset to 0.
         SELECT SUM(active_seconds)::int AS active_seconds, SUM(idle_seconds)::int AS idle_seconds, COUNT(*)::int AS session_count
         FROM agent_sessions WHERE employee_id = e.id AND work_date = $2
       ) t ON true
       WHERE e.status = 'active' ${employeeFilter}
       ORDER BY is_online DESC NULLS LAST, e.full_name`,
      params
    );

    // Score needs today's category breakdown per employee, which the main
    // query above doesn't have (it only has session-level active/idle
    // totals) — two grouped queries here instead of looping per-employee,
    // so this stays O(1) queries regardless of headcount.
    const rules = await getRules();
    const { rows: [settings] } = await safeQuery(`SELECT expected_daily_hours FROM monitoring_settings WHERE id = 1`);
    const employeeFilterApps = canViewAll ? '' : 'AND s.employee_id = $2';
    const appParams = canViewAll ? [workDate] : [workDate, req.staff.employee_id];
    const { rows: appRows } = await safeQuery(
      `SELECT s.employee_id, a.app_name, SUM(a.duration_seconds)::int AS duration_seconds
       FROM app_usage_segments a JOIN agent_sessions s ON s.id = a.session_id
       WHERE s.work_date = $1 ${employeeFilterApps}
       GROUP BY s.employee_id, a.app_name`,
      appParams
    );
    const { rows: siteRows } = await safeQuery(
      `SELECT s.employee_id, w.domain, SUM(w.duration_seconds)::int AS duration_seconds
       FROM website_usage_segments w JOIN agent_sessions s ON s.id = w.session_id
       WHERE s.work_date = $1 ${employeeFilterApps}
       GROUP BY s.employee_id, w.domain`,
      appParams
    );

    const appsByEmployee = new Map();
    for (const row of appRows) {
      if (!appsByEmployee.has(row.employee_id)) appsByEmployee.set(row.employee_id, []);
      appsByEmployee.get(row.employee_id).push(row);
    }
    const sitesByEmployee = new Map();
    for (const row of siteRows) {
      if (!sitesByEmployee.has(row.employee_id)) sitesByEmployee.set(row.employee_id, []);
      sitesByEmployee.get(row.employee_id).push(row);
    }

    const rowsWithScore = rows.map((r) => {
      const productivity = summarizeProductivity(rules, appsByEmployee.get(r.employee_id) || [], sitesByEmployee.get(r.employee_id) || []);
      const score = computeProductivityScore({
        totals: productivity.totals, activeSeconds: r.active_seconds, idleSeconds: r.idle_seconds,
        expectedDailyHours: settings?.expected_daily_hours || 8,
      });
      return { ...r, score: score.score, score_label: score.label };
    });

    res.json({ employees: rowsWithScore, can_view_all: canViewAll });
  } catch (err) {
    console.error('[monitoring:live]', err);
    res.status(500).json({ error: 'Failed to load live monitoring data' });
  }
});

// Shared implementation for both the self and admin day-drilldown routes.
async function buildDayReport(employeeId, date) {
  const { rows: sessions } = await safeQuery(
    `SELECT id, clock_in, clock_out, status, active_seconds, idle_seconds, end_reason
     FROM agent_sessions WHERE employee_id = $1 AND work_date = $2 ORDER BY clock_in`,
    [employeeId, date]
  );
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) {
    return {
      sessions: [], apps: [], websites: [], idle_periods: [], screenshots: [],
      productivity: { totals: {}, productivePct: 0 },
      score: { score: 0, label: 'No activity', breakdown: { focus: 0, engagement: 0, attendance: 0 } },
    };
  }

  const { rows: apps } = await safeQuery(
    `SELECT app_name, SUM(duration_seconds)::int AS duration_seconds
     FROM app_usage_segments WHERE session_id = ANY($1) GROUP BY app_name ORDER BY duration_seconds DESC`,
    [sessionIds]
  );
  const { rows: websites } = await safeQuery(
    `SELECT domain, SUM(duration_seconds)::int AS duration_seconds
     FROM website_usage_segments WHERE session_id = ANY($1) GROUP BY domain ORDER BY duration_seconds DESC`,
    [sessionIds]
  );
  const { rows: idlePeriods } = await safeQuery(
    `SELECT started_at, ended_at, duration_seconds FROM idle_periods WHERE session_id = ANY($1) ORDER BY started_at`,
    [sessionIds]
  );
  const { rows: screenshots } = await safeQuery(
    `SELECT id, captured_at FROM screenshots WHERE session_id = ANY($1) ORDER BY captured_at`,
    [sessionIds]
  );

  const rules = await getRules();
  const productivity = summarizeProductivity(rules, apps, websites);

  const { rows: [settings] } = await safeQuery(`SELECT expected_daily_hours FROM monitoring_settings WHERE id = 1`);
  const activeSeconds = sessions.reduce((sum, s) => sum + s.active_seconds, 0);
  const idleSeconds = sessions.reduce((sum, s) => sum + s.idle_seconds, 0);
  const score = computeProductivityScore({
    totals: productivity.totals, activeSeconds, idleSeconds,
    expectedDailyHours: settings?.expected_daily_hours || 8,
  });

  return { sessions, apps, websites, idle_periods: idlePeriods, screenshots, productivity, score };
}

// ── self view ────────────────────────────────────────────────────────────
router.get('/me/day', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(400).json({ error: 'No linked employee record for this account' });
    const date = req.query.date || today();
    const report = await buildDayReport(req.staff.employee_id, date);
    res.json({ date, ...report });
  } catch (err) {
    console.error('[monitoring:me:day]', err);
    res.status(500).json({ error: 'Failed to load your activity' });
  }
});

// ── admin/HR/HOD view of a specific employee ───────────────────────────────
router.get('/employee/:id/day', async (req, res) => {
  try {
    const isSelf = req.staff.employee_id === req.params.id;
    if (!isSelf && !(await canViewAllMonitoring(req.staff))) {
      return res.status(403).json({ error: 'Insufficient permissions to view this employee\'s activity' });
    }
    const date = req.query.date || today();
    const report = await buildDayReport(req.params.id, date);
    res.json({ date, employee_id: req.params.id, ...report });
  } catch (err) {
    console.error('[monitoring:employee:day]', err);
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

// ── screenshot — signed URL, permission-checked ────────────────────────────
router.get('/screenshots/:id/url', async (req, res) => {
  try {
    const { rows: [shot] } = await safeQuery(`SELECT employee_id, storage_path FROM screenshots WHERE id = $1`, [req.params.id]);
    if (!shot) return res.status(404).json({ error: 'Not found' });

    const isSelf = req.staff.employee_id === shot.employee_id;
    if (!isSelf && !(await canViewAllMonitoring(req.staff))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const url = await storage.getSignedUrl(shot.storage_path, 300, storage.SCREENSHOTS_BUCKET);
    res.json({ url });
  } catch (err) {
    console.error('[monitoring:screenshot:url]', err);
    res.status(500).json({ error: 'Failed to sign screenshot URL' });
  }
});

// ── productivity rules — admin/hr manage the app/domain → category map ────
router.get('/productivity-rules', async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM productivity_rules ORDER BY match_type, pattern`);
    res.json({ rules: rows });
  } catch (err) {
    console.error('[monitoring:rules:list]', err);
    res.status(500).json({ error: 'Failed to load productivity rules' });
  }
});

router.post('/productivity-rules', requireMonitoringAdmin, async (req, res) => {
  try {
    const { match_type, pattern, category } = req.body;
    if (!['app', 'domain'].includes(match_type)) return res.status(400).json({ error: 'match_type must be "app" or "domain"' });
    if (!pattern) return res.status(400).json({ error: 'pattern is required' });
    if (!['productive', 'unproductive', 'neutral', 'blocked'].includes(category)) {
      return res.status(400).json({ error: 'category must be productive, unproductive, neutral, or blocked' });
    }

    const { rows: [rule] } = await safeQuery(
      `INSERT INTO productivity_rules (match_type, pattern, category, created_by) VALUES ($1,$2,$3,$4)
       ON CONFLICT (match_type, pattern) DO UPDATE SET category = EXCLUDED.category
       RETURNING *`,
      [match_type, pattern, category, req.staff.id]
    );
    await logAction({ staffId: req.staff.id, action: 'monitoring.rule.upsert', entity: 'productivity_rules', entityId: rule.id, newValue: rule, ipAddress: req.ip });
    res.status(201).json({ rule });
  } catch (err) {
    console.error('[monitoring:rules:create]', err);
    res.status(500).json({ error: 'Failed to save rule' });
  }
});

router.delete('/productivity-rules/:id', requireMonitoringAdmin, async (req, res) => {
  try {
    await safeQuery(`DELETE FROM productivity_rules WHERE id = $1`, [req.params.id]);
    await logAction({ staffId: req.staff.id, action: 'monitoring.rule.delete', entity: 'productivity_rules', entityId: req.params.id, ipAddress: req.ip });
    res.json({ ok: true });
  } catch (err) {
    console.error('[monitoring:rules:delete]', err);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// ── company-wide monitoring settings ────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const { rows: [settings] } = await safeQuery(`SELECT * FROM monitoring_settings WHERE id = 1`);
    res.json({ settings });
  } catch (err) {
    console.error('[monitoring:settings:get]', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/settings', requireMonitoringAdmin, async (req, res) => {
  try {
    const {
      screenshots_enabled, screenshot_interval_seconds, idle_threshold_seconds, heartbeat_interval_seconds, consent_notice,
      restrict_incognito, expected_daily_hours,
    } = req.body;
    const { rows: [settings] } = await safeQuery(
      `UPDATE monitoring_settings SET
         screenshots_enabled = COALESCE($1, screenshots_enabled),
         screenshot_interval_seconds = COALESCE($2, screenshot_interval_seconds),
         idle_threshold_seconds = COALESCE($3, idle_threshold_seconds),
         heartbeat_interval_seconds = COALESCE($4, heartbeat_interval_seconds),
         consent_notice = COALESCE($5, consent_notice),
         restrict_incognito = COALESCE($6, restrict_incognito),
         expected_daily_hours = COALESCE($7, expected_daily_hours),
         updated_at = NOW()
       WHERE id = 1 RETURNING *`,
      [screenshots_enabled, screenshot_interval_seconds, idle_threshold_seconds, heartbeat_interval_seconds, consent_notice, restrict_incognito, expected_daily_hours]
    );
    await logAction({ staffId: req.staff.id, action: 'monitoring.settings.update', entity: 'monitoring_settings', entityId: '1', newValue: settings, ipAddress: req.ip });
    res.json({ settings });
  } catch (err) {
    console.error('[monitoring:settings:put]', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── devices — list + revoke, so a lost/offboarded laptop can be cut off ──
router.get('/devices', requireMonitoringAdmin, async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT ad.*, e.full_name FROM agent_devices ad JOIN employees e ON e.id = ad.employee_id ORDER BY ad.last_seen_at DESC NULLS LAST`
    );
    res.json({ devices: rows });
  } catch (err) {
    console.error('[monitoring:devices:list]', err);
    res.status(500).json({ error: 'Failed to load devices' });
  }
});

router.post('/devices/:id/revoke', requireMonitoringAdmin, async (req, res) => {
  try {
    await safeQuery(`UPDATE agent_devices SET status = 'revoked' WHERE id = $1`, [req.params.id]);
    await logAction({ staffId: req.staff.id, action: 'monitoring.device.revoke', entity: 'agent_devices', entityId: req.params.id, ipAddress: req.ip });
    res.json({ ok: true });
  } catch (err) {
    console.error('[monitoring:devices:revoke]', err);
    res.status(500).json({ error: 'Failed to revoke device' });
  }
});

module.exports = router;