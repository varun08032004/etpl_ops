'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

const createOkrSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  owner_id: schemas.uuid,
  team_id: schemas.uuid.optional().nullable(),
  department_id: schemas.uuid.optional().nullable(),
  period_start: schemas.isoDate,
  period_end: schemas.isoDate,
  period_type: z.enum(['monthly', 'quarterly', 'yearly']).default('quarterly'),
  key_results: z.array(z.object({
    title: z.string().min(1).max(300),
    description: z.string().max(2000).optional().nullable(),
    metric_type: z.enum(['percentage', 'number', 'currency', 'boolean']).default('percentage'),
    target_value: z.number(),
    unit: z.string().max(50).optional().nullable(),
    owner_id: schemas.uuid.optional().nullable(),
  })).min(1).max(10),
});

const updateOkrSchema = createOkrSchema.partial().strict();

const updateKeyResultSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional().nullable(),
  metric_type: z.enum(['percentage', 'number', 'currency', 'boolean']).optional(),
  target_value: z.number().optional(),
  current_value: z.number().optional(),
  unit: z.string().max(50).optional().nullable(),
  owner_id: schemas.uuid.optional().nullable(),
  status: z.enum(['not_started', 'in_progress', 'at_risk', 'achieved']).optional(),
  order_index: z.number().optional(),
}).strict();

// List OKRs
router.get('/', async (req, res) => {
  try {
    const { owner_id, team_id, department_id, status, period_type } = req.query;
    let where = '', params = [];
    const conditions = [];

    if (owner_id) { params.push(owner_id); conditions.push(`o.owner_id = $${params.length}`); }
    if (team_id) { params.push(team_id); conditions.push(`o.team_id = $${params.length}`); }
    if (department_id) { params.push(department_id); conditions.push(`o.department_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`o.status = $${params.length}`); }
    if (period_type) { params.push(period_type); conditions.push(`o.period_type = $${params.length}`); }

    // Non-admin users see their own OKRs + team/dept OKRs
    if (!['owner', 'admin'].includes(req.staff.role)) {
      if (!req.staff.employee_id) return res.json({ okrs: [] });
      params.push(req.staff.employee_id);
      conditions.push(`(o.owner_id = $${params.length} OR o.team_id IN (SELECT team_id FROM employees WHERE id = $${params.length}) OR o.department_id IN (SELECT department_id FROM employees WHERE id = $${params.length}))`);
    }

    where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT o.*, e.full_name AS owner_name, e.employee_code, t.name AS team_name, d.name AS department_name,
              (SELECT COUNT(*) FROM key_results WHERE okr_id = o.id) AS kr_count,
              (SELECT AVG(progress) FROM key_results WHERE okr_id = o.id) AS avg_progress
       FROM okrs o
       JOIN employees e ON e.id = o.owner_id
       LEFT JOIN teams t ON t.id = o.team_id
       LEFT JOIN departments d ON d.id = o.department_id
       ${where}
       ORDER BY o.created_at DESC`,
      params
    );
    res.json({ okrs: rows });
  } catch (err) {
    console.error('[okrs:list]', err);
    res.status(500).json({ error: 'Failed to fetch OKRs' });
  }
});

// Get OKR with key results
router.get('/:id', async (req, res) => {
  try {
    const { rows: [okr] } = await safeQuery(
      `SELECT o.*, e.full_name AS owner_name, e.employee_code, e.work_email, t.name AS team_name, d.name AS department_name
       FROM okrs o
       JOIN employees e ON e.id = o.owner_id
       LEFT JOIN teams t ON t.id = o.team_id
       LEFT JOIN departments d ON d.id = o.department_id
       WHERE o.id = $1`, [req.params.id]
    );
    if (!okr) return res.status(404).json({ error: 'OKR not found' });

    const { rows: keyResults } = await safeQuery(
      `SELECT kr.*, e.full_name AS owner_name
       FROM key_results kr
       LEFT JOIN employees e ON e.id = kr.owner_id
       WHERE kr.okr_id = $1 ORDER BY kr.order_index`,
      [req.params.id]
    );
    res.json({ okr, keyResults });
  } catch (err) {
    console.error('[okrs:get]', err);
    res.status(500).json({ error: 'Failed to fetch OKR' });
  }
});

// Create OKR with key results
router.post('/', validateBody(createOkrSchema), async (req, res) => {
  try {
    const { title, description, owner_id, team_id, department_id, period_start, period_end, period_type, key_results } = req.body;

    // Validate owner_id matches current user or user is admin
    if (owner_id !== req.staff.employee_id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Can only create OKRs for yourself' });
    }

    const result = await withTransaction(async (client) => {
      const { rows: [okr] } = await client.query(
        `INSERT INTO okrs (title, description, owner_id, team_id, department_id, period_start, period_end, period_type, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [title, description || null, owner_id, team_id || null, department_id || null, period_start, period_end, period_type, req.staff.id]
      );

      for (let i = 0; i < key_results.length; i++) {
        const kr = key_results[i];
        await client.query(
          `INSERT INTO key_results (okr_id, title, description, metric_type, target_value, current_value, unit, owner_id, order_index)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [okr.id, kr.title, kr.description || null, kr.metric_type || 'percentage', kr.target_value, 0, kr.unit || null, kr.owner_id || null, i]
        );
      }
      return okr;
    });

    const { rows: krs } = await safeQuery(`SELECT * FROM key_results WHERE okr_id = $1 ORDER BY order_index`, [result.id]);
    res.status(201).json({ okr: result, keyResults: krs });
  } catch (err) {
    console.error('[okrs:create]', err);
    res.status(500).json({ error: 'Failed to create OKR' });
  }
});

// Update OKR
router.put('/:id', validateBody(updateOkrSchema), async (req, res) => {
  try {
    const { rows: [okr] } = await safeQuery(`SELECT * FROM okrs WHERE id = $1`, [req.params.id]);
    if (!okr) return res.status(404).json({ error: 'OKR not found' });
    if (okr.owner_id !== req.staff.employee_id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can edit' });
    }

    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'key_results') continue; // handled separately
      if (value === '' || value === undefined) continue;
      params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (sets.length) {
      params.push(req.params.id);
      await safeQuery(`UPDATE okrs SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i}`, params);
    }
    res.json({ okr: { ...okr, ...req.body } });
  } catch (err) {
    console.error('[okrs:update]', err);
    res.status(500).json({ error: 'Failed to update OKR' });
  }
});

// Update OKR status and progress
router.post('/:id/status', async (req, res) => {
  try {
    const { status, progress } = req.body;
    const { rows: [okr] } = await safeQuery(`SELECT * FROM okrs WHERE id = $1`, [req.params.id]);
    if (!okr) return res.status(404).json({ error: 'OKR not found' });
    if (okr.owner_id !== req.staff.employee_id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can update status' });
    }

    const sets = []; const params = []; let i = 1;
    if (status) { params.push(status); sets.push(`status = $${i++}`); }
    if (progress !== undefined) { params.push(progress); sets.push(`progress = $${i++}`); }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE okrs SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    res.json({ okr: rows[0] });
  } catch (err) {
    console.error('[okrs:status]', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Key Results
router.put('/:okrId/key-results/:krId', validateBody(updateKeyResultSchema), async (req, res) => {
  try {
    const { rows: [okr] } = await safeQuery(`SELECT * FROM okrs WHERE id = $1`, [req.params.okrId]);
    if (!okr) return res.status(404).json({ error: 'OKR not found' });
    if (okr.owner_id !== req.staff.employee_id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can edit' });
    }

    const { rows: [kr] } = await safeQuery(`SELECT * FROM key_results WHERE id = $1 AND okr_id = $2`, [req.params.krId, req.params.okrId]);
    if (!kr) return res.status(404).json({ error: 'Key result not found' });

    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (value === '' || value === undefined) continue;
      params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    // Auto-calculate progress if current_value provided
    if (req.body.current_value !== undefined && req.body.target_value !== undefined) {
      const progress = Math.min(100, Math.max(0, (req.body.current_value / req.body.target_value) * 100));
      params.push(progress);
      sets.push(`progress = $${i++}`);
    } else if (req.body.current_value !== undefined && kr.target_value) {
      const progress = Math.min(100, Math.max(0, (req.body.current_value / kr.target_value) * 100));
      params.push(progress);
      sets.push(`progress = $${i++}`);
    }

    params.push(req.params.krId);
    const { rows } = await safeQuery(
      `UPDATE key_results SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );

    // Update OKR progress (average of key results)
    const { rows: [avg] } = await safeQuery(`SELECT AVG(progress) AS avg_progress FROM key_results WHERE okr_id = $1`, [req.params.okrId]);
    if (avg.avg_progress !== null) {
      await safeQuery(`UPDATE okrs SET progress = $1, updated_at = NOW() WHERE id = $2`, [Math.round(avg.avg_progress * 100) / 100, req.params.okrId]);
    }

    res.json({ keyResult: rows[0] });
  } catch (err) {
    console.error('[okrs:kr:update]', err);
    res.status(500).json({ error: 'Failed to update key result' });
  }
});

// Bulk update key result progress
router.post('/:okrId/key-results/bulk-progress', async (req, res) => {
  try {
    const { updates } = req.body; // [{id, current_value, status}]
    if (!updates || !updates.length) return res.status(400).json({ error: 'updates array required' });

    const { rows: [okr] } = await safeQuery(`SELECT * FROM okrs WHERE id = $1`, [req.params.okrId]);
    if (!okr) return res.status(404).json({ error: 'OKR not found' });
    if (okr.owner_id !== req.staff.employee_id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can update' });
    }

    await withTransaction(async (client) => {
      for (const u of updates) {
        if (!u.id) continue;
        const { rows: [kr] } = await client.query(`SELECT * FROM key_results WHERE id = $1 AND okr_id = $2`, [u.id, req.params.okrId]);
        if (!kr) continue;

        const currentValue = u.current_value !== undefined ? u.current_value : kr.current_value;
        const targetValue = kr.target_value;
        const progress = targetValue ? Math.min(100, Math.max(0, (currentValue / targetValue) * 100)) : kr.progress;
        const status = u.status || (progress >= 100 ? 'achieved' : progress > 0 ? 'in_progress' : 'not_started');

        await client.query(
          `UPDATE key_results SET current_value = $1, progress = $2, status = $3, updated_at = NOW() WHERE id = $4`,
          [currentValue, progress, status, u.id]
        );
      }
    });

    // Update OKR progress
    const { rows: [avg] } = await safeQuery(`SELECT AVG(progress) AS avg_progress FROM key_results WHERE okr_id = $1`, [req.params.okrId]);
    if (avg.avg_progress !== null) {
      await safeQuery(`UPDATE okrs SET progress = $1, updated_at = NOW() WHERE id = $2`, [Math.round(avg.avg_progress * 100) / 100, req.params.okrId]);
    }

    res.json({ message: 'Updated', count: updates.length });
  } catch (err) {
    console.error('[okrs:bulk-progress]', err);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Delete OKR
router.delete('/:id', async (req, res) => {
  try {
    const { rows: [okr] } = await safeQuery(`SELECT * FROM okrs WHERE id = $1`, [req.params.id]);
    if (!okr) return res.status(404).json({ error: 'OKR not found' });
    if (okr.owner_id !== req.staff.employee_id && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owner can delete' });
    }
    const { rows } = await safeQuery(`DELETE FROM okrs WHERE id = $1 RETURNING id`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[okrs:delete]', err);
    res.status(500).json({ error: 'Failed to delete OKR' });
  }
});

module.exports = router;