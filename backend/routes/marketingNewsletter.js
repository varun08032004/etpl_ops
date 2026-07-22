'use strict';
// routes/marketingNewsletter.js — periodic subscriber/campaign snapshots.
// Not a live ESP integration — log a row whenever you check Mailchimp/
// Resend/Brevo/etc, or right after a send.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole, requireDepartmentHead } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

const MARKETING_DEPARTMENT_NAME = 'Marketing';
function requireMarketingOrAdmin(req, res, next) {
  if (['owner', 'admin'].includes(req.staff.role)) return next();
  return requireDepartmentHead(MARKETING_DEPARTMENT_NAME)(req, res, next);
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM marketing_newsletter_snapshots ORDER BY snapshot_date DESC`);
    res.json({ snapshots: rows });
  } catch (err) {
    console.error('[marketing-newsletter:list]', err);
    res.status(500).json({ error: 'Failed to fetch newsletter snapshots' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { snapshot_date, subscriber_count, campaign_title, emails_sent, open_rate, click_rate, notes } = req.body;

    const { rows: [snapshot] } = await safeQuery(
      `INSERT INTO marketing_newsletter_snapshots (snapshot_date, subscriber_count, campaign_title, emails_sent, open_rate, click_rate, notes, created_by)
       VALUES (COALESCE($1,CURRENT_DATE),COALESCE($2,0),$3,$4,$5,$6,$7,$8) RETURNING *`,
      [snapshot_date || null, subscriber_count ?? null, campaign_title || null, emails_sent ?? null,
       open_rate ?? null, click_rate ?? null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_newsletter.created', entity: 'marketing_newsletter_snapshots', entityId: snapshot.id, newValue: { subscriber_count: snapshot.subscriber_count } });

    res.status(201).json({ snapshot });
  } catch (err) {
    console.error('[marketing-newsletter:create]', err);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const allowed = ['snapshot_date', 'subscriber_count', 'campaign_title', 'emails_sent', 'open_rate', 'click_rate', 'notes'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key] === '' ? null : req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_newsletter_snapshots WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Snapshot not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE marketing_newsletter_snapshots SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'marketing_newsletter.updated', entity: 'marketing_newsletter_snapshots', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ snapshot: rows[0] });
  } catch (err) {
    console.error('[marketing-newsletter:update]', err);
    res.status(500).json({ error: 'Failed to update snapshot' });
  }
});

router.delete('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_newsletter_snapshots WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Snapshot not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_newsletter.deleted', entity: 'marketing_newsletter_snapshots', entityId: deleted.id });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-newsletter:delete]', err);
    res.status(500).json({ error: 'Failed to delete snapshot' });
  }
});

module.exports = router;