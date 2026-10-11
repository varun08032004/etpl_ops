-- Migration 083: Backfill employee PII from plaintext to encrypted
-- Run AFTER 081_encrypt_employee_pii.sql

-- Verification query: Check that all PII is encrypted
-- SELECT 
--   COUNT(*) as total_employees,
--   COUNT(bank_account_number_enc) as encrypted_bank_account,
--   COUNT(pan_number_enc) as encrypted_pan
-- FROM employees
-- WHERE bank_account_number IS NOT NULL 
--    OR pan_number IS NOT NULL;

-- Expected: all counts should match total_employees

-- Cleanup: After verification period (30 days), plaintext columns can be dropped
-- ALTER TABLE employees 
--   DROP COLUMN IF EXISTS bank_account_number,
--   DROP COLUMN IF EXISTS pan_number;

-- This migration documents the process; actual backfill runs via application job
-- See services/encryptionBackfill.js for the actual backfill implementation