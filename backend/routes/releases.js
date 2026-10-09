'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

const createReleaseSchema = z.object({
  project_id: schemas.uuid,
  version_id: schemas.uuid.optional().nullable(),
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  release_date: schemas.isoDate.optional().nullable(),
  release_type: z.enum(['major', 'minor', 'patch', 'hotfix']).default('major'),
});

const updateReleaseSchema = createReleaseSchema.partial().strict();

// List releases
router.get('/', async (req, res) => {
  try {
    const { project_id, status } = req.query;
    let where = '', params = [];
    if (project_id) { params.push(project_id); where = `WHERE r.project_id = $${params.length}`; }
    else if (!['owner', 'admin'].includes(req.staff.role)) {
      if (!req.staff.employee_id) return res.json({ releases: [] });
      const { rows: [emp] } = await safeQuery(`SELECT department_id FROM employees WHERE id = $1`, [req.staff.employee_id]);
      if (emp?.department_id) { params.push(emp.department_id); where = `WHERE tp.department_id = $${params.length}`; }
      else return res.json({ releases: [] });
    }
    if (status) { params.push(status); where += (where ? ' AND ' : 'WHERE ') + `r.status = $${params.length}`; }

    const { rows } = await safeQuery(
      `SELECT r.*, tp.name AS project_name, tp.key_prefix, tv.name AS version_name,
              sa.email AS released_by_email,
              (SELECT COUNT(*) FROM release_issues WHERE release_id = r.id) AS issue_count
       FROM releases r
       JOIN task_projects tp ON tp.id = r.project_id
       LEFT JOIN task_versions tv ON tv.id = r.version_id
       LEFT JOIN staff_accounts sa ON sa.id = r.released_by
       ${where}
       ORDER BY r.release_date DESC NULLS LAST`,
      params
    );
    res.json({ releases: rows });
  } catch (err) {
    console.error('[releases:list]', err);
    res.status(500).json({ error: 'Failed to fetch releases' });
  }
});

// Get release with issues
router.get('/:id', async (req, res) => {
  try {
    const { rows: [release] } = await safeQuery(
      `SELECT r.*, tp.name AS project_name, tp.key_prefix, tv.name AS version_name, sa.email AS released_by_email
       FROM releases r
       JOIN task_projects tp ON tp.id = r.project_id
       LEFT JOIN task_versions tv ON tv.id = r.version_id
       LEFT JOIN staff_accounts sa ON sa.id = r.released_by
       WHERE r.id = $1`, [req.params.id]
    );
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const { rows: issues } = await safeQuery(
      `SELECT ri.*, t.issue_key, t.title, t.type, t.status, t.priority, t.assignee_id, e.full_name AS assignee_name
       FROM release_issues ri
       JOIN tasks t ON t.id = ri.issue_id
       LEFT JOIN employees e ON e.id = t.assignee_id
       WHERE ri.release_id = $1 ORDER BY ri.added_at`,
      [req.params.id]
    );
    res.json({ release, issues });
  } catch (err) {
    console.error('[releases:get]', err);
    res.status(500).json({ error: 'Failed to fetch release' });
  }
});

// Create release
router.post('/', requireRole('admin', 'hr'), validateBody(createReleaseSchema), async (req, res) => {
  try {
    const { project_id, version_id, name, description, release_date, release_type } = req.body;
    const { rows: [release] } = await safeQuery(
      `INSERT INTO releases (project_id, version_id, name, description, release_date, release_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [project_id, version_id || null, name, description || null, release_date || null, release_type, req.staff.id]
    );
    res.status(201).json({ release });
  } catch (err) {
    console.error('[releases:create]', err);
    res.status(500).json({ error: 'Failed to create release' });
  }
});

// Update release
router.put('/:id', requireRole('admin', 'hr'), validateBody(updateReleaseSchema), async (req, res) => {
  try {
    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (value === '' || value === undefined) continue;
      params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE releases SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Release not found' });
    res.json({ release: rows[0] });
  } catch (err) {
    console.error('[releases:update]', err);
    res.status(500).json({ error: 'Failed to update release' });
  }
});

// Release (mark as released)
router.post('/:id/release', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE releases SET status = 'released', released_by = $1, released_at = NOW() WHERE id = $2 AND status != 'released' RETURNING *`,
      [req.staff.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Release not found or already released' });
    res.json({ release: rows[0] });
  } catch (err) {
    console.error('[releases:release]', err);
    res.status(500).json({ error: 'Failed to release' });
  }
});

// Add issues to release
router.post('/:id/issues', async (req, res) => {
  try {
    const { issue_ids } = req.body;
    if (!issue_ids || !issue_ids.length) return res.status(400).json({ error: 'issue_ids required' });

    const added = [];
    for (const issueId of issue_ids) {
      const { rows } = await safeQuery(
        `INSERT INTO release_issues (release_id, issue_id, added_by) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING RETURNING *`,
        [req.params.id, issueId, req.staff.id]
      );
      if (rows.length) added.push(rows[0]);
    }
    res.json({ added });
  } catch (err) {
    console.error('[releases:add-issues]', err);
    res.status(500).json({ error: 'Failed to add issues' });
  }
});

// Remove issue from release
router.delete('/:id/issues/:issueId', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `DELETE FROM release_issues WHERE release_id = $1 AND issue_id = $2 RETURNING *`,
      [req.params.id, req.params.issueId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Issue not in release' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[releases:remove-issue]', err);
    res.status(500).json({ error: 'Failed to remove issue' });
  }
});

// Delete release
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM releases WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Release not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[releases:delete]', err);
    res.status(500).json({ error: 'Failed to delete release' });
  }
});

module.exports = router;