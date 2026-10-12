-- Migration 080: Add encrypted bank credential columns to bank_accounts
-- Run AFTER 079_migration_registry.sql

-- Add plaintext credential columns (if not already present from manual setup)
ALTER TABLE bank_accounts 
  ADD COLUMN IF NOT EXISTS api_client_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS api_client_secret VARCHAR(100),
  ADD COLUMN IF NOT EXISTS api_base_url VARCHAR(200);

-- Add encrypted credential columns
ALTER TABLE bank_accounts 
  ADD COLUMN IF NOT EXISTS api_client_id_enc TEXT,
  ADD COLUMN IF NOT EXISTS api_client_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS api_base_url_enc TEXT,
  ADD COLUMN IF NOT EXISTS credential_key_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS credential_rotated_at TIMESTAMP;

-- Index for backfill queries - find rows needing encryption
CREATE INDEX IF NOT EXISTS idx_bank_accounts_cred_pending 
  ON bank_accounts (id) 
  WHERE 
    (api_client_id IS NOT NULL AND api_client_id_enc IS NULL)
    OR (api_client_secret IS NOT NULL AND api_client_secret_enc IS NULL)
    OR (api_base_url IS NOT NULL AND api_base_url_enc IS NULL);

-- Index for credential key lookups
CREATE INDEX IF NOT EXISTS idx_bank_accounts_cred_key ON bank_accounts (credential_key_id);

-- RLS for bank accounts (finance/admin only)
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY bank_accounts_finance ON bank_accounts FOR ALL 
  USING (current_setting('app.current_user_role', true) IN ('owner', 'admin', 'finance'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;