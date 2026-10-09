'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

// ── Validation schemas ─────────────────────────────────────────────────────────
const createProjectSchema = z.object({
  department_id: schemas.uuid,
  team_id: schemas.uuid.optional().nullable(),
  name: z.string().min(1).max(150),
  key_prefix: z.string().min(2).max(10).toUpperCase(),
  description: z.string().max(2000).optional().nullable(),
  project_lead_id: schemas.uuid.optional().nullable(),
  project_type: z.enum(['software', 'business', 'service_desk']).default('software'),
});

const updateProjectSchema = createProjectSchema.partial().strict();

const createSprintSchema = z.object({
  project_id: schemas.uuid,
  name: z.string().min(1).max(150),
  goal: z.string().max(2000).optional().nullable(),
  start_date: schemas.isoDate.optional().nullable(),
  end_date: schemas.isoDate.optional().nullable(),
});

const updateSprintSchema = createSprintSchema.partial().strict();

const createVersionSchema = z.object({
  project_id: schemas.uuid,
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  start_date: schemas.isoDate.optional().nullable(),
  release_date: schemas.isoDate.optional().nullable(),
});

const updateVersionSchema = createVersionSchema.partial().strict();

const createComponentSchema = z.object({
  project_id: schemas.uuid,
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  lead_id: schemas.uuid.optional().nullable(),
});

const createTaskSchema = z.object({
  project_id: schemas.uuid,
  sprint_id: schemas.uuid.optional().nullable(),
  parent_task_id: schemas.uuid.optional().nullable(),
  title: z.string().min(1).max(300),
  description: z.string().max(10000).optional().nullable(),
  type: z.enum(['task', 'bug', 'story', 'epic', 'subtask']).default('task'),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']).default('medium'),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).default('backlog'),
  assignee_id: schemas.uuid.optional().nullable(),
  reporter_id: schemas.uuid.optional().nullable(),
  story_points: z.number().min(0).max(1000).optional().nullable(),
  due_date: schemas.isoDate.optional().nullable(),
  original_estimate: z.number().min(0).max(10000).optional().nullable(),
  remaining_estimate: z.number().min(0).max(10000).optional().nullable(),
  component_ids: z.array(schemas.uuid).optional(),
  label_ids: z.array(schemas.uuid).optional(),
  fix_version_ids: z.array(schemas.uuid).optional(),
  affects_version_ids: z.array(schemas.uuid).optional(),
});

const updateTaskSchema = createTaskSchema.partial().strict();

const createLabelSchema = z.object({
  project_id: schemas.uuid,
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  content_json: z.any().optional(),
  is_internal: z.boolean().default(false),
});

const addWatcherSchema = z.object({
  employee_id: schemas.uuid,
});

const linkTaskSchema = z.object({
  target_task_id: schemas.uuid,
  link_type: z.enum(['blocks', 'blocked_by', 'relates_to', 'duplicates', 'duplicated_by', 'cloned_from', 'clones']),
});

const logTimeSchema = z.object({
  time_spent: z.number().min(0).max(1000), // hours
  remaining_estimate: z.number().min(0).max(10000).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
  work_date: schemas.isoDate.optional().nullable(),
});

// ── Helpers ────────────────────────────────────────────────────────────────────
async function generateIssueKey(client, projectId) {
  const { rows: [project] } = await client.query(
    `SELECT key_prefix FROM task_projects WHERE id = $1`, [projectId]
  );
  if (!project) throw new Error('Project not found');

  const { rows: [last] } = await client.query(
    `SELECT issue_key FROM tasks WHERE project_id = $1 ORDER BY id DESC LIMIT 1`, [projectId]
  );
  let nextNum = 1;
  if (last?.issue_key) {
    const match = last.issue_key.match(/^([A-Z]+)-(\d+)$/);
    if (match && match[1] === project.key_prefix) {
      nextNum = parseInt(match[2], 10) + 1;
    }
  }
  return `${project.key_prefix}-${nextNum}`;
}

async function logActivity(client, taskId, authorId, field, oldVal, newVal, type, desc) {
  await client.query(
    `INSERT INTO task_activity (task_id, author_id, field_changed, old_value, new_value, change_type, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [taskId, authorId, field, oldVal, newVal, type, desc]
  );
}

async function addWatchers(client, taskId, employeeIds, addedBy) {
  for (const empId of employeeIds) {
    await client.query(
      `INSERT INTO task_watchers (task_id, employee_id, added_by) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [taskId, empId, addedBy]
    );
  }
}

// ── Projects ───────────────────────────────────────────────────────────────────
router.get('/projects', async (req, res) => {
  try {
    const { department_id, team_id } = req.query;
    let where = '', params = [];
    const conditions = [];
    
    if (department_id) { params.push(department_id); conditions.push(`tp.department_id = $${params.length}`); }
    if (team_id) { params.push(team_id); conditions.push(`tp.team_id = $${params.length}`); }
    if (!['owner', 'admin'].includes(req.staff.role)) {
      if (!req.staff.employee_id) return res.json({ projects: [] });
      const { rows: [emp] } = await safeQuery(`SELECT department_id, team_id FROM employees WHERE id = $1`, [req.staff.employee_id]);
      if (emp?.department_id && !department_id) { params.push(emp.department_id); conditions.push(`tp.department_id = $${params.length}`); }
      if (emp?.team_id && !team_id) { params.push(emp.team_id); conditions.push(`tp.team_id = $${params.length}`); }
      if (!emp?.department_id && !emp?.team_id) return res.json({ projects: [] });
    }
    where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT tp.*, d.name AS department_name, t.name AS team_name, e.full_name AS lead_name,
              (SELECT COUNT(*) FROM tasks WHERE project_id = tp.id) AS task_count,
              (SELECT COUNT(*) FROM task_project_members WHERE project_id = tp.id) AS member_count
       FROM task_projects tp
       LEFT JOIN departments d ON d.id = tp.department_id
       LEFT JOIN teams t ON t.id = tp.team_id
       LEFT JOIN employees e ON e.id = tp.project_lead_id
       ${where}
       ORDER BY tp.created_at DESC`,
      params
    );
    res.json({ projects: rows });
  } catch (err) {
    console.error('[tasks:projects:list]', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.get('/projects/:id', async (req, res) => {
  try {
    const { rows: [project] } = await safeQuery(
      `SELECT tp.*, d.name AS department_name, t.name AS team_name, e.full_name AS lead_name
       FROM task_projects tp
       LEFT JOIN departments d ON d.id = tp.department_id
       LEFT JOIN teams t ON t.id = tp.team_id
       LEFT JOIN employees e ON e.id = tp.project_lead_id
       WHERE tp.id = $1`, [req.params.id]
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [sprints, versions, components, labels, members] = await Promise.all([
      safeQuery(`SELECT * FROM task_sprints WHERE project_id = $1 ORDER BY start_date DESC NULLS LAST`, [req.params.id]),
      safeQuery(`SELECT * FROM task_versions WHERE project_id = $1 ORDER BY release_date DESC NULLS LAST`, [req.params.id]),
      safeQuery(`SELECT tc.*, e.full_name AS lead_name FROM task_components tc LEFT JOIN employees e ON e.id = tc.lead_id WHERE tc.project_id = $1`, [req.params.id]),
      safeQuery(`SELECT * FROM task_labels WHERE project_id = $1`, [req.params.id]),
      safeQuery(`SELECT tpm.*, e.full_name, e.work_email, e.employee_code FROM task_project_members tpm JOIN employees e ON e.id = tpm.employee_id WHERE tpm.project_id = $1`, [req.params.id]),
    ]);

    res.json({ 
      project, 
      sprints: sprints.rows, 
      versions: versions.rows, 
      components: components.rows, 
      labels: labels.rows, 
      members: members.rows 
    });
  } catch (err) {
    console.error('[tasks:projects:get]', err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.post('/projects', requireRole('admin', 'hr'), validateBody(createProjectSchema), async (req, res) => {
  try {
    const { department_id, team_id, name, key_prefix, description, project_lead_id, project_type } = req.body;
    const { rows: [project] } = await safeQuery(
      `INSERT INTO task_projects (department_id, team_id, name, key_prefix, description, project_lead_id, project_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [department_id, team_id || null, name, key_prefix.toUpperCase(), description || null, project_lead_id || null, project_type, req.staff.id]
    );
    if (project_lead_id) {
      await safeQuery(
        `INSERT INTO task_project_members (project_id, employee_id, role, added_by) VALUES ($1,$2,'lead',$3)`,
        [project.id, project_lead_id, req.staff.id]
      );
    }
    await safeQuery(
      `INSERT INTO task_project_members (project_id, employee_id, role, added_by) VALUES ($1,$2,'admin',$3)`,
      [project.id, req.staff.employee_id, req.staff.id]
    );
    res.status(201).json({ project });
  } catch (err) {
    console.error('[tasks:projects:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Project with this key prefix already exists in this department' });
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/projects/:id', requireRole('admin', 'hr'), validateBody(updateProjectSchema), async (req, res) => {
  try {
    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (value === '') continue;
      params.push(key === 'key_prefix' ? value.toUpperCase() : value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE task_projects SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json({ project: rows[0] });
  } catch (err) {
    console.error('[tasks:projects:update]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Project with this key prefix already exists in this department' });
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/projects/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM task_projects WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[tasks:projects:delete]', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ── Project Members ────────────────────────────────────────────────────────────
router.get('/projects/:id/members', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT tpm.*, e.full_name, e.work_email, e.employee_code, e.department_id, d.name AS department_name, t.name AS team_name
       FROM task_project_members tpm
       JOIN employees e ON e.id = tpm.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN teams t ON t.id = e.team_id
       WHERE tpm.project_id = $1`, [req.params.id]
    );
    res.json({ members: rows });
  } catch (err) {
    console.error('[tasks:project:members:list]', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

router.post('/projects/:id/members', async (req, res) => {
  try {
    const { employee_id, role } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id required' });
    
    const { rows: [myMember] } = await safeQuery(
      `SELECT role FROM task_project_members WHERE project_id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    const isAdmin = ['owner', 'admin'].includes(req.staff.role);
    if (!myMember && !isAdmin) return res.status(403).json({ error: 'Not a member of this project' });
    if (myMember && !['lead', 'admin'].includes(myMember.role) && !isAdmin) {
      return res.status(403).json({ error: 'Only project leads and admins can add members' });
    }

    const { rows: [member] } = await safeQuery(
      `INSERT INTO task_project_members (project_id, employee_id, role, added_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (project_id, employee_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [req.params.id, employee_id, role || 'member', req.staff.id]
    );
    res.status(201).json({ member });
  } catch (err) {
    console.error('[tasks:project:member:add]', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.delete('/projects/:id/members/:employeeId', async (req, res) => {
  try {
    const { rows: [myMember] } = await safeQuery(
      `SELECT role FROM task_project_members WHERE project_id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    const isAdmin = ['owner', 'admin'].includes(req.staff.role);
    if (!myMember && !isAdmin) return res.status(403).json({ error: 'Not a member of this project' });
    if (myMember && myMember.role !== 'lead' && myMember.role !== 'admin' && !isAdmin) {
      return res.status(403).json({ error: 'Only project leads and admins can remove members' });
    }
    // Can't remove the last lead
    const { rows: [leadCount] } = await safeQuery(
      `SELECT COUNT(*) FROM task_project_members WHERE project_id = $1 AND role = 'lead'`, [req.params.id]
    );
    if (Number(leadCount.count) <= 1) {
      const { rows: [target] } = await safeQuery(
        `SELECT role FROM task_project_members WHERE project_id = $1 AND employee_id = $2`, [req.params.id, req.params.employeeId]
      );
      if (target?.role === 'lead') return res.status(400).json({ error: 'Cannot remove the last project lead' });
    }

    const { rows } = await safeQuery(
      `DELETE FROM task_project_members WHERE project_id = $1 AND employee_id = $2 RETURNING id`,
      [req.params.id, req.params.employeeId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[tasks:project:member:remove]', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ── Versions ────────────────────────────────────────────────────────────────────
router.get('/projects/:projectId/versions', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM task_versions WHERE project_id = $1 ORDER BY release_date DESC NULLS LAST`,
      [req.params.projectId]
    );
    res.json({ versions: rows });
  } catch (err) {
    console.error('[tasks:versions:list]', err);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

router.post('/projects/:projectId/versions', validateBody(createVersionSchema), async (req, res) => {
  try {
    const { name, description, start_date, release_date } = req.body;
    const { rows: [version] } = await safeQuery(
      `INSERT INTO task_versions (project_id, name, description, start_date, release_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.projectId, name, description || null, start_date || null, release_date || null]
    );
    res.status(201).json({ version });
  } catch (err) {
    console.error('[tasks:versions:create]', err);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

router.put('/versions/:id', validateBody(updateVersionSchema), async (req, res) => {
  try {
    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (value === '') continue;
      params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE task_versions SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Version not found' });
    res.json({ version: rows[0] });
  } catch (err) {
    console.error('[tasks:versions:update]', err);
    res.status(500).json({ error: 'Failed to update version' });
  }
});

router.post('/versions/:id/release', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE task_versions SET status = 'released', released_at = NOW() WHERE id = $1 AND status != 'released' RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Version not found or already released' });
    res.json({ version: rows[0] });
  } catch (err) {
    console.error('[tasks:versions:release]', err);
    res.status(500).json({ error: 'Failed to release version' });
  }
});

router.delete('/versions/:id', async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM task_versions WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Version not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[tasks:versions:delete]', err);
    res.status(500).json({ error: 'Failed to delete version' });
  }
});

// ── Components ──────────────────────────────────────────────────────────────────
router.get('/projects/:projectId/components', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT tc.*, e.full_name AS lead_name FROM task_components tc
       LEFT JOIN employees e ON e.id = tc.lead_id
       WHERE tc.project_id = $1`, [req.params.projectId]
    );
    res.json({ components: rows });
  } catch (err) {
    console.error('[tasks:components:list]', err);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
});

router.post('/projects/:projectId/components', validateBody(createComponentSchema), async (req, res) => {
  try {
    const { name, description, lead_id } = req.body;
    const { rows: [component] } = await safeQuery(
      `INSERT INTO task_components (project_id, name, description, lead_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.projectId, name, description || null, lead_id || null]
    );
    res.status(201).json({ component });
  } catch (err) {
    console.error('[tasks:components:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Component with this name already exists in this project' });
    res.status(500).json({ error: 'Failed to create component' });
  }
});

router.delete('/components/:id', async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM task_components WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Component not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[tasks:components:delete]', err);
    res.status(500).json({ error: 'Failed to delete component' });
  }
});

// ── Labels ──────────────────────────────────────────────────────────────────────
router.get('/projects/:projectId/labels', async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM task_labels WHERE project_id = $1`, [req.params.projectId]);
    res.json({ labels: rows });
  } catch (err) {
    console.error('[tasks:labels:list]', err);
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

router.post('/projects/:projectId/labels', validateBody(createLabelSchema), async (req, res) => {
  try {
    const { name, color } = req.body;
    const { rows: [label] } = await safeQuery(
      `INSERT INTO task_labels (project_id, name, color) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.projectId, name, color]
    );
    res.status(201).json({ label });
  } catch (err) {
    console.error('[tasks:labels:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Label with this name already exists in this project' });
    res.status(500).json({ error: 'Failed to create label' });
  }
});

router.delete('/labels/:id', async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM task_labels WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Label not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[tasks:labels:delete]', err);
    res.status(500).json({ error: 'Failed to delete label' });
  }
});

// ── Sprints ────────────────────────────────────────────────────────────────────
router.get('/sprints', async (req, res) => {
  try {
    const { project_id, status } = req.query;
    const conditions = []; const params = [];
    if (project_id) { params.push(project_id); conditions.push(`project_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(
      `SELECT ts.*, tp.name AS project_name, tp.key_prefix
       FROM task_sprints ts
       JOIN task_projects tp ON tp.id = ts.project_id
       ${where}
       ORDER BY ts.start_date DESC NULLS LAST`,
      params
    );
    res.json({ sprints: rows });
  } catch (err) {
    console.error('[tasks:sprints:list]', err);
    res.status(500).json({ error: 'Failed to fetch sprints' });
  }
});

router.post('/sprints', validateBody(createSprintSchema), async (req, res) => {
  try {
    const { project_id, name, goal, start_date, end_date } = req.body;
    const { rows: [sprint] } = await safeQuery(
      `INSERT INTO task_sprints (project_id, name, goal, start_date, end_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [project_id, name, goal || null, start_date || null, end_date || null, req.staff.id]
    );
    res.status(201).json({ sprint });
  } catch (err) {
    console.error('[tasks:sprints:create]', err);
    res.status(500).json({ error: 'Failed to create sprint' });
  }
});

router.put('/sprints/:id', validateBody(updateSprintSchema), async (req, res) => {
  try {
    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (value === '') continue;
      params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE task_sprints SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Sprint not found' });
    res.json({ sprint: rows[0] });
  } catch (err) {
    console.error('[tasks:sprints:update]', err);
    res.status(500).json({ error: 'Failed to update sprint' });
  }
});

router.post('/sprints/:id/start', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE task_sprints SET status = 'active', started_at = NOW() WHERE id = $1 AND status = 'planning' RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Sprint not found or already started' });
    res.json({ sprint: rows[0] });
  } catch (err) {
    console.error('[tasks:sprints:start]', err);
    res.status(500).json({ error: 'Failed to start sprint' });
  }
});

router.post('/sprints/:id/complete', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE task_sprints SET status = 'completed', completed_at = NOW() WHERE id = $1 AND status = 'active' RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Sprint not found or not active' });
    
    // Move incomplete tasks back to backlog
    await safeQuery(
      `UPDATE tasks SET sprint_id = NULL, status = 'backlog', updated_at = NOW()
       WHERE sprint_id = $1 AND status NOT IN ('done', 'cancelled')`,
      [req.params.id]
    );
    res.json({ sprint: rows[0] });
  } catch (err) {
    console.error('[tasks:sprints:complete]', err);
    res.status(500).json({ error: 'Failed to complete sprint' });
  }
});

router.delete('/sprints/:id', async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM task_sprints WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Sprint not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[tasks:sprints:delete]', err);
    res.status(500).json({ error: 'Failed to delete sprint' });
  }
});

// ── Tasks ──────────────────────────────────────────────────────────────────────
router.get('/tasks', async (req, res) => {
  try {
    const { project_id, sprint_id, assignee_id, status, type, my_tasks, team_id, department_id, label_id, component_id } = req.query;
    const conditions = []; const params = [];

    if (project_id) { params.push(project_id); conditions.push(`t.project_id = $${params.length}`); }
    if (sprint_id) { params.push(sprint_id); conditions.push(`t.sprint_id = $${params.length}`); }
    if (assignee_id) { params.push(assignee_id); conditions.push(`t.assignee_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`t.status = $${params.length}`); }
    if (type) { params.push(type); conditions.push(`t.type = $${params.length}`); }
    if (label_id) { params.push(label_id); conditions.push(`t.id IN (SELECT task_id FROM task_task_labels WHERE label_id = $${params.length})`); }
    if (component_id) { params.push(component_id); conditions.push(`t.id IN (SELECT task_id FROM task_task_components WHERE component_id = $${params.length})`); }
    
    if (my_tasks === 'true') {
      if (!req.staff.employee_id) return res.json({ tasks: [] });
      params.push(req.staff.employee_id);
      conditions.push(`t.assignee_id = $${params.length}`);
    } else if (!['owner', 'admin'].includes(req.staff.role)) {
      if (!req.staff.employee_id) return res.json({ tasks: [] });
      const { rows: [emp] } = await safeQuery(`SELECT department_id, team_id FROM employees WHERE id = $1`, [req.staff.employee_id]);
      if (emp?.department_id) { params.push(emp.department_id); conditions.push(`tp.department_id = $${params.length}`); }
      if (emp?.team_id) { params.push(emp.team_id); conditions.push(`tp.team_id = $${params.length}`); }
      if (!emp?.department_id && !emp?.team_id) return res.json({ tasks: [] });
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT t.*, tp.key_prefix, tp.name AS project_name, tp.department_id, tp.team_id,
              e1.full_name AS assignee_name, e1.work_email AS assignee_email, e1.department_id AS assignee_dept, e1.team_id AS assignee_team,
              e2.full_name AS reporter_name, e2.work_email AS reporter_email,
              ts.name AS sprint_name, ts.status AS sprint_status
       FROM tasks t
       JOIN task_projects tp ON tp.id = t.project_id
       LEFT JOIN employees e1 ON e1.id = t.assignee_id
       LEFT JOIN employees e2 ON e2.id = t.reporter_id
       LEFT JOIN task_sprints ts ON ts.id = t.sprint_id
       ${where}
       ORDER BY 
         CASE t.priority WHEN 'highest' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 WHEN 'lowest' THEN 5 END,
         t.updated_at DESC
       LIMIT 500`,
      params
    );

    // Fetch labels, components, versions, watchers for each task
    const taskIds = rows.map(r => r.id);
    let labelsMap = {}, componentsMap = {}, fixVersionsMap = {}, affectsVersionsMap = {}, watchersMap = {}, votesMap = {};
    
    if (taskIds.length > 0) {
      const [labels, components, fixVersions, affectsVersions, watchers, votes] = await Promise.all([
        safeQuery(`SELECT ttl.task_id, tl.* FROM task_task_labels ttl JOIN task_labels tl ON tl.id = ttl.label_id WHERE ttl.task_id = ANY($1)`, [taskIds]),
        safeQuery(`SELECT ttc.task_id, tc.* FROM task_task_components ttc JOIN task_components tc ON tc.id = ttc.component_id WHERE ttc.task_id = ANY($1)`, [taskIds]),
        safeQuery(`SELECT tfv.task_id, tv.* FROM task_fix_versions tfv JOIN task_versions tv ON tv.id = tfv.version_id WHERE tfv.task_id = ANY($1)`, [taskIds]),
        safeQuery(`SELECT tav.task_id, tv.* FROM task_affects_versions tav JOIN task_versions tv ON tv.id = tav.version_id WHERE tav.task_id = ANY($1)`, [taskIds]),
        safeQuery(`SELECT tw.task_id, e.full_name, e.work_email FROM task_watchers tw JOIN employees e ON e.id = tw.employee_id WHERE tw.task_id = ANY($1)`, [taskIds]),
        safeQuery(`SELECT tv.task_id, COUNT(*) AS vote_count FROM task_votes tv WHERE tv.task_id = ANY($1) GROUP BY tv.task_id`, [taskIds]),
      ]);

      for (const r of labels.rows) { (labelsMap[r.task_id] = labelsMap[r.task_id] || []).push(r); }
      for (const r of components.rows) { (componentsMap[r.task_id] = componentsMap[r.task_id] || []).push(r); }
      for (const r of fixVersions.rows) { (fixVersionsMap[r.task_id] = fixVersionsMap[r.task_id] || []).push(r); }
      for (const r of affectsVersions.rows) { (affectsVersionsMap[r.task_id] = affectsVersionsMap[r.task_id] || []).push(r); }
      for (const r of watchers.rows) { (watchersMap[r.task_id] = watchersMap[r.task_id] || []).push(r); }
      for (const r of votes.rows) { votesMap[r.task_id] = Number(r.vote_count); }
    }

    const enrichedTasks = rows.map(t => ({
      ...t,
      labels: labelsMap[t.id] || [],
      components: componentsMap[t.id] || [],
      fix_versions: fixVersionsMap[t.id] || [],
      affects_versions: affectsVersionsMap[t.id] || [],
      watchers: watchersMap[t.id] || [],
      votes: votesMap[t.id] || 0,
    }));

    res.json({ tasks: enrichedTasks });
  } catch (err) {
    console.error('[tasks:tasks:list]', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/tasks/:id', async (req, res) => {
  try {
    const { rows: [task] } = await safeQuery(
      `SELECT t.*, tp.key_prefix, tp.name AS project_name, tp.department_id, tp.team_id,
              e1.full_name AS assignee_name, e1.work_email AS assignee_email,
              e2.full_name AS reporter_name, e2.work_email AS reporter_email,
              ts.name AS sprint_name, ts.status AS sprint_status
       FROM tasks t
       JOIN task_projects tp ON tp.id = t.project_id
       LEFT JOIN employees e1 ON e1.id = t.assignee_id
       LEFT JOIN employees e2 ON e2.id = t.reporter_id
       LEFT JOIN task_sprints ts ON ts.id = t.sprint_id
       WHERE t.id = $1`, [req.params.id]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const [comments, subtasks, labels, components, fixVersions, affectsVersions, watchers, votes, links, activity, attachments] = await Promise.all([
      safeQuery(`SELECT tc.*, sa.email AS author_email, e.full_name AS author_name FROM task_comments tc JOIN staff_accounts sa ON sa.id = tc.author_id LEFT JOIN employees e ON e.id = sa.employee_id WHERE tc.task_id = $1 ORDER BY tc.created_at ASC`, [req.params.id]),
      safeQuery(`SELECT id, issue_key, title, status, type, priority, assignee_id FROM tasks WHERE parent_task_id = $1 ORDER BY created_at`, [req.params.id]),
      safeQuery(`SELECT tl.* FROM task_task_labels ttl JOIN task_labels tl ON tl.id = ttl.label_id WHERE ttl.task_id = $1`, [req.params.id]),
      safeQuery(`SELECT tc.* FROM task_task_components ttc JOIN task_components tc ON tc.id = ttc.component_id WHERE ttc.task_id = $1`, [req.params.id]),
      safeQuery(`SELECT tv.* FROM task_fix_versions tfv JOIN task_versions tv ON tv.id = tfv.version_id WHERE tfv.task_id = $1`, [req.params.id]),
      safeQuery(`SELECT tv.* FROM task_affects_versions tav JOIN task_versions tv ON tv.id = tav.version_id WHERE tav.task_id = $1`, [req.params.id]),
      safeQuery(`SELECT tw.*, e.full_name, e.work_email FROM task_watchers tw JOIN employees e ON e.id = tw.employee_id WHERE tw.task_id = $1`, [req.params.id]),
      safeQuery(`SELECT COUNT(*) AS vote_count FROM task_votes WHERE task_id = $1`, [req.params.id]),
      safeQuery(`SELECT tl.*, t2.issue_key AS target_key, t2.title AS target_title, t2.status AS target_status FROM task_links tl JOIN tasks t2 ON t2.id = tl.target_task_id WHERE tl.source_task_id = $1`, [req.params.id]),
      safeQuery(`SELECT ta.*, sa.email AS author_email, e.full_name AS author_name FROM task_activity ta LEFT JOIN staff_accounts sa ON sa.id = ta.author_id LEFT JOIN employees e ON e.id = sa.employee_id WHERE ta.task_id = $1 ORDER BY ta.created_at DESC LIMIT 50`, [req.params.id]),
      safeQuery(`SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at DESC`, [req.params.id]),
    ]);

    res.json({ 
      task, 
      comments: comments.rows, 
      subtasks: subtasks.rows, 
      labels: labels.rows, 
      components: components.rows, 
      fix_versions: fixVersions.rows, 
      affects_versions: affectsVersions.rows, 
      watchers: watchers.rows, 
      votes: Number(votes.rows[0]?.vote_count || 0), 
      links: links.rows, 
      activity: activity.rows, 
      attachments: attachments.rows 
    });
  } catch (err) {
    console.error('[tasks:tasks:get]', err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

router.post('/tasks', validateBody(createTaskSchema), async (req, res) => {
  try {
    const result = await withTransaction(async (client) => {
      const issueKey = await generateIssueKey(client, req.body.project_id);
      const { rows: [task] } = await client.query(
        `INSERT INTO tasks (project_id, sprint_id, parent_task_id, issue_key, title, description,
            type, priority, status, assignee_id, reporter_id, story_points, due_date, 
            original_estimate, remaining_estimate, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [
          req.body.project_id, req.body.sprint_id || null, req.body.parent_task_id || null,
          issueKey, req.body.title, req.body.description || null,
          req.body.type, req.body.priority, req.body.status,
          req.body.assignee_id || null, req.body.reporter_id || req.staff.employee_id || null,
          req.body.story_points || null, req.body.due_date || null,
          req.body.original_estimate || null, req.body.remaining_estimate || null, req.staff.id
        ]
      );
      
      if (req.body.component_ids?.length) {
        for (const compId of req.body.component_ids) {
          await client.query(`INSERT INTO task_task_components (task_id, component_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [task.id, compId]);
        }
      }
      if (req.body.label_ids?.length) {
        for (const labelId of req.body.label_ids) {
          await client.query(`INSERT INTO task_task_labels (task_id, label_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [task.id, labelId]);
        }
      }
      if (req.body.fix_version_ids?.length) {
        for (const verId of req.body.fix_version_ids) {
          await client.query(`INSERT INTO task_fix_versions (task_id, version_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [task.id, verId]);
        }
      }
      if (req.body.affects_version_ids?.length) {
        for (const verId of req.body.affects_version_ids) {
          await client.query(`INSERT INTO task_affects_versions (task_id, version_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [task.id, verId]);
        }
      }

      await logActivity(client, task.id, req.staff.id, 'created', null, null, 'create', `Created task ${issueKey}`);
      return task;
    });
    res.status(201).json({ task: result });
  } catch (err) {
    console.error('[tasks:tasks:create]', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/tasks/:id', validateBody(updateTaskSchema), async (req, res) => {
  try {
    const { rows: [oldTask] } = await safeQuery(`SELECT * FROM tasks WHERE id = $1`, [req.params.id]);
    if (!oldTask) return res.status(404).json({ error: 'Task not found' });

    const sets = []; const params = []; let i = 1;
    for (const [key, value] of Object.entries(req.body)) {
      if (value === '' || key === 'component_ids' || key === 'label_ids' || key === 'fix_version_ids' || key === 'affects_version_ids') continue;
      params.push(value);
      sets.push(`${key} = $${i++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    // Auto-set completed_at when status changes to 'done'
    if (req.body.status === 'done' && oldTask.status !== 'done') {
      params.push(new Date().toISOString());
      sets.push(`completed_at = $${i++}`, `resolved_at = $${i++}`);
      if (!oldTask.resolution) { params.push('fixed'); sets.push(`resolution = $${i++}`); }
    }

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE tasks SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });

    // Log field changes
    await withTransaction(async (client) => {
      for (const [key, value] of Object.entries(req.body)) {
        if (value === '' || key === 'component_ids' || key === 'label_ids' || key === 'fix_version_ids' || key === 'affects_version_ids') continue;
        const oldVal = oldTask[key];
        if (oldVal !== value && oldVal !== undefined) {
          await logActivity(client, req.params.id, req.staff.id, key, String(oldVal), String(value), 'field_change', `Changed ${key} from "${oldVal}" to "${value}"`);
        }
      }
      
      // Handle many-to-many updates
      if (req.body.component_ids !== undefined) {
        await client.query(`DELETE FROM task_task_components WHERE task_id = $1`, [req.params.id]);
        for (const compId of req.body.component_ids) {
          await client.query(`INSERT INTO task_task_components (task_id, component_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, compId]);
        }
      }
      if (req.body.label_ids !== undefined) {
        await client.query(`DELETE FROM task_task_labels WHERE task_id = $1`, [req.params.id]);
        for (const labelId of req.body.label_ids) {
          await client.query(`INSERT INTO task_task_labels (task_id, label_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, labelId]);
        }
      }
      if (req.body.fix_version_ids !== undefined) {
        await client.query(`DELETE FROM task_fix_versions WHERE task_id = $1`, [req.params.id]);
        for (const verId of req.body.fix_version_ids) {
          await client.query(`INSERT INTO task_fix_versions (task_id, version_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, verId]);
        }
      }
      if (req.body.affects_version_ids !== undefined) {
        await client.query(`DELETE FROM task_affects_versions WHERE task_id = $1`, [req.params.id]);
        for (const verId of req.body.affects_version_ids) {
          await client.query(`INSERT INTO task_affects_versions (task_id, version_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, verId]);
        }
      }
    });

    res.json({ task: rows[0] });
  } catch (err) {
    console.error('[tasks:tasks:update]', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM tasks WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[tasks:tasks:delete]', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ── Task Comments ──────────────────────────────────────────────────────────────
router.post('/tasks/:id/comments', validateBody(createCommentSchema), async (req, res) => {
  try {
    const { rows: [comment] } = await safeQuery(
      `INSERT INTO task_comments (task_id, author_id, content, content_json, is_internal)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, req.staff.id, req.body.content, req.body.content_json || null, req.body.is_internal || false]
    );
    const { rows: [commentWithAuthor] } = await safeQuery(
      `SELECT tc.*, sa.email AS author_email, e.full_name AS author_name
       FROM task_comments tc
       JOIN staff_accounts sa ON sa.id = tc.author_id
       LEFT JOIN employees e ON e.id = sa.employee_id
       WHERE tc.id = $1`, [comment.id]
    );
    await logActivity(req, req.params.id, req.staff.id, 'comment', null, req.body.content, 'comment', 'Added a comment');
    res.status(201).json({ comment: commentWithAuthor });
  } catch (err) {
    console.error('[tasks:comments:create]', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.put('/tasks/:taskId/comments/:commentId', async (req, res) => {
  try {
    const { content, content_json } = req.body;
    const { rows } = await safeQuery(
      `UPDATE task_comments SET content = $1, content_json = $2, updated_at = NOW() WHERE id = $3 AND task_id = $4 AND author_id = $5 RETURNING *`,
      [content, content_json || null, req.params.commentId, req.params.taskId, req.staff.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Comment not found or not authorized' });
    res.json({ comment: rows[0] });
  } catch (err) {
    console.error('[tasks:comments:update]', err);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

router.delete('/tasks/:taskId/comments/:commentId', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `DELETE FROM task_comments WHERE id = $1 AND task_id = $2 AND author_id = $3 RETURNING id`,
      [req.params.commentId, req.params.taskId, req.staff.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Comment not found or not authorized' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[tasks:comments:delete]', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ── Watchers ────────────────────────────────────────────────────────────────────
router.get('/tasks/:id/watchers', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT tw.*, e.full_name, e.work_email, e.employee_code FROM task_watchers tw JOIN employees e ON e.id = tw.employee_id WHERE tw.task_id = $1`,
      [req.params.id]
    );
    res.json({ watchers: rows });
  } catch (err) {
    console.error('[tasks:watchers:list]', err);
    res.status(500).json({ error: 'Failed to fetch watchers' });
  }
});

router.post('/tasks/:id/watchers', validateBody(addWatcherSchema), async (req, res) => {
  try {
    const { rows: [watcher] } = await safeQuery(
      `INSERT INTO task_watchers (task_id, employee_id, added_by) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING RETURNING *`,
      [req.params.id, req.body.employee_id, req.staff.id]
    );
    if (!watcher) return res.status(409).json({ error: 'Already watching' });
    res.status(201).json({ watcher });
  } catch (err) {
    console.error('[tasks:watchers:add]', err);
    res.status(500).json({ error: 'Failed to add watcher' });
  }
});

router.delete('/tasks/:id/watchers/:employeeId', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `DELETE FROM task_watchers WHERE task_id = $1 AND employee_id = $2 RETURNING id`,
      [req.params.id, req.params.employeeId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Watcher not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[tasks:watchers:remove]', err);
    res.status(500).json({ error: 'Failed to remove watcher' });
  }
});

// ── Votes ───────────────────────────────────────────────────────────────────────
router.post('/tasks/:id/vote', async (req, res) => {
  try {
    const { rows: [vote] } = await safeQuery(
      `INSERT INTO task_votes (task_id, employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *`,
      [req.params.id, req.staff.employee_id]
    );
    const { rows: [count] } = await safeQuery(`SELECT COUNT(*) AS vote_count FROM task_votes WHERE task_id = $1`, [req.params.id]);
    res.json({ voted: !!vote, vote_count: Number(count.vote_count) });
  } catch (err) {
    console.error('[tasks:vote:add]', err);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

router.delete('/tasks/:id/vote', async (req, res) => {
  try {
    await safeQuery(`DELETE FROM task_votes WHERE task_id = $1 AND employee_id = $2`, [req.params.id, req.staff.employee_id]);
    const { rows: [count] } = await safeQuery(`SELECT COUNT(*) AS vote_count FROM task_votes WHERE task_id = $1`, [req.params.id]);
    res.json({ voted: false, vote_count: Number(count.vote_count) });
  } catch (err) {
    console.error('[tasks:vote:remove]', err);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

// ── Task Links ──────────────────────────────────────────────────────────────────
router.get('/tasks/:id/links', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT tl.*, t2.issue_key AS target_key, t2.title AS target_title, t2.status AS target_status, t2.type AS target_type
       FROM task_links tl
       JOIN tasks t2 ON t2.id = tl.target_task_id
       WHERE tl.source_task_id = $1`, [req.params.id]
    );
    res.json({ links: rows });
  } catch (err) {
    console.error('[tasks:links:list]', err);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

router.post('/tasks/:id/links', validateBody(linkTaskSchema), async (req, res) => {
  try {
    if (req.params.id === req.body.target_task_id) return res.status(400).json({ error: 'Cannot link task to itself' });
    const { rows: [link] } = await safeQuery(
      `INSERT INTO task_links (source_task_id, target_task_id, link_type, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, req.body.target_task_id, req.body.link_type, req.staff.id]
    );
    await logActivity(req, req.params.id, req.staff.id, 'link', null, req.body.link_type, 'link', `Linked to ${req.body.target_task_id} (${req.body.link_type})`);
    res.status(201).json({ link });
  } catch (err) {
    console.error('[tasks:links:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Link already exists' });
    res.status(500).json({ error: 'Failed to create link' });
  }
});

router.delete('/tasks/:id/links/:linkId', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `DELETE FROM task_links WHERE id = $1 AND source_task_id = $2 RETURNING id`,
      [req.params.linkId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Link not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[tasks:links:delete]', err);
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

// ── Activity/History ───────────────────────────────────────────────────────────
router.get('/tasks/:id/activity', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT ta.*, sa.email AS author_email, e.full_name AS author_name
       FROM task_activity ta
       LEFT JOIN staff_accounts sa ON sa.id = ta.author_id
       LEFT JOIN employees e ON e.id = sa.employee_id
       WHERE ta.task_id = $1 ORDER BY ta.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json({ activity: rows });
  } catch (err) {
    console.error('[tasks:activity:list]', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ── Time Tracking ──────────────────────────────────────────────────────────────
router.post('/tasks/:id/worklog', validateBody(logTimeSchema), async (req, res) => {
  try {
    const { time_spent, remaining_estimate, comment, work_date } = req.body;
    const { rows: [task] } = await safeQuery(
      `UPDATE tasks SET time_spent = time_spent + $1, 
       remaining_estimate = COALESCE($2, remaining_estimate), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [time_spent, remaining_estimate, req.params.id]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await safeQuery(
      `INSERT INTO task_activity (task_id, author_id, field_changed, old_value, new_value, change_type, description)
       VALUES ($1,$2,'worklog', $3, $4, 'worklog', $5)`,
      [req.params.id, req.staff.id, String(task.time_spent - time_spent), String(task.time_spent), comment || `Logged ${time_spent}h`]
    );
    res.json({ task });
  } catch (err) {
    console.error('[tasks:worklog:add]', err);
    res.status(500).json({ error: 'Failed to log work' });
  }
});

module.exports = router;