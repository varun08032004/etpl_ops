'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');
const { registerApprovalAction, createApprovalRequest } = require('../services/approvals');
const { buildDepartmentChain } = require('../services/approvalChain');

router.use(authenticate);

async function deleteDepartment(targetId) {
  const { rows } = await safeQuery(`DELETE FROM departments WHERE id = $1 RETURNING id, name`, [targetId]);
  return rows[0];
}
registerApprovalAction('department.delete', deleteDepartment);

// ── what does MY login currently have access to? — powers the sidebar for
// non-privileged staff (their own department's granted-role modules) and
// lets the frontend show an "HOD" badge. authenticate() already resolved
// all of this onto req.staff, so this route is just exposing it. ──────────
router.get('/my-access', (req, res) => {
  res.json({
    role: req.staff.role,
    effectiveRoles: req.staff.effectiveRoles,
    deptAccess: req.staff.deptAccess,
  });
});

router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT d.id, d.name, d.code, d.cost_center, d.location, d.budget, d.status,
              d.description, d.head_employee_id, d.parent_department_id, d.granted_roles,
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

    await logAction({ staffId: req.staff.id, action: 'department.created', entity: 'departments', entityId: dept.id, newValue: { name: dept.name, code: dept.code } });

    res.status(201).json({ department: dept });
  } catch (err) {
    console.error('[departments:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'A department with this name, code, or cost center already exists' });
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const allowed = ['name', 'description', 'head_employee_id', 'code', 'cost_center', 'location', 'budget', 'status', 'parent_department_id', 'granted_roles'];
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

// ── delete — destructive, routed through the resolved approval chain unless owner ──
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
      await logAction({ staffId: req.staff.id, action: 'department.deleted', entity: 'departments', entityId: deleted.id, oldValue: { name: deleted.name } });
      return res.json({ department: deleted });
    }

    const chain = await buildDepartmentChain(dept.id, req.staff.id);
    const request = await createApprovalRequest({
      actionType: 'department.delete',
      targetType: 'department',
      targetId: dept.id,
      targetLabel: dept.name,
      requestedBy: req.staff.id,
      reason: req.body.reason || null,
      chain,
    });

    res.status(202).json({
      pending: true,
      request,
      message: `Deletion of "${dept.name}" requested — next approver: ${chain[0].label}.`,
    });
  } catch (err) {
    console.error('[departments:delete]', err);
    res.status(500).json({ error: 'Failed to process deletion' });
  }
});

module.exports = router;