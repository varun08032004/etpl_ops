const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'db', '009_missing_tables.sql');
let content = fs.readFileSync(filePath, 'utf8');

// Find the position to insert - after FAILED LOGIN ATTEMPTS section
const insertMarker = '-- ##################################################################################\n-- GRANTS / RLS PREPARATION';
const insertIndex = content.indexOf(insertMarker);

if (insertIndex === -1) {
  console.error('Marker not found');
  process.exit(1);
}

const auditColumnsSql = `
-- ##################################################################################
-- AUDIT LOG ENHANCEMENTS — Add request_id and metadata columns
-- ##################################################################################

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_log_request_id ON audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_staff_action ON audit_log(staff_id, action, created_at);

-- ##################################################################################
-- GRANTS / RLS PREPARATION
-- ##################################################################################
`;

const newContent = content.slice(0, insertIndex) + auditColumnsSql + content.slice(insertIndex);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('audit_log columns added to migration');