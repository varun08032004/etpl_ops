'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  statuses: z.array(z.object({
    status_key: z.string().max(50),
    name: z.string().max(100),
    category: z.enum(['to_do', 'in_progress', 'done']),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
    is_initial: z.boolean().default(false),
    is_final: z.boolean().default(false),
    properties: z.record(z.any()).optional(),
  })).min(1),
  transitions: z.array(z.object({
    from_status_key: z.string(),
    to_status_key: z.string(),
    name: z.string().max(100),
    conditions: z.array(z.any()).optional(),
    validators: z.array(z.any()).optional(),
    post_functions: z.array(z.any()).optional(),
  })).optional(),
});

const updateWorkflowSchema = createWorkflowSchema.partial().strict();

const assignWorkflowSchema = z.object({
  project_id: schemas.uuid,
  issue_type_id: schemas.uuid.optional().nullable(),
  workflow_id: schemas.uuid,
});

// List workflows
router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT w.*, 
              COUNT(ws.id) AS status_count,
              COUNT(pws.id) AS project_count
       FROM workflows w
       LEFT JOIN workflow_statuses ws ON ws.workflow_id = w.id
       LEFT JOIN project_workflow_schemes pws ON pws.workflow_id = w.id
       GROUP BY w.id
       ORDER BY w.created_at DESC`
    );
    res.json({ workflows: rows });
  } catch (err) {
    console.error('[workflows:list]', err);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// Get workflow with statuses and transitions
router.get('/:id', async (req, res) => {
  try {
    const { rows: [workflow] } = await safeQuery(`SELECT * FROM workflows WHERE id = $1`, [req.params.id]);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    const [statuses, transitions, screens, projects] = await Promise.all([
      safeQuery(`SELECT * FROM workflow_statuses WHERE workflow_id = $1 ORDER BY order_index`, [req.params.id]),
      safeQuery(
        `SELECT wt.*, ws1.name AS from_name, ws2.name AS to_name
         FROM workflow_transitions wt
         JOIN workflow_statuses ws1 ON ws1.id = wt.from_status_id
         JOIN workflow_statuses ws2 ON ws2.id = wt.to_status_id
         WHERE wt.workflow_id = $1 ORDER BY wt.order_index`, [req.params.id]
      ),
      safeQuery(`SELECT * FROM workflow_screens WHERE workflow_id = $1`, [req.params.id]),
      safeQuery(
        `SELECT pws.*, tp.name AS project_name, tp.key_prefix
         FROM project_workflow_schemes pws
         JOIN task_projects tp ON tp.id = pws.project_id
         WHERE pws.workflow_id = $1`, [req.params.id]
      ),
    ]);

    res.json({
      workflow,
      statuses: statuses.rows,
      transitions: transitions.rows,
      screens: screens.rows,
      projects: projects.rows,
    });
  } catch (err) {
    console.error('[workflows:get]', err);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// Create workflow
router.post('/', requireRole('admin'), validateBody(createWorkflowSchema), async (req, res) => {
  try {
    const { name, description, statuses, transitions } = req.body;

    const result = await withTransaction(async (client) => {
      const { rows: [workflow] } = await client.query(
        `INSERT INTO workflows (name, description, created_by) VALUES ($1,$2,$3) RETURNING *`,
        [name, description || null, req.staff.id]
      );

      const statusMap = {};
      for (let i = 0; i < statuses.length; i++) {
        const s = statuses[i];
        const { rows: [st] } = await client.query(
          `INSERT INTO workflow_statuses (workflow_id, status_key, name, category, color, is_initial, is_final, properties, order_index)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [workflow.id, s.status_key, s.name, s.category, s.color, s.is_initial, s.is_final, s.properties || null, i]
        );
        statusMap[s.status_key] = st.id;
      }

      if (transitions) {
        for (let i = 0; i < transitions.length; i++) {
          const t = transitions[i];
          await client.query(
            `INSERT INTO workflow_transitions (workflow_id, from_status_id, to_status_id, name, conditions, validators, post_functions, order_index)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [workflow.id, statusMap[t.from_status_key], statusMap[t.to_status_key], t.name, t.conditions || null, t.validators || null, t.post_functions || null, i]
          );
        }
      }

      return workflow;
    });

    res.status(201).json({ workflow: result });
  } catch (err) {
    console.error('[workflows:create]', err);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// Update workflow
router.put('/:id', requireRole('admin'), validateBody(updateWorkflowSchema), async (req, res) => {
  try {
    const { statuses, transitions, ...rest } = req.body;
    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(rest)) {
      if (value === '' || value === undefined) continue;
      params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (sets.length) {
      params.push(req.params.id);
      await safeQuery(`UPDATE workflows SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i}`, params);
    }

    // Update statuses
    if (statuses) {
      await withTransaction(async (client) => {
        for (let i = 0; i < statuses.length; i++) {
          const s = statuses[i];
          if (s.id) {
            await client.query(
              `UPDATE workflow_statuses SET name=$1, category=$2, color=$3, is_initial=$4, is_final=$5, properties=$6, order_index=$7 WHERE id=$8`,
              [s.name, s.category, s.color, s.is_initial, s.is_final, s.properties || null, i, s.id]
            );
          } else {
            const { rows: [st] } = await client.query(
              `INSERT INTO workflow_statuses (workflow_id, status_key, name, category, color, is_initial, is_final, properties, order_index)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
              [req.params.id, s.status_key, s.name, s.category, s.color, s.is_initial, s.is_final, s.properties || null, i]
            );
          }
        }
      });
    }

    const { rows } = await safeQuery(`SELECT * FROM workflows WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Workflow not found' });
    res.json({ workflow: rows[0] });
  } catch (err) {
    console.error('[workflows:update]', err);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// Delete workflow
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rows: [check] } = await safeQuery(
      `SELECT COUNT(*) FROM project_workflow_schemes WHERE workflow_id = $1`, [req.params.id]
    );
    if (Number(check.count) > 0) {
      return res.status(400).json({ error: 'Cannot delete workflow in use by projects' });
    }
    const { rows } = await safeQuery(`DELETE FROM workflows WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Workflow not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[workflows:delete]', err);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// Assign workflow to project (project workflow scheme)
router.post('/schemes', requireRole('admin'), validateBody(assignWorkflowSchema), async (req, res) => {
  try {
    const { project_id, issue_type_id, workflow_id } = req.body;
    const { rows: [scheme] } = await safeQuery(
      `INSERT INTO project_workflow_schemes (project_id, issue_type_id, workflow_id)
       VALUES ($1,$2,$3)
       ON CONFLICT (project_id, issue_type_id) DO UPDATE SET workflow_id = EXCLUDED.workflow_id
       RETURNING *`,
      [project_id, issue_type_id || null, workflow_id]
    );
    res.status(201).json({ scheme });
  } catch (err) {
    console.error('[workflows:scheme:create]', err);
    res.status(500).json({ error: 'Failed to assign workflow' });
  }
});

// Get project workflow schemes
router.get('/projects/:projectId/schemes', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT pws.*, w.name AS workflow_name, w.description
       FROM project_workflow_schemes pws
       JOIN workflows w ON w.id = pws.workflow_id
       WHERE pws.project_id = $1`, [req.params.projectId]
    );
    res.json({ schemes: rows });
  } catch (err) {
    console.error('[workflows:schemes:list]', err);
    res.status(500).json({ error: 'Failed to fetch schemes' });
  }
});

// Delete project workflow scheme
router.delete('/schemes/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM project_workflow_schemes WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Scheme not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[workflows:scheme:delete]', err);
    res.status(500).json({ error: 'Failed to delete scheme' });
  }
});

// Get available workflows for project
router.get('/available', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM workflows WHERE is_active = true ORDER BY name`
    );
    res.json({ workflows: rows });
  } catch (err) {
    console.error('[workflows:available]', err);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

module.exports = router;