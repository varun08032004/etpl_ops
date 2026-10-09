'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

// Validation schemas
const createProjectSchema = z.object({
    key: z.string().min(2).max(10).toUpperCase(),
    name: z.string().min(1).max(255),
    description: z.string().max(5000).optional().nullable(),
    project_type: z.enum(['software', 'business', 'service_desk']).default('software'),
    lead_id: schemas.uuid.optional().nullable(),
    default_assignee: schemas.uuid.optional().nullable(),
    url: z.string().url().optional().nullable(),
    is_private: z.boolean().default(false),
    category_id: schemas.uuid.optional().nullable(),
});

const updateProjectSchema = createProjectSchema.partial().strict();

const createCategorySchema = z.object({
    name: z.string().min(1).max(150),
    description: z.string().max(1000).optional().nullable(),
});

// ============================================================================
// PROJECT CATEGORIES
// ============================================================================

router.get('/categories', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT * FROM jira_project_categories ORDER BY name`
        );
        res.json({ categories: rows });
    } catch (err) {
        console.error('[jira:categories:list]', err);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

router.post('/categories', requireRole('admin'), validateBody(createCategorySchema), async (req, res) => {
    try {
        const { name, description } = req.body;
        const { rows: [category] } = await safeQuery(
            `INSERT INTO jira_project_categories (name, description) VALUES ($1,$2) RETURNING *`,
            [name, description || null]
        );
        res.status(201).json({ category });
    } catch (err) {
        console.error('[jira:categories:create]', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Category already exists' });
        res.status(500).json({ error: 'Failed to create category' });
    }
});

router.put('/categories/:id', requireRole('admin'), validateBody(createCategorySchema.partial()), async (req, res) => {
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
            `UPDATE jira_project_categories SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
            params
        );
        if (!rows.length) return res.status(404).json({ error: 'Category not found' });
        res.json({ category: rows[0] });
    } catch (err) {
        console.error('[jira:categories:update]', err);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

router.delete('/categories/:id', requireRole('admin'), async (req, res) => {
    try {
        const { rows } = await safeQuery(`DELETE FROM jira_project_categories WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Category not found' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:categories:delete]', err);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// ============================================================================
// PROJECTS
// ============================================================================

router.get('/', async (req, res) => {
    try {
        const { archived, category_id, lead_id, member_id } = req.query;
        const conditions = [];
        const params = [];
        
        if (archived === 'false') {
            conditions.push(`p.archived_at IS NULL`);
        } else if (archived === 'true') {
            conditions.push(`p.archived_at IS NOT NULL`);
        }
        
        if (category_id) {
            params.push(category_id);
            conditions.push(`p.category_id = $${params.length}`);
        }
        
        if (lead_id) {
            params.push(lead_id);
            conditions.push(`p.lead_id = $${params.length}`);
        }
        
        if (member_id) {
            params.push(member_id);
            conditions.push(`EXISTS (SELECT 1 FROM jira_project_members pm WHERE pm.project_id = p.id AND pm.employee_id = $${params.length})`);
        }
        
        // Non-admin users only see projects they're members of (or lead)
        if (!['owner', 'admin'].includes(req.staff.role)) {
            if (!req.staff.employee_id) return res.json({ projects: [] });
            params.push(req.staff.employee_id);
            conditions.push(`(p.lead_id = $${params.length} OR EXISTS (SELECT 1 FROM jira_project_members pm WHERE pm.project_id = p.id AND pm.employee_id = $${params.length}))`);
        }
        
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        
        const { rows } = await safeQuery(
            `SELECT p.*, c.name as category_name, e.full_name as lead_name, e.email as lead_email,
                    (SELECT COUNT(*) FROM jira_project_members WHERE project_id = p.id) as member_count
             FROM jira_projects p
             LEFT JOIN jira_project_categories c ON c.id = p.category_id
             LEFT JOIN employees e ON e.id = p.lead_id
             ${where}
             ORDER BY p.updated_at DESC`,
            params
        );
        res.json({ projects: rows });
    } catch (err) {
        console.error('[jira:projects:list]', err);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { rows: [project] } = await safeQuery(
            `SELECT p.*, c.name as category_name, e.full_name as lead_name, e.email as lead_email
             FROM jira_projects p
             LEFT JOIN jira_project_categories c ON c.id = p.category_id
             LEFT JOIN employees e ON e.id = p.lead_id
             WHERE p.id = $1`,
            [req.params.id]
        );
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Check access
        const isMember = await safeQuery(
            `SELECT 1 FROM jira_project_members WHERE project_id = $1 AND employee_id = $2`,
            [req.params.id, req.staff.employee_id]
        );
        const isLead = project.lead_id === req.staff.employee_id;
        const isAdmin = ['owner', 'admin'].includes(req.staff.role);
        
        if (!isAdmin && !isLead && !isMember.rows.length && project.is_private) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get members, versions, components
        const [members, versions, components, issueTypes, statuses] = await Promise.all([
            safeQuery(`SELECT pm.*, e.full_name, e.email, e.employee_code, pr.name as role_name
                       FROM jira_project_members pm
                       JOIN employees e ON e.id = pm.employee_id
                       JOIN jira_project_roles pr ON pr.id = pm.role_id
                       WHERE pm.project_id = $1`, [req.params.id]),
            safeQuery(`SELECT * FROM jira_versions WHERE project_id = $1 ORDER BY release_date DESC NULLS LAST`, [req.params.id]),
            safeQuery(`SELECT c.*, e.full_name as lead_name FROM jira_components c LEFT JOIN employees e ON e.id = c.lead_id WHERE c.project_id = $1`, [req.params.id]),
            safeQuery(`SELECT pit.*, it.name, it.color, it.icon_id FROM jira_project_issue_types pit JOIN jira_issue_types it ON it.id = pit.issue_type_id WHERE pit.project_id = $1`, [req.params.id]),
            safeQuery(`SELECT ps.*, s.name, s.category, s.color FROM jira_project_statuses ps JOIN jira_issue_statuses s ON s.id = ps.status_id WHERE ps.project_id = $1 ORDER BY ps.rank`, [req.params.id]),
        ]);

        res.json({
            project,
            members: members.rows,
            versions: versions.rows,
            components: components.rows,
            issueTypes: issueTypes.rows,
            statuses: statuses.rows,
        });
    } catch (err) {
        console.error('[jira:projects:get]', err);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

router.post('/', requireRole('admin'), validateBody(createProjectSchema), async (req, res) => {
    try {
        const { key, name, description, project_type, lead_id, default_assignee, url, is_private, category_id } = req.body;
        
        const result = await withTransaction(async (client) => {
            const { rows: [project] } = await client.query(
                `INSERT INTO jira_projects (key, name, description, project_type, lead_id, default_assignee, url, is_private, category_id, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
                [key.toUpperCase(), name, description || null, project_type, lead_id || null, default_assignee || null, url || null, is_private, category_id || null, req.staff.id]
            );

            // Add creator as admin
            if (req.staff.employee_id) {
                const { rows: [adminRole] } = await client.query(
                    `SELECT id FROM jira_project_roles WHERE name = 'Administrators' AND is_system = true`
                );
                if (adminRole) {
                    await client.query(
                        `INSERT INTO jira_project_members (project_id, employee_id, role_id, added_by) VALUES ($1,$2,$3,$4)`,
                        [project.id, req.staff.employee_id, adminRole.id, req.staff.id]
                    );
                }
            }

            // Assign default issue types, statuses, workflows, screens, permissions, notifications
            await setupProjectDefaults(client, project.id);

            return project;
        });

        res.status(201).json({ project: result });
    } catch (err) {
        console.error('[jira:projects:create]', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Project key already exists' });
        res.status(500).json({ error: 'Failed to create project' });
    }
});

router.put('/:id', requireRole('admin'), validateBody(updateProjectSchema), async (req, res) => {
    try {
        const sets = []; const params = []; let i = 1;
        for (const [key, value] of Object.entries(req.body)) {
            if (value === '') continue;
            params.push(key === 'key' ? value.toUpperCase() : value);
            sets.push(`${key} = $${i++}`);
        }
        if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
        params.push(req.params.id);
        const { rows } = await safeQuery(
            `UPDATE jira_projects SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
            params
        );
        if (!rows.length) return res.status(404).json({ error: 'Project not found' });
        res.json({ project: rows[0] });
    } catch (err) {
        console.error('[jira:projects:update]', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Project key already exists' });
        res.status(500).json({ error: 'Failed to update project' });
    }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
    try {
        const { rows } = await safeQuery(`DELETE FROM jira_projects WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Project not found' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:projects:delete]', err);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// Archive/Unarchive project
router.post('/:id/archive', requireRole('admin'), async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `UPDATE jira_projects SET archived_at = NOW() WHERE id = $1 AND archived_at IS NULL RETURNING *`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Project not found or already archived' });
        res.json({ project: rows[0] });
    } catch (err) {
        console.error('[jira:projects:archive]', err);
        res.status(500).json({ error: 'Failed to archive project' });
    }
});

router.post('/:id/unarchive', requireRole('admin'), async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `UPDATE jira_projects SET archived_at = NULL WHERE id = $1 AND archived_at IS NOT NULL RETURNING *`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Project not found or not archived' });
        res.json({ project: rows[0] });
    } catch (err) {
        console.error('[jira:projects:unarchive]', err);
        res.status(500).json({ error: 'Failed to unarchive project' });
    }
});

// ============================================================================
// PROJECT MEMBERS
// ============================================================================

router.get('/:id/members', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT pm.*, e.full_name, e.email, e.employee_code, pr.name as role_name
             FROM jira_project_members pm
             JOIN employees e ON e.id = pm.employee_id
             JOIN jira_project_roles pr ON pr.id = pm.role_id
             WHERE pm.project_id = $1
             ORDER BY pr.name, e.full_name`,
            [req.params.id]
        );
        res.json({ members: rows });
    } catch (err) {
        console.error('[jira:members:list]', err);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

const addMemberSchema = z.object({
    employee_id: schemas.uuid,
    role_id: schemas.uuid,
});

router.post('/:id/members', async (req, res) => {
    try {
        const { employee_id, role_id } = req.body;
        
        // Check permission - only project lead or admin can add members
        const { rows: [project] } = await safeQuery(`SELECT lead_id FROM jira_projects WHERE id = $1`, [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        const isAdmin = ['owner', 'admin'].includes(req.staff.role);
        const isLead = project.lead_id === req.staff.employee_id;
        
        if (!isAdmin && !isLead) {
            return res.status(403).json({ error: 'Only project lead or admin can add members' });
        }

        const { rows: [member] } = await safeQuery(
            `INSERT INTO jira_project_members (project_id, employee_id, role_id, added_by)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (project_id, employee_id) DO UPDATE SET role_id = EXCLUDED.role_id
             RETURNING *`,
            [req.params.id, employee_id, role_id, req.staff.id]
        );
        res.status(201).json({ member });
    } catch (err) {
        console.error('[jira:members:add]', err);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

router.put('/:id/members/:employeeId', async (req, res) => {
    try {
        const { role_id } = req.body;
        
        // Check permission
        const { rows: [project] } = await safeQuery(`SELECT lead_id FROM jira_projects WHERE id = $1`, [req.params.id]);
        const isAdmin = ['owner', 'admin'].includes(req.staff.role);
        const isLead = project.lead_id === req.staff.employee_id;
        if (!isAdmin && !isLead) return res.status(403).json({ error: 'Only project lead or admin can update members' });

        const { rows } = await safeQuery(
            `UPDATE jira_project_members SET role_id = $1 WHERE project_id = $2 AND employee_id = $3 RETURNING *`,
            [role_id, req.params.id, req.params.employeeId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Member not found' });
        res.json({ member: rows[0] });
    } catch (err) {
        console.error('[jira:members:update]', err);
        res.status(500).json({ error: 'Failed to update member' });
    }
});

router.delete('/:id/members/:employeeId', async (req, res) => {
    try {
        // Check permission
        const { rows: [project] } = await safeQuery(`SELECT lead_id FROM jira_projects WHERE id = $1`, [req.params.id]);
        const isAdmin = ['owner', 'admin'].includes(req.staff.role);
        const isLead = project.lead_id === req.staff.employee_id;
        if (!isAdmin && !isLead) return res.status(403).json({ error: 'Only project lead or admin can remove members' });

        // Prevent removing last admin
        const { rows: [adminCount] } = await safeQuery(
            `SELECT COUNT(*) FROM jira_project_members pm JOIN jira_project_roles pr ON pr.id = pm.role_id
             WHERE pm.project_id = $1 AND pr.name = 'Administrators'`,
            [req.params.id]
        );
        const { rows: [targetRole] } = await safeQuery(
            `SELECT pr.name FROM jira_project_members pm JOIN jira_project_roles pr ON pr.id = pm.role_id
             WHERE pm.project_id = $1 AND pm.employee_id = $2`,
            [req.params.id, req.params.employeeId]
        );
        
        if (targetRole && targetRole.name === 'Administrators' && Number(adminCount.count) <= 1) {
            return res.status(400).json({ error: 'Cannot remove the last administrator' });
        }

        const { rows } = await safeQuery(
            `DELETE FROM jira_project_members WHERE project_id = $1 AND employee_id = $2 RETURNING *`,
            [req.params.id, req.params.employeeId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Member not found' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:members:remove]', err);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

// ============================================================================
// VERSIONS
// ============================================================================

const createVersionSchema = z.object({
    name: z.string().min(1).max(150),
    description: z.string().max(5000).optional().nullable(),
    start_date: schemas.isoDate.optional().nullable(),
    release_date: schemas.isoDate.optional().nullable(),
});

const updateVersionSchema = createVersionSchema.partial().strict();

router.get('/:projectId/versions', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT v.*, 
                    (SELECT COUNT(*) FROM jira_issues WHERE fix_versions @> ARRAY[v.id]) as fix_issue_count,
                    (SELECT COUNT(*) FROM jira_issues WHERE affected_versions @> ARRAY[v.id]) as affected_issue_count
             FROM jira_versions v
             WHERE v.project_id = $1
             ORDER BY v.release_date DESC NULLS LAST`,
            [req.params.projectId]
        );
        res.json({ versions: rows });
    } catch (err) {
        console.error('[jira:versions:list]', err);
        res.status(500).json({ error: 'Failed to fetch versions' });
    }
});

router.post('/:projectId/versions', validateBody(createVersionSchema), async (req, res) => {
    try {
        const { name, description, start_date, release_date } = req.body;
        const { rows: [version] } = await safeQuery(
            `INSERT INTO jira_versions (project_id, name, description, start_date, release_date, created_by)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [req.params.projectId, name, description || null, start_date || null, release_date || null, req.staff.id]
        );
        res.status(201).json({ version });
    } catch (err) {
        console.error('[jira:versions:create]', err);
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
            `UPDATE jira_versions SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
            params
        );
        if (!rows.length) return res.status(404).json({ error: 'Version not found' });
        res.json({ version: rows[0] });
    } catch (err) {
        console.error('[jira:versions:update]', err);
        res.status(500).json({ error: 'Failed to update version' });
    }
});

router.post('/versions/:id/release', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `UPDATE jira_versions SET status = 'released', released_by = $1, released_at = NOW() WHERE id = $2 AND status != 'released' RETURNING *`,
            [req.staff.id, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Version not found or already released' });
        res.json({ version: rows[0] });
    } catch (err) {
        console.error('[jira:versions:release]', err);
        res.status(500).json({ error: 'Failed to release version' });
    }
});

router.post('/versions/:id/archive', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `UPDATE jira_versions SET status = 'archived' WHERE id = $1 AND status != 'archived' RETURNING *`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Version not found or already archived' });
        res.json({ version: rows[0] });
    } catch (err) {
        console.error('[jira:versions:archive]', err);
        res.status(500).json({ error: 'Failed to archive version' });
    }
});

router.delete('/versions/:id', async (req, res) => {
    try {
        const { rows } = await safeQuery(`DELETE FROM jira_versions WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Version not found' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:versions:delete]', err);
        res.status(500).json({ error: 'Failed to delete version' });
    }
});

// ============================================================================
// COMPONENTS
// ============================================================================

const createComponentSchema = z.object({
    name: z.string().min(1).max(150),
    description: z.string().max(5000).optional().nullable(),
    lead_id: schemas.uuid.optional().nullable(),
    default_assignee_type: z.enum(['project_default', 'component_lead', 'project_lead', 'unassigned']).default('project_default'),
});

router.get('/:projectId/components', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT c.*, e.full_name as lead_name
             FROM jira_components c
             LEFT JOIN employees e ON e.id = c.lead_id
             WHERE c.project_id = $1`,
            [req.params.projectId]
        );
        res.json({ components: rows });
    } catch (err) {
        console.error('[jira:components:list]', err);
        res.status(500).json({ error: 'Failed to fetch components' });
    }
});

router.post('/:projectId/components', validateBody(createComponentSchema), async (req, res) => {
    try {
        const { name, description, lead_id, default_assignee_type } = req.body;
        const { rows: [component] } = await safeQuery(
            `INSERT INTO jira_components (project_id, name, description, lead_id, default_assignee_type, created_by)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [req.params.projectId, name, description || null, lead_id || null, default_assignee_type, req.staff.id]
        );
        res.status(201).json({ component });
    } catch (err) {
        console.error('[jira:components:create]', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Component with this name already exists' });
        res.status(500).json({ error: 'Failed to create component' });
    }
});

router.delete('/components/:id', async (req, res) => {
    try {
        const { rows } = await safeQuery(`DELETE FROM jira_components WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Component not found' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:components:delete]', err);
        res.status(500).json({ error: 'Failed to delete component' });
    }
});

// ============================================================================
// HELPER: Setup project defaults
// ============================================================================

async function setupProjectDefaults(client, projectId) {
    // Assign all issue types
    const { rows: issueTypes } = await client.query(`SELECT id FROM jira_issue_types WHERE is_system = true`);
    for (const it of issueTypes) {
        await client.query(
            `INSERT INTO jira_project_issue_types (project_id, issue_type_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [projectId, it.id]
        );
    }

    // Assign all statuses with default ranking
    const { rows: statuses } = await client.query(`SELECT id FROM jira_issue_statuses WHERE is_system = true ORDER BY id`);
    for (let i = 0; i < statuses.length; i++) {
        await client.query(
            `INSERT INTO jira_project_statuses (project_id, status_id, rank) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [projectId, statuses[i].id, i * 1000]
        );
    }

    // Assign default workflow scheme
    const { rows: [wfScheme] } = await client.query(`SELECT id FROM jira_workflow_schemes WHERE is_default = true LIMIT 1`);
    if (wfScheme) {
        await client.query(
            `INSERT INTO jira_project_workflow_schemes (project_id, scheme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [projectId, wfScheme.id]
        );
    }

    // Assign default screen scheme
    const { rows: [screenScheme] } = await client.query(`SELECT id FROM jira_screen_schemes WHERE is_default = true LIMIT 1`);
    if (screenScheme) {
        await client.query(
            `INSERT INTO jira_project_screen_schemes (project_id, scheme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [projectId, screenScheme.id]
        );
    }

    // Assign default permission scheme
    const { rows: [permScheme] } = await client.query(`SELECT id FROM jira_permission_schemes WHERE is_default = true LIMIT 1`);
    if (permScheme) {
        await client.query(
            `INSERT INTO jira_project_permission_schemes (project_id, scheme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [projectId, permScheme.id]
        );
    }

    // Assign default notification scheme
    const { rows: [notifScheme] } = await client.query(`SELECT id FROM jira_notification_schemes WHERE is_default = true LIMIT 1`);
    if (notifScheme) {
        await client.query(
            `INSERT INTO jira_project_notification_schemes (project_id, scheme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [projectId, notifScheme.id]
        );
    }

    // Assign default issue security scheme
    const { rows: [secScheme] } = await client.query(`SELECT id FROM jira_issue_security_schemes WHERE is_default = true LIMIT 1`);
    if (secScheme) {
        await client.query(
            `INSERT INTO jira_project_issue_security_schemes (project_id, scheme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [projectId, secScheme.id]
        );
    }
}

module.exports = router;