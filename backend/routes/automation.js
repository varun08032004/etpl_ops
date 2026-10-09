'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

const createRuleSchema = z.object({
  project_id: schemas.uuid.optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  trigger: z.object({
    type: z.string(), // issue_created, issue_updated, issue_transitioned, comment_added, scheduled, etc.
    conditions: z.array(z.any()).optional(),
  }),
  conditions: z.array(z.any()).optional(),
  actions: z.array(z.object({
    type: z.string(), // transition_issue, assign_issue, add_comment, send_email, update_field, create_issue, webhook, etc.
    params: z.record(z.any()),
  })).min(1),
});

const updateRuleSchema = createRuleSchema.partial().strict();

// List automation rules
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    let where = '', params = [];
    if (project_id) { params.push(project_id); where = `WHERE ar.project_id = $${params.length}`; }
    else if (!['owner', 'admin'].includes(req.staff.role)) {
      if (!req.staff.employee_id) return res.json({ rules: [] });
      const { rows: [emp] } = await safeQuery(`SELECT department_id FROM employees WHERE id = $1`, [req.staff.employee_id]);
      if (emp?.department_id) {
        params.push(emp.department_id);
        where = `WHERE tp.department_id = $${params.length}`;
      } else return res.json({ rules: [] });
    }
    const { rows } = await safeQuery(
      `SELECT ar.*, tp.name AS project_name, tp.key_prefix
       FROM automation_rules ar
       LEFT JOIN task_projects tp ON tp.id = ar.project_id
       ${where}
       ORDER BY ar.created_at DESC`,
      params
    );
    res.json({ rules: rows });
  } catch (err) {
    console.error('[automation:list]', err);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

// Get single rule
router.get('/:id', async (req, res) => {
  try {
    const { rows: [rule] } = await safeQuery(
      `SELECT ar.*, tp.name AS project_name FROM automation_rules ar LEFT JOIN task_projects tp ON tp.id = ar.project_id WHERE ar.id = $1`,
      [req.params.id]
    );
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    const { rows: audit } = await safeQuery(
      `SELECT aal.*, sa.email AS triggered_by_email FROM automation_audit_log aal
       LEFT JOIN staff_accounts sa ON sa.id = aal.triggered_by
       WHERE aal.rule_id = $1 ORDER BY aal.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ rule, audit });
  } catch (err) {
    console.error('[automation:get]', err);
    res.status(500).json({ error: 'Failed to fetch rule' });
  }
});

// Create rule
router.post('/', requireRole('admin'), validateBody(createRuleSchema), async (req, res) => {
  try {
    const { project_id, name, description, trigger, conditions, actions } = req.body;
    const { rows: [rule] } = await safeQuery(
      `INSERT INTO automation_rules (project_id, name, description, trigger, conditions, actions, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [project_id || null, name, description || null, JSON.stringify(trigger), conditions ? JSON.stringify(conditions) : null, JSON.stringify(actions), req.staff.id]
    );
    res.status(201).json({ rule });
  } catch (err) {
    console.error('[automation:create]', err);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// Update rule
router.put('/:id', requireRole('admin'), validateBody(updateRuleSchema), async (req, res) => {
  try {
    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'trigger' || key === 'conditions' || key === 'actions') {
        if (value === undefined) continue;
        params.push(JSON.stringify(value));
      } else if (value === '' || value === undefined) continue;
      else params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE automation_rules SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Rule not found' });
    res.json({ rule: rows[0] });
  } catch (err) {
    console.error('[automation:update]', err);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// Toggle rule status
router.post('/:id/toggle', async (req, res) => {
  try {
    const { rows: [rule] } = await safeQuery(
      `UPDATE automation_rules SET status = CASE WHEN status = 'enabled' THEN 'disabled' ELSE 'enabled' END WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ rule });
  } catch (err) {
    console.error('[automation:toggle]', err);
    res.status(500).json({ error: 'Failed to toggle rule' });
  }
});

// Delete rule
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM automation_rules WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Rule not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[automation:delete]', err);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// Get audit log
router.get('/:id/audit', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const { rows: [count] } = await safeQuery(`SELECT COUNT(*) FROM automation_audit_log WHERE rule_id = $1`, [req.params.id]);
    const { rows } = await safeQuery(
      `SELECT aal.*, sa.email AS triggered_by_email
       FROM automation_audit_log aal
       LEFT JOIN staff_accounts sa ON sa.id = aal.triggered_by
       WHERE aal.rule_id = $1 ORDER BY aal.created_at DESC LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    res.json({ audit: rows, total: Number(count.count) });
  } catch (err) {
    console.error('[automation:audit]', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Execute rule manually (for testing)
router.post('/:id/execute', async (req, res) => {
  try {
    const { issue_id, triggered_by } = req.body;
    // This would be called by the automation engine
    // For now, just log the manual execution
    const { rows: [rule] } = await safeQuery(`SELECT * FROM automation_rules WHERE id = $1`, [req.params.id]);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    await safeQuery(
      `INSERT INTO automation_audit_log (rule_id, issue_id, status, triggered_by, execution_time_ms, error_message)
       VALUES ($1,$2,'success',$3,0,'Manual execution')`,
      [req.params.id, issue_id || null, req.staff.id]
    );

    res.json({ message: 'Rule queued for execution', rule });
  } catch (err) {
    console.error('[automation:execute]', err);
    res.status(500).json({ error: 'Failed to execute rule' });
  }
});

module.exports = router;