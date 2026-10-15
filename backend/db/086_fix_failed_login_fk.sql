-- Migration 086: Fix failed_login_attempts foreign key constraint
-- Make staff_account_id nullable to allow tracking failed logins for non-existent accounts

-- Drop the existing foreign key constraint
ALTER TABLE failed_login_attempts 
DROP CONSTRAINT IF EXISTS failed_login_attempts_staff_account_id_fkey;

-- Make staff_account_id nullable
ALTER TABLE failed_login_attempts 
ALTER COLUMN staff_account_id DROP NOT NULL;

-- Re-add the foreign key constraint (now allowing NULL)
ALTER TABLE failed_login_attempts 
ADD CONSTRAINT failed_login_attempts_staff_account_id_fkey 
FOREIGN KEY (staff_account_id) REFERENCES staff_accounts(id) ON DELETE CASCADE;