-- ============================================================================
-- COMPANY SETTINGS & DEFAULTS (seeded once, editable by admins)
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_settings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key                 VARCHAR(100) NOT NULL UNIQUE,
    value               JSONB NOT NULL,
    description         TEXT,
    category            VARCHAR(50) NOT NULL,
    is_system           BOOLEAN DEFAULT FALSE,
    updated_by          UUID REFERENCES staff_accounts(id),
    updated_at          TIMESTAMP DEFAULT NOW()
);

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'working_days', '[1,2,3,4,5]', 'Working days: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun', 'attendance', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'working_days');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'work_start_time', '"09:30"', 'Default work start time (24hr format)', 'attendance', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'work_start_time');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'work_end_time', '"19:00"', 'Default work end time (24hr format)', 'attendance', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'work_end_time');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'daily_work_hours', '9.5', 'Standard daily working hours', 'attendance', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'daily_work_hours');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'late_threshold_minutes', '15', 'Minutes after start time considered late', 'attendance', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'late_threshold_minutes');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'early_departure_threshold_minutes', '15', 'Minutes before end time considered early departure', 'attendance', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'early_departure_threshold_minutes');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'monthly_paid_leaves', '2', 'Paid leaves granted per month (accrual)', 'leave', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'monthly_paid_leaves');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'annual_leaves_per_year', '24', 'Total annual leave days per year (12 months * 2)', 'leave', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'annual_leaves_per_year');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'sick_leaves_per_year', '12', 'Sick leave days per year (1 per month)', 'leave', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'sick_leaves_per_year');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'casual_leaves_per_year', '0', 'Casual leave days per year', 'leave', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'casual_leaves_per_year');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'leave_accrual_frequency', '"monthly"', 'How leave is accrued: monthly, quarterly, yearly', 'leave', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'leave_accrual_frequency');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'leave_approval_levels', '[{"role": "manager", "level": 1}, {"role": "hr", "level": 2}, {"role": "admin", "level": 3}]', 'Approval hierarchy for leave requests', 'leave', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'leave_approval_levels');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'expense_approval_levels', '[{"role": "manager", "level": 1}, {"role": "finance", "level": 2}, {"role": "admin", "level": 3}]', 'Approval hierarchy for expense claims', 'expense', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'expense_approval_levels');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'payroll_cutoff_day', '25', 'Day of month when payroll is cut off', 'payroll', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'payroll_cutoff_day');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'payroll_processing_day', '1', 'Day of month when payroll is processed', 'payroll', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'payroll_processing_day');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'company_name', '"EtherTrack Technologies"', 'Company legal name', 'general', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'company_name');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'company_code', '"ETPL"', 'Company code for agent/app', 'general', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'company_code');

INSERT INTO company_settings (key, value, description, category, is_system)
SELECT 'timezone', '"Asia/Kolkata"', 'Company timezone', 'general', true
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE key = 'timezone');

-- Default leave types
INSERT INTO leave_types (name, days_per_year, is_paid)
SELECT 'Annual Leave', 24, true
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Annual Leave');

INSERT INTO leave_types (name, days_per_year, is_paid)
SELECT 'Sick Leave', 12, true
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Sick Leave');

INSERT INTO leave_types (name, days_per_year, is_paid)
SELECT 'Casual Leave', 0, true
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Casual Leave');

INSERT INTO leave_types (name, days_per_year, is_paid)
SELECT 'Maternity Leave', 180, true
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Maternity Leave');

INSERT INTO leave_types (name, days_per_year, is_paid)
SELECT 'Paternity Leave', 15, true
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Paternity Leave');

INSERT INTO leave_types (name, days_per_year, is_paid)
SELECT 'Unpaid Leave', 0, false
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Unpaid Leave');

INSERT INTO leave_types (name, days_per_year, is_paid)
SELECT 'Compensatory Off', 0, true
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Compensatory Off');

-- Attendance policies
CREATE TABLE IF NOT EXISTS attendance_policies (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(100) NOT NULL UNIQUE,
    working_days        INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    work_start_time     TIME NOT NULL DEFAULT '09:30',
    work_end_time       TIME NOT NULL DEFAULT '19:00',
    daily_hours         NUMERIC(4,2) NOT NULL DEFAULT 9.5,
    late_threshold      INTERVAL NOT NULL DEFAULT '15 minutes',
    early_departure_threshold INTERVAL NOT NULL DEFAULT '15 minutes',
    break_duration      INTERVAL NOT NULL DEFAULT '1 hour',
    grace_period        INTERVAL NOT NULL DEFAULT '5 minutes',
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

INSERT INTO attendance_policies (name, working_days, work_start_time, work_end_time, daily_hours, late_threshold, early_departure_threshold, break_duration, grace_period, is_active)
SELECT 'default', '{1,2,3,4,5}', '09:30', '19:00', 9.5, '15 minutes', '15 minutes', '1 hour', '5 minutes', true
WHERE NOT EXISTS (SELECT 1 FROM attendance_policies WHERE name = 'default');

-- Leave policies
CREATE TABLE IF NOT EXISTS leave_policies (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    leave_type_id       UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    accrual_per_month   NUMERIC(5,2) NOT NULL DEFAULT 0,
    max_accrual         NUMERIC(5,2),
    carry_forward_limit NUMERIC(5,2),
    min_balance_to_apply NUMERIC(5,2) DEFAULT 0,
    requires_approval   BOOLEAN DEFAULT TRUE,
    approval_levels     JSONB DEFAULT '[{"role": "manager", "level": 1}]',
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(leave_type_id)
);

INSERT INTO leave_policies (leave_type_id, accrual_per_month, max_accrual, carry_forward_limit, requires_approval, approval_levels)
SELECT id, 2.0, 30, 10, true, '[{"role": "manager", "level": 1}, {"role": "hr", "level": 2}]' FROM leave_types WHERE name = 'Annual Leave'
  AND NOT EXISTS (SELECT 1 FROM leave_policies WHERE leave_type_id = leave_types.id);

INSERT INTO leave_policies (leave_type_id, accrual_per_month, max_accrual, carry_forward_limit, requires_approval, approval_levels)
SELECT id, 1.0, 15, 5, true, '[{"role": "manager", "level": 1}]' FROM leave_types WHERE name = 'Sick Leave'
  AND NOT EXISTS (SELECT 1 FROM leave_policies WHERE leave_type_id = leave_types.id);

INSERT INTO leave_policies (leave_type_id, accrual_per_month, max_accrual, carry_forward_limit, requires_approval, approval_levels)
SELECT id, 0, 0, 0, true, '[{"role": "manager", "level": 1}]' FROM leave_types WHERE name = 'Casual Leave'
  AND NOT EXISTS (SELECT 1 FROM leave_policies WHERE leave_type_id = leave_types.id);

INSERT INTO leave_policies (leave_type_id, accrual_per_month, max_accrual, carry_forward_limit, requires_approval, approval_levels)
SELECT id, 0, 180, 0, true, '[{"role": "manager", "level": 1}, {"role": "hr", "level": 2}, {"role": "admin", "level": 3}]' FROM leave_types WHERE name = 'Maternity Leave'
  AND NOT EXISTS (SELECT 1 FROM leave_policies WHERE leave_type_id = leave_types.id);

INSERT INTO leave_policies (leave_type_id, accrual_per_month, max_accrual, carry_forward_limit, requires_approval, approval_levels)
SELECT id, 0, 15, 0, true, '[{"role": "manager", "level": 1}, {"role": "hr", "level": 2}]' FROM leave_types WHERE name = 'Paternity Leave'
  AND NOT EXISTS (SELECT 1 FROM leave_policies WHERE leave_type_id = leave_types.id);

-- Approval workflows
CREATE TABLE IF NOT EXISTS approval_workflows (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_type       VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    levels              JSONB NOT NULL DEFAULT '[]',
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

INSERT INTO approval_workflows (workflow_type, name, description, levels)
SELECT 'leave', 'Standard Leave Approval', 'Default leave approval flow', '[{"role": "manager", "level": 1, "conditions": {}}, {"role": "hr", "level": 2, "conditions": {"days_gt": 5}}, {"role": "admin", "level": 3, "conditions": {"days_gt": 10}}]'
WHERE NOT EXISTS (SELECT 1 FROM approval_workflows WHERE workflow_type = 'leave');

INSERT INTO approval_workflows (workflow_type, name, description, levels)
SELECT 'expense', 'Expense Claim Approval', 'Default expense claim approval flow', '[{"role": "manager", "level": 1, "conditions": {}}, {"role": "finance", "level": 2, "conditions": {"amount_gt": 5000}}, {"role": "admin", "level": 3, "conditions": {"amount_gt": 25000}}]'
WHERE NOT EXISTS (SELECT 1 FROM approval_workflows WHERE workflow_type = 'expense');

INSERT INTO approval_workflows (workflow_type, name, description, levels)
SELECT 'reimbursement', 'Reimbursement Approval', 'Default reimbursement approval flow', '[{"role": "manager", "level": 1, "conditions": {}}, {"role": "finance", "level": 2, "conditions": {}}, {"role": "admin", "level": 3, "conditions": {"amount_gt": 50000}}]'
WHERE NOT EXISTS (SELECT 1 FROM approval_workflows WHERE workflow_type = 'reimbursement');