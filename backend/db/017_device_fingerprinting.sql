-- Device Fingerprinting & Heartbeat Hardening
-- Run after 016_agent_monitoring.sql

-- Add hardware fingerprint columns to agent_devices
ALTER TABLE agent_devices
  ADD COLUMN IF NOT EXISTS hw_id VARCHAR(500),                    -- SHA256 of stable hardware identifiers
  ADD COLUMN IF NOT EXISTS hw_id_components JSONB,                -- Individual components for audit (cpu_id, motherboard_serial, disk_serial, mac_addresses)
  ADD COLUMN IF NOT EXISTS fingerprint_verified_at TIMESTAMP,     -- Last time fingerprint matched
  ADD COLUMN IF NOT EXISTS fingerprint_mismatch_count INTEGER DEFAULT 0,  -- Count of mismatches
  ADD COLUMN IF NOT EXISTS last_known_ip INET,                    -- Last seen IP for geo verification
  ADD COLUMN IF NOT EXISTS last_known_location JSONB,             -- { country, region, city, lat, lon, isp }
  ADD COLUMN IF NOT EXISTS is_office_network BOOLEAN DEFAULT FALSE, -- Whether last IP matches office CIDR
  ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP DEFAULT NOW(),   -- When device was first enrolled
  ADD COLUMN IF NOT EXISTS last_heartbeat_seq INTEGER DEFAULT 0;  -- Monotonically increasing sequence for replay protection

-- Add heartbeat sequence to agent_sessions for replay protection
ALTER TABLE agent_sessions
  ADD COLUMN IF NOT EXISTS heartbeat_seq INTEGER DEFAULT 0,       -- Current sequence number
  ADD COLUMN IF NOT EXISTS last_heartbeat_received_at TIMESTAMP;  -- Server-side receipt time

-- Index for fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_agent_devices_hw_id ON agent_devices (hw_id);
CREATE INDEX IF NOT EXISTS idx_agent_devices_employee_hw ON agent_devices (employee_id, hw_id);

-- Office network CIDR ranges (configured via monitoring_settings or separate table)
CREATE TABLE IF NOT EXISTS office_networks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL,                          -- e.g. "Main Office", "Branch Office"
  cidr            CIDR NOT NULL,                                  -- e.g. "203.0.113.0/24"
  created_at      TIMESTAMP DEFAULT NOW(),
  created_by      UUID REFERENCES staff_accounts(id)
);

-- Device enrollment audit log
CREATE TABLE IF NOT EXISTS device_enrollment_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id       UUID NOT NULL REFERENCES agent_devices(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  action          VARCHAR(30) NOT NULL,                           -- enrolled, fingerprint_verified, fingerprint_mismatch, hw_id_changed, revoked
  hw_id           VARCHAR(500),                                   -- Fingerprint at time of event
  ip              INET,                                           -- IP at time of event
  location        JSONB,                                          -- Geo location at time of event
  user_agent      TEXT,                                           -- Agent version/OS
  metadata        JSONB,                                          -- Additional context
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_enrollment_device ON device_enrollment_log (device_id);
CREATE INDEX IF NOT EXISTS idx_device_enrollment_employee ON device_enrollment_log (employee_id);
CREATE INDEX IF NOT EXISTS idx_device_enrollment_action ON device_enrollment_log (action);

-- Heartbeat anomaly log (impossible travel, sequence gaps, etc.)
CREATE TABLE IF NOT EXISTS heartbeat_anomaly_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  device_id       UUID NOT NULL REFERENCES agent_devices(id) ON DELETE CASCADE,
  anomaly_type    VARCHAR(50) NOT NULL,                           -- sequence_gap, impossible_travel, fingerprint_mismatch, ip_mismatch, timeout
  severity        VARCHAR(20) DEFAULT 'warning',                  -- info, warning, critical
  details         JSONB,                                          -- Expected vs actual values
  ip              INET,
  location        JSONB,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_anomaly_session ON heartbeat_anomaly_log (session_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_anomaly_employee ON heartbeat_anomaly_log (employee_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_anomaly_type ON heartbeat_anomaly_log (anomaly_type);

-- Update monitoring_settings with new security options
ALTER TABLE monitoring_settings
  ADD COLUMN IF NOT EXISTS require_hardware_fingerprint BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_fingerprint_mismatches INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS block_on_fingerprint_mismatch BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS enforce_office_network BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allowed_office_network_ids UUID[],     -- References office_networks
  ADD COLUMN IF NOT EXISTS heartbeat_seq_validation BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_heartbeat_gap_seconds INTEGER DEFAULT 120,
  ADD COLUMN IF NOT EXISTS anomaly_alert_webhook TEXT;            -- Webhook for critical anomalies