'use strict';
// routes/productDepartments.js — Product ↔ Department mappings

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/v1/product-departments — all mappings
router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(`
      SELECT pd.*, p.name as product_name, p.slug as product_slug, d.name as dept_name, d.code as dept_code
      FROM product_departments pd
      JOIN products p ON p.id = pd.product_id
      JOIN departments d ON d.id = pd.department_id
      WHERE p.is_active = TRUE AND d.status = 'active'
      ORDER BY p.name, pd.is_primary DESC, d.name
    `);
    res.json({ mappings: rows });
  } catch (err) {
    console.error('[product-departments:list]', err);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// POST /api/v1/product-departments — add mapping (owner/admin)
router.post('/', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { product_id, department_id, focus_area, is_primary } = req.body;
    if (!product_id || !department_id) return res.status(400).json({ error: 'product_id and department_id required' });

    const { rows: [mapping] } = await safeQuery(`
      INSERT INTO product_departments (product_id, department_id, focus_area, is_primary)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [product_id, department_id, focus_area || null, is_primary || false]);

    res.status(201).json({ mapping });
  } catch (err) {
    console.error('[product-departments:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Mapping already exists' });
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// PUT /api/v1/product-departments/:id — update mapping
router.put('/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const allowed = ['focus_area', 'is_primary'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key] === '' ? null : req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE product_departments SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Mapping not found' });

    res.json({ mapping: rows[0] });
  } catch (err) {
    console.error('[product-departments:update]', err);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

// DELETE /api/v1/product-departments/:id
router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM product_departments WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Mapping not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[product-departments:delete]', err);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

module.exports = router;