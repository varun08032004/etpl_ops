'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.use(requireRole('admin')); // everything here is owner/admin only, deliberately stricter than finance/hr

// ── audit log ────────────────────────────────────────────────────────────
router.get('/audit-log', async (req, res) => {
  try {
    const { action, staff_id, from, to } = req.query;
    const conditions = [];
    const params = [];
    if (action) { params.push(`%${action}%`); conditions.push(`al.action ILIKE $${params.length}`); }
    if (staff_id) { params.push(staff_id); conditions.push(`al.staff_id = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`al.created_at >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`al.created_at <= $${params.length}::date + 1`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT al.*, sa.email AS staff_email FROM audit_log al
       LEFT JOIN staff_accounts sa ON sa.id = al.staff_id
       ${where} ORDER BY al.created_at DESC LIMIT 200`,
      params
    );
    res.json({ entries: rows });
  } catch (err) {
    console.error('[admin:audit-log]', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ── permissions matrix — static reference, not a dynamic permission engine ─
// This documents what's actually enforced in code (requireRole() calls
// throughout the route files) rather than being a separate source of truth
// that could drift from reality. If you change a requireRole() call, update
// this table to match — it's a reference view, not the thing being enforced.
router.get('/permissions-matrix', (req, res) => {
  const ROLES = ['owner', 'admin', 'hr', 'finance', 'manager', 'employee'];
  const MODULES = [
    { module: 'Dashboard & Analytics', owner: 'full', admin: 'full', hr: 'full', finance: 'full', manager: 'none', employee: 'none' },
    { module: 'People (HR records)', owner: 'full', admin: 'full', hr: 'full', finance: 'view', manager: 'none', employee: 'own record only' },
    { module: 'Compensation data', owner: 'full', admin: 'full', hr: 'full', finance: 'full', manager: 'none', employee: 'own only' },
    { module: 'Sales pipeline', owner: 'full', admin: 'full', hr: 'view', finance: 'full', manager: 'view', employee: 'none' },
    { module: 'Invoices', owner: 'full', admin: 'full', hr: 'none', finance: 'full', manager: 'none', employee: 'none' },
    { module: 'Accounting / Ledger', owner: 'full', admin: 'full', hr: 'none', finance: 'full', manager: 'none', employee: 'none' },
    { module: 'Payroll', owner: 'full', admin: 'full', hr: 'view', finance: 'full', manager: 'none', employee: 'own payslips only' },
    { module: 'Documents (own)', owner: 'full', admin: 'full', hr: 'full', finance: 'full', manager: 'own only', employee: 'own only' },
    { module: 'Team logins (create/deactivate)', owner: 'full', admin: 'full', hr: 'none', finance: 'none', manager: 'none', employee: 'none' },
    { module: 'Role changes', owner: 'can grant any role', admin: 'cannot grant owner', hr: 'none', finance: 'none', manager: 'none', employee: 'none' },
    { module: 'Automation rules (toggle)', owner: 'full', admin: 'full', hr: 'none', finance: 'none', manager: 'none', employee: 'none' },
    { module: 'Platform Sync (run/void)', owner: 'full', admin: 'full', hr: 'none', finance: 'full', manager: 'view records only', employee: 'none' },
    { module: 'Audit Log', owner: 'full', admin: 'full', hr: 'none', finance: 'none', manager: 'none', employee: 'none' },
  ];
  res.json({ roles: ROLES, modules: MODULES });
});

// ── leave approvals (admin) ──────────────────────────────────────────────
router.get('/leave/pending', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT lr.*, lt.name AS leave_type_name, e.full_name AS employee_name, e.employee_code, d.name AS department_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE lr.status = 'pending'
       ORDER BY lr.start_date ASC`
    );
    res.json({ leaveRequests: rows });
  } catch (err) {
    console.error('[admin:leave:pending]', err);
    res.status(500).json({ error: 'Failed to fetch pending leave requests' });
  }
});

router.post('/leave/:leaveId/decision', async (req, res) => {
  try {
    const { decision } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const { rows: [leaveRequest] } = await safeQuery(`SELECT employee_id, leave_type_id, num_days FROM leave_requests WHERE id = $1`, [req.params.id]);
    if (!leaveRequest) return res.status(404).json({ error: 'Leave request not found' });

    const { rows } = await safeQuery(
      `UPDATE leave_requests SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3 RETURNING *`,
      [decision, req.staff.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Leave request not found' });

    if (decision === 'approved') {
      const { rows: [lt] } = await safeQuery(`SELECT name FROM leave_types WHERE id = $1`, [leaveRequest.leave_type_id]);
      const col = /sick/i.test(lt?.name) ? 'leave_balance_sick' : /annual/i.test(lt?.name) ? 'leave_balance_annual' : null;
      if (col) {
        await safeQuery(`UPDATE employees SET ${col} = GREATEST(0, ${col} - $1) WHERE id = $2`, [leaveRequest.num_days, leaveRequest.employee_id]);
      }
    }
    res.json({ leave: rows[0] });
  } catch (err) {
    console.error('[admin:leave:decision]', err);
    res.status(500).json({ error: 'Failed to process leave decision' });
  }
});

// ── delete leave request (admin/owner) ────────────────────────────────
router.delete('/leave/:id', async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM leave_requests WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Leave request not found' });
    res.json({ deleted: true, message: 'Leave request deleted' });
  } catch (err) {
    console.error('[admin:leave:delete]', err);
    res.status(500).json({ error: 'Failed to delete leave request' });
  }
});

// ── expense claims approval (admin) ────────────────────────────────────
router.get('/claims/pending', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT ec.*, e.full_name AS employee_name, e.employee_code, d.name AS department_name
       FROM expense_claims ec
       JOIN employees e ON e.id = ec.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ec.status = 'pending'
       ORDER BY ec.created_at ASC`
    );
    res.json({ claims: rows });
  } catch (err) {
    console.error('[admin:claims:pending]', err);
    res.status(500).json({ error: 'Failed to fetch pending claims' });
  }
});

router.post('/claims/:claimId/decision', async (req, res) => {
  try {
    const { decision } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const { rows } = await safeQuery(
      `UPDATE expense_claims SET status = $1, decided_by = $2, decided_at = NOW() WHERE id = $3 AND status = 'pending' RETURNING *`,
      [decision, req.staff.id, req.params.claimId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Claim not found or already processed' });
    res.json({ claim: rows[0] });
  } catch (err) {
    console.error('[admin:claims:decision]', err);
    res.status(500).json({ error: 'Failed to process claim decision' });
  }
});

// ── delete expense claim (admin/owner) ────────────────────────────────
router.delete('/claims/:id', async (req, res) => {
  try {
    const { rows } = await safeQuery(`DELETE FROM expense_claims WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Expense claim not found' });
    res.json({ deleted: true, message: 'Expense claim deleted' });
  } catch (err) {
    console.error('[admin:claims:delete]', err);
    res.status(500).json({ error: 'Failed to delete expense claim' });
  }
});

module.exports = router;