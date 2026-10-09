'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);

// Validation schemas
const createIssueSchema = z.object({
    project_id: schemas.uuid,
    issue_type_id: schemas.uuid,
    summary: z.string().min(1).max(300),
    description: z.string().max(10000).optional().nullable(),
    description_adf: z.any().optional().nullable(),
    priority_id: schemas.uuid.optional().nullable(),
    assignee_id: schemas.uuid.optional().nullable(),
    reporter_id: schemas.uuid.optional().nullable(),
    parent_id: schemas.uuid.optional().nullable(),
    epic_id: schemas.uuid.optional().nullable(),
    sprint_id: schemas.uuid.optional().nullable(),
    story_points: z.number().min(0).max(1000).optional().nullable(),
    original_estimate: z.number().min(0).max(10000).optional().nullable(),
    remaining_estimate: z.number().min(0).max(10000).optional().nullable(),
    due_date: schemas.isoDate.optional().nullable(),
    start_date: schemas.isoDate.optional().nullable(),
    security_level_id: schemas.uuid.optional().nullable(),
    environment: z.string().max(2000).optional().nullable(),
    fix_versions: z.array(schemas.uuid).optional(),
    affected_versions: z.array(schemas.uuid).optional(),
    components: z.array(schemas.uuid).optional(),
    labels: z.array(z.string().max(100)).optional(),
});

const updateIssueSchema = createIssueSchema.partial().strict();

const createCommentSchema = z.object({
    body: z.string().min(1).max(10000),
    body_adf: z.any().optional().nullable(),
    is_internal: z.boolean().default(false),
});

const createWorklogSchema = z.object({
    time_spent: z.number().min(0).max(1000),
    comment: z.string().max(2000).optional().nullable(),
    comment_adf: z.any().optional().nullable(),
    started_at: schemas.isoDateTime.optional().nullable(),
});

const createAttachmentSchema = z.object({
    filename: z.string().min(1).max(255),
    file_size: z.number().min(1).max(50000000),
    mime_type: z.string().max(100),
    storage_path: z.string().min(1).max(500),
    thumbnail_path: z.string().max(500).optional().nullable(),
    width: z.number().optional().nullable(),
    height: z.number().optional().nullable(),
});

router.use(authenticate);

// ============================================================================
// ISSUES
// ============================================================================

// List issues with filters
router.get('/', async (req, res) => {
    try {
        const { 
            project_id, sprint_id, assignee_id, reporter_id, 
            status_id, type_id, priority_id, epic_id,
            parent_id, my_issues, search, limit = 50, offset = 0 
        } = req.query;
        
        const conditions = [];
        const params = [];
        
        if (project_id) { params.push(project_id); conditions.push(`i.project_id = $${params.length}`); }
        if (sprint_id) { params.push(sprint_id); conditions.push(`i.sprint_id = $${params.length}`); }
        if (assignee_id) { params.push(assignee_id); conditions.push(`i.assignee_id = $${params.length}`); }
        if (reporter_id) { params.push(reporter_id); conditions.push(`i.reporter_id = $${params.length}`); }
        if (status_id) { params.push(status_id); conditions.push(`i.status_id = $${params.length}`); }
        if (type_id) { params.push(type_id); conditions.push(`i.issue_type_id = $${params.length}`); }
        if (priority_id) { params.push(priority_id); conditions.push(`i.priority_id = $${params.length}`); }
        if (epic_id) { params.push(epic_id); conditions.push(`i.epic_id = $${params.length}`); }
        if (parent_id) { params.push(parent_id); conditions.push(`i.parent_id = $${params.length}`); }
        if (search) { params.push(`%${search}%`); conditions.push(`(i.summary ILIKE $${params.length} OR i.description ILIKE $${params.length})`); }
        
        if (my_issues === 'true') {
            if (!req.staff.employee_id) return res.json({ issues: [] });
            params.push(req.staff.employee_id);
            conditions.push(`(i.assignee_id = $${params.length} OR i.reporter_id = $${params.length})`);
        } else if (!['owner', 'admin'].includes(req.staff.role)) {
            if (!req.staff.employee_id) return res.json({ issues: [] });
            params.push(req.staff.employee_id);
            conditions.push(`(i.assignee_id = $${params.length} OR i.reporter_id = $${params.length})`);
        }
        
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        
        params.push(Number(limit), Number(offset));
        
        const { rows } = await safeQuery(
            `SELECT i.*, p.key as project_key, p.name as project_name,
                    it.name as issue_type_name, it.color as issue_type_color,
                    s.name as status_name, s.category as status_category, s.color as status_color,
                    pr.name as priority_name, pr.icon_color as priority_color,
                    e1.full_name as assignee_name, e1.email as assignee_email,
                    e2.full_name as reporter_name, e2.email as reporter_email,
                    ep.issue_key as epic_key, ep.summary as epic_summary,
                    sp.name as sprint_name, sp.status as sprint_status
             FROM jira_issues i
             JOIN jira_projects p ON p.id = i.project_id
             JOIN jira_issue_types it ON it.id = i.issue_type_id
             JOIN jira_issue_statuses s ON s.id = i.status_id
             LEFT JOIN jira_priorities pr ON pr.id = i.priority_id
             LEFT JOIN employees e1 ON e1.id = i.assignee_id
             LEFT JOIN employees e2 ON e2.id = i.reporter_id
             LEFT JOIN jira_issues ep ON ep.id = i.epic_id
             LEFT JOIN jira_sprints sp ON sp.id = i.sprint_id
             ${where}
             ORDER BY i.rank ASC, i.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        
        const { rows: [count] } = await safeQuery(
            `SELECT COUNT(*) FROM jira_issues i ${where}`,
            params.slice(0, -2)
        );
        
        res.json({ 
            issues: rows, 
            pagination: { 
                total: Number(count.count), 
                limit: Number(limit), 
                offset: Number(offset) 
            } 
        });
    } catch (err) {
        console.error('[jira:issues:list]', err);
        res.status(500).json({ error: 'Failed to fetch issues' });
    }
});

// Get single issue with full details
router.get('/:id', async (req, res) => {
    try {
        const { rows: [issue] } = await safeQuery(
            `SELECT i.*, p.key as project_key, p.name as project_name,
                    it.name as issue_type_name, it.color as issue_type_color,
                    s.name as status_name, s.category as status_category, s.color as status_color,
                    pr.name as priority_name, pr.icon_color as priority_color,
                    r.name as resolution_name,
                    e1.full_name as assignee_name, e1.email as assignee_email,
                    e2.full_name as reporter_name, e2.email as reporter_email,
                    ep.issue_key as epic_key, ep.summary as epic_summary,
                    sp.name as sprint_name, sp.status as sprint_status,
                    v.name as version_name, c.name as component_name
             FROM jira_issues i
             JOIN jira_projects p ON p.id = i.project_id
             JOIN jira_issue_types it ON it.id = i.issue_type_id
             JOIN jira_issue_statuses s ON s.id = i.status_id
             LEFT JOIN jira_priorities pr ON pr.id = i.priority_id
             LEFT JOIN jira_resolutions r ON r.id = i.resolution_id
             LEFT JOIN employees e1 ON e1.id = i.assignee_id
             LEFT JOIN employees e2 ON e2.id = i.reporter_id
             LEFT JOIN jira_issues ep ON ep.id = i.epic_id
             LEFT JOIN jira_sprints sp ON sp.id = i.sprint_id
             LEFT JOIN jira_versions v ON v.id = ANY(i.fix_versions)
             LEFT JOIN jira_components c ON c.id = ANY(i.components)
             WHERE i.id = $1`,
            [req.params.id]
        );
        if (!issue) return res.status(404).json({ error: 'Issue not found' });

        // Get comments, worklogs, attachments, links, watchers, votes, history
        const [comments, worklogs, attachments, links, watchers, votes, history] = await Promise.all([
            safeQuery(`SELECT c.*, sa.email as author_email, e.full_name as author_name 
                       FROM jira_comments c 
                       JOIN staff_accounts sa ON sa.id = c.author_id 
                       LEFT JOIN employees e ON e.id = sa.employee_id 
                       WHERE c.issue_id = $1 AND c.deleted_at IS NULL ORDER BY c.created_at ASC`, [req.params.id]),
            safeQuery(`SELECT w.*, sa.email as author_email, e.full_name as author_name 
                       FROM jira_worklogs w 
                       JOIN staff_accounts sa ON sa.id = w.author_id 
                       LEFT JOIN employees e ON e.id = sa.employee_id 
                       WHERE w.issue_id = $1 ORDER BY w.started_at DESC`, [req.params.id]),
            safeQuery(`SELECT * FROM jira_attachments WHERE issue_id = $1 ORDER BY created_at DESC`, [req.params.id]),
            safeQuery(`SELECT il.*, i2.issue_key as target_key, i2.summary as target_summary, i2.status_id as target_status 
                       FROM jira_issue_links il 
                       JOIN jira_issues i2 ON i2.id = il.target_issue_id 
                       WHERE il.source_issue_id = $1`, [req.params.id]),
            safeQuery(`SELECT w.*, e.full_name, e.email FROM jira_watchers w JOIN employees e ON e.id = w.employee_id WHERE w.issue_id = $1`, [req.params.id]),
            safeQuery(`SELECT v.*, e.full_name, e.email FROM jira_votes v JOIN employees e ON e.id = v.employee_id WHERE v.issue_id = $1`, [req.params.id]),
            safeQuery(`SELECT h.*, sa.email as author_email, e.full_name as author_name 
                       FROM jira_issue_history h 
                       LEFT JOIN staff_accounts sa ON sa.id = h.author_id 
                       LEFT JOIN employees e ON e.id = sa.employee_id 
                       WHERE h.issue_id = $1 ORDER BY h.created_at DESC`, [req.params.id]),
        ]);

        // Get subtasks
        const { rows: subtasks } = await safeQuery(
            `SELECT i.*, it.name as issue_type_name, s.name as status_name, s.category as status_category 
             FROM jira_issues i 
             JOIN jira_issue_types it ON it.id = i.issue_type_id 
             JOIN jira_issue_statuses s ON s.id = i.status_id 
             WHERE i.parent_id = $1 ORDER BY i.rank`, 
            [req.params.id]
        );

        // Get epic issues
        const { rows: epicIssues } = await safeQuery(
            `SELECT i.*, it.name as issue_type_name, s.name as status_name, s.category as status_category 
             FROM jira_issues i 
             JOIN jira_issue_types it ON it.id = i.issue_type_id 
             JOIN jira_issue_statuses s ON s.id = i.status_id 
             WHERE i.epic_id = $1 ORDER BY i.rank`, 
            [req.params.id]
        );

        res.json({ 
            issue, 
            comments: comments.rows, 
            worklogs: worklogs.rows, 
            attachments: attachments.rows, 
            links: links.rows, 
            watchers: watchers.rows, 
            votes: votes.rows, 
            history: history.rows,
            subtasks: subtasks.rows,
            epicIssues: epicIssues.rows,
        });
    } catch (err) {
        console.error('[jira:issues:get]', err);
        res.status(500).json({ error: 'Failed to fetch issue' });
    }
});

// Create issue
router.post('/', validateBody(createIssueSchema), async (req, res) => {
    try {
        const result = await withTransaction(async (client) => {
            const { rows: [issue] } = await client.query(
                `INSERT INTO jira_issues (project_id, issue_type_id, summary, description, description_adf, 
                    priority_id, assignee_id, reporter_id, parent_id, epic_id, sprint_id, 
                    story_points, original_estimate, remaining_estimate, due_date, start_date, 
                    security_level_id, environment, fix_versions, affected_versions, components, labels, 
                    reporter_id, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
                 RETURNING *`,
                [req.body.project_id, req.body.issue_type_id, req.body.summary, req.body.description || null, 
                    req.body.description_adf || null, req.body.priority_id || null, req.body.assignee_id || null, 
                    req.body.reporter_id || req.staff.employee_id, req.body.parent_id || null, req.body.epic_id || null, 
                    req.body.sprint_id || null, req.body.story_points || null, req.body.original_estimate || null, 
                    req.body.remaining_estimate || null, req.body.due_date || null, req.body.start_date || null, 
                    req.body.security_level_id || null, req.body.environment || null, 
                    req.body.fix_versions || null, req.body.affected_versions || null, 
                    req.body.components || null, req.body.labels || null, 
                    req.body.reporter_id || req.staff.employee_id, req.staff.id]
            );

            // Log history
            await client.query(
                `INSERT INTO jira_issue_history (issue_id, author_id, field_changed, old_value, new_value, change_type, description) 
                 VALUES ($1,$2,'created',NULL,'Created','create','Issue created')`,
                [issue.id, req.staff.id]
            );

            return issue;
        });

        // Fetch full issue with relations
        const { rows: [fullIssue] } = await safeQuery(
            `SELECT i.*, p.key as project_key, p.name as project_name,
                    it.name as issue_type_name, it.color as issue_type_color,
                    s.name as status_name, s.category as status_category, s.color as status_color,
                    pr.name as priority_name, pr.icon_color as priority_color,
                    e1.full_name as assignee_name, e1.email as assignee_email,
                    e2.full_name as reporter_name, e2.email as reporter_email
             FROM jira_issues i
             JOIN jira_projects p ON p.id = i.project_id
             JOIN jira_issue_types it ON it.id = i.issue_type_id
             JOIN jira_issue_statuses s ON s.id = i.status_id
             LEFT JOIN jira_priorities pr ON pr.id = i.priority_id
             LEFT JOIN employees e1 ON e1.id = i.assignee_id
             LEFT JOIN employees e2 ON e2.id = i.reporter_id
             WHERE i.id = $1`,
            [result.id]
        );

        res.status(201).json({ issue: fullIssue });
    } catch (err) {
        console.error('[jira:issues:create]', err);
        res.status(500).json({ error: 'Failed to create issue' });
    }
});

// Update issue
router.put('/:id', validateBody(updateIssueSchema), async (req, res) => {
    try {
        const { rows: [oldIssue] } = await safeQuery(`SELECT * FROM jira_issues WHERE id = $1`, [req.params.id]);
        if (!oldIssue) return res.status(404).json({ error: 'Issue not found' });

        const sets = []; const params = []; let i = 1;
        for (const [key, value] of Object.entries(req.body)) {
            if (value === '' || value === undefined) continue;
            params.push(value);
            sets.push(`${key} = $${i++}`);
        }
        if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

        // Track changes for history
        for (const [key, value] of Object.entries(req.body)) {
            if (oldIssue[key] !== value && value !== undefined) {
                await pool.query(
                    `INSERT INTO jira_issue_history (issue_id, author_id, field_changed, old_value, new_value, change_type, description) 
                     VALUES ($1,$2,$3,$4,$5,'field_change','Field updated')`,
                    [req.params.id, req.staff.id, key, String(oldIssue[key]), String(value)]
                );
            }
        }

        // Handle status change to 'done'
        if (req.body.status_id && req.body.status_id !== oldIssue.status_id) {
            const { rows: [newStatus] } = await safeQuery(`SELECT category FROM jira_issue_statuses WHERE id = $1`, [req.body.status_id]);
            if (newStatus?.category === 'done') {
                params.push(new Date().toISOString());
                sets.push(`resolved_at = $${i++}`);
            }
        }

        params.push(req.params.id);
        const { rows } = await safeQuery(
            `UPDATE jira_issues SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
            params
        );
        if (!rows.length) return res.status(404).json({ error: 'Issue not found' });
        res.json({ issue: rows[0] });
    } catch (err) {
        console.error('[jira:issues:update]', err);
        res.status(500).json({ error: 'Failed to update issue' });
    }
});

// Delete issue
router.delete('/:id', async (req, res) => {
    try {
        const { rows } = await safeQuery(`DELETE FROM jira_issues WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Issue not found' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:issues:delete]', err);
        res.status(500).json({ error: 'Failed to delete issue' });
    }
});

// ============================================================================
// ISSUE COMMENTS
// ============================================================================

router.get('/:id/comments', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT c.*, sa.email as author_email, e.full_name as author_name
             FROM jira_comments c
             JOIN staff_accounts sa ON sa.id = c.author_id
             LEFT JOIN employees e ON e.id = sa.employee_id
             WHERE c.issue_id = $1 AND c.deleted_at IS NULL
             ORDER BY c.created_at ASC`,
            [req.params.id]
        );
        res.json({ comments: rows });
    } catch (err) {
        console.error('[jira:comments:list]', err);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

router.post('/:id/comments', validateBody(createCommentSchema), async (req, res) => {
    try {
        const { rows: [comment] } = await safeQuery(
            `INSERT INTO jira_comments (issue_id, author_id, body, body_adf, is_internal)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [req.params.id, req.staff.id, req.body.body, req.body.body_adf || null, req.body.is_internal || false]
        );
        res.status(201).json({ comment });
    } catch (err) {
        console.error('[jira:comments:create]', err);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

router.put('/comments/:commentId', validateBody(createCommentSchema.partial()), async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `UPDATE jira_comments SET body = $1, body_adf = $2, is_internal = $3, updated_at = NOW()
             WHERE id = $1 AND author_id = $2 RETURNING *`,
            [req.body.body, req.body.body_adf || null, req.body.is_internal || false, req.params.commentId, req.staff.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Comment not found or not authorized' });
        res.json({ comment: rows[0] });
    } catch (err) {
        console.error('[jira:comments:update]', err);
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

router.delete('/comments/:commentId', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `UPDATE jira_comments SET deleted_at = NOW() WHERE id = $1 AND author_id = $2 RETURNING *`,
            [req.params.commentId, req.staff.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Comment not found or not authorized' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:comments:delete]', err);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ============================================================================
// ISSUE WORKLOGS
// ============================================================================

router.get('/:id/worklogs', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT w.*, sa.email as author_email, e.full_name as author_name
             FROM jira_worklogs w
             JOIN staff_accounts sa ON sa.id = w.author_id
             LEFT JOIN employees e ON e.id = sa.employee_id
             WHERE w.issue_id = $1 ORDER BY w.started_at DESC`,
            [req.params.id]
        );
        res.json({ worklogs: rows });
    } catch (err) {
        console.error('[jira:worklogs:list]', err);
        res.status(500).json({ error: 'Failed to fetch worklogs' });
    }
});

router.post('/:id/worklogs', validateBody(createWorklogSchema), async (req, res) => {
    try {
        const { time_spent, comment, comment_adf, started_at } = req.body;
        const { rows: [worklog] } = await safeQuery(
            `INSERT INTO jira_worklogs (issue_id, author_id, time_spent, time_spent_sec, comment, comment_adf, started_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [req.params.id, req.staff.id, time_spent, time_spent * 3600, comment || null, comment_adf || null, started_at || new Date().toISOString()]
        );
        res.status(201).json({ worklog });
    } catch (err) {
        console.error('[jira:worklogs:create]', err);
        res.status(500).json({ error: 'Failed to log work' });
    }
});

router.delete('/worklogs/:worklogId', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `DELETE FROM jira_worklogs WHERE id = $1 AND author_id = $2 RETURNING id`,
            [req.params.worklogId, req.staff.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Worklog not found or not authorized' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:worklogs:delete]', err);
        res.status(500).json({ error: 'Failed to delete worklog' });
    }
});

// ============================================================================
// ISSUE ATTACHMENTS
// ============================================================================

router.get('/:id/attachments', async (req, res) => {
    try {
        const { rows } = await safeQuery(`SELECT * FROM jira_attachments WHERE issue_id = $1 ORDER BY created_at DESC`, [req.params.id]);
        res.json({ attachments: rows });
    } catch (err) {
        console.error('[jira:attachments:list]', err);
        res.status(500).json({ error: 'Failed to fetch attachments' });
    }
});

router.post('/:id/attachments', async (req, res) => {
    try {
        // Handle file upload - expects multipart/form-data
        const { filename, file_size, mime_type, storage_path, thumbnail_path, width, height } = req.body;
        const { rows: [attachment] } = await safeQuery(
            `INSERT INTO jira_attachments (issue_id, filename, file_size, mime_type, storage_path, thumbnail_path, width, height, uploaded_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [req.params.id, filename, file_size, mime_type, storage_path, thumbnail_path || null, width || null, height || null, req.staff.id]
        );
        res.status(201).json({ attachment });
    } catch (err) {
        console.error('[jira:attachments:create]', err);
        res.status(500).json({ error: 'Failed to upload attachment' });
    }
});

router.delete('/attachments/:attachmentId', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `DELETE FROM jira_attachments WHERE id = $1 AND uploaded_by = $2 RETURNING id`,
            [req.params.attachmentId, req.staff.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Attachment not found or not authorized' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:attachments:delete]', err);
        res.status(500).json({ error: 'Failed to delete attachment' });
    }
});

// ============================================================================
// ISSUE LINKS
// ============================================================================

router.get('/:id/links', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT il.*, i2.issue_key as target_key, i2.summary as target_summary, i2.status_id as target_status
             FROM jira_issue_links il
             JOIN jira_issues i2 ON i2.id = il.target_issue_id
             WHERE il.source_issue_id = $1`,
            [req.params.id]
        );
        res.json({ links: rows });
    } catch (err) {
        console.error('[jira:links:list]', err);
        res.status(500).json({ error: 'Failed to fetch links' });
    }
});

router.post('/:id/links', async (req, res) => {
    try {
        const { target_issue_id, link_type } = req.body;
        if (req.params.id === target_issue_id) return res.status(400).json({ error: 'Cannot link issue to itself' });
        
        const { rows: [link] } = await safeQuery(
            `INSERT INTO jira_issue_links (source_issue_id, target_issue_id, link_type, created_by)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [req.params.id, target_issue_id, link_type, req.staff.id]
        );
        res.status(201).json({ link });
    } catch (err) {
        console.error('[jira:links:create]', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Link already exists' });
        res.status(500).json({ error: 'Failed to create link' });
    }
});

router.delete('/links/:linkId', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `DELETE FROM jira_issue_links WHERE id = $1 AND created_by = $2 RETURNING id`,
            [req.params.linkId, req.staff.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Link not found or not authorized' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:links:delete]', err);
        res.status(500).json({ error: 'Failed to delete link' });
    }
});

// ============================================================================
// WATCHERS & VOTES
// ============================================================================

router.get('/:id/watchers', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT w.*, e.full_name, e.email FROM jira_watchers w JOIN employees e ON e.id = w.employee_id WHERE w.issue_id = $1`,
            [req.params.id]
        );
        res.json({ watchers: rows });
    } catch (err) {
        console.error('[jira:watchers:list]', err);
        res.status(500).json({ error: 'Failed to fetch watchers' });
    }
});

router.post('/:id/watchers', async (req, res) => {
    try {
        const { employee_id } = req.body;
        const { rows: [watcher] } = await safeQuery(
            `INSERT INTO jira_watchers (issue_id, employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *`,
            [req.params.id, employee_id || req.staff.employee_id]
        );
        if (!watcher) return res.status(409).json({ error: 'Already watching' });
        res.status(201).json({ watcher });
    } catch (err) {
        console.error('[jira:watchers:add]', err);
        res.status(500).json({ error: 'Failed to add watcher' });
    }
});

router.delete('/:id/watchers/:employeeId', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `DELETE FROM jira_watchers WHERE issue_id = $1 AND employee_id = $2 RETURNING *`,
            [req.params.id, req.params.employeeId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Watcher not found' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:watchers:remove]', err);
        res.status(500).json({ error: 'Failed to remove watcher' });
    }
});

router.post('/:id/vote', async (req, res) => {
    try {
        const { rows: [vote] } = await safeQuery(
            `INSERT INTO jira_votes (issue_id, employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *`,
            [req.params.id, req.staff.employee_id]
        );
        if (!vote) return res.status(409).json({ error: 'Already voted' });
        res.status(201).json({ vote });
    } catch (err) {
        console.error('[jira:votes:add]', err);
        res.status(500).json({ error: 'Failed to vote' });
    }
});

router.delete('/:id/vote', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `DELETE FROM jira_votes WHERE issue_id = $1 AND employee_id = $2 RETURNING *`,
            [req.params.id, req.staff.employee_id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Vote not found' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[jira:votes:remove]', err);
        res.status(500).json({ error: 'Failed to remove vote' });
    }
});

// ============================================================================
// ISSUE HISTORY
// ============================================================================

router.get('/:id/history', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT h.*, sa.email as author_email, e.full_name as author_name
             FROM jira_issue_history h
             LEFT JOIN staff_accounts sa ON sa.id = h.author_id
             LEFT JOIN employees e ON e.id = sa.employee_id
             WHERE h.issue_id = $1 ORDER BY h.created_at DESC LIMIT 100`,
            [req.params.id]
        );
        res.json({ history: rows });
    } catch (err) {
        console.error('[jira:history:list]', err);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// ============================================================================
// ISSUE TRANSITIONS (workflow)
// ============================================================================

router.get('/:id/transitions', async (req, res) => {
    try {
        const { rows: [issue] } = await safeQuery(
            `SELECT i.*, p.id as project_id, w.id as workflow_id
             FROM jira_issues i
             JOIN jira_projects p ON p.id = i.project_id
             JOIN jira_project_workflow_schemes pws ON pws.project_id = p.id
             JOIN jira_workflow_schemes ws ON ws.id = pws.scheme_id
             JOIN jira_workflow_schemes wsm ON wsm.scheme_id = ws.id AND wsm.issue_type_id = (SELECT issue_type_id FROM jira_issues WHERE id = $1)
             JOIN jira_workflows w ON w.id = wsm.workflow_id
             WHERE i.id = $1`,
            [req.params.id]
        );
        if (!issue) return res.status(404).json({ error: 'Issue not found' });

        const { rows: transitions } = await safeQuery(
            `SELECT wt.*, s.name as from_name, s.color as from_color, s2.name as to_name, s2.color as to_color
             FROM jira_workflow_transitions wt
             JOIN jira_issue_statuses s ON s.id = wt.from_status_id
             JOIN jira_issue_statuses s2 ON s2.id = wt.to_status_id
             WHERE wt.workflow_id = $1 AND wt.from_status_id = $2`,
            [issue.workflow_id, issue.status_id]
        );

        res.json({ transitions });
    } catch (err) {
        console.error('[jira:transitions]', err);
        res.status(500).json({ error: 'Failed to fetch transitions' });
    }
});

router.post('/:id/transition', async (req, res) => {
    try {
        const { transition_id, fields } = req.body;
        
        const { rows: [transition] } = await safeQuery(
            `SELECT * FROM jira_workflow_transitions WHERE id = $1`,
            [transition_id]
        );
        if (!transition) return res.status(404).json({ error: 'Transition not found' });

        // Verify current status matches from_status
        const { rows: [issue] } = await safeQuery(`SELECT status_id FROM jira_issues WHERE id = $1`, [req.params.id]);
        if (!issue || issue.status_id !== transition.from_status_id) {
            return res.status(400).json({ error: 'Issue is not in the correct status for this transition' });
        }

        // Execute transition
        const sets = [`status_id = $1`, `updated_at = NOW()`];
        const params = [transition.to_status_id];
        
        if (transition.to_status_id) {
            const { rows: [newStatus] } = await safeQuery(`SELECT category FROM jira_issue_statuses WHERE id = $1`, [transition.to_status_id]);
            if (newStatus?.category === 'done') {
                params.push(new Date().toISOString());
                sets.push(`resolved_at = $${params.length}`);
            }
        }

        params.push(req.params.id);
        await pool.query(
            `UPDATE jira_issues SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
            params
        );

        // Log history
        await pool.query(
            `INSERT INTO jira_issue_history (issue_id, author_id, field_changed, old_value, new_value, change_type, description)
             VALUES ($1,$2,'status',$3,$4,'transition','Status transitioned via workflow')`,
            [req.params.id, req.staff.id, transition.from_status_id, transition.to_status_id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[jira:transition]', err);
        res.status(500).json({ error: 'Failed to execute transition' });
    }
});

module.exports = router;