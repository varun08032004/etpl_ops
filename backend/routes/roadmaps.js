'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

const createRoadmapSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  is_shared: z.boolean().default(false),
  share_permissions: z.array(z.object({ type: z.string(), param: z.string() })).optional(),
  view_config: z.record(z.any()).optional(),
});

const updateRoadmapSchema = createRoadmapSchema.partial().strict();

const createRoadmapItemSchema = z.object({
  roadmap_id: schemas.uuid,
  issue_id: schemas.uuid.optional().nullable(),
  project_id: schemas.uuid.optional().nullable(),
  parent_id: schemas.uuid.optional().nullable(),
  name: z.string().min(1).max(300),
  type: z.enum(['epic', 'story', 'initiative', 'theme']),
  start_date: schemas.isoDate.optional().nullable(),
  end_date: schemas.isoDate.optional().nullable(),
  progress: z.number().min(0).max(100).default(0),
  assignee_id: schemas.uuid.optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  order_index: z.number().default(0),
  fields: z.record(z.any()).optional(),
});

const updateRoadmapItemSchema = createRoadmapItemSchema.partial().strict();

// List roadmaps
router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT r.*, sa.email AS owner_email,
              (SELECT COUNT(*) FROM roadmap_items WHERE roadmap_id = r.id) AS item_count
       FROM roadmaps r
       JOIN staff_accounts sa ON sa.id = r.owner_id
       WHERE r.owner_id = $1 OR r.is_shared = true
       ORDER BY r.updated_at DESC`,
      [req.staff.id]
    );
    res.json({ roadmaps: rows });
  } catch (err) {
    console.error('[roadmaps:list]', err);
    res.status(500).json({ error: 'Failed to fetch roadmaps' });
  }
});

// Get roadmap with items (hierarchical)
router.get('/:id', async (req, res) => {
  try {
    const { rows: [roadmap] } = await safeQuery(`SELECT * FROM roadmaps WHERE id = $1`, [req.params.id]);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
    if (roadmap.owner_id !== req.staff.id && !roadmap.is_shared) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rows: items } = await safeQuery(
      `SELECT ri.*, t.issue_key, t.title AS issue_title, t.status AS issue_status, t.type AS issue_type,
              e.full_name AS assignee_name, p.name AS project_name, p.key_prefix
       FROM roadmap_items ri
       LEFT JOIN tasks t ON t.id = ri.issue_id
       LEFT JOIN employees e ON e.id = ri.assignee_id
       LEFT JOIN task_projects p ON p.id = ri.project_id
       WHERE ri.roadmap_id = $1 ORDER BY ri.order_index`,
      [req.params.id]
    );
    res.json({ roadmap, items });
  } catch (err) {
    console.error('[roadmaps:get]', err);
    res.status(500).json({ error: 'Failed to fetch roadmap' });
  }
});

// Create roadmap
router.post('/', validateBody(createRoadmapSchema), async (req, res) => {
  try {
    const { name, description, is_shared, share_permissions, view_config } = req.body;
    const { rows: [roadmap] } = await safeQuery(
      `INSERT INTO roadmaps (name, description, owner_id, is_shared, share_permissions, view_config)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, description || null, req.staff.id, is_shared || false, share_permissions ? JSON.stringify(share_permissions) : null, view_config ? JSON.stringify(view_config) : null]
    );
    res.status(201).json({ roadmap });
  } catch (err) {
    console.error('[roadmaps:create]', err);
    res.status(500).json({ error: 'Failed to create roadmap' });
  }
});

// Update roadmap
router.put('/:id', validateBody(updateRoadmapSchema), async (req, res) => {
  try {
    const { rows: [roadmap] } = await safeQuery(`SELECT * FROM roadmaps WHERE id = $1`, [req.params.id]);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
    if (roadmap.owner_id !== req.staff.id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can edit' });
    }

    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'share_permissions' || key === 'view_config') {
        if (value === undefined) continue;
        params.push(JSON.stringify(value));
      } else if (value === '' || value === undefined) continue;
      else params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE roadmaps SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    res.json({ roadmap: rows[0] });
  } catch (err) {
    console.error('[roadmaps:update]', err);
    res.status(500).json({ error: 'Failed to update roadmap' });
  }
});

// Delete roadmap
router.delete('/:id', async (req, res) => {
  try {
    const { rows: [roadmap] } = await safeQuery(`SELECT * FROM roadmaps WHERE id = $1`, [req.params.id]);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
    if (roadmap.owner_id !== req.staff.id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can delete' });
    }
    const { rows } = await safeQuery(`DELETE FROM roadmaps WHERE id = $1 RETURNING id`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[roadmaps:delete]', err);
    res.status(500).json({ error: 'Failed to delete roadmap' });
  }
});

// Roadmap Items
router.post('/items', validateBody(createRoadmapItemSchema), async (req, res) => {
  try {
    const { rows: [roadmap] } = await safeQuery(`SELECT * FROM roadmaps WHERE id = $1`, [req.body.roadmap_id]);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
    if (roadmap.owner_id !== req.staff.id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can add items' });
    }

    const { roadmap_id, issue_id, project_id, parent_id, name, type, start_date, end_date, progress, assignee_id, color, order_index, fields } = req.body;
    const { rows: [item] } = await safeQuery(
      `INSERT INTO roadmap_items (roadmap_id, issue_id, project_id, parent_id, name, type, start_date, end_date, progress, assignee_id, color, order_index, fields)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [roadmap_id, issue_id || null, project_id || null, parent_id || null, name, type, start_date || null, end_date || null, progress || 0, assignee_id || null, color, order_index, fields ? JSON.stringify(fields) : null]
    );
    res.status(201).json({ item });
  } catch (err) {
    console.error('[roadmaps:item:create]', err);
    res.status(500).json({ error: 'Failed to create roadmap item' });
  }
});

router.put('/items/:id', validateBody(updateRoadmapItemSchema), async (req, res) => {
  try {
    const { rows: [item] } = await safeQuery(
      `SELECT ri.*, r.owner_id FROM roadmap_items ri JOIN roadmaps r ON r.id = ri.roadmap_id WHERE ri.id = $1`,
      [req.params.id]
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.owner_id !== req.staff.id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only roadmap owner can edit items' });
    }

    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'fields') {
        if (value === undefined) continue;
        params.push(JSON.stringify(value));
      } else if (value === '' || value === undefined) continue;
      else params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE roadmap_items SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    res.json({ item: rows[0] });
  } catch (err) {
    console.error('[roadmaps:item:update]', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.delete('/items/:id', async (req, res) => {
  try {
    const { rows: [item] } = await safeQuery(
      `SELECT ri.*, r.owner_id FROM roadmap_items ri JOIN roadmaps r ON r.id = ri.roadmap_id WHERE ri.id = $1`,
      [req.params.id]
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.owner_id !== req.staff.id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only roadmap owner can delete items' });
    }
    const { rows } = await safeQuery(`DELETE FROM roadmap_items WHERE id = $1 RETURNING id`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[roadmaps:item:delete]', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Bulk reorder items
router.post('/items/reorder', async (req, res) => {
  try {
    const { items } = req.body; // [{id, order_index, parent_id}]
    if (!items || !items.length) return res.status(400).json({ error: 'items array required' });

    await withTransaction(async (client) => {
      for (const item of items) {
        await client.query(
          `UPDATE roadmap_items SET order_index = $1, parent_id = $2 WHERE id = $3`,
          [item.order_index, item.parent_id || null, item.id]
        );
      }
    });
    res.json({ updated: items.length });
  } catch (err) {
    console.error('[roadmaps:reorder]', err);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

module.exports = router;