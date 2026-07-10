-- ═══════════════════════════════════════════════════════════════════════════
-- EtherTrack Internal Ops — HR + Accounting/Bookkeeping ERP
-- Separate database from the customer-facing platform DB (by design).
-- Postgres. Follows the same conventions as ethertrack-backend/db/schema.sql
-- (uuid pk, enums, updated_at triggers) so it feels native to the codebase.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────────────────

CREATE TYPE staff_role          AS ENUM ('owner', 'admin', 'hr', 'finance', 'manager', 'employee');
CREATE TYPE employment_type     AS ENUM ('full_time', 'part_time', 'contract', 'intern');
CREATE TYPE employee_status     AS ENUM ('active', 'on_leave', 'notice_period', 'exited');
CREATE TYPE leave_status        AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE gender_type         AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

CREATE TYPE account_type        AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');
CREATE TYPE journal_source      AS ENUM ('manual', 'invoice', 'bill', 'payroll', 'bank_import', 'payment', 'adjustment', 'opening_balance');
CREATE TYPE party_type          AS ENUM ('customer', 'vendor', 'both');
CREATE TYPE invoice_status      AS ENUM ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void');
CREATE TYPE bill_status         AS ENUM ('draft', 'received', 'partially_paid', 'paid', 'overdue', 'void');
CREATE TYPE payroll_run_status  AS ENUM ('draft', 'processing', 'paid', 'failed', 'cancelled');
CREATE TYPE payroll_item_status AS ENUM ('pending', 'processing', 'paid', 'failed');
CREATE TYPE attendance_status   AS ENUM ('present', 'absent', 'half_day', 'on_leave', 'holiday', 'weekend', 'wfh');

-- ══════════════════════════════════════════════════════════════════════════
-- STAFF ACCOUNTS (login for THIS internal tool — separate from platform users)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE staff_accounts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  role              staff_role NOT NULL DEFAULT 'employee',
  employee_id       UUID,                          -- FK added after employees table exists
  is_active         BOOLEAN DEFAULT TRUE,
  two_fa_enabled    BOOLEAN DEFAULT FALSE,
  two_fa_secret     VARCHAR(255),
  last_login        TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- HR — DEPARTMENTS / DESIGNATIONS
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE departments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(150) NOT NULL UNIQUE,
  description   TEXT,
  head_employee_id UUID,                           -- FK added after employees table exists
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE designations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(150) NOT NULL,
  department_id UUID REFERENCES departments(id),
  level         INTEGER DEFAULT 0,                 -- for org-chart / approval hierarchy ordering
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- HR — EMPLOYEES
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE employees (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code         VARCHAR(50) UNIQUE NOT NULL,   -- e.g. ET-EMP-0001

  -- Identity
  full_name             VARCHAR(255) NOT NULL,
  personal_email        VARCHAR(255),
  work_email            VARCHAR(255) UNIQUE,
  phone                 VARCHAR(20),
  gender                gender_type,
  date_of_birth         DATE,

  -- Address / KYC (India-specific)
  address_line          TEXT,
  city                  VARCHAR(100),
  state                 VARCHAR(100),
  pincode               VARCHAR(10),
  pan_number            VARCHAR(10),
  aadhaar_last4         VARCHAR(4),                    -- never store full Aadhaar

  -- Employment
  department_id         UUID REFERENCES departments(id),
  designation_id         UUID REFERENCES designations(id),
  manager_id             UUID REFERENCES employees(id),
  employment_type        employment_type NOT NULL DEFAULT 'full_time',
  status                 employee_status NOT NULL DEFAULT 'active',
  date_of_joining         DATE NOT NULL,
  date_of_exit             DATE,
  exit_reason              TEXT,

  -- Compensation (CTC breakdown — used by payroll module)
  ctc_annual              NUMERIC(14,2),
  basic_monthly           NUMERIC(14,2),
  hra_monthly             NUMERIC(14,2),
  other_allowances_monthly NUMERIC(14,2),
  employer_pf_monthly     NUMERIC(14,2) DEFAULT 0,

  -- Bank (for payroll — Razorpay payout contact/fund account IDs cached here)
  bank_account_number     VARCHAR(50),
  bank_ifsc                VARCHAR(15),
  razorpay_contact_id       VARCHAR(100),
  razorpay_fund_account_id  VARCHAR(100),

  -- Integrations
  trackpilot_user_id        VARCHAR(100),               -- maps to TrackPilot's user for attendance sync

  -- Leave balances (simple counters; ledger detail in leave_requests)
  leave_balance_annual     NUMERIC(5,2) DEFAULT 0,
  leave_balance_sick       NUMERIC(5,2) DEFAULT 0,

  notes                    TEXT,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

ALTER TABLE staff_accounts   ADD CONSTRAINT fk_staff_employee   FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE departments      ADD CONSTRAINT fk_dept_head        FOREIGN KEY (head_employee_id) REFERENCES employees(id);

CREATE TABLE employee_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type      VARCHAR(100) NOT NULL,        -- offer_letter, id_proof, pan, contract, appraisal...
  file_url      VARCHAR(500) NOT NULL,
  uploaded_by   UUID REFERENCES staff_accounts(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- HR — LEAVE
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE leave_types (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(100) NOT NULL UNIQUE,   -- Annual, Sick, Casual, Unpaid...
  days_per_year     NUMERIC(5,2) DEFAULT 0,
  is_paid           BOOLEAN DEFAULT TRUE
);

CREATE TABLE leave_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  leave_type_id     UUID NOT NULL REFERENCES leave_types(id),
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  num_days          NUMERIC(5,2) NOT NULL,
  reason            TEXT,
  status            leave_status DEFAULT 'pending',
  approved_by       UUID REFERENCES staff_accounts(id),
  approved_at       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- HR — ATTENDANCE (synced from TrackPilot)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE attendance_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  work_date         DATE NOT NULL,
  status            attendance_status NOT NULL DEFAULT 'present',
  clock_in          TIMESTAMP,
  clock_out         TIMESTAMP,
  active_seconds    INTEGER DEFAULT 0,             -- from TrackPilot activity tracking
  idle_seconds      INTEGER DEFAULT 0,
  source            VARCHAR(50) DEFAULT 'trackpilot',
  raw_payload       JSONB,                          -- store original TrackPilot payload for audit
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

-- ══════════════════════════════════════════════════════════════════════════
-- ACCOUNTING — CHART OF ACCOUNTS (double-entry core)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE chart_of_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(20) UNIQUE NOT NULL,     -- e.g. 1000, 1100, 4000
  name            VARCHAR(150) NOT NULL,
  account_type    account_type NOT NULL,
  parent_id       UUID REFERENCES chart_of_accounts(id),
  is_group        BOOLEAN DEFAULT FALSE,            -- header/group account (no direct postings)
  is_system       BOOLEAN DEFAULT FALSE,             -- protected accounts (e.g. Retained Earnings)
  is_active       BOOLEAN DEFAULT TRUE,
  description     TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fiscal_periods (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label         VARCHAR(20) NOT NULL UNIQUE,        -- e.g. 'FY2025-26', 'FY2025-26-Q1'
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_closed     BOOLEAN DEFAULT FALSE,
  closed_at     TIMESTAMP,
  closed_by     UUID REFERENCES staff_accounts(id)
);

-- Every financial event in the system (invoice, bill, payroll, manual entry)
-- creates ONE journal_entry with 2+ journal_lines that must balance (sum debit = sum credit).
CREATE TABLE journal_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number    VARCHAR(30) UNIQUE NOT NULL,      -- e.g. JE-2026-000001
  entry_date      DATE NOT NULL,
  source          journal_source NOT NULL DEFAULT 'manual',
  source_type     VARCHAR(50),                       -- 'invoice' | 'bill' | 'payroll_run' | ...
  source_id       UUID,                               -- id of the invoice/bill/payroll_run etc.
  narration       TEXT,
  is_posted       BOOLEAN DEFAULT TRUE,               -- false = draft, not yet affecting ledger
  reversed_by     UUID REFERENCES journal_entries(id), -- points to the reversing entry, if any
  created_by      UUID REFERENCES staff_accounts(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE journal_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit           NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit          NUMERIC(14,2) NOT NULL DEFAULT 0,
  party_id        UUID,                                -- optional link to customer/vendor, FK added below
  description     TEXT,
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))                -- a line is either a debit or a credit, not both
);

-- ══════════════════════════════════════════════════════════════════════════
-- ACCOUNTING — PARTIES (customers / vendors for AR & AP)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE parties (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  party_type        party_type NOT NULL DEFAULT 'customer',
  email             VARCHAR(255),
  phone             VARCHAR(20),
  gstin             VARCHAR(15),                        -- India GST number, nullable for individuals
  billing_address   TEXT,
  state             VARCHAR(100),                        -- needed to determine CGST+SGST vs IGST
  payment_terms_days INTEGER DEFAULT 30,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMP DEFAULT NOW()
);

ALTER TABLE journal_lines ADD CONSTRAINT fk_journal_lines_party FOREIGN KEY (party_id) REFERENCES parties(id);

-- ══════════════════════════════════════════════════════════════════════════
-- ACCOUNTING — SALES INVOICES (AR) — GST-compliant
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number    VARCHAR(30) UNIQUE NOT NULL,        -- e.g. INV-2026-000001
  party_id          UUID NOT NULL REFERENCES parties(id),
  invoice_date      DATE NOT NULL,
  due_date          DATE NOT NULL,
  status            invoice_status DEFAULT 'draft',

  subtotal          NUMERIC(14,2) NOT NULL DEFAULT 0,
  cgst_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  sgst_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  igst_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid       NUMERIC(14,2) NOT NULL DEFAULT 0,

  place_of_supply   VARCHAR(100),
  notes             TEXT,
  pdf_url           VARCHAR(500),

  journal_entry_id  UUID REFERENCES journal_entries(id), -- the AR posting for this invoice
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoice_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     VARCHAR(500) NOT NULL,
  hsn_sac_code    VARCHAR(10),
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(14,2) NOT NULL,
  gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 18,     -- % — 0/5/12/18/28 standard slabs
  line_total      NUMERIC(14,2) NOT NULL,               -- qty * unit_price (pre-tax)
  income_account_id UUID REFERENCES chart_of_accounts(id) -- which revenue account this hits
);

CREATE TABLE payments_received (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id),
  amount          NUMERIC(14,2) NOT NULL,
  payment_date    DATE NOT NULL,
  method          VARCHAR(50),                           -- bank_transfer, razorpay, cash, upi...
  reference        VARCHAR(150),
  bank_account_id  UUID,                                  -- FK added below
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by       UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- ACCOUNTING — VENDOR BILLS / EXPENSES (AP)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE expense_categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(150) NOT NULL UNIQUE,           -- SaaS Tools, Rent, Travel, AWS, Contractors...
  expense_account_id UUID REFERENCES chart_of_accounts(id)
);

CREATE TABLE bills (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_number       VARCHAR(30) UNIQUE NOT NULL,         -- internal ref, e.g. BILL-2026-000001
  vendor_id         UUID NOT NULL REFERENCES parties(id),
  bill_date         DATE NOT NULL,
  due_date          DATE NOT NULL,
  status            bill_status DEFAULT 'draft',
  category_id       UUID REFERENCES expense_categories(id),

  subtotal          NUMERIC(14,2) NOT NULL DEFAULT 0,
  gst_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid       NUMERIC(14,2) NOT NULL DEFAULT 0,

  attachment_url    VARCHAR(500),                         -- scanned bill/receipt
  notes             TEXT,

  journal_entry_id  UUID REFERENCES journal_entries(id),
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments_made (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id         UUID NOT NULL REFERENCES bills(id),
  amount          NUMERIC(14,2) NOT NULL,
  payment_date    DATE NOT NULL,
  method          VARCHAR(50),
  reference       VARCHAR(150),
  bank_account_id UUID,                                    -- FK added below
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by      UUID REFERENCES staff_accounts(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- BANKING
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE bank_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_name    VARCHAR(150) NOT NULL,                  -- 'EtherTrack Current A/C - HDFC'
  account_number  VARCHAR(50),
  ifsc            VARCHAR(15),
  bank_name       VARCHAR(150),
  ledger_account_id UUID REFERENCES chart_of_accounts(id), -- links to COA (asset account)
  opening_balance NUMERIC(14,2) DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW()
);

ALTER TABLE payments_received ADD CONSTRAINT fk_pr_bank FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
ALTER TABLE payments_made     ADD CONSTRAINT fk_pm_bank FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);

CREATE TABLE bank_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id   UUID NOT NULL REFERENCES bank_accounts(id),
  txn_date          DATE NOT NULL,
  description       TEXT,
  amount            NUMERIC(14,2) NOT NULL,               -- positive = credit, negative = debit
  reconciled        BOOLEAN DEFAULT FALSE,
  matched_journal_entry_id UUID REFERENCES journal_entries(id),
  source            VARCHAR(50) DEFAULT 'manual_import',   -- manual_import, razorpay
  raw_payload       JSONB,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- PAYROLL (drives Razorpay Payouts)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE payroll_runs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_month      INTEGER NOT NULL,                     -- 1-12
  period_year       INTEGER NOT NULL,
  status            payroll_run_status DEFAULT 'draft',
  total_gross       NUMERIC(14,2) DEFAULT 0,
  total_deductions  NUMERIC(14,2) DEFAULT 0,
  total_net         NUMERIC(14,2) DEFAULT 0,
  processed_at      TIMESTAMP,
  journal_entry_id  UUID REFERENCES journal_entries(id),  -- payroll expense posting
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(period_month, period_year)
);

CREATE TABLE payroll_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id        UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id           UUID NOT NULL REFERENCES employees(id),

  basic                 NUMERIC(14,2) DEFAULT 0,
  hra                   NUMERIC(14,2) DEFAULT 0,
  other_allowances      NUMERIC(14,2) DEFAULT 0,
  gross_pay             NUMERIC(14,2) DEFAULT 0,

  pf_deduction          NUMERIC(14,2) DEFAULT 0,
  professional_tax      NUMERIC(14,2) DEFAULT 0,
  tds_deduction         NUMERIC(14,2) DEFAULT 0,
  other_deductions      NUMERIC(14,2) DEFAULT 0,
  loss_of_pay_days       NUMERIC(5,2) DEFAULT 0,           -- from attendance/leave shortfall

  net_pay               NUMERIC(14,2) DEFAULT 0,

  status                payroll_item_status DEFAULT 'pending',
  razorpay_payout_id     VARCHAR(100),
  paid_at                TIMESTAMP,
  failure_reason          TEXT,

  UNIQUE(payroll_run_id, employee_id)
);

-- ══════════════════════════════════════════════════════════════════════════
-- AUDIT LOG
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id    UUID REFERENCES staff_accounts(id),
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(100),
  entity_id   VARCHAR(100),
  old_value   JSONB,
  new_value   JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_employees_dept          ON employees(department_id);
CREATE INDEX idx_employees_status        ON employees(status);
CREATE INDEX idx_attendance_employee_date ON attendance_records(employee_id, work_date);
CREATE INDEX idx_leave_employee          ON leave_requests(employee_id);
CREATE INDEX idx_journal_lines_account   ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_entry     ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_entries_date    ON journal_entries(entry_date);
CREATE INDEX idx_invoices_party          ON invoices(party_id);
CREATE INDEX idx_invoices_status         ON invoices(status);
CREATE INDEX idx_bills_vendor            ON bills(vendor_id);
CREATE INDEX idx_bank_txns_account       ON bank_transactions(bank_account_id);
CREATE INDEX idx_payroll_items_run       ON payroll_items(payroll_run_id);
CREATE INDEX idx_payroll_items_employee  ON payroll_items(employee_id);

-- ══════════════════════════════════════════════════════════════════════════
-- TRIGGERS — auto update updated_at
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_updated_at   BEFORE UPDATE ON employees   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_staff_updated_at       BEFORE UPDATE ON staff_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at    BEFORE UPDATE ON invoices    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bills_updated_at       BEFORE UPDATE ON bills       FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- TRIGGER — enforce that every journal entry balances (sum debit = sum credit)
-- Runs after any insert/update/delete on journal_lines for a given entry.
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_journal_entry_balanced() RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  total_debit NUMERIC(14,2);
  total_credit NUMERIC(14,2);
BEGIN
  je_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
  INTO total_debit, total_credit
  FROM journal_lines WHERE journal_entry_id = je_id;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced: debit=% credit=%', je_id, total_debit, total_credit;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_journal_balanced
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_journal_entry_balanced();
