'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { fireEvent } = require('../services/automationEngine');

router.use(authenticate);

// ── automation rules — view/toggle only, not a builder (no create/edit UI on purpose) ──
router.get('/rules', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM automation_rules ORDER BY trigger_event`);
    res.json({ rules: rows });
  } catch (err) {
    console.error('[automation:rules:list]', err);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

router.post('/rules/:id/toggle', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE automation_rules SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Rule not found' });
    res.json({ rule: rows[0] });
  } catch (err) {
    console.error('[automation:rules:toggle]', err);
    res.status(500).json({ error: 'Failed to toggle rule' });
  }
});

// ── in-app notifications for the logged-in staff member ────────────────────
router.get('/notifications', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM notifications WHERE target_staff_id = $1 OR target_role = $2 ORDER BY created_at DESC LIMIT 50`,
      [req.staff.id, req.staff.role]
    );
    const unreadCount = rows.filter((n) => !n.is_read).length;
    res.json({ notifications: rows, unreadCount });
  } catch (err) {
    console.error('[automation:notifications:list]', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/notifications/:id/read', async (req, res) => {
  try {
    const { rows } = await safeQuery(`UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: rows[0] });
  } catch (err) {
    console.error('[automation:notifications:read]', err);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

router.post('/notifications/mark-all-read', async (req, res) => {
  try {
    await safeQuery(
      `UPDATE notifications SET is_read = true WHERE (target_staff_id = $1 OR target_role = $2) AND is_read = false`,
      [req.staff.id, req.staff.role]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[automation:notifications:mark-all-read]', err);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// ── onboarding checklist ────────────────────────────────────────────────────
router.get('/checklist/:employeeId', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM onboarding_checklist_items WHERE employee_id = $1 ORDER BY created_at ASC`,
      [req.params.employeeId]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('[automation:checklist:get]', err);
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

router.post('/checklist/:itemId/toggle', requireRole('hr'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE onboarding_checklist_items SET is_done = NOT is_done,
         done_by = CASE WHEN NOT is_done THEN $1 ELSE NULL END,
         done_at = CASE WHEN NOT is_done THEN NOW() ELSE NULL END
       WHERE id = $2 RETURNING *`,
      [req.staff.id, req.params.itemId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Checklist item not found' });
    res.json({ item: rows[0] });
  } catch (err) {
    console.error('[automation:checklist:toggle]', err);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// ── overdue invoice scanner ──────────────────────────────────────────────────
// Time-based triggers (unlike the others, which fire on a specific action)
// need something to actually run the check. No cron is set up in this repo —
// call this manually for now, or wire a scheduled job (node-cron, or an
// external cron hitting this endpoint) to run it daily.
router.post('/run-overdue-check', requireRole('finance'), async (req, res) => {
  try {
    const { rows: overdueInvoices } = await safeQuery(
      `SELECT i.*, p.name AS party_name FROM invoices i
       JOIN parties p ON p.id = i.party_id
       WHERE i.due_date < CURRENT_DATE AND i.status IN ('sent','partially_paid') AND i.overdue_flagged_at IS NULL`
    );

    for (const inv of overdueInvoices) {
      await safeQuery(`UPDATE invoices SET status = 'overdue', overdue_flagged_at = NOW() WHERE id = $1`, [inv.id]);
      await fireEvent('invoice.overdue', {
        invoice_number: inv.invoice_number, party_name: inv.party_name,
        total_amount: inv.total_amount, link: `/invoices`,
      });
    }

    res.json({ flaggedCount: overdueInvoices.length });
  } catch (err) {
    console.error('[automation:overdue-check]', err);
    res.status(500).json({ error: 'Failed to run overdue check' });
  }
});

module.exports = router;