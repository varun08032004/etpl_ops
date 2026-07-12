'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { fireEvent } = require('../services/automationEngine');

router.use(authenticate);

// Stage -> default probability mapping. Deals can still override this manually.
const STAGE_PROBABILITY = { new: 10, qualified: 25, proposal_sent: 50, negotiation: 75, won: 100, lost: 0 };

async function getSalesSetting(key) {
  const { rows: [row] } = await safeQuery(`SELECT value FROM sales_settings WHERE key = $1`, [key]);
  return row ? Number(row.value) : null;
}

// ── list deals (the pipeline) ───────────────────────────────────────────────
router.get('/deals', async (req, res) => {
  try {
    const { stage, assigned_to } = req.query;
    const conditions = [];
    const params = [];
    if (stage) { params.push(stage); conditions.push(`d.stage = $${params.length}`); }
    if (assigned_to) { params.push(assigned_to); conditions.push(`d.assigned_to = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT d.*, sa.email AS assigned_to_email FROM deals d
       LEFT JOIN staff_accounts sa ON sa.id = d.assigned_to
       ${where} ORDER BY d.updated_at DESC`,
      params
    );
    res.json({ deals: rows });
  } catch (err) {
    console.error('[sales:deals:list]', err);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// ── deals flagged for follow-up (no activity for N days, still open) ───────
// Defined BEFORE /deals/:id so Express doesn't treat "follow-up" as an :id.
router.get('/deals/follow-up', async (req, res) => {
  try {
    const days = await getSalesSetting('follow_up_inactivity_days');
    const { rows } = await safeQuery(
      `SELECT d.*, sa.email AS assigned_to_email FROM deals d
       LEFT JOIN staff_accounts sa ON sa.id = d.assigned_to
       WHERE d.stage NOT IN ('won','lost') AND d.last_activity_at < NOW() - ($1 || ' days')::interval
       ORDER BY d.last_activity_at ASC`,
      [days || 14]
    );
    res.json({ deals: rows, inactivityThresholdDays: days || 14 });
  } catch (err) {
    console.error('[sales:deals:follow-up]', err);
    res.status(500).json({ error: 'Failed to fetch follow-up list' });
  }
});

// ── weighted pipeline forecast ──────────────────────────────────────────────
router.get('/forecast', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT stage, COUNT(*) AS deal_count, COALESCE(SUM(deal_value),0) AS total_value,
              COALESCE(SUM(deal_value * probability_percent / 100),0) AS weighted_value
       FROM deals WHERE stage NOT IN ('won','lost') GROUP BY stage`
    );
    const { rows: [wonThisMonth] } = await safeQuery(
      `SELECT COALESCE(SUM(deal_value),0) AS total FROM deals
       WHERE stage = 'won' AND updated_at >= date_trunc('month', CURRENT_DATE)`
    );
    const totalWeighted = rows.reduce((s, r) => s + Number(r.weighted_value), 0);
    const totalOpen = rows.reduce((s, r) => s + Number(r.total_value), 0);
    res.json({ byStage: rows, totalWeightedPipeline: totalWeighted, totalOpenPipeline: totalOpen, wonThisMonth: Number(wonThisMonth.total) });
  } catch (err) {
    console.error('[sales:forecast]', err);
    res.status(500).json({ error: 'Failed to compute forecast' });
  }
});

router.get('/deals/:id', async (req, res) => {
  try {
    const { rows: [deal] } = await safeQuery(
      `SELECT d.*, sa.email AS assigned_to_email FROM deals d LEFT JOIN staff_accounts sa ON sa.id = d.assigned_to WHERE d.id = $1`,
      [req.params.id]
    );
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const { rows: quotations } = await safeQuery(`SELECT * FROM quotations WHERE deal_id = $1 ORDER BY created_at DESC`, [req.params.id]);
    const { rows: tasks } = await safeQuery(`SELECT * FROM deal_tasks WHERE deal_id = $1 ORDER BY due_date ASC NULLS LAST`, [req.params.id]);
    res.json({ deal, quotations, tasks });
  } catch (err) {
    console.error('[sales:deals:get]', err);
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

router.post('/deals', async (req, res) => {
  try {
    const { company_name, contact_name, contact_email, contact_phone, source, deal_value, expected_close_date, notes } = req.body;
    if (!company_name) return res.status(400).json({ error: 'company_name is required' });

    const { rows: [deal] } = await safeQuery(
      `INSERT INTO deals (company_name, contact_name, contact_email, contact_phone, source, deal_value, probability_percent, expected_close_date, notes, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
      [company_name, contact_name || null, contact_email || null, contact_phone || null, source || null,
       deal_value || 0, STAGE_PROBABILITY.new, expected_close_date || null, notes || null, req.staff.id]
    );
    res.status(201).json({ deal });
  } catch (err) {
    console.error('[sales:deals:create]', err);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

router.put('/deals/:id', async (req, res) => {
  try {
    const allowed = ['company_name', 'contact_name', 'contact_email', 'contact_phone', 'source',
      'deal_value', 'probability_percent', 'expected_close_date', 'notes', 'assigned_to'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    sets.push(`last_activity_at = NOW()`, `updated_at = NOW()`);

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE deals SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Deal not found' });
    res.json({ deal: rows[0] });
  } catch (err) {
    console.error('[sales:deals:update]', err);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// ── move stage (separate from generic update — auto-sets probability + activity timestamp) ──
router.post('/deals/:id/move-stage', async (req, res) => {
  try {
    const { stage } = req.body;
    if (!Object.keys(STAGE_PROBABILITY).includes(stage)) return res.status(400).json({ error: 'Invalid stage' });

    const { rows } = await safeQuery(
      `UPDATE deals SET stage = $1, probability_percent = $2, last_activity_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [stage, STAGE_PROBABILITY[stage], req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Deal not found' });
    res.json({ deal: rows[0] });
  } catch (err) {
    console.error('[sales:deals:move-stage]', err);
    res.status(500).json({ error: 'Failed to move deal stage' });
  }
});

// ── mark Won — creates/links a party so invoicing can take over from here ──
router.post('/deals/:id/mark-won', requireRole('finance'), async (req, res) => {
  try {
    const { rows: [deal] } = await safeQuery(`SELECT * FROM deals WHERE id = $1`, [req.params.id]);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    let partyId = deal.converted_party_id;
    if (!partyId) {
      const { rows: [party] } = await safeQuery(
        `INSERT INTO parties (name, party_type, email, phone) VALUES ($1,'customer',$2,$3) RETURNING id`,
        [deal.company_name, deal.contact_email || null, deal.contact_phone || null]
      );
      partyId = party.id;
    }

    const { rows } = await safeQuery(
      `UPDATE deals SET stage = 'won', probability_percent = 100, converted_party_id = $1, last_activity_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [partyId, req.params.id]
    );
    fireEvent('deal.won', { company_name: rows[0].company_name, link: `/sales` });

    res.json({ deal: rows[0], note: 'Party created in Invoices module — you can now invoice this customer directly.' });
  } catch (err) {
    console.error('[sales:deals:mark-won]', err);
    res.status(500).json({ error: 'Failed to mark deal won' });
  }
});

router.post('/deals/:id/mark-lost', async (req, res) => {
  try {
    const { reason } = req.body;
    const { rows } = await safeQuery(
      `UPDATE deals SET stage = 'lost', probability_percent = 0, lost_reason = $1, last_activity_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [reason || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Deal not found' });
    res.json({ deal: rows[0] });
  } catch (err) {
    console.error('[sales:deals:mark-lost]', err);
    res.status(500).json({ error: 'Failed to mark deal lost' });
  }
});

// ── deal tasks ───────────────────────────────────────────────────────────────
router.post('/deals/:id/tasks', async (req, res) => {
  try {
    const { title, due_date } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const { rows: [task] } = await safeQuery(
      `INSERT INTO deal_tasks (deal_id, title, due_date, assigned_to) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, title, due_date || null, req.staff.id]
    );
    res.status(201).json({ task });
  } catch (err) {
    console.error('[sales:tasks:create]', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.post('/tasks/:taskId/toggle', async (req, res) => {
  try {
    const { rows } = await safeQuery(`UPDATE deal_tasks SET is_done = NOT is_done WHERE id = $1 RETURNING *`, [req.params.taskId]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ task: rows[0] });
  } catch (err) {
    console.error('[sales:tasks:toggle]', err);
    res.status(500).json({ error: 'Failed to toggle task' });
  }
});

// ── quotations — with discount approval governance (SALES-01) ──────────────
router.post('/deals/:id/quotations', async (req, res) => {
  try {
    const { items, discount_percent, valid_until, notes } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'At least one line item is required' });

    const subtotal = items.reduce((s, it) => s + Number(it.quantity || 1) * Number(it.unit_price), 0);
    const discountPct = Number(discount_percent || 0);
    const discountAmount = Math.round(subtotal * discountPct / 100 * 100) / 100;
    const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;

    const threshold = await getSalesSetting('discount_approval_threshold_percent');
    const requiresApproval = discountPct > (threshold ?? 15);

    const { rows: [{ next_num }] } = await safeQuery(
      `SELECT 'QUO-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
              LPAD((COALESCE(MAX(SUBSTRING(quote_number FROM '\\d+$')::int), 0) + 1)::text, 5, '0') AS next_num
       FROM quotations WHERE quote_number LIKE 'QUO-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'`
    );

    const quotation = await withTransaction(async (client) => {
      const { rows: [quo] } = await client.query(
        `INSERT INTO quotations (deal_id, quote_number, valid_until, subtotal, discount_percent, discount_amount, total_amount, status, requires_approval, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [req.params.id, next_num, valid_until || null, subtotal, discountPct, discountAmount, totalAmount,
         requiresApproval ? 'pending_approval' : 'draft', requiresApproval, notes || null, req.staff.id]
      );
      for (const it of items) {
        const lineTotal = Number(it.quantity || 1) * Number(it.unit_price);
        await client.query(
          `INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5)`,
          [quo.id, it.description, it.quantity || 1, it.unit_price, lineTotal]
        );
      }
      return quo;
    });

    await safeQuery(`UPDATE deals SET last_activity_at = NOW() WHERE id = $1`, [req.params.id]);

    res.status(201).json({
      quotation,
      note: requiresApproval ? `Discount of ${discountPct}% exceeds the ${threshold ?? 15}% approval threshold — this quote needs Finance/Admin approval before it can be sent.` : null,
    });
  } catch (err) {
    console.error('[sales:quotations:create]', err);
    res.status(500).json({ error: 'Failed to create quotation' });
  }
});

router.get('/quotations/:id', async (req, res) => {
  try {
    const { rows: [quotation] } = await safeQuery(`SELECT * FROM quotations WHERE id = $1`, [req.params.id]);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    const { rows: items } = await safeQuery(`SELECT * FROM quotation_items WHERE quotation_id = $1`, [req.params.id]);
    res.json({ quotation, items });
  } catch (err) {
    console.error('[sales:quotations:get]', err);
    res.status(500).json({ error: 'Failed to fetch quotation' });
  }
});

router.post('/quotations/:id/approve', requireRole('finance'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE quotations SET status = 'draft', requires_approval = false, approved_by = $1, approved_at = NOW() WHERE id = $2 AND status = 'pending_approval' RETURNING *`,
      [req.staff.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Quotation not found or not pending approval' });
    res.json({ quotation: rows[0] });
  } catch (err) {
    console.error('[sales:quotations:approve]', err);
    res.status(500).json({ error: 'Failed to approve quotation' });
  }
});

router.post('/quotations/:id/send', async (req, res) => {
  try {
    const { rows: [quo] } = await safeQuery(`SELECT * FROM quotations WHERE id = $1`, [req.params.id]);
    if (!quo) return res.status(404).json({ error: 'Quotation not found' });
    if (quo.requires_approval) return res.status(400).json({ error: 'This quotation still needs approval before it can be sent' });

    const { rows } = await safeQuery(`UPDATE quotations SET status = 'sent' WHERE id = $1 RETURNING *`, [req.params.id]);
    await safeQuery(`UPDATE deals SET stage = 'proposal_sent', probability_percent = $1, last_activity_at = NOW() WHERE id = $2 AND stage IN ('new','qualified')`,
      [STAGE_PROBABILITY.proposal_sent, quo.deal_id]);
    res.json({ quotation: rows[0] });
  } catch (err) {
    console.error('[sales:quotations:send]', err);
    res.status(500).json({ error: 'Failed to send quotation' });
  }
});

module.exports = router;