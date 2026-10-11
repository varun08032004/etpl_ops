const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

const sql = `
-- Employee device bindings table
CREATE TABLE IF NOT EXISTS employee_device_bindings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id           UUID NOT NULL REFERENCES employees(id),
  device_fingerprint    VARCHAR(255) NOT NULL,  -- SHA256 of device components
  device_name           VARCHAR(100),           -- Human readable name
  device_ip             INET,                   -- Last known IP
  status                VARCHAR(20) DEFAULT 'active',  -- active, revoked, pending_approval
  registered_at         TIMESTAMP DEFAULT NOW(),
  approved_by           UUID REFERENCES staff_accounts(id),
  approved_at           TIMESTAMP,
  revoked_at            TIMESTAMP,
  revoked_by            UUID REFERENCES staff_accounts(id),
  revoked_reason        TEXT,
  UNIQUE(employee_id, device_fingerprint)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_device_bindings_employee ON employee_device_bindings(employee_id);
CREATE INDEX IF NOT EXISTS idx_device_bindings_fingerprint ON employee_device_bindings(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_bindings_status ON employee_device_bindings(status);

-- Device change requests table
CREATE TABLE IF NOT EXISTS device_change_requests (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id           UUID NOT NULL REFERENCES employees(id),
  old_device_fingerprint VARCHAR(255),
  new_device_fingerprint VARCHAR(255) NOT NULL,
  new_device_name       VARCHAR(100),
  new_device_ip         INET,
  reason                TEXT,
  status                VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
  requested_at          TIMESTAMP DEFAULT NOW(),
  reviewed_by           UUID REFERENCES staff_accounts(id),
  reviewed_at           TIMESTAMP,
  review_notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_device_change_employee ON device_change_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_device_change_status ON device_change_requests(status);

-- Add device_fingerprint to attendance_punch_log for audit trail
ALTER TABLE attendance_punch_log 
  ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255);

-- Add device_fingerprint to attendance_records for audit
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255);
`;

pool.query(sql)
  .then(r => console.log('Device binding tables created successfully'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());