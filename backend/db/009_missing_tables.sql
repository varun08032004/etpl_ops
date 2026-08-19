-- Migration 009: Missing tables referenced by application code but not in schema.sql
-- Run AFTER base schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- EXPENSE CLAIMS -- Employee-submitted reimbursement requests
CREATE TABLE IF NOT EXISTS expense_claims (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id           UUID NOT NULL REFERENCES employees(id),
  category              VARCHAR(150) NOT NULL,
  description           TEXT,
  amount                NUMERIC(14,2) NOT NULL,
  expense_date          DATE NOT NULL,
  receipt_document_id   UUID,
  levels_required       INTEGER NOT NULL DEFAULT 0,
  current_level         INTEGER NOT NULL DEFAULT 0,
  status                VARCHAR(30) NOT NULL DEFAULT 'pending',
  accrual_journal_entry_id UUID REFERENCES journal_entries(id),
  journal_entry_id      UUID REFERENCES journal_entries(id),
  created_by            UUID REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_claims_employee ON expense_claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON expense_claims(status);
CREATE INDEX IF NOT EXISTS idx_expense_claims_level ON expense_claims(current_level);

-- RECURRING EXPENSES
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  VARCHAR(200) NOT NULL,
  vendor_id             UUID REFERENCES parties(id),
  category_id           UUID REFERENCES expense_categories(id),
  frequency             VARCHAR(20) NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','yearly','custom_days')),
  custom_interval_days  INTEGER,
  currency              VARCHAR(10) NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR','USD','EUR','GBP','AUD','SGD')),
  testnet_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  prod_amount           NUMERIC(14,2) NOT NULL DEFAULT 0,
  next_due_date         DATE NOT NULL,
  end_date              DATE,
  reminder_days_before  INTEGER DEFAULT 3,
  approval_status       VARCHAR(30) NOT NULL DEFAULT 'approved',
  is_active             BOOLEAN DEFAULT TRUE,
  created_by            UUID REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due ON recurring_expenses(next_due_date);

-- RECURRING EXPENSE OCCURRENCES
CREATE TABLE IF NOT EXISTS recurring_expense_occurrences (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_expense_id  UUID NOT NULL REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  due_date              DATE NOT NULL,
  amount                NUMERIC(14,2) NOT NULL,
  original_currency     VARCHAR(10),
  original_amount       NUMERIC(14,2),
  exchange_rate         NUMERIC(10,6) DEFAULT 1,
  status                VARCHAR(30) NOT NULL DEFAULT 'upcoming',
  paid_date             DATE,
  bill_id               UUID REFERENCES bills(id),
  reconciled            BOOLEAN DEFAULT FALSE,
  reconciled_at         TIMESTAMP,
  reconciled_by         UUID REFERENCES staff_accounts(id),
  bank_statement_reference VARCHAR(200),
  failure_reason        TEXT,
  failed_at             TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE(recurring_expense_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_status ON recurring_expense_occurrences(status);
CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_due ON recurring_expense_occurrences(due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_reconciled ON recurring_expense_occurrences(reconciled);

-- CATEGORY BUDGETS
CREATE TABLE IF NOT EXISTS category_budgets (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id           UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  monthly_budget_inr    NUMERIC(14,2) NOT NULL,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_id)
);

-- SALES SETTINGS
CREATE TABLE IF NOT EXISTS sales_settings (
  key                   VARCHAR(100) PRIMARY KEY,
  value                 TEXT NOT NULL,
  updated_at            TIMESTAMP DEFAULT NOW()
);

INSERT INTO sales_settings (key, value)
VALUES ('discount_approval_threshold_percent', '15')
ON CONFLICT (key) DO NOTHING;

-- TEAMS
CREATE TABLE IF NOT EXISTS teams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(150) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  team_head_id  UUID REFERENCES employees(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_department ON teams(department_id);
CREATE INDEX IF NOT EXISTS idx_teams_head ON teams(team_head_id);

-- APPROVAL REQUESTS
CREATE TABLE IF NOT EXISTS approval_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type       VARCHAR(50) NOT NULL,
  target_type       VARCHAR(50) NOT NULL,
  target_id         UUID NOT NULL,
  target_label      VARCHAR(200),
  requested_by      UUID NOT NULL REFERENCES staff_accounts(id),
  reason            TEXT,
  payload           JSONB,
  chain             JSONB NOT NULL,
  current_stage     INTEGER NOT NULL DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by       UUID REFERENCES staff_accounts(id),
  reviewed_at       TIMESTAMP,
  rejection_reason  TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_target ON approval_requests(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_current ON approval_requests(current_stage);

-- BANK SYNC STATE
CREATE TABLE IF NOT EXISTS bank_sync_state (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id               UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  last_synced_transaction_date  DATE,
  last_synced_at                TIMESTAMP,
  last_sync_status              VARCHAR(30) DEFAULT 'never',
  last_sync_error               TEXT,
  created_at                    TIMESTAMP DEFAULT NOW(),
  updated_at                    TIMESTAMP DEFAULT NOW(),
  UNIQUE(bank_account_id)
);

-- STAFF NOTIFICATIONS
CREATE TABLE IF NOT EXISTS staff_notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id    UUID NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  link        VARCHAR(500),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_staff ON staff_notifications(staff_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_unread ON staff_notifications(staff_id) WHERE is_read = false;

-- AUTOMATION RULES
CREATE TABLE IF NOT EXISTS automation_rules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(200) NOT NULL,
  trigger_event     VARCHAR(100) NOT NULL,
  condition         JSONB,
  actions           JSONB NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_event, is_active);

-- FX RATE CACHE
CREATE TABLE IF NOT EXISTS fx_rate_cache (
  currency              VARCHAR(10) NOT NULL,
  rate_date             DATE NOT NULL,
  rate_to_inr           NUMERIC(10,6) NOT NULL,
  fetched_at            TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (currency, rate_date)
);

-- RECURRING EXPENSE AUDIT LOG
CREATE TABLE IF NOT EXISTS recurring_expense_audit_log (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_expense_id  UUID NOT NULL REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  action                VARCHAR(50) NOT NULL,
  changed_by            UUID REFERENCES staff_accounts(id),
  before_state          JSONB,
  after_state           JSONB,
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_audit_expense ON recurring_expense_audit_log(recurring_expense_id);
CREATE INDEX IF NOT EXISTS idx_recurring_audit_created ON recurring_expense_audit_log(created_at);

-- EXPENSE BANK TRANSACTIONS
CREATE TABLE IF NOT EXISTS expense_bank_transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id       UUID NOT NULL REFERENCES bank_accounts(id),
  transaction_date      DATE NOT NULL,
  description           TEXT,
  amount                NUMERIC(14,2) NOT NULL,
  external_transaction_id VARCHAR(200),
  raw_payload           JSONB,
  matched_occurrence_id UUID REFERENCES recurring_expense_occurrences(id),
  match_confidence      NUMERIC(3,2),
  match_method          VARCHAR(30),
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_bank_txns_account ON expense_bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_expense_bank_txns_date ON expense_bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_expense_bank_txns_matched ON expense_bank_transactions(matched_occurrence_id);
CREATE INDEX IF NOT EXISTS idx_expense_bank_txns_external ON expense_bank_transactions(external_transaction_id);

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_account_id  UUID NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  token_hash        VARCHAR(64) NOT NULL,
  user_agent        TEXT,
  ip_address        VARCHAR(45),
  expires_at        TIMESTAMP NOT NULL,
  revoked_at        TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(staff_account_id, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_staff ON refresh_tokens(staff_account_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked_at);

-- FAILED LOGIN ATTEMPTS
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_account_id  UUID NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  ip_address        VARCHAR(45) NOT NULL,
  user_agent        TEXT,
  attempt_time      TIMESTAMP DEFAULT NOW(),
  success           BOOLEAN DEFAULT FALSE,
  lockout_until     TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_login_staff ON failed_login_attempts(staff_account_id);
CREATE INDEX IF NOT EXISTS idx_failed_login_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_time ON failed_login_attempts(attempt_time);
CREATE INDEX IF NOT EXISTS idx_failed_login_lockout ON failed_login_attempts(lockout_until);

-- AUDIT LOG ENHANCEMENTS
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS metadata JSONB;
CREATE INDEX IF NOT EXISTS idx_audit_log_request_id ON audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_staff_action ON audit_log(staff_id, action, created_at);

-- IDEMPOTENCY KEYS
ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) UNIQUE;
ALTER TABLE payments_made ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_payments_received_idempotency ON payments_received(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_made_idempotency ON payments_made(idempotency_key);

-- CLOSED PERIOD ENFORCEMENT
CREATE OR REPLACE FUNCTION enforce_closed_period() RETURNS TRIGGER AS $$
DECLARE period_closed BOOLEAN;
BEGIN
  SELECT is_closed INTO period_closed
  FROM fiscal_periods
  WHERE NEW.entry_date BETWEEN start_date AND end_date LIMIT 1;
  IF period_closed THEN
    RAISE EXCEPTION 'Cannot modify entries in a closed fiscal period. Period is closed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_closed_period ON journal_entries;
CREATE TRIGGER trg_journal_closed_period
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION enforce_closed_period();

DROP TRIGGER IF EXISTS trg_invoice_closed_period ON invoices;
CREATE TRIGGER trg_invoice_closed_period
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION enforce_closed_period();

DROP TRIGGER IF EXISTS trg_bill_closed_period ON bills;
CREATE TRIGGER trg_bill_closed_period
  BEFORE INSERT OR UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION enforce_closed_period();

DROP TRIGGER IF EXISTS trg_pr_closed_period ON payments_received;
CREATE TRIGGER trg_pr_closed_period
  BEFORE INSERT OR UPDATE ON payments_received
  FOR EACH ROW EXECUTE FUNCTION enforce_closed_period();

DROP TRIGGER IF EXISTS trg_pm_closed_period ON payments_made;
CREATE TRIGGER trg_pm_closed_period
  BEFORE INSERT OR UPDATE ON payments_made
  FOR EACH ROW EXECUTE FUNCTION enforce_closed_period();

DROP TRIGGER IF EXISTS trg_payroll_closed_period ON payroll_runs;
CREATE TRIGGER trg_payroll_closed_period
  BEFORE INSERT OR UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION enforce_closed_period();

CREATE OR REPLACE FUNCTION enforce_closed_period_lines() RETURNS TRIGGER AS $$
DECLARE
  period_closed BOOLEAN;
  je_date DATE;
BEGIN
  SELECT entry_date INTO je_date FROM journal_entries WHERE id = NEW.journal_entry_id;
  SELECT is_closed INTO period_closed
  FROM fiscal_periods
  WHERE je_date BETWEEN start_date AND end_date LIMIT 1;
  IF period_closed THEN
    RAISE EXCEPTION 'Cannot modify journal lines in a closed fiscal period. Period is closed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_lines_closed_period ON journal_lines;
CREATE TRIGGER trg_journal_lines_closed_period
  BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION enforce_closed_period_lines();

-- CHECK CONSTRAINTS
DO $$ BEGIN
  ALTER TABLE expense_claims ADD CONSTRAINT chk_expense_claims_amount_positive CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE recurring_expenses ADD CONSTRAINT chk_recurring_amounts_nonneg CHECK (testnet_amount >= 0 AND prod_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Skip chk_occurrence_amount_positive as existing data may have zero amounts
-- ALTER TABLE recurring_expense_occurrences ADD CONSTRAINT chk_occurrence_amount_positive CHECK (amount > 0);

DO $$ BEGIN
  ALTER TABLE category_budgets ADD CONSTRAINT chk_category_budget_nonneg CHECK (monthly_budget_inr >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE fx_rate_cache ADD CONSTRAINT chk_fx_rate_positive CHECK (rate_to_inr > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE expense_bank_transactions ADD CONSTRAINT chk_bank_txn_amount_nonzero CHECK (amount <> 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sales_settings ADD CONSTRAINT chk_discount_threshold CHECK (
    key <> 'discount_approval_threshold_percent' OR
    (value ~ '^\d+(\.\d+)?$' AND CAST(value AS NUMERIC) BETWEEN 0 AND 100)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE teams ADD CONSTRAINT chk_teams_name_not_empty CHECK (length(trim(name)) > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE approval_requests ADD CONSTRAINT chk_approval_status CHECK (status IN ('pending','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE automation_rules ADD CONSTRAINT chk_automation_trigger_not_empty CHECK (length(trim(trigger_event::text)) > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- IDEMPOTENCY KEYS
ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) UNIQUE;
ALTER TABLE payments_made ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_payments_received_idempotency ON payments_received(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_made_idempotency ON payments_made(idempotency_key);

-- GRANTS / RLS PREPARATION
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expense_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rate_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expense_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- AI CONFIRMATIONS -- Persistent confirmation storage with TTL and replay protection
CREATE TABLE IF NOT EXISTS ai_confirmations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  confirmation_id   VARCHAR(100) NOT NULL UNIQUE,
  staff_account_id  UUID NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  tool_name         VARCHAR(100) NOT NULL,
  parameters        JSONB NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, CONFIRMED, EXECUTED, EXPIRED, REJECTED
  created_at        TIMESTAMP DEFAULT NOW(),
  expires_at        TIMESTAMP NOT NULL,
  executed_at       TIMESTAMP,
  executed_by       UUID REFERENCES staff_accounts(id),
  original_question TEXT,
  tool_parameters   JSONB NOT NULL,
  idempotency_key   VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_ai_confirmations_staff ON ai_confirmations(staff_account_id);
CREATE INDEX IF NOT EXISTS idx_ai_confirmations_status ON ai_confirmations(status);
CREATE INDEX IF NOT EXISTS idx_ai_confirmations_expires ON ai_confirmations(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_confirmations_idempotency ON ai_confirmations(idempotency_key);

-- PLACEHOLDER POLICIES (to be refined in Phase 3)
DO $$ BEGIN
  CREATE POLICY expense_claims_all ON expense_claims FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY recurring_expenses_all ON recurring_expenses FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY recurring_occurrences_all ON recurring_expense_occurrences FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY category_budgets_all ON category_budgets FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY sales_settings_all ON sales_settings FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY fx_rate_cache_all ON fx_rate_cache FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY recurring_audit_all ON recurring_expense_audit_log FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY expense_bank_txns_all ON expense_bank_transactions FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY teams_all ON teams FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY approval_requests_all ON approval_requests FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY bank_sync_state_all ON bank_sync_state FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY staff_notifications_all ON staff_notifications FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY automation_rules_all ON automation_rules FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY refresh_tokens_all ON refresh_tokens FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY failed_login_attempts_all ON failed_login_attempts FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;