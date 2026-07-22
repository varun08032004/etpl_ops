'use strict';
// routes/marketingContent.js — the content calendar: what's going out,
// on which platform/handle, tied to which campaign (optional), and who owns it.

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
    const { status, platform, campaign_id, from, to } = req.query;
    const params = [];
    const clauses = [];
    if (status) { params.push(status); clauses.push(`cc.status = $${params.length}`); }
    if (platform) { params.push(platform); clauses.push(`cc.platform = $${params.length}`); }
    if (campaign_id) { params.push(campaign_id); clauses.push(`cc.campaign_id = $${params.length}`); }
    if (from) { params.push(from); clauses.push(`cc.scheduled_date >= $${params.length}`); }
    if (to) { params.push(to); clauses.push(`cc.scheduled_date <= $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT cc.*, e.full_name AS assignee_name, sa.display_name AS account_name, c.name AS campaign_name
       FROM marketing_content_calendar cc
       LEFT JOIN employees e ON e.id = cc.assigned_to
       LEFT JOIN marketing_social_accounts sa ON sa.id = cc.social_account_id
       LEFT JOIN marketing_campaigns c ON c.id = cc.campaign_id
       ${where}
       ORDER BY cc.scheduled_date ASC NULLS LAST, cc.created_at DESC`,
      params
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('[marketing-content:list]', err);
    res.status(500).json({ error: 'Failed to fetch content calendar' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [item] } = await safeQuery(`SELECT * FROM marketing_content_calendar WHERE id = $1`, [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Content item not found' });
    res.json({ item });
  } catch (err) {
    console.error('[marketing-content:get]', err);
    res.status(500).json({ error: 'Failed to fetch content item' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    const {
      title, content_type, platform, social_account_id, campaign_id, scheduled_date,
      status, caption, link_url, assigned_to, notes,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [item] } = await safeQuery(
      `INSERT INTO marketing_content_calendar
        (title, content_type, platform, social_account_id, campaign_id, scheduled_date, status, caption, link_url, assigned_to, notes, created_by)
       VALUES ($1,COALESCE($2,'post'),$3,$4,$5,$6,COALESCE($7,'idea'),$8,$9,$10,$11,$12)
       RETURNING *`,
      [title, content_type || null, platform || null, social_account_id || null, campaign_id || null,
       scheduled_date || null, status || null, caption || null, link_url || null, assigned_to || null,
       notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_content.created', entity: 'marketing_content_calendar', entityId: item.id, newValue: { title: item.title, status: item.status } });

    res.status(201).json({ item });
  } catch (err) {
    console.error('[marketing-content:create]', err);
    res.status(500).json({ error: 'Failed to create content item' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const allowed = [
      'title', 'content_type', 'platform', 'social_account_id', 'campaign_id', 'scheduled_date',
      'status', 'caption', 'link_url', 'assigned_to', 'notes',
    ];
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_content_calendar WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Content item not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE marketing_content_calendar SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_content.updated', entity: 'marketing_content_calendar', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ item: rows[0] });
  } catch (err) {
    console.error('[marketing-content:update]', err);
    res.status(500).json({ error: 'Failed to update content item' });
  }
});

router.delete('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_content_calendar WHERE id = $1 RETURNING id, title`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Content item not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_content.deleted', entity: 'marketing_content_calendar', entityId: deleted.id, oldValue: { title: deleted.title } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-content:delete]', err);
    res.status(500).json({ error: 'Failed to delete content item' });
  }
});

module.exports = router;