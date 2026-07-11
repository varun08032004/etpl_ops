-- ═══════════════════════════════════════════════════════════════════════════
-- Payroll compliance upgrade: TDS (dual regime), EPF, ESIC, Professional Tax,
-- 50% wage cap rule, Full & Final settlement tracking.
-- Run after schema.sql. Verify all seeded slab values with your CA — tax law
-- changes yearly and by state; these are a starting structure, not gospel.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE tax_regime_type AS ENUM ('old', 'new');

ALTER TABLE employees ADD COLUMN tax_regime tax_regime_type NOT NULL DEFAULT 'new';
ALTER TABLE employees ADD COLUMN da_monthly NUMERIC(14,2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN pf_applicable BOOLEAN DEFAULT TRUE;
ALTER TABLE employees ADD COLUMN esic_applicable BOOLEAN DEFAULT NULL;
ALTER TABLE employees ADD COLUMN declared_deductions JSONB DEFAULT '{}';

CREATE TABLE tax_slabs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  regime            tax_regime_type NOT NULL,
  fiscal_year       VARCHAR(10) NOT NULL,
  income_from       NUMERIC(14,2) NOT NULL,
  income_to         NUMERIC(14,2),
  rate_percent      NUMERIC(5,2) NOT NULL,
  standard_deduction NUMERIC(14,2) NOT NULL DEFAULT 50000,
  cess_percent      NUMERIC(5,2) NOT NULL DEFAULT 4
);

CREATE TABLE pt_slabs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state             VARCHAR(100) NOT NULL,
  gross_from        NUMERIC(14,2) NOT NULL,
  gross_to          NUMERIC(14,2),
  monthly_amount    NUMERIC(14,2) NOT NULL,
  applies_in_february_override NUMERIC(14,2)
);

CREATE TABLE compliance_settings (
  key               VARCHAR(100) PRIMARY KEY,
  value             VARCHAR(255) NOT NULL,
  note              TEXT
);
INSERT INTO compliance_settings (key, value, note) VALUES
('epf_mandatory_headcount', '20', 'EPF becomes mandatory once active headcount crosses this'),
('esic_mandatory_headcount', '10', 'ESIC becomes mandatory once active headcount crosses this'),
('esic_wage_ceiling', '21000', 'ESIC only applies to employees with gross monthly wages at or below this'),
('epf_wage_ceiling', '15000', 'Statutory EPF contribution base is capped at this basic+DA amount'),
('disbursal_deadline_day', '7', 'Salary must be disbursed by this day of the following month'),
('ff_settlement_days', '2', 'Full & Final settlement must be completed within this many working days of exit');

ALTER TABLE payroll_items ADD COLUMN da_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN epf_employer_contribution NUMERIC(14,2) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN esic_employee_deduction NUMERIC(14,2) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN esic_employer_contribution NUMERIC(14,2) DEFAULT 0;

ALTER TABLE payroll_runs ADD COLUMN is_final_settlement BOOLEAN DEFAULT FALSE;
ALTER TABLE payroll_runs ADD COLUMN disbursal_due_date DATE;

CREATE TABLE final_settlements (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id           UUID NOT NULL REFERENCES employees(id),
  payroll_item_id       UUID REFERENCES payroll_items(id),
  exit_date             DATE NOT NULL,
  pending_salary_days    NUMERIC(5,2) DEFAULT 0,
  pending_salary_amount  NUMERIC(14,2) DEFAULT 0,
  leave_days_encashed     NUMERIC(5,2) DEFAULT 0,
  leave_encashment_amount NUMERIC(14,2) DEFAULT 0,
  other_dues              NUMERIC(14,2) DEFAULT 0,
  other_dues_note          TEXT,
  recoveries               NUMERIC(14,2) DEFAULT 0,
  recoveries_note           TEXT,
  net_settlement_amount     NUMERIC(14,2) DEFAULT 0,
  deadline_date              DATE NOT NULL,
  settled_at                  TIMESTAMP,
  created_at                   TIMESTAMP DEFAULT NOW()
);