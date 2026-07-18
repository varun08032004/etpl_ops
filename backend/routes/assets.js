'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

// ── list / filter (e.g. ?employee_id=... for an employee's assigned assets,
//    ?status=in_stock for the free-pool picker) ─────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { employee_id, status, category } = req.query;
    const conditions = [];
    const params = [];
    if (employee_id) { params.push(employee_id); conditions.push(`a.assigned_to = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`a.status = $${params.length}`); }
    if (category) { params.push(category); conditions.push(`a.category = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT a.*, e.full_name AS assigned_to_name
       FROM assets a LEFT JOIN employees e ON e.id = a.assigned_to
       ${where} ORDER BY a.created_at DESC`,
      params
    );
    res.json({ assets: rows });
  } catch (err) {
    console.error('[assets:list]', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [asset] } = await safeQuery(
      `SELECT a.*, e.full_name AS assigned_to_name FROM assets a LEFT JOIN employees e ON e.id = a.assigned_to WHERE a.id = $1`,
      [req.params.id]
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset });
  } catch (err) {
    console.error('[assets:get]', err);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// ── register a new asset into inventory — not destructive, immediate ───────
router.post('/', requireRole('hr'), async (req, res) => {
  try {
    const { asset_tag, category, description, serial_number, purchase_date, purchase_value, notes } = req.body;
    if (!category || !category.trim()) return res.status(400).json({ error: 'category is required' });

    const { rows: [asset] } = await safeQuery(
      `INSERT INTO assets (asset_tag, category, description, serial_number, purchase_date, purchase_value, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [asset_tag || null, category.trim(), description || null, serial_number || null, purchase_date || null, purchase_value || null, notes || null]
    );
    res.status(201).json({ asset });
  } catch (err) {
    console.error('[assets:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'An asset with this tag already exists' });
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

router.put('/:id', requireRole('hr'), async (req, res) => {
  try {
    const allowed = ['asset_tag', 'category', 'description', 'serial_number', 'purchase_date', 'purchase_value', 'notes'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key] === '' ? null : req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE assets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset: rows[0] });
  } catch (err) {
    console.error('[assets:update]', err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// ── assign to an employee — flips status, stamps assigned_date ─────────────
router.post('/:id/assign', requireRole('hr'), async (req, res) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });

    const { rows: [asset] } = await safeQuery(`SELECT * FROM assets WHERE id = $1`, [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (asset.status === 'assigned') return res.status(400).json({ error: 'Asset is already assigned — return it first' });

    const { rows: [updated] } = await safeQuery(
      `UPDATE assets SET status = 'assigned', assigned_to = $1, assigned_date = CURRENT_DATE, returned_date = NULL WHERE id = $2 RETURNING *`,
      [employee_id, req.params.id]
    );

    await logAction({ staffId: req.staff.id, action: 'asset.assigned', entity: 'assets', entityId: updated.id, newValue: { employee_id, category: updated.category } });

    res.json({ asset: updated });
  } catch (err) {
    console.error('[assets:assign]', err);
    res.status(500).json({ error: 'Failed to assign asset' });
  }
});

// ── return — clears the employee link, back to in_stock ────────────────────
router.post('/:id/return', requireRole('hr'), async (req, res) => {
  try {
    const { rows: [asset] } = await safeQuery(`SELECT * FROM assets WHERE id = $1`, [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const { rows: [updated] } = await safeQuery(
      `UPDATE assets SET status = 'in_stock', assigned_to = NULL, returned_date = CURRENT_DATE WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logAction({ staffId: req.staff.id, action: 'asset.returned', entity: 'assets', entityId: updated.id, oldValue: { previouslyAssignedTo: asset.assigned_to } });

    res.json({ asset: updated });
  } catch (err) {
    console.error('[assets:return]', err);
    res.status(500).json({ error: 'Failed to return asset' });
  }
});

// ── retire / mark lost — immediate, not gated (low-value operational change) ─
router.post('/:id/retire', requireRole('hr'), async (req, res) => {
  try {
    const { reason } = req.body;
    const { rows } = await safeQuery(
      `UPDATE assets SET status = 'retired', assigned_to = NULL, notes = COALESCE(notes || E'\\n', '') || $1 WHERE id = $2 RETURNING *`,
      [reason ? `Retired: ${reason}` : 'Retired', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset: rows[0] });
  } catch (err) {
    console.error('[assets:retire]', err);
    res.status(500).json({ error: 'Failed to retire asset' });
  }
});

module.exports = router;