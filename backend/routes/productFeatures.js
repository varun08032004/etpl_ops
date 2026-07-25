'use strict';
// routes/productFeatures.js — the roadmap: features/work items across
// ethertrack.in's core areas (portfolio management, marketplace, emission
// tracking, reports).

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole, requireDepartmentHead } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

const PRODUCT_DEPARTMENT_NAME = 'Product';
function requireProductOrAdmin(req, res, next) {
  if (['owner', 'admin'].includes(req.staff.role)) return next();
  return requireDepartmentHead(PRODUCT_DEPARTMENT_NAME)(req, res, next);
}

router.get('/', async (req, res) => {
  try {
    const { status, area } = req.query;
    const params = [];
    const clauses = [];
    if (status) { params.push(status); clauses.push(`f.status = $${params.length}`); }
    if (area) { params.push(area); clauses.push(`f.area = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT f.*, e.full_name AS owner_name
       FROM product_features f
       LEFT JOIN employees e ON e.id = f.owner_employee_id
       ${where}
       ORDER BY
         CASE f.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         f.target_date ASC NULLS LAST`,
      params
    );
    res.json({ features: rows });
  } catch (err) {
    console.error('[product-features:list]', err);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

router.post('/', requireProductOrAdmin, async (req, res) => {
  try {
    const { title, description, area, status, priority, target_date, owner_employee_id, notes } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [feature] } = await safeQuery(
      `INSERT INTO product_features (title, description, area, status, priority, target_date, owner_employee_id, notes, created_by)
       VALUES ($1,$2,COALESCE($3,'other'),COALESCE($4,'backlog'),COALESCE($5,'medium'),$6,$7,$8,$9)
       RETURNING *`,
      [title, description || null, area || null, status || null, priority || null, target_date || null,
       owner_employee_id || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'product_feature.created', entity: 'product_features', entityId: feature.id, newValue: { title: feature.title, status: feature.status } });

    res.status(201).json({ feature });
  } catch (err) {
    console.error('[product-features:create]', err);
    res.status(500).json({ error: 'Failed to create feature' });
  }
});

router.put('/:id', requireProductOrAdmin, async (req, res) => {
  try {
    const allowed = ['title', 'description', 'area', 'status', 'priority', 'target_date', 'owner_employee_id', 'notes'];
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM product_features WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Feature not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE product_features SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'product_feature.updated', entity: 'product_features', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ feature: rows[0] });
  } catch (err) {
    console.error('[product-features:update]', err);
    res.status(500).json({ error: 'Failed to update feature' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM product_features WHERE id = $1 RETURNING id, title`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Feature not found' });
    await logAction({ staffId: req.staff.id, action: 'product_feature.deleted', entity: 'product_features', entityId: deleted.id, oldValue: { title: deleted.title } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[product-features:delete]', err);
    res.status(500).json({ error: 'Failed to delete feature' });
  }
});

module.exports = router;