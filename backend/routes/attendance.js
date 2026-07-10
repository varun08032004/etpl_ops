'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────
// NOTE: TrackPilot's actual API shape (webhook payload / REST endpoints /
// auth method) isn't something I can verify — I don't have visibility into
// their docs. This file has the two integration points wired to your DB
// with the field mapping made explicit, so plugging in the real TrackPilot
// contract is a find-and-replace on `mapTrackPilotPayload()` and the
// `pullFromTrackPilot()` request, not a redesign.
// ─────────────────────────────────────────────────────────────────────────

router.use(authenticate);

function mapTrackPilotPayload(payload) {
  // ADAPT THIS to TrackPilot's real webhook/API field names.
  return {
    trackpilotUserId: payload.user_id || payload.userId,
    workDate: payload.date || payload.work_date,
    clockIn: payload.clock_in || payload.start_time || null,
    clockOut: payload.clock_out || payload.end_time || null,
    activeSeconds: payload.active_seconds ?? payload.activeTime ?? 0,
    idleSeconds: payload.idle_seconds ?? payload.idleTime ?? 0,
  };
}

async function upsertAttendance(mapped, rawPayload) {
  const { rows: [employee] } = await safeQuery(
    `SELECT id FROM employees WHERE trackpilot_user_id = $1`,
    [mapped.trackpilotUserId]
  );
  if (!employee) {
    console.warn('[attendance] no employee mapped to trackpilot_user_id', mapped.trackpilotUserId);
    return null;
  }

  // Presence rule: if active time is very low relative to a workday, mark half_day; zero -> absent.
  // Tune these thresholds to your team's actual working hours.
  const activeHours = mapped.activeSeconds / 3600;
  let status = 'present';
  if (activeHours === 0 && !mapped.clockIn) status = 'absent';
  else if (activeHours > 0 && activeHours < 4) status = 'half_day';

  const { rows: [record] } = await safeQuery(
    `INSERT INTO attendance_records (employee_id, work_date, status, clock_in, clock_out, active_seconds, idle_seconds, source, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'trackpilot',$8)
     ON CONFLICT (employee_id, work_date) DO UPDATE SET
       status = EXCLUDED.status, clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,
       active_seconds = EXCLUDED.active_seconds, idle_seconds = EXCLUDED.idle_seconds, raw_payload = EXCLUDED.raw_payload
     RETURNING *`,
    [employee.id, mapped.workDate, status, mapped.clockIn, mapped.clockOut, mapped.activeSeconds, mapped.idleSeconds, rawPayload]
  );
  return record;
}

// ── webhook receiver — point TrackPilot's webhook config at this URL ───────
router.post('/webhooks/trackpilot', express.json(), async (req, res) => {
  // TODO: verify TrackPilot's webhook signature header (check their docs for the header name)
  // before trusting the payload — same pattern as the Razorpay webhook verification.
  try {
    const mapped = mapTrackPilotPayload(req.body);
    if (!mapped.trackpilotUserId || !mapped.workDate) {
      return res.status(400).json({ error: 'Payload missing user/date fields' });
    }
    const record = await upsertAttendance(mapped, req.body);
    res.status(200).json({ received: true, recordId: record?.id || null });
  } catch (err) {
    console.error('[attendance:webhook]', err);
    res.status(200).json({ received: true }); // ack to avoid webhook retries storming
  }
});

// ── manual pull fallback — call this from a cron job if TrackPilot only offers a REST API, not webhooks ──
router.post('/sync/trackpilot', requireRole('hr'), async (req, res) => {
  try {
    if (!process.env.TRACKPILOT_API_KEY) {
      return res.status(500).json({ error: 'TRACKPILOT_API_KEY not configured' });
    }
    // const axios = require('axios');
    // const { data } = await axios.get('https://api.trackpilot.example/v1/attendance', {
    //   headers: { Authorization: `Bearer ${process.env.TRACKPILOT_API_KEY}` },
    //   params: { date: req.body.date },
    // });
    // const results = await Promise.all(data.records.map(r => upsertAttendance(mapTrackPilotPayload(r), r)));
    res.status(501).json({
      error: 'Pull sync not wired up yet — needs TrackPilot API base URL + endpoint from their docs. See commented-out code in this handler.',
    });
  } catch (err) {
    console.error('[attendance:sync]', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ── view attendance ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { employee_id, from, to } = req.query;
    const conditions = [];
    const params = [];
    if (employee_id) { params.push(employee_id); conditions.push(`employee_id = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`work_date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`work_date <= $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT * FROM attendance_records ${where} ORDER BY work_date DESC LIMIT 500`, params
    );
    res.json({ attendance: rows });
  } catch (err) {
    console.error('[attendance:list]', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

module.exports = router;
