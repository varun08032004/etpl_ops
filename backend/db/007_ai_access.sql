-- AI Access Level for AI Agent
-- Run this migration to add AI access control

ALTER TABLE staff_accounts ADD COLUMN IF NOT EXISTS ai_access_level VARCHAR(20) DEFAULT 'AI_DISABLED';

-- Set owner/founder to AI_AGENT
UPDATE staff_accounts SET ai_access_level = 'AI_AGENT' WHERE role = 'owner';

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_staff_ai_access ON staff_accounts(ai_access_level);

COMMENT ON COLUMN staff_accounts.ai_access_level IS 'AI access level: AI_DISABLED, AI_KNOWLEDGE, AI_AGENT';