'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// ── list / search employees ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, department_id, search } = req.query;
    const conditions = [];
    const params = [];

    if (status) { params.push(status); conditions.push(`e.status = $${params.length}`); }
    if (department_id) { params.push(department_id); conditions.push(`e.department_id = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(e.full_name ILIKE $${params.length} OR e.employee_code ILIKE $${params.length} OR e.work_email ILIKE $${params.length})`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(
      `SELECT e.id, e.employee_code, e.full_name, e.work_email, e.status, e.employment_type,
              e.date_of_joining, d.name AS department, des.title AS designation
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN designations des ON des.id = e.designation_id
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
         department_id, designation_id, manager_id, employment_type, date_of_joining,
         ctc_annual, basic_monthly, hra_monthly, other_allowances_monthly, employer_pf_monthly,
         bank_account_number, bank_ifsc
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING id, employee_code, full_name`,
      [
        next_code, b.full_name, b.personal_email || null, b.work_email || null, b.phone || null,
        b.gender || null, b.date_of_birth || null,
        b.address_line || null, b.city || null, b.state || null, b.pincode || null, b.pan_number || null,
        b.department_id || null, b.designation_id || null, b.manager_id || null,
        b.employment_type || 'full_time', b.date_of_joining,
        b.ctc_annual || null, b.basic_monthly || null, b.hra_monthly || null,
        b.other_allowances_monthly || null, b.employer_pf_monthly || 0,
        b.bank_account_number || null, b.bank_ifsc || null,
      ]
    );

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
      'department_id', 'designation_id', 'manager_id', 'employment_type', 'status',
      'ctc_annual', 'basic_monthly', 'hra_monthly', 'other_allowances_monthly', 'employer_pf_monthly',
      'bank_account_number', 'bank_ifsc', 'trackpilot_user_id', 'notes',
    ];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key]);
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
router.post('/:id/exit', requireRole('hr'), async (req, res) => {
  try {
    const { exit_date, reason } = req.body;
    if (!exit_date) return res.status(400).json({ error: 'exit_date is required' });

    const { rows } = await safeQuery(
      `UPDATE employees SET status = 'exited', date_of_exit = $1, exit_reason = $2 WHERE id = $3 RETURNING id, full_name, status`,
      [exit_date, reason || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });

    await safeQuery(`UPDATE staff_accounts SET is_active = false WHERE employee_id = $1`, [req.params.id]);

    res.json({ employee: rows[0] });
  } catch (err) {
    console.error('[employees:exit]', err);
    res.status(500).json({ error: 'Failed to process exit' });
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

    // Deduct from balance if approved and it's a tracked type
    if (decision === 'approved') {
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
