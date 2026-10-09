'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { withIdempotency } = require('../middleware/idempotency');

router.use(authenticate);

// ── Helper: get current date in IST (company timezone) ───────────────────────────
function getISTDate() {
  // Use Asia/Kolkata timezone for company work date
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in ms
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().slice(0, 10);
}

function getISTDayOfWeek() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.getDay() === 0 ? 7 : istTime.getDay(); // 1=Mon, 7=Sun
}

// ── Helper: get working hours config for a date ────────────────────────────────
async function getWorkingHoursConfig(dayOfWeek) {
  const { rows: [config] } = await safeQuery(
    `SELECT * FROM company_working_hours WHERE day_of_week = $1`,
    [dayOfWeek]
  );
  return config || {
    punch_in_time: '09:30:00',
    punch_out_time: '19:00:00',
    grace_period_minutes: 15,
    is_working_day: dayOfWeek >= 1 && dayOfWeek <= 5,
    late_penalty_per_min: 0.5,
    early_leave_penalty_per_min: 0.5
  };
}

// ── Helper: calculate late/early minutes ──────────────────────────────────────
function calculateLateEarlyMinutes(clockIn, clockOut, expectedIn, expectedOut, graceMinutes) {
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  
  if (clockIn && expectedIn) {
    const diffMs = new Date(clockIn) - new Date(expectedIn);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins > graceMinutes) {
      lateMinutes = diffMins - graceMinutes;
    }
  }
  
  if (clockOut && expectedOut) {
    const diffMs = new Date(expectedOut) - new Date(clockOut);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins > 0) {
      earlyLeaveMinutes = diffMins;
    }
  }
  
  return { lateMinutes, earlyLeaveMinutes };
}

// ── Helper: determine status based on attendance ──────────────────────────────
function determineStatus(clockIn, clockOut, expectedIn, expectedOut, lateMinutes, earlyLeaveMinutes, isWorkingDay) {
  if (!isWorkingDay) return 'weekend';
  if (!clockIn && !clockOut) return 'absent';
  if (lateMinutes > 0 && earlyLeaveMinutes > 0) return 'late'; // both late and early leave
  if (lateMinutes > 0) return 'late';
  if (earlyLeaveMinutes > 0) return 'early_leave';
  return 'present';
}

// ── PUNCH IN (Agent Only) ──────────────────────────────────────────────────────
// Only source='agent' allowed. Creates pending record, attendance finalized on punch-out.
router.post('/punch-in', async (req, res) => {
  try {
    const { source = 'agent', device_info } = req.body;
    
    // Only allow agent source
    if (source !== 'agent') {
      return res.status(403).json({ error: 'Punch in only allowed via EtherTrack Desktop Agent' });
    }
    
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'No linked employee record for this account' });
    }
    const targetEmployeeId = req.staff.employee_id;
    
    const workDate = getISTDate();
    const dayOfWeek = getISTDayOfWeek();
    
    // Check if already punched in today
    const { rows: [existing] } = await safeQuery(
      `SELECT id, clock_in FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
      [targetEmployeeId, workDate]
    );
    
    if (existing?.clock_in) {
      return res.status(400).json({ error: 'Already punched in today', record: existing });
    }
    
    // Get working hours config (strict: 9:30 AM - 7:00 PM)
    const config = await getWorkingHoursConfig(dayOfWeek);
    if (!config.is_working_day) {
      return res.status(400).json({ error: 'Today is not a working day (Mon-Fri only)' });
    }
    
    // Strict expected times
    const expectedPunchIn = new Date(now);
    expectedPunchIn.setHours(9, 30, 0, 0);  // 9:30 AM
    
    const expectedPunchOut = new Date(now);
    expectedPunchOut.setHours(19, 0, 0, 0);  // 7:00 PM
    
    // Calculate late minutes (strict - no grace for agent)
    const lateMinutes = calculateLateEarlyMinutes(now, null, expectedPunchIn, expectedPunchOut, config.grace_period_minutes).lateMinutes;
    const status = 'pending'; // Will be finalized on punch-out
    
    // Insert pending attendance record (not finalized until punch-out)
    const { rows: [record] } = await safeQuery(
      `INSERT INTO attendance_records (employee_id, work_date, status, clock_in, expected_punch_in, expected_punch_out, late_minutes, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (employee_id, work_date) DO UPDATE SET
         clock_in = EXCLUDED.clock_in,
         expected_punch_in = EXCLUDED.expected_punch_in,
         expected_punch_out = EXCLUDED.expected_punch_out,
         late_minutes = EXCLUDED.late_minutes,
         status = EXCLUDED.status,
         source = EXCLUDED.source,
         updated_at = NOW()
       RETURNING *`,
      [targetEmployeeId, workDate, status, now, expectedPunchIn, expectedPunchOut, lateMinutes, 'agent']
    );
    
    // Log punch event
    await safeQuery(
      `INSERT INTO attendance_punch_log (employee_id, work_date, punch_type, punch_time, source, device_info)
       VALUES ($1,$2,'in',$3,$4,$5)`,
      [targetEmployeeId, workDate, now, 'agent', device_info ? JSON.stringify(device_info) : null]
    );
    
    res.json({ record, message: 'Punched in successfully via Agent' });
  } catch (err) {
    console.error('[attendance:punch-in]', err);
    res.status(err.status || 500).json({ error: err.message || 'Punch in failed' });
  }
});

// ── PUNCH OUT (Agent Only) ─────────────────────────────────────────────────────
// Only source='agent' allowed. Finalizes attendance record (requires both in/out).
router.post('/punch-out', async (req, res) => {
  try {
    const { source = 'agent', device_info } = req.body;
    
    // Only allow agent source
    if (source !== 'agent') {
      return res.status(403).json({ error: 'Punch out only allowed via EtherTrack Desktop Agent' });
    }
    
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'No linked employee record for this account' });
    }
    const targetEmployeeId = req.staff.employee_id;
    
    const workDate = getISTDate();
    const dayOfWeek = getISTDayOfWeek();
    
    // Get existing record
    const { rows: [existing] } = await safeQuery(
      `SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
      [targetEmployeeId, workDate]
    );
    
    if (!existing) {
      return res.status(400).json({ error: 'No punch-in record found for today. Please punch in first via Agent.' });
    }
    
    if (existing.clock_out) {
      return res.status(400).json({ error: 'Already punched out today', record: existing });
    }
    
    // Strict expected times (9:30 AM - 7:00 PM)
    const expectedPunchIn = existing.expected_punch_in || (() => { const d = new Date(now); d.setHours(9,30,0,0); return d; })();
    const expectedPunchOut = existing.expected_punch_out || (() => { const d = new Date(now); d.setHours(19,0,0,0); return d; })();
    
    // Get working hours config for grace period
    const config = await getWorkingHoursConfig(dayOfWeek);
    
    // Calculate late/early minutes
    const { lateMinutes: existingLate, earlyLeaveMinutes } = calculateLateEarlyMinutes(
      existing.clock_in, now, expectedPunchIn, expectedPunchOut, config.grace_period_minutes
    );
    
    // Finalize status now that we have both in and out
    const finalStatus = determineStatus(existing.clock_in, now, expectedPunchIn, expectedPunchOut, existingLate, earlyLeaveMinutes, config.is_working_day);
    
    // Update attendance record - FINALIZE it
    const { rows: [record] } = await safeQuery(
      `UPDATE attendance_records SET
         clock_out = $1,
         early_leave_minutes = $2,
         status = $3,
         source = $4,
         updated_at = NOW()
       WHERE employee_id = $5 AND work_date = $6
       RETURNING *`,
      [now, earlyLeaveMinutes, finalStatus, 'agent', targetEmployeeId, workDate]
    );
    
    // Log punch event
    await safeQuery(
      `INSERT INTO attendance_punch_log (employee_id, work_date, punch_type, punch_time, source, device_info)
       VALUES ($1,$2,'out',$3,$4,$5)`,
      [targetEmployeeId, workDate, now, 'agent', device_info ? JSON.stringify(device_info) : null]
    );
    
    res.json({ record, message: 'Punched out successfully via Agent. Attendance finalized.' });
  } catch (err) {
    console.error('[attendance:punch-out]', err);
    res.status(err.status || 500).json({ error: err.message || 'Punch out failed' });
  }
});

// ── REVERSAL: Undo Punch In (admin/hr/self within grace period) ────────────────
router.post('/punch-in/undo', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'No linked employee record' });
    }
    const today = getISTDate();
    
    // Check if punch in exists and no punch out yet
    const { rows: [record] } = await safeQuery(
      `SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
      [req.staff.employee_id, today]
    );
    
    if (!record || !record.clock_in) {
      return res.status(400).json({ error: 'No punch in to undo' });
    }
    if (record.clock_out) {
      return res.status(400).json({ error: 'Cannot undo punch in after punch out' });
    }
    
    // Delete the attendance record and punch log
    await safeQuery(`DELETE FROM attendance_punch_log WHERE employee_id = $1 AND work_date = $2 AND punch_type = 'in'`, [req.staff.employee_id, today]);
    await safeQuery(`DELETE FROM attendance_records WHERE employee_id = $1 AND work_date = $2`, [req.staff.employee_id, today]);
    
    res.json({ ok: true, message: 'Punch in undone' });
  } catch (err) {
    console.error('[attendance:punch-in:undo]', err);
    res.status(500).json({ error: 'Failed to undo punch in' });
  }
});

// ── REVERSAL: Undo Punch Out (admin/hr/self within grace period) ───────────────
router.post('/punch-out/undo', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'No linked employee record' });
    }
    const today = getISTDate();
    
    const { rows: [record] } = await safeQuery(
      `SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
      [req.staff.employee_id, today]
    );
    
    if (!record || !record.clock_out) {
      return res.status(400).json({ error: 'No punch out to undo' });
    }
    if (!record.clock_in) {
      return res.status(400).json({ error: 'Invalid state: punch out without punch in' });
    }
    
    // Revert to punched-in state (pending)
    const dayOfWeek = new Date(today).getDay() === 0 ? 7 : new Date(today).getDay();
    const config = await getWorkingHoursConfig(dayOfWeek);
    const expectedPunchIn = record.expected_punch_in;
    const expectedPunchOut = record.expected_punch_out;
    const lateMinutes = record.late_minutes || 0;
    
    const { rows: [updated] } = await safeQuery(
      `UPDATE attendance_records SET
         clock_out = NULL,
         early_leave_minutes = 0,
         status = 'pending',
         updated_at = NOW()
       WHERE employee_id = $1 AND work_date = $2
       RETURNING *`,
      [req.staff.employee_id, today]
    );
    
    // Delete the punch-out log entry
    await safeQuery(`DELETE FROM attendance_punch_log WHERE employee_id = $1 AND work_date = $2 AND punch_type = 'out'`, [req.staff.employee_id, today]);
    
    res.json({ record: updated, message: 'Punch out undone — now punched in again' });
  } catch (err) {
    console.error('[attendance:punch-out:undo]', err);
    res.status(500).json({ error: 'Failed to undo punch out' });
  }
});

// ── GET TODAY'S ATTENDANCE STATUS (for self) ───────────────────────────────────
router.get('/me/today', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'No linked employee record for this account' });
    }
    const today = getISTDate();
    
    const { rows: [record] } = await safeQuery(
      `SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
      [req.staff.employee_id, today]
    );
    
    // Also get punch log for today
    const { rows: punchLog } = await safeQuery(
      `SELECT punch_type, punch_time, source FROM attendance_punch_log WHERE employee_id = $1 AND work_date = $2 ORDER BY punch_time`,
      [req.staff.employee_id, today]
    );
    
    res.json({ record: record || null, punch_log: punchLog });
  } catch (err) {
    console.error('[attendance:me:today] ERROR:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch today\'s attendance', detail: err.message });
  }
});

// ── LIVE ATTENDANCE — today's status for all employees (admin/hr) ───────────────
router.get('/live/today', requireRole('admin', 'hr'), async (req, res) => {
  try {
    const today = getISTDate();
    const dayOfWeek = getISTDayOfWeek();
    const config = await getWorkingHoursConfig(dayOfWeek);
    
    const { rows } = await safeQuery(
      `SELECT 
         e.id AS employee_id, e.full_name, e.employee_code, e.work_email, d.name AS department,
         ar.clock_in, ar.clock_out, ar.status, ar.late_minutes, ar.early_leave_minutes,
         ar.expected_punch_in, ar.expected_punch_out, ar.source, ar.active_seconds, ar.idle_seconds,
         (ar.clock_in IS NOT NULL) AS punched_in,
         (ar.clock_out IS NOT NULL) AS punched_out
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN attendance_records ar ON ar.employee_id = e.id AND ar.work_date = $1
       WHERE e.status = 'active'
       ORDER BY e.full_name`,
      [today]
    );
    
    // Add computed fields
    const employees = rows.map(r => ({
      ...r,
      is_late: r.late_minutes > 0,
      is_early_leave: r.early_leave_minutes > 0,
      is_present: r.punched_in && !r.punched_out,
      is_completed: r.punched_in && r.punched_out,
      is_absent: !r.punched_in && config.is_working_day,
      working_day: config.is_working_day,
      expected_punch_in: config.punch_in_time,
      expected_punch_out: config.punch_out_time
    }));
    
    const summary = {
      total: employees.length,
      present: employees.filter(e => e.is_completed).length,
      active: employees.filter(e => e.is_present).length,
      late: employees.filter(e => e.is_late).length,
      early_leave: employees.filter(e => e.is_early_leave).length,
      absent: employees.filter(e => e.is_absent).length,
      not_punched_in: employees.filter(e => !e.punched_in && config.is_working_day).length
    };
    
    res.json({ employees, summary, config });
  } catch (err) {
    console.error('[attendance:live:today]', err);
    res.status(500).json({ error: 'Failed to fetch live attendance' });
  }
});

// ── LIVE ATTENDANCE — specific date (admin/hr) ──────────────────────────────────
router.get('/live/date', requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
    
    const dayOfWeek = new Date(date).getDay() === 0 ? 7 : new Date(date).getDay();
    const config = await getWorkingHoursConfig(dayOfWeek);
    
    const { rows } = await safeQuery(
      `SELECT 
         e.id AS employee_id, e.full_name, e.employee_code, e.work_email, d.name AS department,
         ar.clock_in, ar.clock_out, ar.status, ar.late_minutes, ar.early_leave_minutes,
         ar.expected_punch_in, ar.expected_punch_out, ar.source, ar.active_seconds, ar.idle_seconds
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN attendance_records ar ON ar.employee_id = e.id AND ar.work_date = $1
       WHERE e.status = 'active'
       ORDER BY e.full_name`,
      [date]
    );
    
    const employees = rows.map(r => ({
      ...r,
      is_late: r.late_minutes > 0,
      is_early_leave: r.early_leave_minutes > 0,
      is_present: r.clock_in && !r.clock_out,
      is_completed: r.clock_in && r.clock_out,
      is_absent: !r.clock_in && config.is_working_day,
      working_day: config.is_working_day
    }));
    
    const summary = {
      total: employees.length,
      present: employees.filter(e => e.is_completed).length,
      active: employees.filter(e => e.is_present).length,
      late: employees.filter(e => e.is_late).length,
      early_leave: employees.filter(e => e.is_early_leave).length,
      absent: employees.filter(e => e.is_absent).length,
      not_punched_in: employees.filter(e => !e.clock_in && config.is_working_day).length
    };
    
    res.json({ employees, summary, config, date });
  } catch (err) {
    console.error('[attendance:live:date]', err);
    res.status(500).json({ error: 'Failed to fetch attendance for date' });
  }
});

// ── ATTENDANCE SUMMARY FOR DATE RANGE (for reports/performance) ────────────────
router.get('/summary', async (req, res) => {
  try {
    const { employee_id, from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates required' });
    
    const conditions = [`work_date >= $1`, `work_date <= $2`];
    const params = [from, to];
    
    if (employee_id) {
      params.push(employee_id);
      conditions.push(`employee_id = $${params.length}`);
    } else if (!['admin', 'hr', 'owner'].includes(req.staff.role)) {
      // Non-admin can only see their own
      if (!req.staff.employee_id) return res.status(400).json({ error: 'No linked employee record' });
      params.push(req.staff.employee_id);
      conditions.push(`employee_id = $${params.length}`);
    }
    
    const { rows } = await safeQuery(
      `SELECT * FROM attendance_records WHERE ${conditions.join(' AND ')} ORDER BY work_date DESC`,
      params
    );
    
    // Calculate summary stats
    const stats = {
      total_days: rows.length,
      present: rows.filter(r => r.status === 'present').length,
      late: rows.filter(r => r.status === 'late').length,
      early_leave: rows.filter(r => r.status === 'early_leave').length,
      absent: rows.filter(r => r.status === 'absent').length,
      on_leave: rows.filter(r => r.status === 'on_leave').length,
      half_day: rows.filter(r => r.status === 'half_day').length,
      total_late_minutes: rows.reduce((sum, r) => sum + (r.late_minutes || 0), 0),
      total_early_leave_minutes: rows.reduce((sum, r) => sum + (r.early_leave_minutes || 0), 0),
      total_active_hours: rows.reduce((sum, r) => sum + (r.active_seconds || 0), 0) / 3600
    };
    
    res.json({ records: rows, stats });
  } catch (err) {
    console.error('[attendance:summary]', err);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

// ── manual sync for our own desktop agent ───────────────────────────────────
// Only creates attendance records when BOTH clock_in AND clock_out are present (full day completed)
router.post('/sync/agent', requireRole('hr'), async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || !records.length) {
      return res.status(400).json({ error: 'records array required' });
    }

    let synced = 0, skipped = 0, incomplete = 0;
    for (const r of records) {
      if (!r.employee_id || !r.work_date) {
        skipped++;
        continue;
      }

      // Only process records that have BOTH clock_in AND clock_out (completed day)
      if (!r.clock_in || !r.clock_out) {
        incomplete++;
        continue;
      }

      const dayOfWeek = new Date(r.work_date).getDay() === 0 ? 7 : new Date(r.work_date).getDay();
      const config = await getWorkingHoursConfig(dayOfWeek);
      
      // Strict expected times: 9:30 AM - 7:00 PM
      const expectedPunchIn = new Date(r.work_date);
      expectedPunchIn.setHours(9, 30, 0, 0);
      
      const expectedPunchOut = new Date(r.work_date);
      expectedPunchOut.setHours(19, 0, 0, 0);
      
      // Calculate late/early
      let lateMinutes = 0, earlyLeaveMinutes = 0;
      if (r.clock_in) {
        const diffMs = new Date(r.clock_in) - expectedPunchIn;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins > config.grace_period_minutes) lateMinutes = diffMins - config.grace_period_minutes;
      }
      if (r.clock_out) {
        const diffMs = expectedPunchOut - new Date(r.clock_out);
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins > 0) earlyLeaveMinutes = diffMins;
      }
      
      const finalStatus = determineStatus(r.clock_in, r.clock_out, expectedPunchIn, expectedPunchOut, lateMinutes, earlyLeaveMinutes, config.is_working_day);

      await safeQuery(
        `INSERT INTO attendance_records (employee_id, work_date, status, clock_in, clock_out, expected_punch_in, expected_punch_out, late_minutes, early_leave_minutes, active_seconds, idle_seconds, source, raw_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (employee_id, work_date) DO UPDATE SET
           status = EXCLUDED.status, clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,
           expected_punch_in = EXCLUDED.expected_punch_in, expected_punch_out = EXCLUDED.expected_punch_out,
           late_minutes = EXCLUDED.late_minutes, early_leave_minutes = EXCLUDED.early_leave_minutes,
           active_seconds = EXCLUDED.active_seconds, idle_seconds = EXCLUDED.idle_seconds, raw_payload = EXCLUDED.raw_payload`,
        [
          r.employee_id,
          r.work_date,
          finalStatus,
          r.clock_in || null,
          r.clock_out || null,
          expectedPunchIn,
          expectedPunchOut,
          lateMinutes,
          earlyLeaveMinutes,
          r.active_seconds || 0,
          r.idle_seconds || 0,
          r.source || 'agent',
          r.raw_payload ? JSON.stringify(r.raw_payload) : null,
        ]
      );
      synced++;
    }

    res.json({ message: `Synced ${synced} completed attendance record(s)`, synced, skipped, incomplete });
  } catch (err) {
    console.error('[attendance:sync:agent]', err);
    res.status(err.status || 500).json({ error: err.message || 'Sync failed' });
  }
});

// ── webhook receiver for our own agent ──────────────────────────────────────
const crypto = require('crypto');

function verifyAgentSignature(req) {
  const secret = process.env.AGENT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('AGENT_WEBHOOK_SECRET not configured');
  }
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  if (!signature || !timestamp) {
    throw Object.assign(new Error('Missing webhook signature headers'), { status: 400 });
  }

  const rawBody = req.body;
  const payloadToSign = `${timestamp}.${rawBody.toString()}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const valid = sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  if (!valid) {
    throw Object.assign(new Error('Invalid webhook signature'), { status: 401 });
  }
}

router.post('/webhooks/agent', express.raw({ type: 'application/json', limit: '50mb' }), withIdempotency(async (req, res) => {
  try {
    verifyAgentSignature(req);
  } catch (err) {
    console.warn('[attendance:webhook:agent] signature check failed:', err.message);
    return res.status(err.status || 401).send(err.message);
  }

  try {
    const event = JSON.parse(req.body.toString());
    console.log('[attendance:webhook:agent] verified agent event received');

    const { employee_id, work_date, status, clock_in, clock_out, active_seconds, idle_seconds, raw_payload } = event;
    if (!employee_id || !work_date) {
      console.warn('[attendance:webhook:agent] payload missing required fields');
      return res.status(200).json({ received: true, mapped: false });
    }

    // Only process if BOTH clock_in and clock_out are present (completed day)
    if (!clock_in || !clock_out) {
      console.log('[attendance:webhook:agent] incomplete day (missing punch in/out), skipping');
      return res.status(200).json({ received: true, mapped: false, reason: 'incomplete_day' });
    }

    const dayOfWeek = new Date(work_date).getDay() === 0 ? 7 : new Date(work_date).getDay();
    const config = await getWorkingHoursConfig(dayOfWeek);
    
    // Strict expected times: 9:30 AM - 7:00 PM
    const expectedPunchIn = new Date(work_date);
    expectedPunchIn.setHours(9, 30, 0, 0);
    
    const expectedPunchOut = new Date(work_date);
    expectedPunchOut.setHours(19, 0, 0, 0);
    
    // Calculate late/early
    let lateMinutes = 0, earlyLeaveMinutes = 0;
    if (clock_in) {
      const diffMs = new Date(clock_in) - expectedPunchIn;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins > config.grace_period_minutes) lateMinutes = diffMins - config.grace_period_minutes;
    }
    if (clock_out) {
      const diffMs = expectedPunchOut - new Date(clock_out);
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins > 0) earlyLeaveMinutes = diffMins;
    }
    
    const finalStatus = determineStatus(clock_in, clock_out, expectedPunchIn, expectedPunchOut, lateMinutes, earlyLeaveMinutes, config.is_working_day);

    const { rows: [record] } = await safeQuery(
      `INSERT INTO attendance_records (employee_id, work_date, status, clock_in, clock_out, expected_punch_in, expected_punch_out, late_minutes, early_leave_minutes, active_seconds, idle_seconds, source, raw_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'agent',$12)
       ON CONFLICT (employee_id, work_date) DO UPDATE SET
         status = EXCLUDED.status, clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,
         expected_punch_in = EXCLUDED.expected_punch_in, expected_punch_out = EXCLUDED.expected_punch_out,
         late_minutes = EXCLUDED.late_minutes, early_leave_minutes = EXCLUDED.early_leave_minutes,
         active_seconds = EXCLUDED.active_seconds, idle_seconds = EXCLUDED.idle_seconds, raw_payload = EXCLUDED.raw_payload
       RETURNING *`,
      [employee_id, work_date, finalStatus, clock_in || null, clock_out || null, expectedPunchIn, expectedPunchOut, lateMinutes, earlyLeaveMinutes, active_seconds || 0, idle_seconds || 0, raw_payload ? JSON.stringify(raw_payload) : null]
    );
    res.status(200).json({ received: true, recordId: record?.id || null });
  } catch (err) {
    console.error('[attendance:webhook:agent]', err);
    res.status(200).json({ received: true });
  }
}));

// ── leave approvals (admin/hr) ──────────────────────────────────────────────
router.get('/leave/pending', requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT lr.*, lt.name AS leave_type_name, e.full_name AS employee_name, e.employee_code, d.name AS department_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE lr.status = 'pending'
       ORDER BY lr.start_date ASC`
    );
    res.json({ leaveRequests: rows });
  } catch (err) {
    console.error('[attendance:leave:pending]', err);
    res.status(500).json({ error: 'Failed to fetch pending leave requests' });
  }
});

router.post('/leave/:leaveId/decision', requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const { rows: [leaveRequest] } = await safeQuery(`SELECT employee_id, leave_type_id, num_days FROM leave_requests WHERE id = $1`, [req.params.id]);
    if (!leaveRequest) return res.status(404).json({ error: 'Leave request not found' });

    const { rows } = await safeQuery(
      `UPDATE leave_requests SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3 RETURNING *`,
      [decision, req.staff.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Leave request not found' });

    if (decision === 'approved') {
      const { rows: [lt] } = await safeQuery(`SELECT name FROM leave_types WHERE id = $1`, [leaveRequest.leave_type_id]);
      const col = /sick/i.test(lt?.name) ? 'leave_balance_sick' : /annual/i.test(lt?.name) ? 'leave_balance_annual' : null;
      if (col) {
        await safeQuery(`UPDATE employees SET ${col} = GREATEST(0, ${col} - $1) WHERE id = $2`, [leaveRequest.num_days, leaveRequest.employee_id]);
      }
    }
    res.json({ leave: rows[0] });
  } catch (err) {
    console.error('[attendance:leave:decision]', err);
    res.status(500).json({ error: 'Failed to process leave decision' });
  }
});

router.delete('/leave/:id', requireRole('admin', 'owner'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM leave_requests WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Leave request not found' });
    res.json({ deleted: true, message: 'Leave request deleted' });
  } catch (err) {
    console.error('[attendance:leave:delete]', err);
    res.status(500).json({ error: 'Failed to delete leave request' });
  }
});

// ── expense claims approval (admin/hr/finance) ──────────────────────────────
router.get('/claims/pending', requireRole('admin', 'hr', 'finance'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT ec.*, e.full_name AS employee_name, e.employee_code, d.name AS department_name
       FROM expense_claims ec
       JOIN employees e ON e.id = ec.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ec.status = 'pending'
       ORDER BY ec.created_at ASC`
    );
    res.json({ claims: rows });
  } catch (err) {
    console.error('[attendance:claims:pending]', err);
    res.status(500).json({ error: 'Failed to fetch pending claims' });
  }
});

router.post('/claims/:claimId/decision', requireRole('admin', 'hr', 'finance'), async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const { rows } = await safeQuery(
      `UPDATE expense_claims SET status = $1, decided_by = $2, decided_at = NOW() WHERE id = $3 AND status = 'pending' RETURNING *`,
      [decision, req.staff.id, req.params.claimId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Claim not found or already processed' });
    res.json({ claim: rows[0] });
  } catch (err) {
    console.error('[attendance:claims:decision]', err);
    res.status(500).json({ error: 'Failed to process claim decision' });
  }
});

router.delete('/claims/:id', requireRole('admin', 'owner'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM expense_claims WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Expense claim not found' });
    res.json({ deleted: true, message: 'Expense claim deleted' });
  } catch (err) {
    console.error('[attendance:claims:delete]', err);
    res.status(500).json({ error: 'Failed to delete expense claim' });
  }
});

// ── view attendance records ──────────────────────────────────────────────────
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

// ── Working hours config endpoints (admin/hr) ────────────────────────────────
router.get('/working-hours', requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM company_working_hours ORDER BY day_of_week`);
    res.json({ workingHours: rows });
  } catch (err) {
    console.error('[attendance:working-hours:list]', err);
    res.status(500).json({ error: 'Failed to fetch working hours config' });
  }
});

router.put('/working-hours/:dayOfWeek', requireRole('admin', 'hr'), async (req, res) => {
  try {
    const dayOfWeek = parseInt(req.params.dayOfWeek);
    if (dayOfWeek < 1 || dayOfWeek > 7) return res.status(400).json({ error: 'dayOfWeek must be 1-7' });
    
    const { punch_in_time, punch_out_time, grace_period_minutes, is_working_day, late_penalty_per_min, early_leave_penalty_per_min } = req.body;
    
    const { rows: [config] } = await safeQuery(
      `UPDATE company_working_hours SET
         punch_in_time = COALESCE($1, punch_in_time),
         punch_out_time = COALESCE($2, punch_out_time),
         grace_period_minutes = COALESCE($3, grace_period_minutes),
         is_working_day = COALESCE($4, is_working_day),
         late_penalty_per_min = COALESCE($5, late_penalty_per_min),
         early_leave_penalty_per_min = COALESCE($6, early_leave_penalty_per_min)
       WHERE day_of_week = $7 RETURNING *`,
      [punch_in_time, punch_out_time, grace_period_minutes, is_working_day, late_penalty_per_min, early_leave_penalty_per_min, dayOfWeek]
    );
    
    res.json({ config });
  } catch (err) {
    console.error('[attendance:working-hours:update]', err);
    res.status(500).json({ error: 'Failed to update working hours config' });
  }
});

// ── Attendance-based Performance Score ───────────────────────────────────────
const { calculateAttendanceScore, calculateBatchAttendanceScores, getAttendanceScoreLabel, getAttendanceScoreColor } = require('../services/attendanceScore');

// Get attendance score for a single employee (for self or admin/hr)
router.get('/score/:employeeId?', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates required' });
    
    let targetEmployeeId = req.params.employeeId;
    
    // If no employeeId provided, use logged-in user's employee record
    if (!targetEmployeeId) {
      if (!req.staff.employee_id) {
        return res.status(400).json({ error: 'No linked employee record' });
      }
      targetEmployeeId = req.staff.employee_id;
    }
    
    // Check permissions - users can only see their own score unless admin/hr
    const isSelf = req.staff.employee_id === targetEmployeeId;
    const isAdminHr = ['admin', 'hr', 'owner'].includes(req.staff.role);
    
    if (!isSelf && !isAdminHr) {
      return res.status(403).json({ error: 'Insufficient permissions to view this score' });
    }
    
    const result = await calculateAttendanceScore(targetEmployeeId, from, to);
    res.json({ 
      ...result, 
      label: getAttendanceScoreLabel(result.score),
      color: getAttendanceScoreColor(result.score)
    });
  } catch (err) {
    console.error('[attendance:score]', err);
    res.status(500).json({ error: 'Failed to calculate attendance score' });
  }
});

// Batch attendance scores for multiple employees (admin/hr only)
router.post('/score/batch', requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { employee_ids, from, to } = req.body;
    if (!employee_ids || !Array.isArray(employee_ids) || !employee_ids.length) {
      return res.status(400).json({ error: 'employee_ids array required' });
    }
    if (!from || !to) return res.status(400).json({ error: 'from and to dates required' });
    
    const scores = await calculateBatchAttendanceScores(employee_ids, from, to);
    
    // Add labels and colors
    const enrichedScores = {};
    for (const [id, data] of Object.entries(scores)) {
      enrichedScores[id] = {
        ...data,
        label: getAttendanceScoreLabel(data.score),
        color: getAttendanceScoreColor(data.score)
      };
    }
    
    res.json({ scores: enrichedScores });
  } catch (err) {
    console.error('[attendance:score:batch]', err);
    res.status(500).json({ error: 'Failed to calculate batch attendance scores' });
  }
});

module.exports = router;