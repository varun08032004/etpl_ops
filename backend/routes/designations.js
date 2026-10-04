'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT des.*, d.name AS department_name, oht.name AS tier_name, oht.display_order AS tier_order, oht.color AS tier_color
       FROM designations des
       LEFT JOIN departments d ON d.id = des.department_id
       LEFT JOIN org_hierarchy_tiers oht ON oht.id = des.tier_id
       ORDER BY oht.display_order, des.title`
    );
    res.json({ designations: rows });
  } catch (err) {
    console.error('[designations:list]', err);
    res.status(500).json({ error: 'Failed to fetch designations' });
  }
});

// Find-or-create by title — lets the employee form's designation field
// accept either an existing title or a brand new one without a separate
// "manage designations" screen. Not gated behind approval: creating a new
// job title isn't destructive.
router.post('/', requireRole('hr'), validateBody(z.object({
  title: z.string().min(1, 'title is required').max(150),
  department_id: schemas.uuid.optional().nullable(),
  tier_id: schemas.uuid.optional().nullable(),
})), async (req, res) => {
  try {
    const { title, department_id, tier_id } = req.body;
    const { rows } = await safeQuery(
      `INSERT INTO designations (title, department_id, tier_id) VALUES ($1,$2,$3)
       ON CONFLICT (title) DO UPDATE SET title = EXCLUDED.title, department_id = EXCLUDED.department_id, tier_id = EXCLUDED.tier_id
       RETURNING *`,
      [title.trim(), department_id || null, tier_id || null]
    );
    res.status(201).json({ designation: rows[0] });
  } catch (err) {
    console.error('[designations:create]', err);
    res.status(500).json({ error: 'Failed to save designation' });
  }
});

// Update designation (including tier_id)
router.put('/:id', requireRole('hr'), validateBody(z.object({
  title: z.string().min(1).max(150).optional(),
  department_id: schemas.uuid.optional().nullable(),
  tier_id: schemas.uuid.optional().nullable(),
  level: z.number().int().optional(),
})), async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['title', 'department_id', 'tier_id', 'level'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        let value = req.body[key];
        if (value === '') value = null;
        params.push(value);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(id);
    const { rows } = await safeQuery(
      `UPDATE designations SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Designation not found' });
    res.json({ designation: rows[0] });
  } catch (err) {
    console.error('[designations:update]', err);
    res.status(500).json({ error: 'Failed to update designation' });
  }
});

// Delete designation
router.delete('/:id', requireRole('hr'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: [{ count }] } = await safeQuery(
      `SELECT COUNT(*) FROM employees WHERE designation_id = $1`, [id]
    );
    if (Number(count) > 0) {
      return res.status(409).json({ error: `Cannot delete — ${count} employee(s) have this designation` });
    }
    await safeQuery(`DELETE FROM designations WHERE id = $1`, [id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[designations:delete]', err);
    res.status(500).json({ error: 'Failed to delete designation' });
  }
});

module.exports = router;