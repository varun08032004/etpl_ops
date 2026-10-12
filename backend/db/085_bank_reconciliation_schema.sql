-- Migration 085: Add reconciliation fields to expense_bank_transactions
-- Run after 084_journal_entry_idempotency.sql

-- Add reconciliation status and related fields to expense_bank_transactions
ALTER TABLE expense_bank_transactions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'unmatched',
  ADD COLUMN IF NOT EXISTS match_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS match_method VARCHAR(30),
  ADD COLUMN IF NOT EXISTS matched_journal_entry_id UUID REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES staff_accounts(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES staff_accounts(id);

-- Add constraint for valid status values
ALTER TABLE expense_bank_transactions
  ADD CONSTRAINT chk_expense_bank_txn_status 
  CHECK (status IN ('unmatched', 'matched', 'reviewed', 'reconciled'));

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_expense_bank_txn_status 
  ON expense_bank_transactions(status) 
  WHERE status IN ('unmatched', 'matched', 'reviewed');

-- Add index for matched journal entry lookup
CREATE INDEX IF NOT EXISTS idx_expense_bank_txn_matched_je 
  ON expense_bank_transactions(matched_journal_entry_id)
  WHERE matched_journal_entry_id IS NOT NULL;

-- Add reverse reference from journal_entries to bank transactions
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS matched_bank_transaction_id UUID REFERENCES expense_bank_transactions(id);

-- Add index for the reverse lookup
CREATE INDEX IF NOT EXISTS idx_journal_entries_matched_bt 
  ON journal_entries(matched_bank_transaction_id)
  WHERE matched_bank_transaction_id IS NOT NULL;

-- Update existing records to have default status
UPDATE expense_bank_transactions 
SET status = 'unmatched' 
WHERE status IS NULL;

-- Add match_confidence constraint
ALTER TABLE expense_bank_transactions
  ADD CONSTRAINT chk_match_confidence_range 
  CHECK (match_confidence IS NULL OR (match_confidence >= 0.7 AND match_confidence <= 1.0));

-- Add match_method constraint
ALTER TABLE expense_bank_transactions
  ADD CONSTRAINT chk_match_method 
  CHECK (match_method IS NULL OR match_method IN ('auto_exact', 'auto_fuzzy', 'manual'));