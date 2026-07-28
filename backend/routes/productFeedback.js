'use strict';
// routes/productFeedback.js — bugs, feature requests, and feedback from
// internal team, advisors, or beta users. Optionally links to a roadmap item.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireDepartmentHead } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

const PRODUCT_DEPARTMENT_NAME = 'Product';
function requireProductOrAdmin(req, res, next) {
  if (['owner', 'admin'].includes(req.staff.role)) return next();
  return requireDepartmentHead(PRODUCT_DEPARTMENT_NAME)(req, res, next);
}

router.get('/', async (req, res) => {
  try {
    const { status, feedback_type } = req.query;
    const params = [];
    const clauses = [];
    if (status) { params.push(status); clauses.push(`f.status = $${params.length}`); }
    if (feedback_type) { params.push(feedback_type); clauses.push(`f.feedback_type = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT f.*, rf.title AS related_feature_title
       FROM product_feedback f
       LEFT JOIN product_features rf ON rf.id = f.related_feature_id
       ${where}
       ORDER BY
         CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         f.created_at DESC`,
      params
    );
    res.json({ feedback: rows });
  } catch (err) {
    console.error('[product-feedback:list]', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

router.post('/', requireProductOrAdmin, async (req, res) => {
  try {
    const {
      title, feedback_type, severity, status, area, description,
      reported_by_name, reported_by_email, source, related_feature_id, notes,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [item] } = await safeQuery(
      `INSERT INTO product_feedback
        (title, feedback_type, severity, status, area, description, reported_by_name, reported_by_email, source, related_feature_id, notes, created_by)
       VALUES ($1,COALESCE($2::product_feedback_type,'feedback'),COALESCE($3::product_feedback_severity,'medium'),COALESCE($4::product_feedback_status,'open'),COALESCE($5::product_area,'other'),$6,$7,$8,COALESCE($9::product_feedback_source,'internal'),$10,$11,$12)
       RETURNING *`,
      [title, feedback_type || null, severity || null, status || null, area || null, description || null,
       reported_by_name || null, reported_by_email || null, source || null, related_feature_id || null,
       notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'product_feedback.created', entity: 'product_feedback', entityId: item.id, newValue: { title: item.title, feedback_type: item.feedback_type } });

    res.status(201).json({ item });
  } catch (err) {
    console.error('[product-feedback:create]', err);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

router.put('/:id', requireProductOrAdmin, async (req, res) => {
  try {
    const allowed = [
      'title', 'feedback_type', 'severity', 'status', 'area', 'description',
      'reported_by_name', 'reported_by_email', 'source', 'related_feature_id', 'notes',
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM product_feedback WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Feedback not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE product_feedback SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'product_feedback.updated', entity: 'product_feedback', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ item: rows[0] });
  } catch (err) {
    console.error('[product-feedback:update]', err);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

router.delete('/:id', requireProductOrAdmin, async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM product_feedback WHERE id = $1 RETURNING id, title`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Feedback not found' });
    await logAction({ staffId: req.staff.id, action: 'product_feedback.deleted', entity: 'product_feedback', entityId: deleted.id, oldValue: { title: deleted.title } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[product-feedback:delete]', err);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

module.exports = router;