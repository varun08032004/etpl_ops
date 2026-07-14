'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { registerApprovalAction, createApprovalRequest } = require('../services/approvals');

router.use(authenticate);

async function deleteDepartment(targetId) {
  const { rows } = await safeQuery(`DELETE FROM departments WHERE id = $1 RETURNING id, name`, [targetId]);
  return rows[0];
}
registerApprovalAction('department.delete', deleteDepartment);

// ── list departments, with head name + employee count ──────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT d.id, d.name, d.code, d.cost_center, d.location, d.budget, d.status,
              d.description, d.head_employee_id, d.parent_department_id,
              h.full_name AS head_name, h.work_email AS head_email,
              p.name AS parent_name,
              COUNT(e.id) AS employee_count
       FROM departments d
       LEFT JOIN employees h ON h.id = d.head_employee_id
       LEFT JOIN departments p ON p.id = d.parent_department_id
       LEFT JOIN employees e ON e.department_id = d.id AND e.status != 'exited'
       GROUP BY d.id, h.full_name, h.work_email, p.name
       ORDER BY d.name`
    );
    res.json({ departments: rows.map((r) => ({ ...r, employee_count: Number(r.employee_count) })) });
  } catch (err) {
    console.error('[departments:list]', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// ── single department with its members ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows: [dept] } = await safeQuery(
      `SELECT d.*, h.full_name AS head_name, h.work_email AS head_email, p.name AS parent_name
       FROM departments d
       LEFT JOIN employees h ON h.id = d.head_employee_id
       LEFT JOIN departments p ON p.id = d.parent_department_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const { rows: members } = await safeQuery(
      `SELECT e.id, e.full_name, e.work_email, e.status, des.title AS designation
       FROM employees e LEFT JOIN designations des ON des.id = e.designation_id
       WHERE e.department_id = $1 AND e.status != 'exited'
       ORDER BY e.full_name`,
      [req.params.id]
    );
    res.json({ department: dept, members });
  } catch (err) {
    console.error('[departments:get]', err);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// ── create — immediate, additions don't need approval ───────────────────────
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, description, head_employee_id, code, cost_center, location, budget, status, parent_department_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    const { rows: [dept] } = await safeQuery(
      `INSERT INTO departments (name, description, head_employee_id, code, cost_center, location, budget, status, parent_department_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'active'),$9) RETURNING *`,
      [
        name.trim(), description || null, head_employee_id || null,
        code || null, cost_center || null, location || null,
        budget || null, status || null, parent_department_id || null,
      ]
    );
    res.status(201).json({ department: dept });
  } catch (err) {
    console.error('[departments:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'A department with this name, code, or cost center already exists' });
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// ── update (rename, change description, change head, etc.) — immediate ─────
// Changing who the head is or editing cost-center metadata isn't destructive
// to anything, so this stays outside the approval flow — only deleting the
// department itself is gated.
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const allowed = ['name', 'description', 'head_employee_id', 'code', 'cost_center', 'location', 'budget', 'status', 'parent_department_id'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key] === '' ? null : req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE departments SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Department not found' });
    res.json({ department: rows[0] });
  } catch (err) {
    console.error('[departments:update]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'That name, code, or cost center is already in use' });
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// ── delete — destructive, routed through Founder approval for admins ───────
// Same pattern as staff_account.deactivate: owner acts immediately, admin's
// click creates a pending request instead. Blocked outright (no request
// created) if employees are still assigned — reassign them first, matching
// the "never leave dangling references" guard used elsewhere in this codebase.
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rows: [dept] } = await safeQuery(`SELECT id, name FROM departments WHERE id = $1`, [req.params.id]);
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const { rows: [{ count }] } = await safeQuery(
      `SELECT COUNT(*) FROM employees WHERE department_id = $1 AND status != 'exited'`,
      [req.params.id]
    );
    if (Number(count) > 0) {
      return res.status(400).json({ error: `${count} employee(s) are still in this department — reassign them first` });
    }

    if (req.staff.role === 'owner') {
      const deleted = await deleteDepartment(req.params.id);
      return res.json({ department: deleted });
    }

    const request = await createApprovalRequest({
      actionType: 'department.delete',
      targetType: 'department',
      targetId: dept.id,
      targetLabel: dept.name,
      requestedBy: req.staff.id,
      reason: req.body.reason || null,
    });

    res.status(202).json({
      pending: true,
      request,
      message: `Deletion of "${dept.name}" requested — awaiting Founder approval.`,
    });
  } catch (err) {
    console.error('[departments:delete]', err);
    res.status(500).json({ error: 'Failed to process deletion' });
  }
});

module.exports = router;