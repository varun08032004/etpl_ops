'use strict';

const ledger = require('../ledger');
const { safeQuery } = require('../../db/pool');

const employeeTools = [
  {
    name: 'list_employees',
    description: 'List and search employees with optional filters',
    category: 'hr',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['hr', 'owner', 'admin', 'finance'],
    allowedDepartments: [],
    parameters: {
      status: { type: 'string', required: false, description: 'Filter by employee status' },
      department_id: { type: 'string', required: false, description: 'Filter by department UUID' },
      team_id: { type: 'string', required: false, description: 'Filter by team UUID' },
      search: { type: 'string', required: false, description: 'Search by name, code, or email' },
    },
    execute: async (params, user) => {
      const conditions = [];
      const queryParams = [];

      if (params.status) { queryParams.push(params.status); conditions.push(`e.status = $${queryParams.length}`); }
      if (params.department_id) { queryParams.push(params.department_id); conditions.push(`e.department_id = $${queryParams.length}`); }
      if (params.team_id) { queryParams.push(params.team_id); conditions.push(`e.team_id = $${queryParams.length}`); }
      if (params.search) { queryParams.push(`%${params.search}%`); conditions.push(`(e.full_name ILIKE $${queryParams.length} OR e.employee_code ILIKE $${queryParams.length} OR e.work_email ILIKE $${queryParams.length})`); }

      // Apply permission filtering
      const isPrivileged = ['owner', 'admin', 'hr', 'finance'].includes(user.role);
      if (!isPrivileged && user.staff.employee_id) {
        queryParams.push(user.staff.employee_id);
        conditions.push(`e.id = $${queryParams.length}`);
      }

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
        queryParams
      );
      return { employees: rows };
    },
  },

  {
    name: 'get_employee',
    description: 'Get detailed employee information',
    category: 'hr',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['hr', 'owner', 'admin', 'finance'],
    allowedDepartments: [],
    parameters: {
      employee_id: { type: 'string', required: true, description: 'Employee UUID' },
    },
    execute: async (params, user) => {
      const isPrivileged = ['owner', 'admin', 'hr', 'finance'].includes(user.role);
      const isSelf = user.staff.employee_id === params.employee_id;

      if (!isPrivileged && !isSelf) {
        throw new Error('Not authorized to view this employee');
      }

      const { rows } = await safeQuery(`SELECT * FROM employees WHERE id = $1`, [params.employee_id]);
      if (!rows.length) throw new Error('Employee not found');

      const employee = rows[0];
      if (!isPrivileged && !isSelf) {
        // Remove sensitive fields
        delete employee.ctc_annual;
        delete employee.basic_monthly;
        delete employee.hra_monthly;
        delete employee.other_allowances_monthly;
        delete employee.employer_pf_monthly;
        delete employee.bank_account_number;
        delete employee.bank_ifsc;
      }

      // Check for linked staff account
      const { rows: [linkedAccount] } = await safeQuery(
        `SELECT id, email, is_active FROM staff_accounts WHERE employee_id = $1`,
        [params.employee_id]
      );
      employee.linked_staff_account = linkedAccount || null;

      return { employee };
    },
  },

  {
    name: 'get_leave_balances',
    description: 'Get leave balances for an employee',
    category: 'hr',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['hr', 'owner', 'admin', 'finance'],
    allowedDepartments: [],
    parameters: {
      employee_id: { type: 'string', required: true, description: 'Employee UUID' },
    },
    execute: async (params, user) => {
      const isPrivileged = ['owner', 'admin', 'hr'].includes(user.role);
      const isSelf = user.staff.employee_id === params.employee_id;

      if (!isPrivileged && !isSelf) {
        throw new Error('Not authorized to view leave balances');
      }

      const { rows } = await safeQuery(
        `SELECT e.leave_balance_annual, e.leave_balance_sick,
                lr.*, lt.name AS leave_type_name
         FROM employees e
         LEFT JOIN leave_requests lr ON lr.employee_id = e.id
         LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
         WHERE e.id = $1
         ORDER BY lr.start_date DESC`,
        [params.employee_id]
      );

      return { leaveBalances: rows };
    },
  },

  {
    name: 'get_attendance',
    description: 'Get attendance records for an employee',
    category: 'hr',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['hr', 'owner', 'admin', 'finance'],
    allowedDepartments: [],
    parameters: {
      employee_id: { type: 'string', required: true, description: 'Employee UUID' },
      from: { type: 'string', required: false, description: 'Start date (YYYY-MM-DD)' },
      to: { type: 'string', required: false, description: 'End date (YYYY-MM-DD)' },
    },
    execute: async (params, user) => {
      const isPrivileged = ['owner', 'admin', 'hr'].includes(user.role);
      const isSelf = user.staff.employee_id === params.employee_id;

      if (!isPrivileged && !isSelf) {
        throw new Error('Not authorized to view attendance');
      }

      const conditions = ['employee_id = $1'];
      const queryParams = [params.employee_id];
      if (params.from) { queryParams.push(params.from); conditions.push(`work_date >= $${queryParams.length}`); }
      if (params.to) { queryParams.push(params.to); conditions.push(`work_date <= $${queryParams.length}`); }

      const { rows } = await safeQuery(
        `SELECT * FROM attendance_records WHERE ${conditions.join(' AND ')} ORDER BY work_date DESC LIMIT 500`,
        queryParams
      );
      return { attendance: rows };
    },
  },

  {
    name: 'create_employee',
    description: 'Create a new employee (onboarding)',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: true,
    destructive: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    sensitiveFields: ['ctc_annual', 'basic_monthly', 'hra_monthly', 'bank_account_number', 'bank_ifsc', 'pan_number'],
    parameters: {
      full_name: { type: 'string', required: true },
      date_of_joining: { type: 'string', required: true, description: 'YYYY-MM-DD' },
      personal_email: { type: 'string', required: false },
      work_email: { type: 'string', required: false },
      phone: { type: 'string', required: false },
      gender: { type: 'string', required: false },
      date_of_birth: { type: 'string', required: false, description: 'YYYY-MM-DD' },
      address_line: { type: 'string', required: false },
      city: { type: 'string', required: false },
      state: { type: 'string', required: false },
      pincode: { type: 'string', required: false },
      pan_number: { type: 'string', required: false },
      department_id: { type: 'string', required: false },
      team_id: { type: 'string', required: false },
      designation_id: { type: 'string', required: false },
      manager_id: { type: 'string', required: false },
      employment_type: { type: 'string', required: false, enum: ['full_time', 'part_time', 'contract', 'intern'] },
      ctc_annual: { type: 'number', required: false },
      basic_monthly: { type: 'number', required: false },
      hra_monthly: { type: 'number', required: false },
      other_allowances_monthly: { type: 'number', required: false },
      employer_pf_monthly: { type: 'number', required: false },
      bank_account_number: { type: 'string', required: false },
      bank_ifsc: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      // Generate next employee_code
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
           bank_account_number, bank_ifsc
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
         RETURNING *`,
        [
          next_code, params.full_name, params.personal_email || null, params.work_email || null, params.phone || null,
          params.gender || null, params.date_of_birth || null,
          params.address_line || null, params.city || null, params.state || null, params.pincode || null, params.pan_number || null,
          params.department_id || null, params.team_id || null, params.designation_id || null, params.manager_id || null,
          params.employment_type || 'full_time', params.date_of_joining,
          params.ctc_annual || null, params.basic_monthly || null, params.hra_monthly || null,
          params.other_allowances_monthly || null, params.employer_pf_monthly || 0,
          params.bank_account_number || null, params.bank_ifsc || null,
        ]
      );

      return { employee, message: `Employee ${employee.full_name} created successfully with code ${employee.employee_code}` };
    },
  },

  {
    name: 'update_employee',
    description: 'Update employee information',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: true,
    destructive: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    sensitiveFields: ['ctc_annual', 'basic_monthly', 'hra_monthly', 'bank_account_number', 'bank_ifsc'],
    parameters: {
      employee_id: { type: 'string', required: true },
      full_name: { type: 'string', required: false },
      personal_email: { type: 'string', required: false },
      work_email: { type: 'string', required: false },
      phone: { type: 'string', required: false },
      gender: { type: 'string', required: false },
      date_of_birth: { type: 'string', required: false },
      address_line: { type: 'string', required: false },
      city: { type: 'string', required: false },
      state: { type: 'string', required: false },
      pincode: { type: 'string', required: false },
      pan_number: { type: 'string', required: false },
      department_id: { type: 'string', required: false },
      team_id: { type: 'string', required: false },
      designation_id: { type: 'string', required: false },
      manager_id: { type: 'string', required: false },
      employment_type: { type: 'string', required: false },
      ctc_annual: { type: 'number', required: false },
      basic_monthly: { type: 'number', required: false },
      hra_monthly: { type: 'number', required: false },
      other_allowances_monthly: { type: 'number', required: false },
      employer_pf_monthly: { type: 'number', required: false },
      bank_account_number: { type: 'string', required: false },
      bank_ifsc: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const { employee_id, ...updates } = params;
      const allowed = [
        'full_name', 'personal_email', 'work_email', 'phone', 'gender', 'date_of_birth',
        'address_line', 'city', 'state', 'pincode', 'pan_number',
        'department_id', 'team_id', 'designation_id', 'manager_id', 'employment_type',
        'ctc_annual', 'basic_monthly', 'hra_monthly', 'other_allowances_monthly', 'employer_pf_monthly',
        'bank_account_number', 'bank_ifsc',
      ];

      const sets = [];
      const queryParams = [];
      for (const key of allowed) {
        if (key in updates) {
          let value = updates[key];
          if (value === '') value = null;
          queryParams.push(value);
          sets.push(`${key} = $${queryParams.length}`);
        }
      }
      if (!sets.length) throw new Error('No valid fields to update');

      queryParams.push(employee_id);
      const { rows } = await safeQuery(
        `UPDATE employees SET ${sets.join(', ')} WHERE id = $${queryParams.length} RETURNING *`,
        queryParams
      );
      if (!rows.length) throw new Error('Employee not found');
      return { employee: rows[0] };
    },
  },

  {
    name: 'exit_employee',
    description: 'Offboard an employee (exit)',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: true,
    destructive: true,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      employee_id: { type: 'string', required: true },
      exit_date: { type: 'string', required: true, description: 'YYYY-MM-DD' },
      reason: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const isOwner = user.role === 'owner';
      const isHR = user.role === 'hr';

      // For owner/hr: immediate. For admin: requires approval chain.
      if (isOwner || isHR) {
        const { rows } = await safeQuery(
          `UPDATE employees SET status = 'exited', date_of_exit = $1, exit_reason = $2 WHERE id = $3 RETURNING id, full_name, status`,
          [params.exit_date, params.reason || null, params.employee_id]
        );
        if (!rows.length) throw new Error('Employee not found');

        await safeQuery(`UPDATE staff_accounts SET is_active = false WHERE employee_id = $1`, [params.employee_id]);
        return { employee: rows[0], message: `Employee ${rows[0].full_name} exited successfully` };
      } else {
        throw new Error('Only owner/hr can exit employees directly. Admin must use approval chain.');
      }
    },
  },

  {
    name: 'reinstate_employee',
    description: 'Reinstate an exited employee',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: true,
    destructive: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      employee_id: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows } = await safeQuery(
        `UPDATE employees SET status = 'active', date_of_exit = NULL, exit_reason = NULL
         WHERE id = $1 AND status = 'exited' RETURNING id, full_name, status`,
        [params.employee_id]
      );
      if (!rows.length) throw new Error('Employee not found, or is not currently exited');

      const { rows: [reactivatedLogin] } = await safeQuery(
        `UPDATE staff_accounts SET is_active = true WHERE employee_id = $1 RETURNING id, email`,
        [params.employee_id]
      );

      return { employee: rows[0], reactivated_login: reactivatedLogin || null, message: `Employee ${rows[0].full_name} reinstated successfully` };
    },
  },

  {
    name: 'create_leave_request',
    description: 'Submit a leave request',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['employee', 'hr', 'owner', 'admin', 'manager'],
    allowedDepartments: [],
    parameters: {
      employee_id: { type: 'string', required: true },
      leave_type_id: { type: 'string', required: true },
      start_date: { type: 'string', required: true, description: 'YYYY-MM-DD' },
      end_date: { type: 'string', required: true, description: 'YYYY-MM-DD' },
      reason: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const isSelf = user.staff.employee_id === params.employee_id;
      const isPrivileged = ['owner', 'admin', 'hr'].includes(user.role);
      if (!isSelf && !isPrivileged) throw new Error('Can only request leave for yourself');

      const numDays = (new Date(params.end_date) - new Date(params.start_date)) / 86400000 + 1;
      const { rows: [leave] } = await safeQuery(
        `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, num_days, reason)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [params.employee_id, params.leave_type_id, params.start_date, params.end_date, numDays, params.reason || null]
      );
      return { leave, message: 'Leave request submitted successfully' };
    },
  },

  {
    name: 'decide_leave_request',
    description: 'Approve or reject a leave request',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      leave_id: { type: 'string', required: true },
      decision: { type: 'string', required: true, enum: ['approved', 'rejected'] },
    },
    execute: async (params, user) => {
      const { rows: [leaveRequest] } = await safeQuery(`SELECT employee_id FROM leave_requests WHERE id = $1`, [params.leave_id]);
      if (!leaveRequest) throw new Error('Leave request not found');

      const { rows: [requester] } = await safeQuery(`SELECT manager_id, department_id FROM employees WHERE id = $1`, [leaveRequest.employee_id]);
      let isAuthorized = ['owner', 'admin', 'hr'].includes(user.role) || (user.effectiveRoles || []).includes('hr');
      if (!isAuthorized && user.staff.employee_id && requester) {
        isAuthorized = user.staff.employee_id === requester.manager_id;
        if (!isAuthorized && requester.department_id) {
          const { rows: [dept] } = await safeQuery(`SELECT head_employee_id FROM departments WHERE id = $1`, [requester.department_id]);
          isAuthorized = dept?.head_employee_id === user.staff.employee_id;
        }
      }
      if (!isAuthorized) throw new Error('Not authorized to decide on this request');

      const { rows } = await safeQuery(
        `UPDATE leave_requests SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3 RETURNING *`,
        [params.decision, user.staff.id, params.leave_id]
      );
      if (!rows.length) throw new Error('Leave request not found');

      if (params.decision === 'approved') {
        const { rows: [lt] } = await safeQuery(`SELECT name FROM leave_types WHERE id = (SELECT leave_type_id FROM leave_requests WHERE id = $1)`, [params.leave_id]);
        const col = /sick/i.test(lt?.name) ? 'leave_balance_sick' : /annual/i.test(lt?.name) ? 'leave_balance_annual' : null;
        if (col) {
          await safeQuery(`UPDATE employees SET ${col} = GREATEST(0, ${col} - $1) WHERE id = $2`, [rows[0].num_days, rows[0].employee_id]);
        }
      }
      return { leave: rows[0] };
    },
  },
];

module.exports = employeeTools;