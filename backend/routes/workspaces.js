'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ── List workspaces I have access to ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.json({ workspaces: [] });
    }

    const { rows } = await safeQuery(
      `SELECT w.*, wm.role AS my_role,
              (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) AS member_count,
              (SELECT COUNT(*) FROM workspace_docs WHERE workspace_id = w.id) AS doc_count
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.employee_id = $1
       ORDER BY w.updated_at DESC`,
      [req.staff.employee_id]
    );
    res.json({ workspaces: rows });
  } catch (err) {
    console.error('[workspace:list]', err);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// ── Get single workspace with members and docs ────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows: [workspace] } = await safeQuery(
      `SELECT w.*, d.name AS department_name
       FROM workspaces w
       LEFT JOIN departments d ON d.id = w.department_id
       WHERE w.id = $1`, [req.params.id]
    );
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    // Check access
    const { rows: [member] } = await safeQuery(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    if (!member && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const { rows: members } = await safeQuery(
      `SELECT wm.*, e.full_name, e.work_email, e.employee_code
       FROM workspace_members wm
       JOIN employees e ON e.id = wm.employee_id
       WHERE wm.workspace_id = $1`, [req.params.id]
    );

    const { rows: docs } = await safeQuery(
      `SELECT wd.*, e.full_name AS created_by_name
       FROM workspace_docs wd
       LEFT JOIN staff_accounts sa ON sa.id = wd.created_by
       LEFT JOIN employees e ON e.id = sa.employee_id
       WHERE wd.workspace_id = $1 ORDER BY wd.updated_at DESC`,
      [req.params.id]
    );

    res.json({ workspace: { ...workspace, my_role: member?.role || 'admin' }, members, docs });
  } catch (err) {
    console.error('[workspace:get]', err);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// ── Create workspace ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'Employee record required' });
    }
    const { name, description, department_id, is_public } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = await withTransaction(async (client) => {
      const { rows: [workspace] } = await client.query(
        `INSERT INTO workspaces (name, description, department_id, is_public, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [name.trim(), description || null, department_id || null, is_public || false, req.staff.id]
      );
      await client.query(
        `INSERT INTO workspace_members (workspace_id, employee_id, role) VALUES ($1,$2,'owner')`,
        [workspace.id, req.staff.employee_id]
      );
      return workspace;
    });
    res.status(201).json({ workspace: result });
  } catch (err) {
    console.error('[workspace:create]', err);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// ── Update workspace ──────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, description, is_public } = req.body;
    const sets = [];
    const params = [];
    let i = 1;
    if (name !== undefined) { if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' }); params.push(name.trim()); sets.push(`name = $${i++}`); }
    if (description !== undefined) { params.push(description); sets.push(`description = $${i++}`); }
    if (is_public !== undefined) { params.push(is_public); sets.push(`is_public = $${i++}`); }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    params.push(req.staff.employee_id);
    const { rows } = await safeQuery(
      `UPDATE workspaces SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${i++} AND (created_by = (SELECT id FROM staff_accounts WHERE employee_id = $${i}) OR $${i} IN (SELECT employee_id FROM workspace_members WHERE workspace_id = $${i-1} AND role IN ('owner','editor')))
       RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Workspace not found or insufficient permissions' });
    res.json({ workspace: rows[0] });
  } catch (err) {
    console.error('[workspace:update]', err);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// ── Delete workspace ──────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `DELETE FROM workspaces WHERE id = $1 AND created_by = (SELECT id FROM staff_accounts WHERE employee_id = $2)
       RETURNING id`,
      [req.params.id, req.staff.employee_id]
    );
    if (!rows.length && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only workspace owner or admin can delete' });
    }
    if (!rows.length && ['owner', 'admin'].includes(req.staff.role)) {
      const { rows: adminDel } = await safeQuery(`DELETE FROM workspaces WHERE id = $1 RETURNING id`, [req.params.id]);
      if (!adminDel.length) return res.status(404).json({ error: 'Workspace not found' });
      return res.json({ deleted: true });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error('[workspace:delete]', err);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// ── Members ───────────────────────────────────────────────────────────────────
router.post('/:id/members', async (req, res) => {
  try {
    const { employee_id, role } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id required' });

    // Check if requester is owner/editor of workspace
    const { rows: [myMember] } = await safeQuery(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    if (!myMember && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    if (myMember && !['owner', 'editor'].includes(myMember.role) && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only owners and editors can add members' });
    }

    const { rows: [member] } = await safeQuery(
      `INSERT INTO workspace_members (workspace_id, employee_id, role)
       VALUES ($1,$2,$3)
       ON CONFLICT (workspace_id, employee_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [req.params.id, employee_id, role || 'viewer']
    );
    res.status(201).json({ member });
  } catch (err) {
    console.error('[workspace:add-member]', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.delete('/:id/members/:employeeId', async (req, res) => {
  try {
    const { rows: [myMember] } = await safeQuery(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    if (!myMember && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    if (myMember && myMember.role !== 'owner' && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only workspace owner can remove members' });
    }

    const { rows } = await safeQuery(
      `DELETE FROM workspace_members WHERE workspace_id = $1 AND employee_id = $2 RETURNING id`,
      [req.params.id, req.params.employeeId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[workspace:remove-member]', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ── Docs ──────────────────────────────────────────────────────────────────────
router.get('/:workspaceId/docs', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT wd.*, e.full_name AS created_by_name
       FROM workspace_docs wd
       LEFT JOIN staff_accounts sa ON sa.id = wd.created_by
       LEFT JOIN employees e ON e.id = sa.employee_id
       WHERE wd.workspace_id = $1 ORDER BY wd.updated_at DESC`,
      [req.params.workspaceId]
    );
    res.json({ docs: rows });
  } catch (err) {
    console.error('[workspace:docs:list]', err);
    res.status(500).json({ error: 'Failed to fetch docs' });
  }
});

router.get('/:workspaceId/docs/:docId', async (req, res) => {
  try {
    const { rows: [doc] } = await safeQuery(
      `SELECT wd.*, e.full_name AS created_by_name
       FROM workspace_docs wd
       LEFT JOIN staff_accounts sa ON sa.id = wd.created_by
       LEFT JOIN employees e ON e.id = sa.employee_id
       WHERE wd.id = $1 AND wd.workspace_id = $2`,
      [req.params.docId, req.params.workspaceId]
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json({ doc });
  } catch (err) {
    console.error('[workspace:docs:get]', err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.post('/:workspaceId/docs', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const { rows: [myMember] } = await safeQuery(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND employee_id = $2`,
      [req.params.workspaceId, req.staff.employee_id]
    );
    if (!myMember && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    if (myMember && myMember.role === 'viewer' && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Viewers cannot create documents' });
    }

    const { rows: [doc] } = await safeQuery(
      `INSERT INTO workspace_docs (workspace_id, title, content, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.workspaceId, title.trim(), content || {}, req.staff.id]
    );
    res.status(201).json({ doc });
  } catch (err) {
    console.error('[workspace:docs:create]', err);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

router.put('/:workspaceId/docs/:docId', async (req, res) => {
  try {
    const { title, content } = req.body;

    const { rows: [myMember] } = await safeQuery(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND employee_id = $2`,
      [req.params.workspaceId, req.staff.employee_id]
    );
    if (!myMember && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    if (myMember && myMember.role === 'viewer' && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Viewers cannot edit documents' });
    }

    const sets = [];
    const params = [];
    let i = 1;
    if (title !== undefined) { if (!title.trim()) return res.status(400).json({ error: 'Title cannot be empty' }); params.push(title.trim()); sets.push(`title = $${i++}`); }
    if (content !== undefined) { params.push(content); sets.push(`content = $${i++}`, `version = version + 1`); }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.docId);
    params.push(req.params.workspaceId);
    const { rows } = await safeQuery(
      `UPDATE workspace_docs SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${i++} AND workspace_id = $${i} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    res.json({ doc: rows[0] });
  } catch (err) {
    console.error('[workspace:docs:update]', err);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

router.delete('/:workspaceId/docs/:docId', async (req, res) => {
  try {
    const { rows: [myMember] } = await safeQuery(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND employee_id = $2`,
      [req.params.workspaceId, req.staff.employee_id]
    );
    if (!myMember && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }
    if (myMember && myMember.role !== 'owner' && !['owner', 'admin'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Only workspace owner can delete documents' });
    }

    const { rows } = await safeQuery(
      `DELETE FROM workspace_docs WHERE id = $1 AND workspace_id = $2 RETURNING id`,
      [req.params.docId, req.params.workspaceId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[workspace:docs:delete]', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;