'use strict';
// routes/marketingCompetitors.js — who else is in the CCTS/BRSR/ESG
// compliance space, their pricing/positioning, reviewed periodically.

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
    const { tier } = req.query;
    const params = [];
    let where = '';
    if (tier) { params.push(tier); where = `WHERE tier = $1`; }
    const { rows } = await safeQuery(
      `SELECT * FROM marketing_competitors ${where} ORDER BY tier ASC, name ASC`, params
    );
    res.json({ competitors: rows });
  } catch (err) {
    console.error('[marketing-competitors:list]', err);
    res.status(500).json({ error: 'Failed to fetch competitors' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { name, website, tier, pricing_notes, strengths, weaknesses, last_reviewed_date, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows: [competitor] } = await safeQuery(
      `INSERT INTO marketing_competitors (name, website, tier, pricing_notes, strengths, weaknesses, last_reviewed_date, notes, created_by)
       VALUES ($1,$2,COALESCE($3,'direct'),$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, website || null, tier || null, pricing_notes || null, strengths || null, weaknesses || null,
       last_reviewed_date || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_competitor.created', entity: 'marketing_competitors', entityId: competitor.id, newValue: { name: competitor.name } });

    res.status(201).json({ competitor });
  } catch (err) {
    console.error('[marketing-competitors:create]', err);
    res.status(500).json({ error: 'Failed to create competitor' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const allowed = ['name', 'website', 'tier', 'pricing_notes', 'strengths', 'weaknesses', 'last_reviewed_date', 'notes'];
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_competitors WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Competitor not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE marketing_competitors SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'marketing_competitor.updated', entity: 'marketing_competitors', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ competitor: rows[0] });
  } catch (err) {
    console.error('[marketing-competitors:update]', err);
    res.status(500).json({ error: 'Failed to update competitor' });
  }
});

router.delete('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_competitors WHERE id = $1 RETURNING id, name`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Competitor not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_competitor.deleted', entity: 'marketing_competitors', entityId: deleted.id, oldValue: { name: deleted.name } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-competitors:delete]', err);
    res.status(500).json({ error: 'Failed to delete competitor' });
  }
});

module.exports = router;