'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { fetchTrackpilotsEmployees, fetchAttendanceSummary } = require('../services/trackpilotsClient');

router.use(authenticate);

// ── manual/scheduled pull — the primary sync path ───────────────────────────
// Calls the real Trackpilots REST API (report-analysis/attendance-summary).
// Auto-maps any employee missing a trackpilot_user_id by matching work_email
// against Trackpilots' own roster first, so newly added employees don't need
// manual UUID entry before their first sync.
//
// KNOWN LIMITATION: this endpoint only returns attendanceStatus + checkIn/
// checkOut per day — no active/idle seconds breakdown (that lives under a
// different endpoint, /v1/report-analysis/monthly-summary or the work-summary
// family). active_seconds/idle_seconds are left at their column defaults
// here. If you want those populated too, say so and I'll add the second call.
router.post('/sync/trackpilot', requireRole('hr'), async (req, res) => {
  try {
    const { month, year, timeZone } = req.body;
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required (e.g. { "month": 7, "year": 2026 })' });
    }

    let autoMapped = 0;
    try {
      const tpEmployees = await fetchTrackpilotsEmployees();
      const { rows: unmapped } = await safeQuery(
        `SELECT id, work_email FROM employees
         WHERE trackpilot_user_id IS NULL AND work_email IS NOT NULL AND status != 'exited'`
      );
      for (const emp of unmapped) {
        const match = tpEmployees.find(
          (t) => t.emailId && t.emailId.toLowerCase() === emp.work_email.toLowerCase()
        );
        if (match) {
          await safeQuery(`UPDATE employees SET trackpilot_user_id = $1 WHERE id = $2`, [match.userId, emp.id]);
          autoMapped++;
        }
      }
    } catch (mapErr) {
      // Don't let a mapping failure block syncing whoever's already mapped.
      console.warn('[attendance:sync] auto-map step failed, continuing with existing mappings:', mapErr.message);
    }

    const { rows: employees } = await safeQuery(
      `SELECT id, trackpilot_user_id FROM employees WHERE trackpilot_user_id IS NOT NULL AND status != 'exited'`
    );
    if (!employees.length) {
      return res.status(400).json({
        error: 'No employees are linked to a Trackpilots user yet. Auto-mapping matches by work_email — ' +
          'make sure each employee\'s work_email matches their Trackpilots login email, or set trackpilot_user_id manually.',
      });
    }

    const idByTrackpilotId = Object.fromEntries(employees.map((e) => [e.trackpilot_user_id, e.id]));
    const userIds = employees.map((e) => e.trackpilot_user_id);

    const data = await fetchAttendanceSummary({
      userIds,
      year: Number(year),
      month: Number(month),
      timeZone: timeZone || process.env.COMPANY_TIMEZONE || 'Asia/Kolkata',
    });

    let synced = 0, skipped = 0;
    for (const userBlock of data) {
      const employeeId = idByTrackpilotId[userBlock.user?.userId];
      if (!employeeId) { continue; }

      for (const day of userBlock.dailySummary || []) {
        // UPCOMING = future date this month, nothing to record yet.
        // WEEK_OFF = not a working day, no attendance expected.
        if (day.attendanceStatus === 'UPCOMING' || day.attendanceStatus === 'WEEK_OFF') {
          skipped++;
          continue;
        }

        const status = day.attendanceStatus === 'ABSENT' ? 'absent' : 'present'; // PRESENT + WORKED_ON_WEEK_OFF -> present

        // checkIn/checkOut come back as formatted strings ("9:05 AM"), not
        // ISO timestamps — combine with the day's date. This is a best-effort
        // parse using the server's local time interpretation; for a fully
        // timezone-correct value, this would need to explicitly account for
        // the `timeZone` sent in the request rather than relying on JS's
        // Date parsing of the combined string.
        const clockIn = day.checkIn ? new Date(`${day.date} ${day.checkIn}`) : null;
        const clockOut = day.checkOut ? new Date(`${day.date} ${day.checkOut}`) : null;

        await safeQuery(
          `INSERT INTO attendance_records (employee_id, work_date, status, clock_in, clock_out, source, raw_payload)
           VALUES ($1,$2,$3,$4,$5,'trackpilot',$6)
           ON CONFLICT (employee_id, work_date) DO UPDATE SET
             status = EXCLUDED.status, clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,
             source = EXCLUDED.source, raw_payload = EXCLUDED.raw_payload`,
          [
            employeeId,
            day.date,
            status,
            clockIn && !isNaN(clockIn) ? clockIn : null,
            clockOut && !isNaN(clockOut) ? clockOut : null,
            JSON.stringify(day),
          ]
        );
        synced++;
      }
    }

    res.json({
      message: `Synced ${synced} attendance record(s) across ${employees.length} employee(s)` +
        (autoMapped ? ` (auto-mapped ${autoMapped} new employee${autoMapped === 1 ? '' : 's'} to Trackpilots by email).` : '.'),
      synced,
      skipped,
      employeesSynced: employees.length,
      autoMapped,
    });
  } catch (err) {
    console.error('[attendance:sync]', err);
    res.status(err.status || 500).json({ error: err.message || 'Sync failed' });
  }
});

// ── webhook receiver — live desktop events (activity/app/screenshot) ───────
// Trackpilots' real webhook events are per-activity pings (work-mode /
// privacy-mode changes), not a daily attendance rollup — so this feeds a
// different use case than /sync/trackpilot above (live presence, not the
// daily present/absent record). Signature verification below follows
// Trackpilots' documented scheme exactly:
//   HMAC_SHA256(`${timestamp}.${rawBody}`, TRACKPILOTS_WEBHOOK_SECRET)
// sent as header x-webhook-signature, compared against x-webhook-timestamp.
// See https://developer.trackpilots.com/docs/developer-tools/webhooks
//
// The exact payload field names for each event type weren't fully specified
// in what I could pull from their docs (the OpenAPI schema components for
// DesktopActivityTrackingCapturedEvent etc. weren't populated at the URLs
// I checked) — mapTrackPilotPayload() below is unchanged/best-effort from
// before. First real webhook received will log its full raw shape so you
// can correct the field mapping against what actually arrives.
function mapTrackPilotPayload(payload) {
  // ADAPT if the logged raw payload (see console.log below) shows different field names.
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

function verifyTrackpilotsSignature(req) {
  const secret = process.env.TRACKPILOTS_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('TRACKPILOTS_WEBHOOK_SECRET not configured');
  }
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  if (!signature || !timestamp) {
    throw Object.assign(new Error('Missing webhook signature headers'), { status: 400 });
  }

  const rawBody = req.body; // Buffer, since this route uses express.raw()
  const payloadToSign = `${timestamp}.${rawBody.toString()}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const valid = sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  if (!valid) {
    throw Object.assign(new Error('Invalid webhook signature'), { status: 401 });
  }
}

router.post('/webhooks/trackpilot', express.raw({ type: 'application/json', limit: '50mb' }), async (req, res) => {
  try {
    verifyTrackpilotsSignature(req);
  } catch (err) {
    console.warn('[attendance:webhook] signature check failed:', err.message);
    return res.status(err.status || 401).send(err.message);
  }

  try {
    const event = JSON.parse(req.body.toString());
    console.log('[attendance:webhook] verified Trackpilots event received — raw shape:', JSON.stringify(event).slice(0, 500));

    const mapped = mapTrackPilotPayload(event);
    if (!mapped.trackpilotUserId || !mapped.workDate) {
      console.warn('[attendance:webhook] payload missing expected user/date fields after mapping — check the logged raw shape above and adjust mapTrackPilotPayload()');
      return res.status(200).json({ received: true, mapped: false });
    }
    const record = await upsertAttendance(mapped, event);
    res.status(200).json({ received: true, recordId: record?.id || null });
  } catch (err) {
    console.error('[attendance:webhook]', err);
    res.status(200).json({ received: true }); // ack anyway per Trackpilots' retry policy
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