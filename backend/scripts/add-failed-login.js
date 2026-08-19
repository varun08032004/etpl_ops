const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'db', '009_missing_tables.sql');
let content = fs.readFileSync(filePath, 'utf8');

// Find the position to insert - after REFRESH TOKENS section, before GRANTS/RLS
const insertMarker = '-- ##################################################################################\n-- GRANTS / RLS PREPARATION';
const insertIndex = content.indexOf(insertMarker);

if (insertIndex === -1) {
  console.error('Marker not found');
  process.exit(1);
}

const failedLoginSql = `
-- ##################################################################################
-- FAILED LOGIN ATTEMPTS — Brute-force protection and account lockout
-- ##################################################################################

CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_account_id  UUID NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  ip_address        VARCHAR(45) NOT NULL,
  user_agent        TEXT,
  attempt_time      TIMESTAMP DEFAULT NOW(),
  success           BOOLEAN DEFAULT FALSE,
  lockout_until     TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_login_staff ON failed_login_attempts(staff_account_id);
CREATE INDEX IF NOT EXISTS idx_failed_login_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_time ON failed_login_attempts(attempt_time);

-- ##################################################################################
-- GRANTS / RLS PREPARATION
-- ##################################################################################

ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY failed_login_attempts_all ON failed_login_attempts FOR ALL USING (true);

`;

const newContent = content.slice(0, insertIndex) + failedLoginSql + content.slice(insertIndex);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('failed_login_attempts table added to migration');