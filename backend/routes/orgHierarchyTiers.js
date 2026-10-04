'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

const tierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  display_order: z.number().int().min(0).default(0),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
});

// List all tiers (ordered by display_order)
router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM org_hierarchy_tiers ORDER BY display_order, name`
    );
    res.json({ tiers: rows });
  } catch (err) {
    console.error('[org-hierarchy-tiers:list]', err);
    res.status(500).json({ error: 'Failed to fetch hierarchy tiers' });
  }
});

// Create tier (owner/admin only)
router.post('/', requireRole('admin'), validateBody(tierSchema), async (req, res) => {
  try {
    const { name, display_order, description, color, icon } = req.body;
    const { rows } = await safeQuery(
      `INSERT INTO org_hierarchy_tiers (name, display_order, description, color, icon)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), display_order || 0, description || null, color || '#6366f1', icon || null]
    );
    res.status(201).json({ tier: rows[0] });
  } catch (err) {
    console.error('[org-hierarchy-tiers:create]', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A tier with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create hierarchy tier' });
  }
});

// Update tier (owner/admin only) - system tiers cannot be deleted
router.put('/:id', requireRole('admin'), validateBody(tierSchema.partial()), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: [existing] } = await safeQuery(`SELECT * FROM org_hierarchy_tiers WHERE id = $1`, [id]);
    if (!existing) return res.status(404).json({ error: 'Tier not found' });
    if (existing.is_system && req.body.name && req.body.name !== existing.name) {
      return res.status(400).json({ error: 'Cannot rename system tier' });
    }

    const allowed = ['name', 'display_order', 'description', 'color', 'icon'];
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
      `UPDATE org_hierarchy_tiers SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    res.json({ tier: rows[0] });
  } catch (err) {
    console.error('[org-hierarchy-tiers:update]', err);
    res.status(500).json({ error: 'Failed to update hierarchy tier' });
  }
});

// Delete tier (owner/admin only) - system tiers cannot be deleted
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: [existing] } = await safeQuery(`SELECT * FROM org_hierarchy_tiers WHERE id = $1`, [id]);
    if (!existing) return res.status(404).json({ error: 'Tier not found' });
    if (existing.is_system) {
      return res.status(400).json({ error: 'Cannot delete system tier' });
    }

    // Check if any designations use this tier
    const { rows: [{ count }] } = await safeQuery(
      `SELECT COUNT(*) FROM designations WHERE tier_id = $1`, [id]
    );
    if (Number(count) > 0) {
      return res.status(409).json({ error: `Cannot delete — ${count} designation(s) use this tier` });
    }

    await safeQuery(`DELETE FROM org_hierarchy_tiers WHERE id = $1`, [id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[org-hierarchy-tiers:delete]', err);
    res.status(500).json({ error: 'Failed to delete hierarchy tier' });
  }
});

// Reorder tiers (owner/admin only)
router.post('/reorder', requireRole('admin'), validateBody(z.array(z.object({
  id: schemas.uuid,
  display_order: z.number().int().min(0),
}))), async (req, res) => {
  try {
    await withTransaction(async (client) => {
      for (const { id, display_order } of req.body) {
        await client.query(
          `UPDATE org_hierarchy_tiers SET display_order = $1 WHERE id = $2`,
          [display_order, id]
        );
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[org-hierarchy-tiers:reorder]', err);
    res.status(500).json({ error: 'Failed to reorder tiers' });
  }
});

module.exports = router;