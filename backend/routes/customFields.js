'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

const createFieldSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(['text', 'textarea', 'number', 'date', 'datetime', 'select', 'multi_select', 'user_picker', 'multi_user_picker', 'url', 'checkbox', 'radio', 'cascade_select', 'labels']),
  default_value: z.any().optional().nullable(),
  options: z.array(z.object({ value: z.string(), label: z.string(), color: z.string().optional() })).optional(),
  is_required: z.boolean().default(false),
  project_ids: z.array(schemas.uuid).optional(),
  issue_type_ids: z.array(z.string()).optional(),
});

const updateFieldSchema = createFieldSchema.partial().strict();

const createContextSchema = z.object({
  field_id: schemas.uuid,
  project_id: schemas.uuid.optional().nullable(),
  issue_type_ids: z.array(z.string()).optional(),
  is_global: z.boolean().default(false),
  default_value: z.any().optional().nullable(),
});

// List all custom fields
router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT cf.*, 
              COUNT(cfc.id) AS context_count,
              COUNT(cfv.id) AS usage_count
       FROM custom_fields cf
       LEFT JOIN custom_field_contexts cfc ON cfc.field_id = cf.id
       LEFT JOIN custom_field_values cfv ON cfv.field_id = cf.id
       GROUP BY cf.id
       ORDER BY cf.created_at DESC`
    );
    res.json({ fields: rows });
  } catch (err) {
    console.error('[customFields:list]', err);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// Get single field with contexts
router.get('/:id', async (req, res) => {
  try {
    const { rows: [field] } = await safeQuery(`SELECT * FROM custom_fields WHERE id = $1`, [req.params.id]);
    if (!field) return res.status(404).json({ error: 'Field not found' });

    const { rows: contexts } = await safeQuery(
      `SELECT cfc.*, p.name AS project_name, p.key_prefix
       FROM custom_field_contexts cfc
       LEFT JOIN task_projects p ON p.id = cfc.project_id
       WHERE cfc.field_id = $1`, [req.params.id]
    );
    res.json({ field, contexts });
  } catch (err) {
    console.error('[customFields:get]', err);
    res.status(500).json({ error: 'Failed to fetch field' });
  }
});

// Create custom field
router.post('/', requireRole('admin'), validateBody(createFieldSchema), async (req, res) => {
  try {
    const { name, description, type, default_value, options, is_required, project_ids, issue_type_ids } = req.body;
    const fieldKey = `cf_${Date.now().toString(36)}`;

    const result = await withTransaction(async (client) => {
      const { rows: [field] } = await client.query(
        `INSERT INTO custom_fields (name, description, type, default_value, options, is_required, field_key, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [name, description || null, type, default_value || null, options ? JSON.stringify(options) : null, is_required, fieldKey, req.staff.id]
      );

      // Create contexts
      const projects = project_ids || [];
      if (projects.length === 0) {
        // Global context
        await client.query(
          `INSERT INTO custom_field_contexts (field_id, is_global) VALUES ($1, true)`,
          [field.id]
        );
      } else {
        for (const pid of projects) {
          await client.query(
            `INSERT INTO custom_field_contexts (field_id, project_id, issue_type_ids) VALUES ($1,$2,$3)`,
            [field.id, pid, issue_type_ids || null]
          );
        }
      }
      return field;
    });

    res.status(201).json({ field: result });
  } catch (err) {
    console.error('[customFields:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Field name already exists' });
    res.status(500).json({ error: 'Failed to create custom field' });
  }
});

// Update custom field
router.put('/:id', requireRole('admin'), validateBody(updateFieldSchema), async (req, res) => {
  try {
    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'options' && value) value = JSON.stringify(value);
      if (value === '' || value === undefined) continue;
      params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE custom_fields SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Field not found' });
    res.json({ field: rows[0] });
  } catch (err) {
    console.error('[customFields:update]', err);
    res.status(500).json({ error: 'Failed to update field' });
  }
});

// Delete custom field
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM custom_fields WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Field not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[customFields:delete]', err);
    res.status(500).json({ error: 'Failed to delete field' });
  }
});

// Contexts
router.post('/:id/contexts', requireRole('admin'), validateBody(createContextSchema), async (req, res) => {
  try {
    const { project_id, issue_type_ids, is_global, default_value } = req.body;
    const { rows: [context] } = await safeQuery(
      `INSERT INTO custom_field_contexts (field_id, project_id, issue_type_ids, is_global, default_value)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, project_id || null, issue_type_ids || null, is_global, default_value || null]
    );
    res.status(201).json({ context });
  } catch (err) {
    console.error('[customFields:context:create]', err);
    res.status(500).json({ error: 'Failed to create context' });
  }
});

router.delete('/:fieldId/contexts/:contextId', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `DELETE FROM custom_field_contexts WHERE id = $1 AND field_id = $2 RETURNING id`,
      [req.params.contextId, req.params.fieldId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Context not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[customFields:context:delete]', err);
    res.status(500).json({ error: 'Failed to delete context' });
  }
});

// Get field value for an issue
router.get('/issues/:issueId/values', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT cfv.*, cf.name, cf.type, cf.field_key, cf.options
       FROM custom_field_values cfv
       JOIN custom_fields cf ON cf.id = cfv.field_id
       WHERE cfv.issue_id = $1`, [req.params.issueId]
    );
    res.json({ values: rows });
  } catch (err) {
    console.error('[customFields:values:get]', err);
    res.status(500).json({ error: 'Failed to fetch values' });
  }
});

// Set field value for an issue
router.put('/issues/:issueId/values/:fieldId', async (req, res) => {
  try {
    const { value } = req.body;
    const { rows: [field] } = await safeQuery(`SELECT * FROM custom_fields WHERE id = $1`, [req.params.fieldId]);
    if (!field) return res.status(404).json({ error: 'Field not found' });

    const { rows } = await safeQuery(
      `INSERT INTO custom_field_values (issue_id, field_id, value)
       VALUES ($1,$2,$3)
       ON CONFLICT (issue_id, field_id) DO UPDATE SET value = EXCLUDED.value
       RETURNING *`,
      [req.params.issueId, req.params.fieldId, value]
    );
    res.json({ value: rows[0] });
  } catch (err) {
    console.error('[customFields:values:set]', err);
    res.status(500).json({ error: 'Failed to set value' });
  }
});

module.exports = router;