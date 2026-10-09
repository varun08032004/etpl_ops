'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

const createDashboardSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  is_shared: z.boolean().default(false),
  share_permissions: z.array(z.object({ type: z.string(), param: z.string() })).optional(),
  layout: z.record(z.any()).optional(),
});

const updateDashboardSchema = createDashboardSchema.partial().strict();

const createGadgetSchema = z.object({
  dashboard_id: schemas.uuid,
  gadget_type: z.enum(['filter_results', 'pie_chart', 'created_vs_resolved', 'sprint_burndown', 'velocity_chart', 'issue_statistics', 'activity_stream', 'assigned_to_me', 'jira_roadmap', 'text', 'calendar', 'quick_links']),
  title: z.string().max(200).optional().nullable(),
  config: z.record(z.any()).optional(),
  position_x: z.number().default(0),
  position_y: z.number().default(0),
  width: z.number().default(6),
  height: z.number().default(4),
});

// List dashboards
router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT d.*, sa.email AS owner_email,
              (SELECT COUNT(*) FROM dashboard_gadgets WHERE dashboard_id = d.id) AS gadget_count
       FROM dashboards d
       JOIN staff_accounts sa ON sa.id = d.owner_id
       WHERE d.owner_id = $1 OR d.is_shared = true
       ORDER BY d.updated_at DESC`,
      [req.staff.id]
    );
    res.json({ dashboards: rows });
  } catch (err) {
    console.error('[dashboards:list]', err);
    res.status(500).json({ error: 'Failed to fetch dashboards' });
  }
});

// Get dashboard with gadgets
router.get('/:id', async (req, res) => {
  try {
    const { rows: [dashboard] } = await safeQuery(`SELECT * FROM dashboards WHERE id = $1`, [req.params.id]);
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });

    // Check access
    if (dashboard.owner_id !== req.staff.id && !dashboard.is_shared) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rows: gadgets } = await safeQuery(
      `SELECT * FROM dashboard_gadgets WHERE dashboard_id = $1 ORDER BY position_y, position_x`,
      [req.params.id]
    );
    res.json({ dashboard, gadgets });
  } catch (err) {
    console.error('[dashboards:get]', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Create dashboard
router.post('/', validateBody(createDashboardSchema), async (req, res) => {
  try {
    const { name, description, is_shared, share_permissions, layout } = req.body;
    const { rows: [dashboard] } = await safeQuery(
      `INSERT INTO dashboards (name, description, owner_id, is_shared, share_permissions, layout)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, description || null, req.staff.id, is_shared || false, share_permissions ? JSON.stringify(share_permissions) : null, layout ? JSON.stringify(layout) : null]
    );
    res.status(201).json({ dashboard });
  } catch (err) {
    console.error('[dashboards:create]', err);
    res.status(500).json({ error: 'Failed to create dashboard' });
  }
});

// Update dashboard
router.put('/:id', validateBody(updateDashboardSchema), async (req, res) => {
  try {
    const { rows: [dashboard] } = await safeQuery(`SELECT * FROM dashboards WHERE id = $1`, [req.params.id]);
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    if (dashboard.owner_id !== req.staff.id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can edit' });
    }

    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'share_permissions' || key === 'layout') {
        if (value === undefined) continue;
        params.push(JSON.stringify(value));
      } else if (value === '' || value === undefined) continue;
      else params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE dashboards SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    res.json({ dashboard: rows[0] });
  } catch (err) {
    console.error('[dashboards:update]', err);
    res.status(500).json({ error: 'Failed to update dashboard' });
  }
});

// Delete dashboard
router.delete('/:id', async (req, res) => {
  try {
    const { rows: [dashboard] } = await safeQuery(`SELECT * FROM dashboards WHERE id = $1`, [req.params.id]);
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    if (dashboard.owner_id !== req.staff.id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can delete' });
    }
    const { rows } = await safeQuery(`DELETE FROM dashboards WHERE id = $1 RETURNING id`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[dashboards:delete]', err);
    res.status(500).json({ error: 'Failed to delete dashboard' });
  }
});

// Gadgets
router.post('/gadgets', validateBody(createGadgetSchema), async (req, res) => {
  try {
    const { rows: [dashboard] } = await safeQuery(`SELECT * FROM dashboards WHERE id = $1`, [req.body.dashboard_id]);
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    if (dashboard.owner_id !== req.staff.id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can add gadgets' });
    }

    const { dashboard_id, gadget_type, title, config, position_x, position_y, width, height } = req.body;
    const { rows: [gadget] } = await safeQuery(
      `INSERT INTO dashboard_gadgets (dashboard_id, gadget_type, title, config, position_x, position_y, width, height)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [dashboard_id, gadget_type, title || null, config ? JSON.stringify(config) : null, position_x, position_y, width, height]
    );
    res.status(201).json({ gadget });
  } catch (err) {
    console.error('[dashboards:gadget:create]', err);
    res.status(500).json({ error: 'Failed to add gadget' });
  }
});

router.put('/gadgets/:id', async (req, res) => {
  try {
    const { rows: [gadget] } = await safeQuery(
      `SELECT dg.*, d.owner_id FROM dashboard_gadgets dg JOIN dashboards d ON d.id = dg.dashboard_id WHERE dg.id = $1`,
      [req.params.id]
    );
    if (!gadget) return res.status(404).json({ error: 'Gadget not found' });
    if (gadget.owner_id !== req.staff.id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only dashboard owner can edit gadgets' });
    }

    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'config') {
        if (value === undefined) continue;
        params.push(JSON.stringify(value));
      } else if (value === '' || value === undefined) continue;
      else params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE dashboard_gadgets SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    res.json({ gadget: rows[0] });
  } catch (err) {
    console.error('[dashboards:gadget:update]', err);
    res.status(500).json({ error: 'Failed to update gadget' });
  }
});

router.delete('/gadgets/:id', async (req, res) => {
  try {
    const { rows: [gadget] } = await safeQuery(
      `SELECT dg.*, d.owner_id FROM dashboard_gadgets dg JOIN dashboards d ON d.id = dg.dashboard_id WHERE dg.id = $1`,
      [req.params.id]
    );
    if (!gadget) return res.status(404).json({ error: 'Gadget not found' });
    if (gadget.owner_id !== req.staff.id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only dashboard owner can delete gadgets' });
    }
    const { rows } = await safeQuery(`DELETE FROM dashboard_gadgets WHERE id = $1 RETURNING id`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[dashboards:gadget:delete]', err);
    res.status(500).json({ error: 'Failed to delete gadget' });
  }
});

module.exports = router;