-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Deferred Revenue & Prepaid Expenses for Proper Accrual Accounting
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add Deferred Revenue account (liability) and Prepaid Expenses account (asset)
INSERT INTO chart_of_accounts (code, name, account_type, is_group) VALUES
('2700', 'Deferred Revenue',                 'liability', false),
('1500', 'Prepaid Expenses',                 'asset', false)
ON CONFLICT (code) DO NOTHING;

-- 2. Revenue Recognition Schedules (for subscription invoices)
CREATE TABLE IF NOT EXISTS revenue_recognition_schedules (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id            UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  total_amount          NUMERIC(14,2) NOT NULL,
  recognized_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  frequency             VARCHAR(20) NOT NULL DEFAULT 'monthly',
  next_recognition_date DATE NOT NULL,
  is_complete           BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_sched_next_date ON revenue_recognition_schedules(next_recognition_date);
CREATE INDEX IF NOT EXISTS idx_revenue_sched_invoice ON revenue_recognition_schedules(invoice_id);

-- 3. Prepaid Expense Schedules (for multi-year payments like domain)
CREATE TABLE IF NOT EXISTS prepaid_expense_schedules (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id               UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  total_amount          NUMERIC(14,2) NOT NULL,
  expensed_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  expense_account_id    UUID NOT NULL REFERENCES chart_of_accounts(id),
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  frequency             VARCHAR(20) NOT NULL DEFAULT 'monthly',
  next_expense_date     DATE NOT NULL,
  is_complete           BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prepaid_sched_next_date ON prepaid_expense_schedules(next_expense_date);
CREATE INDEX IF NOT EXISTS idx_prepaid_sched_bill ON prepaid_expense_schedules(bill_id);

-- 4. Monthly Accrual Job Log
CREATE TABLE IF NOT EXISTS accrual_job_log (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type              VARCHAR(30) NOT NULL,
  period_start          DATE NOT NULL,
  period_end            DATE NOT NULL,
  schedules_processed   INTEGER DEFAULT 0,
  total_amount          NUMERIC(14,2) DEFAULT 0,
  journal_entry_ids     UUID[],
  status                VARCHAR(20) NOT NULL DEFAULT 'completed',
  error_message         TEXT,
  created_by            UUID REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accrual_log_period ON accrual_job_log(period_start, period_end);

-- 5. Add invoice_type to distinguish subscription vs one-time
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(30) DEFAULT 'one_time';
-- Values: 'one_time', 'subscription', 'recurring'

-- 6. Add prepaid_flag to bills to mark multi-year prepaid expenses
ALTER TABLE bills ADD COLUMN IF NOT EXISTS is_prepaid BOOLEAN DEFAULT FALSE;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS prepaid_end_date DATE;

-- 7. RLS Policies
ALTER TABLE revenue_recognition_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE prepaid_expense_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE accrual_job_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY revenue_sched_all ON revenue_recognition_schedules FOR ALL USING (true);
CREATE POLICY prepaid_sched_all ON prepaid_expense_schedules FOR ALL USING (true);
CREATE POLICY accrual_log_all ON accrual_job_log FOR ALL USING (true);

-- 8. Data cleanup: Remove duplicate bills (keep first created per vendor/date/amount/description)
-- Run this manually after review:
-- DELETE FROM bills 
-- WHERE id NOT IN (
--   SELECT MIN(id) FROM bills 
--   GROUP BY vendor_id, bill_date, total_amount, description
-- );