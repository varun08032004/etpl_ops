'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

const createSlaSchema = z.object({
  project_id: schemas.uuid,
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  jql: z.string().min(1),
  goals: z.array(z.object({
    metric: z.enum(['time_to_first_response', 'time_to_resolution', 'time_to_acknowledgment']),
    time_seconds: z.number().min(1),
    calendar_id: schemas.uuid,
  })).min(1),
});

const updateSlaSchema = createSlaSchema.partial().strict();

// List SLA configs
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    let where = '', params = [];
    if (project_id) { params.push(project_id); where = `WHERE sc.project_id = $${params.length}`; }
    else if (!['owner', 'admin'].includes(req.staff.role)) {
      if (!req.staff.employee_id) return res.json({ slas: [] });
      const { rows: [emp] } = await safeQuery(`SELECT department_id FROM employees WHERE id = $1`, [req.staff.employee_id]);
      if (emp?.department_id) { params.push(emp.department_id); where = `WHERE tp.department_id = $${params.length}`; }
      else return res.json({ slas: [] });
    }
    const { rows } = await safeQuery(
      `SELECT sc.*, tp.name AS project_name, tp.key_prefix, sc_cal.name AS calendar_name
       FROM sla_configs sc
       JOIN task_projects tp ON tp.id = sc.project_id
       LEFT JOIN sla_calendars sc_cal ON sc_cal.id = (sc.goals->0->>'calendar_id')::uuid
       ${where}
       ORDER BY sc.created_at DESC`,
      params
    );
    res.json({ slas: rows });
  } catch (err) {
    console.error('[slas:list]', err);
    res.status(500).json({ error: 'Failed to fetch SLA configs' });
  }
});

// Get SLA with issue metrics
router.get('/:id', async (req, res) => {
  try {
    const { rows: [sla] } = await safeQuery(`SELECT * FROM sla_configs WHERE id = $1`, [req.params.id]);
    if (!sla) return res.status(404).json({ error: 'SLA not found' });

    const { rows: metrics } = await safeQuery(
      `SELECT sim.*, t.issue_key, t.title, t.status, t.assignee_id
       FROM sla_issue_metrics sim
       JOIN tasks t ON t.id = sim.issue_id
       WHERE sim.sla_config_id = $1
       ORDER BY sim.started_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json({ sla, metrics });
  } catch (err) {
    console.error('[slas:get]', err);
    res.status(500).json({ error: 'Failed to fetch SLA' });
  }
});

// Create SLA
router.post('/', requireRole('admin'), validateBody(createSlaSchema), async (req, res) => {
  try {
    const { project_id, name, description, jql, goals } = req.body;
    const { rows: [sla] } = await safeQuery(
      `INSERT INTO sla_configs (project_id, name, description, jql, goals, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [project_id, name, description || null, jql, JSON.stringify(goals), req.staff.id]
    );
    res.status(201).json({ sla });
  } catch (err) {
    console.error('[slas:create]', err);
    res.status(500).json({ error: 'Failed to create SLA' });
  }
});

// Update SLA
router.put('/:id', requireRole('admin'), validateBody(updateSlaSchema), async (req, res) => {
  try {
    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'goals' && value) { params.push(JSON.stringify(value)); }
      else if (value === '' || value === undefined) continue;
      else params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE sla_configs SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'SLA not found' });
    res.json({ sla: rows[0] });
  } catch (err) {
    console.error('[slas:update]', err);
    res.status(500).json({ error: 'Failed to update SLA' });
  }
});

// Toggle SLA active
router.post('/:id/toggle', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE sla_configs SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'SLA not found' });
    res.json({ sla: rows[0] });
  } catch (err) {
    console.error('[slas:toggle]', err);
    res.status(500).json({ error: 'Failed to toggle SLA' });
  }
});

// Calendars
router.get('/calendars', async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM sla_calendars ORDER BY name`);
    res.json({ calendars: rows });
  } catch (err) {
    console.error('[slas:calendars]', err);
    res.status(500).json({ error: 'Failed to fetch calendars' });
  }
});

module.exports = router;