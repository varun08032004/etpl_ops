'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// ── manual sync for our own desktop agent ───────────────────────────────────
// Accepts attendance records from our agent and stores them.
// Body: { records: [{ employee_id, work_date, status, clock_in, clock_out, active_seconds, idle_seconds, source, raw_payload }] }
router.post('/sync/agent', requireRole('hr'), async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || !records.length) {
      return res.status(400).json({ error: 'records array required' });
    }

    let synced = 0, skipped = 0;
    for (const r of records) {
      if (!r.employee_id || !r.work_date) {
        skipped++;
        continue;
      }

      const status = r.status || (r.active_seconds > 0 ? 'present' : 'absent');

      await safeQuery(
        `INSERT INTO attendance_records (employee_id, work_date, status, clock_in, clock_out, active_seconds, idle_seconds, source, raw_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (employee_id, work_date) DO UPDATE SET
           status = EXCLUDED.status, clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,
           active_seconds = EXCLUDED.active_seconds, idle_seconds = EXCLUDED.idle_seconds, raw_payload = EXCLUDED.raw_payload`,
        [
          r.employee_id,
          r.work_date,
          status,
          r.clock_in || null,
          r.clock_out || null,
          r.active_seconds || 0,
          r.idle_seconds || 0,
          r.source || 'agent',
          r.raw_payload ? JSON.stringify(r.raw_payload) : null,
        ]
      );
      synced++;
    }

    res.json({ message: `Synced ${synced} attendance record(s)`, synced, skipped });
  } catch (err) {
    console.error('[attendance:sync:agent]', err);
    res.status(err.status || 500).json({ error: err.message || 'Sync failed' });
  }
});

// ── webhook receiver for our own agent ──────────────────────────────────────
// Our agent can POST attendance events here for real-time updates.
// Signature verification using AGENT_WEBHOOK_SECRET.
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

router.post('/webhooks/agent', express.raw({ type: 'application/json', limit: '50mb' }), async (req, res) => {
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

    const { rows: [record] } = await safeQuery(
      `INSERT INTO attendance_records (employee_id, work_date, status, clock_in, clock_out, active_seconds, idle_seconds, source, raw_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'agent',$8)
       ON CONFLICT (employee_id, work_date) DO UPDATE SET
         status = EXCLUDED.status, clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,
         active_seconds = EXCLUDED.active_seconds, idle_seconds = EXCLUDED.idle_seconds, raw_payload = EXCLUDED.raw_payload
       RETURNING *`,
      [employee_id, work_date, status || 'present', clock_in || null, clock_out || null, active_seconds || 0, idle_seconds || 0, raw_payload ? JSON.stringify(raw_payload) : null]
    );
    res.status(200).json({ received: true, recordId: record?.id || null });
  } catch (err) {
    console.error('[attendance:webhook:agent]', err);
    res.status(200).json({ received: true }); // ack anyway to avoid retry storms
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