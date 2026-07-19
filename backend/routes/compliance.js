'use strict';
// routes/compliance.js — SRS §8.14
//
// COMP-01: every item has an owner, due date, status, evidentiary document.
// COMP-02: escalate to Founder/Admin within 48h of the final (1-day) reminder
//          if status hasn't moved. Implemented as /run-reminders, meant to be
//          hit by an external scheduler (this codebase has no in-process cron —
//          see services/automationEngine.js, which is purely event-driven).
//          Wire an external trigger (Render Cron Job / GitHub Actions scheduled
//          workflow / etc.) to POST here once daily.
// COMP-03: /due-soon powers the Dashboard's always-visible compliance widget.
//
// Per SRS §41.10's state-machine convention: status never changes via a
// generic PATCH — only through the dedicated /start and /file actions below,
// so an illegal transition is structurally impossible, not just discouraged.
//
// 2026-07 update: create/edit widened from finance-only to also allow the
// head of the "Legal & Compliance" department, since Compliance now covers
// ROC/labour/DPIIT items owned by Legal, not just finance-driven filings
// (GST/TDS/PF/ESIC). Uses requireDepartmentHead (checks departments.
// head_employee_id dynamically) rather than a fixed role name — see
// middleware/auth.js and routes/oneTimeRegistrations.js for the same pattern.
// Rows with is_auto_generated=true were spawned automatically from a one-time
// registration (see routes/oneTimeRegistrations.js) — edits are still allowed
// but the category/recurring_interval are best left alone since they're
// matched against services/complianceRules.js by title.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole, requireDepartmentHead } = require('../middleware/auth');
const { fireEvent } = require('../services/automationEngine');

router.use(authenticate);

const REMINDER_STAGES = [30, 15, 7, 1]; // days before due_date, per SRS §2320
const COMPLIANCE_DEPARTMENT_NAME = 'Legal & Compliance';

// Passes for owner/admin (via requireRole's bypass), finance role, OR the
// head of Legal & Compliance (via requireDepartmentHead's dynamic lookup).
function requireFinanceOrComplianceHead(req, res, next) {
  if (['owner', 'admin', 'finance'].includes(req.staff.role)) return next();
  return requireDepartmentHead(COMPLIANCE_DEPARTMENT_NAME)(req, res, next);
}

// ── list, with computed "is overdue" and days-until-due for the UI ─────────
router.get('/', async (req, res) => {
  try {
    const { status, category, owner_employee_id } = req.query;
    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`ci.status = $${params.length}`); }
    if (category) { params.push(category); conditions.push(`ci.category = $${params.length}`); }
    if (owner_employee_id) { params.push(owner_employee_id); conditions.push(`ci.owner_employee_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT ci.*, e.full_name AS owner_name,
              (ci.due_date - CURRENT_DATE) AS days_until_due,
              (ci.status != 'filed' AND ci.due_date < CURRENT_DATE) AS is_overdue
       FROM compliance_items ci
       LEFT JOIN employees e ON e.id = ci.owner_employee_id
       ${where}
       ORDER BY ci.due_date ASC`,
      params
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('[compliance:list]', err);
    res.status(500).json({ error: 'Failed to fetch compliance items' });
  }
});

// ── COMP-03: due within 30 days OR overdue — for the Dashboard widget ──────
router.get('/due-soon', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT ci.id, ci.title, ci.category, ci.due_date, ci.status, ci.escalated_at,
              e.full_name AS owner_name,
              (ci.due_date - CURRENT_DATE) AS days_until_due,
              (ci.status != 'filed' AND ci.due_date < CURRENT_DATE) AS is_overdue
       FROM compliance_items ci
       LEFT JOIN employees e ON e.id = ci.owner_employee_id
       WHERE ci.status != 'filed' AND ci.due_date <= CURRENT_DATE + INTERVAL '30 days'
       ORDER BY ci.due_date ASC
       LIMIT 20`
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('[compliance:due-soon]', err);
    res.status(500).json({ error: 'Failed to fetch due-soon compliance items' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [item] } = await safeQuery(
      `SELECT ci.*, e.full_name AS owner_name FROM compliance_items ci
       LEFT JOIN employees e ON e.id = ci.owner_employee_id WHERE ci.id = $1`,
      [req.params.id]
    );
    if (!item) return res.status(404).json({ error: 'Compliance item not found' });
    res.json({ item });
  } catch (err) {
    console.error('[compliance:get]', err);
    res.status(500).json({ error: 'Failed to fetch compliance item' });
  }
});

// ── create — COMP-01 requires owner + due date at minimum; document can follow later ──
router.post('/', requireFinanceOrComplianceHead, async (req, res) => {
  try {
    const { category, title, description, owner_employee_id, due_date, recurring_interval } = req.body;
    if (!category || !title || !due_date) {
      return res.status(400).json({ error: 'category, title, and due_date are required' });
    }
    const { rows: [item] } = await safeQuery(
      `INSERT INTO compliance_items (category, title, description, owner_employee_id, due_date, recurring_interval, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [category, title, description || null, owner_employee_id || null, due_date, recurring_interval || null, req.staff.id]
    );
    res.status(201).json({ item });
  } catch (err) {
    console.error('[compliance:create]', err);
    res.status(500).json({ error: 'Failed to create compliance item' });
  }
});

// ── edit metadata (not status — see dedicated transitions below) ───────────
router.put('/:id', requireFinanceOrComplianceHead, async (req, res) => {
  try {
    const allowed = ['category', 'title', 'description', 'owner_employee_id', 'due_date', 'recurring_interval'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key] === '' ? null : req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    sets.push(`updated_at = NOW()`);

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE compliance_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Compliance item not found' });
    res.json({ item: rows[0] });
  } catch (err) {
    console.error('[compliance:update]', err);
    res.status(500).json({ error: 'Failed to update compliance item' });
  }
});

// ── dedicated transitions — not_started -> in_progress -> filed ────────────
router.post('/:id/start', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE compliance_items SET status = 'in_progress', updated_at = NOW()
       WHERE id = $1 AND status = 'not_started' RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Item not found or not in not_started status' });
    res.json({ item: rows[0] });
  } catch (err) {
    console.error('[compliance:start]', err);
    res.status(500).json({ error: 'Failed to start item' });
  }
});

// Filing requires the evidentiary document per COMP-01 — pass
// filed_document_id (upload via /api/documents first, entity_type=
// 'compliance_item', entity_id=this item's id, then pass the returned id here).
router.post('/:id/file', async (req, res) => {
  try {
    const { filed_document_id } = req.body;
    if (!filed_document_id) {
      return res.status(400).json({ error: 'filed_document_id is required — upload the evidentiary document first' });
    }
    const { rows } = await safeQuery(
      `UPDATE compliance_items SET status = 'filed', filed_document_id = $1, escalated_at = NULL, updated_at = NOW()
       WHERE id = $2 AND status != 'filed' RETURNING *`,
      [filed_document_id, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Item not found or already filed' });

    // Recurring items spawn their next cycle automatically on filing.
    const item = rows[0];
    if (item.recurring_interval) {
      const intervalSql = {
        monthly: '1 month',
        quarterly: '3 months',
        half_yearly: '6 months',
        annual: '1 year',
      }[item.recurring_interval];
      if (intervalSql) {
        await safeQuery(
          `INSERT INTO compliance_items
             (category, title, description, owner_employee_id, due_date, recurring_interval, created_by, is_auto_generated, source_registration_slug)
           VALUES ($1,$2,$3,$4, ($5::date + $6::interval), $7, $8, $9, $10)`,
          [
            item.category, item.title, item.description, item.owner_employee_id,
            item.due_date, intervalSql, item.recurring_interval, item.created_by,
            item.is_auto_generated || false, item.source_registration_slug || null,
          ]
        );
      }
    }

    res.json({ item });
  } catch (err) {
    console.error('[compliance:file]', err);
    res.status(500).json({ error: 'Failed to file item' });
  }
});

// ── COMP-02 reminder + escalation job — call daily from an external scheduler ──
router.post('/run-reminders', requireRole('finance'), async (req, res) => {
  try {
    const { rows: candidates } = await safeQuery(
      `SELECT ci.*, e.full_name AS owner_name FROM compliance_items ci
       LEFT JOIN employees e ON e.id = ci.owner_employee_id
       WHERE ci.status != 'filed'`
    );

    let remindersSent = 0, escalated = 0;
    const now = new Date();

    for (const item of candidates) {
      const daysUntilDue = Math.ceil((new Date(item.due_date) - now) / 86400000);

      // Send the next reminder stage that's due and hasn't already been sent.
      const dueStage = [...REMINDER_STAGES].reverse().find((stage) => daysUntilDue <= stage);
      if (dueStage && item.last_reminder_stage !== dueStage) {
        await fireEvent('compliance_item.due_soon', {
          title: item.title, category: item.category, owner_name: item.owner_name,
          due_date: item.due_date, days_until_due: daysUntilDue, link: '/compliance',
        });
        await safeQuery(
          `UPDATE compliance_items SET last_reminder_stage = $1, last_reminder_sent_at = NOW() WHERE id = $2`,
          [dueStage, item.id]
        );
        remindersSent++;
      }

      // COMP-02: 48h after the FINAL (1-day) reminder with no status change -> escalate once.
      if (
        item.last_reminder_stage === 1 &&
        item.last_reminder_sent_at &&
        !item.escalated_at &&
        (now - new Date(item.last_reminder_sent_at)) >= 48 * 3600 * 1000
      ) {
        await fireEvent('compliance_item.escalated', {
          title: item.title, category: item.category, owner_name: item.owner_name,
          due_date: item.due_date, link: '/compliance',
        });
        await safeQuery(`UPDATE compliance_items SET escalated_at = NOW() WHERE id = $1`, [item.id]);
        escalated++;
      }
    }

    res.json({ checked: candidates.length, remindersSent, escalated });
  } catch (err) {
    console.error('[compliance:run-reminders]', err);
    res.status(500).json({ error: 'Failed to run reminders' });
  }
});

module.exports = router;