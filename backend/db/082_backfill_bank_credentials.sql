-- Migration 082: Backfill bank credentials from plaintext to encrypted
-- This migration provides the SQL structure for the backfill job
-- The actual backfill is performed by services/encryptionBackfill.js

-- This migration documents the backfill process and provides
-- verification queries for post-backfill validation

-- Verification query: Check that all credentials are encrypted
-- SELECT 
--   COUNT(*) as total_accounts,
--   COUNT(api_client_id_enc) as encrypted_client_id,
--   COUNT(api_client_secret_enc) as encrypted_secret,
--   COUNT(api_base_url_enc) as encrypted_base_url
-- FROM bank_accounts
-- WHERE api_client_id IS NOT NULL 
--    OR api_client_secret IS NOT NULL 
--    OR api_base_url IS NOT NULL;

-- Expected: all counts should match total_accounts

-- Cleanup: After verification period (30 days), plaintext columns can be dropped
-- ALTER TABLE bank_accounts 
--   DROP COLUMN IF EXISTS api_client_id,
--   DROP COLUMN IF EXISTS api_client_secret,
--   DROP COLUMN IF EXISTS api_base_url;

-- This migration documents the process; actual backfill runs via application job
-- See services/encryptionBackfill.js for the actual backfill implementation