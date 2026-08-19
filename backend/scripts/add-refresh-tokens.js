const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'db', '009_missing_tables.sql');
let content = fs.readFileSync(filePath, 'utf8');

const insertMarker = '-- GRANTS / RLS PREPARATION (enable RLS on sensitive tables, policies added in Phase 3)';
const insertIndex = content.indexOf(insertMarker);

if (insertIndex === -1) {
  console.error('Marker not found');
  process.exit(1);
}

const refreshTokensSql = '\n' +
'-- ##################################################################################\n' +
'-- REFRESH TOKENS \u2014 Token rotation for authentication\n' +
'-- ##################################################################################\n\n' +
'CREATE TABLE IF NOT EXISTS refresh_tokens (\n' +
'  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n' +
'  staff_account_id  UUID NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,\n' +
'  token_hash        VARCHAR(64) NOT NULL,\n' +
'  user_agent        TEXT,\n' +
'  ip_address        VARCHAR(45),\n' +
'  expires_at        TIMESTAMP NOT NULL,\n' +
'  revoked_at        TIMESTAMP,\n' +
'  created_at        TIMESTAMP DEFAULT NOW(),\n' +
'  UNIQUE(staff_account_id, token_hash)\n' +
');\n\n' +
'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_staff ON refresh_tokens(staff_account_id);\n' +
'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);\n' +
'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked_at);\n\n' +
'-- ##################################################################################\n' +
'-- GRANTS / RLS PREPARATION\n' +
'-- ##################################################################################\n\n' +
'ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;\n' +
'CREATE POLICY refresh_tokens_all ON refresh_tokens FOR ALL USING (true);\n\n';

const newContent = content.slice(0, insertIndex) + refreshTokensSql + content.slice(insertIndex);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('refresh_tokens table added to migration');