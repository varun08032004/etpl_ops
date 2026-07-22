'use strict';
// routes/marketingPress.js — press coverage, interviews, podcasts, awards,
// backlinks. Simple log, useful for investor updates too.

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
    const { mention_type } = req.query;
    const params = [];
    let where = '';
    if (mention_type) { params.push(mention_type); where = `WHERE mention_type = $1`; }
    const { rows } = await safeQuery(
      `SELECT * FROM marketing_press_mentions ${where} ORDER BY published_date DESC NULLS LAST, created_at DESC`, params
    );
    res.json({ mentions: rows });
  } catch (err) {
    console.error('[marketing-press:list]', err);
    res.status(500).json({ error: 'Failed to fetch press mentions' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { title, publication, mention_type, url, published_date, sentiment, notes } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [mention] } = await safeQuery(
      `INSERT INTO marketing_press_mentions (title, publication, mention_type, url, published_date, sentiment, notes, created_by)
       VALUES ($1,$2,COALESCE($3,'article'),$4,$5,COALESCE($6,'neutral'),$7,$8) RETURNING *`,
      [title, publication || null, mention_type || null, url || null, published_date || null,
       sentiment || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_press.created', entity: 'marketing_press_mentions', entityId: mention.id, newValue: { title: mention.title } });

    res.status(201).json({ mention });
  } catch (err) {
    console.error('[marketing-press:create]', err);
    res.status(500).json({ error: 'Failed to create press mention' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const allowed = ['title', 'publication', 'mention_type', 'url', 'published_date', 'sentiment', 'notes'];
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_press_mentions WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Press mention not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE marketing_press_mentions SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'marketing_press.updated', entity: 'marketing_press_mentions', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ mention: rows[0] });
  } catch (err) {
    console.error('[marketing-press:update]', err);
    res.status(500).json({ error: 'Failed to update press mention' });
  }
});

router.delete('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_press_mentions WHERE id = $1 RETURNING id, title`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Press mention not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_press.deleted', entity: 'marketing_press_mentions', entityId: deleted.id, oldValue: { title: deleted.title } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-press:delete]', err);
    res.status(500).json({ error: 'Failed to delete press mention' });
  }
});

module.exports = router;