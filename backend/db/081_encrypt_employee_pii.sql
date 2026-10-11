-- Migration 081: Add encrypted PII columns to employees
-- Run AFTER 080_encrypt_bank_credentials.sql

-- Add encrypted PII columns to employees
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS bank_account_number_enc TEXT,
  ADD COLUMN IF NOT EXISTS pan_number_enc TEXT,
  ADD COLUMN IF NOT EXISTS pii_key_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS pii_rotated_at TIMESTAMP;

-- Index for backfill queries - find rows needing encryption
CREATE INDEX IF NOT EXISTS idx_employees_pii_pending 
  ON employees (id) 
  WHERE 
    (bank_account_number IS NOT NULL AND bank_account_number_enc IS NULL)
    OR (pan_number IS NOT NULL AND pan_number_enc IS NULL);

-- Index for PII key lookups
CREATE INDEX IF NOT EXISTS idx_employees_pii_key ON employees (pii_key_id);

-- RLS for employees (HR/payroll/self only)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY employees_self ON employees FOR SELECT 
  USING (id = current_setting('app.current_user_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY employees_hr_payroll ON employees FOR ALL 
  USING (current_setting('app.current_user_role', true) IN ('owner', 'admin', 'hr', 'finance'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;