'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { fireEvent } = require('../services/automationEngine');
const { logAction } = require('../services/auditLog');
const { registerApprovalAction, createApprovalRequest } = require('../services/approvals');
const { buildEmployeeActionChain } = require('../services/approvalChain');

router.use(authenticate);

// The actual exit — deactivates status AND their login. Run either
// immediately (owner/hr, below) or later by approveRequest() once the
// Founder signs off (the admin-initiated path). Audit logging happens
// inside approveRequest() for the admin path, and explicitly here for the
// owner/hr-immediate path.
async function exitEmployee(employeeId, payload) {
  const { exit_date, reason } = payload || {};
  const { rows } = await safeQuery(
    `UPDATE employees SET status = 'exited', date_of_exit = $1, exit_reason = $2 WHERE id = $3 RETURNING id, full_name, status`,
    [exit_date, reason || null, employeeId]
  );
  if (rows.length) {
    await safeQuery(`UPDATE staff_accounts SET is_active = false WHERE employee_id = $1`, [employeeId]);
  }
  return rows[0];
}
registerApprovalAction('employee.exit', (targetId, payload) => exitEmployee(targetId, payload));

// ── self-service: resolve the logged-in staff member's own employee record ──
// Must be defined BEFORE the /:id routes below, or Express would treat "me" as an :id.
router.get('/me', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(404).json({ error: 'This login is not linked to an employee record' });
    }
    const { rows: [employee] } = await safeQuery(
      `SELECT e.*, d.name AS department, des.title AS designation, t.name AS team
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN designations des ON des.id = e.designation_id
       LEFT JOIN teams t ON t.id = e.team_id
       WHERE e.id = $1`,
      [req.staff.employee_id]
    );
    if (!employee) return res.status(404).json({ error: 'Employee record not found' });
    res.json({ employee }); // full compensation visible — this IS the owner viewing their own record
  } catch (err) {
    console.error('[employees:me]', err);
    res.status(500).json({ error: 'Failed to fetch your profile' });
  }
});

router.get('/me/leave', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'This login is not linked to an employee record' });
    const { rows } = await safeQuery(
      `SELECT lr.*, lt.name AS leave_type_name FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.employee_id = $1 ORDER BY lr.start_date DESC`,
      [req.staff.employee_id]
    );
    res.json({ leaveRequests: rows });
  } catch (err) {
    console.error('[employees:me:leave]', err);
    res.status(500).json({ error: 'Failed to fetch your leave requests' });
  }
});

router.get('/leave-types', async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM leave_types ORDER BY name`);
    res.json({ leaveTypes: rows });
  } catch (err) {
    console.error('[employees:leave-types]', err);
    res.status(500).json({ error: 'Failed to fetch leave types' });
  }
});

// ── list / search employees ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, department_id, team_id, search } = req.query;
    const conditions = [];
    const params = [];

    if (status) { params.push(status); conditions.push(`e.status = $${params.length}`); }
    if (department_id) { params.push(department_id); conditions.push(`e.department_id = $${params.length}`); }
    if (team_id) { params.push(team_id); conditions.push(`e.team_id = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(e.full_name ILIKE $${params.length} OR e.employee_code ILIKE $${params.length} OR e.work_email ILIKE $${params.length})`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(
      `SELECT e.id, e.employee_code, e.full_name, e.work_email, e.status, e.employment_type,
              e.date_of_joining, e.department_id, e.team_id,
              d.name AS department, des.title AS designation, t.name AS team
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN designations des ON des.id = e.designation_id
       LEFT JOIN teams t ON t.id = e.team_id
       ${where}
       ORDER BY e.created_at DESC`,
      params
    );
    res.json({ employees: rows });
  } catch (err) {
    console.error('[employees:list]', err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// ── get single employee (full detail — CTC visible to hr/finance/admin/self only) ──
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM employees WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });

    const employee = rows[0];
    const isSelf = req.staff.employee_id === employee.id;
    const canSeeComp = isSelf || ['owner', 'admin', 'hr', 'finance'].includes(req.staff.role);

    if (!canSeeComp) {
      delete employee.ctc_annual;
      delete employee.basic_monthly;
      delete employee.hra_monthly;
      delete employee.other_allowances_monthly;
      delete employee.employer_pf_monthly;
      delete employee.bank_account_number;
      delete employee.bank_ifsc;
    }

    // Flags whether this employee already has a staff login, and its email —
    // powers a "Create login" shortcut on the employee detail page.
    const { rows: [linkedAccount] } = await safeQuery(
      `SELECT id, email, is_active FROM staff_accounts WHERE employee_id = $1`,
      [req.params.id]
    );
    employee.linked_staff_account = linkedAccount || null;

    res.json({ employee });
  } catch (err) {
    console.error('[employees:get]', err);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// ── create employee (onboarding) ───────────────────────────────────────────
router.post('/', requireRole('hr'), async (req, res) => {
  try {
    const b = req.body;
    if (!b.full_name || !b.date_of_joining) {
      return res.status(400).json({ error: 'full_name and date_of_joining are required' });
    }

    // Generate next employee_code: ET-EMP-0001, 0002, ...
    const { rows: [{ next_code }] } = await safeQuery(
      `SELECT 'ET-EMP-' || LPAD((COALESCE(MAX(SUBSTRING(employee_code FROM '\\d+$')::int), 0) + 1)::text, 4, '0') AS next_code
       FROM employees`
    );

    const { rows: [employee] } = await safeQuery(
      `INSERT INTO employees (
         employee_code, full_name, personal_email, work_email, phone, gender, date_of_birth,
         address_line, city, state, pincode, pan_number,
         department_id, team_id, designation_id, manager_id, employment_type, date_of_joining,
         ctc_annual, basic_monthly, hra_monthly, other_allowances_monthly, employer_pf_monthly,
         da_monthly, tax_regime, pf_applicable,
         bank_account_number, bank_ifsc
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
       RETURNING *`,
      [
        next_code, b.full_name, b.personal_email || null, b.work_email || null, b.phone || null,
        b.gender || null, b.date_of_birth || null,
        b.address_line || null, b.city || null, b.state || null, b.pincode || null, b.pan_number || null,
        b.department_id || null, b.team_id || null, b.designation_id || null, b.manager_id || null,
        b.employment_type || 'full_time', b.date_of_joining,
        b.ctc_annual || null, b.basic_monthly || null, b.hra_monthly || null,
        b.other_allowances_monthly || null, b.employer_pf_monthly || 0,
        b.da_monthly || 0, b.tax_regime || 'new', b.pf_applicable !== false,
        b.bank_account_number || null, b.bank_ifsc || null,
      ]
    );

    fireEvent('employee.created', { employeeId: employee.id, employeeName: employee.full_name });

    res.status(201).json({ employee });
  } catch (err) {
    console.error('[employees:create]', err);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// ── update employee ─────────────────────────────────────────────────────────
router.put('/:id', requireRole('hr'), async (req, res) => {
  try {
    const allowed = [
      'full_name', 'personal_email', 'work_email', 'phone', 'gender', 'date_of_birth',
      'address_line', 'city', 'state', 'pincode', 'pan_number',
      'department_id', 'team_id', 'designation_id', 'manager_id', 'employment_type', 'status',
      'ctc_annual', 'basic_monthly', 'hra_monthly', 'other_allowances_monthly', 'employer_pf_monthly',
      'da_monthly', 'tax_regime', 'pf_applicable', 'esic_applicable', 'declared_deductions',
      'bank_account_number', 'bank_ifsc', 'trackpilot_user_id', 'notes',
    ];
    // 'exited' must go through POST /:id/exit — that's what captures exit_date/
    // reason properly and deactivates the linked login, and now what routes
    // through Founder approval for admins. Blocking it here so it can't slip
    // through as a bare status flip that skips all of that.
    if (req.body.status === 'exited') {
      return res.status(400).json({ error: 'Use POST /employees/:id/exit to offboard an employee, not a status update' });
    }
    // Symmetric guard: bringing an exited employee back to any active-ish
    // status here would skip login reactivation and leave date_of_exit /
    // exit_reason stale. That has to go through POST /:id/reinstate instead.
    if ('status' in req.body) {
      const { rows: [current] } = await safeQuery(`SELECT status FROM employees WHERE id = $1`, [req.params.id]);
      if (current?.status === 'exited') {
        return res.status(400).json({ error: 'Use POST /employees/:id/reinstate to bring back an exited employee, not a status update' });
      }
    }

    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        let value = req.body[key];
        if (value === '') value = null; // "Unassigned"/"No manager set" submit '' — must be NULL for UUID columns
        params.push(value);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE employees SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json({ employee: rows[0] });
  } catch (err) {
    console.error('[employees:update]', err);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// ── offboard (exit) — never hard-delete an employee, preserves payroll/leave history ──
// Owner/HR: immediate — offboarding is HR's normal day-to-day work.
// Admin: creates a Founder-approval request instead — an admin exiting
// someone deactivates their login and freezes their record, which fits the
// "admin proposes, Founder approves" model for destructive actions.
router.post('/:id/exit', requireRole('hr'), async (req, res) => {
  try {
    const { exit_date, reason } = req.body;
    if (!exit_date) return res.status(400).json({ error: 'exit_date is required' });

    if (req.staff.role === 'owner' || req.staff.role === 'hr') {
      const employee = await exitEmployee(req.params.id, { exit_date, reason });
      if (!employee) return res.status(404).json({ error: 'Employee not found' });

      await logAction({ staffId: req.staff.id, action: 'employee.exited', entity: 'employees', entityId: employee.id, newValue: { full_name: employee.full_name, exit_date } });

      return res.json({ employee });
    }

    // admin path: request instead of act
    const { rows: [emp] } = await safeQuery(`SELECT id, full_name FROM employees WHERE id = $1`, [req.params.id]);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const chain = await buildEmployeeActionChain(emp.id, req.staff.id);

    const request = await createApprovalRequest({
      actionType: 'employee.exit',
      targetType: 'employee',
      targetId: emp.id,
      targetLabel: emp.full_name,
      requestedBy: req.staff.id,
      reason: reason || null,
      payload: { exit_date, reason },
      chain,
    });

    res.status(202).json({
      pending: true,
      request,
      message: `Exit for ${emp.full_name} requested — next approver: ${chain[0].label}.`,
    });
  } catch (err) {
    console.error('[employees:exit]', err);
    res.status(500).json({ error: 'Failed to process exit' });
  }
});

// ── reinstate — undo an accidental exit. Immediate for hr/admin/owner alike,
// since this corrects a mistake rather than performing a new destructive
// action, so it's not routed through Founder approval. Clears date_of_exit /
// exit_reason and reactivates the linked login in the same step so the two
// can't end up out of sync (employee active but login still off, or vice versa).
// Department/team/designation/manager are left exactly as they were — HR can
// change those afterwards via Edit if the employee is coming back into a
// different role.
router.post('/:id/reinstate', requireRole('hr'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE employees SET status = 'active', date_of_exit = NULL, exit_reason = NULL
       WHERE id = $1 AND status = 'exited' RETURNING id, full_name, status`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Employee not found, or is not currently exited' });

    const { rows: [reactivatedLogin] } = await safeQuery(
      `UPDATE staff_accounts SET is_active = true WHERE employee_id = $1 RETURNING id, email`,
      [req.params.id]
    );

    await logAction({
      staffId: req.staff.id, action: 'employee.reinstated', entity: 'employees', entityId: rows[0].id,
      newValue: { full_name: rows[0].full_name, reactivated_login: reactivatedLogin?.email || null },
    });

    res.json({ employee: rows[0], reactivated_login: reactivatedLogin || null });
  } catch (err) {
    console.error('[employees:reinstate]', err);
    res.status(500).json({ error: 'Failed to reinstate employee' });
  }
});

// ── leave requests ───────────────────────────────────────────────────────────
router.post('/:id/leave', async (req, res) => {
  try {
    const isSelf = req.staff.employee_id === req.params.id;
    if (!isSelf && !['owner', 'admin', 'hr'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Can only request leave for yourself' });
    }
    const { leave_type_id, start_date, end_date, reason } = req.body;
    if (!leave_type_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'leave_type_id, start_date, end_date are required' });
    }
    const numDays = (new Date(end_date) - new Date(start_date)) / 86400000 + 1;

    const { rows: [leave] } = await safeQuery(
      `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, num_days, reason)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, leave_type_id, start_date, end_date, numDays, reason || null]
    );
    res.status(201).json({ leave });
  } catch (err) {
    console.error('[employees:leave:create]', err);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
});

router.post('/leave/:leaveId/decision', requireRole('hr'), async (req, res) => {
  try {
    const { decision } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }
    const { rows } = await safeQuery(
      `UPDATE leave_requests SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3 RETURNING *`,
      [decision, req.staff.id, req.params.leaveId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Leave request not found' });

    if (decision === 'approved') {
      const { rows: [empInfo] } = await safeQuery(`SELECT full_name FROM employees WHERE id = $1`, [rows[0].employee_id]);
      fireEvent('leave.approved', {
        employee_name: empInfo?.full_name, start_date: rows[0].start_date?.toISOString().slice(0,10),
        end_date: rows[0].end_date?.toISOString().slice(0,10), link: `/employees/${rows[0].employee_id}`,
      });
      const lr = rows[0];
      const { rows: [lt] } = await safeQuery(`SELECT name FROM leave_types WHERE id = $1`, [lr.leave_type_id]);
      const col = /sick/i.test(lt?.name) ? 'leave_balance_sick' : /annual/i.test(lt?.name) ? 'leave_balance_annual' : null;
      if (col) {
        await safeQuery(`UPDATE employees SET ${col} = GREATEST(0, ${col} - $1) WHERE id = $2`, [lr.num_days, lr.employee_id]);
      }
    }
    res.json({ leave: rows[0] });
  } catch (err) {
    console.error('[employees:leave:decision]', err);
    res.status(500).json({ error: 'Failed to process leave decision' });
  }
});

module.exports = router;