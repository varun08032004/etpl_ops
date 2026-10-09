-- Asset-Device-Agent Linking for Employee Laptop Management
-- Run after 019_performance_monitoring_integration.sql

-- Drop and recreate assets table (idempotent)
DROP TABLE IF EXISTS agent_status_history CASCADE;
DROP TABLE IF EXISTS assets CASCADE;

-- Create assets table for employee equipment (laptops, phones, etc.)
CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_tag       VARCHAR(50) UNIQUE NOT NULL,          -- e.g. ETPL-LAP-0001
  name            VARCHAR(200) NOT NULL,                -- e.g. "Dell Latitude 7430"
  asset_type      VARCHAR(50) NOT NULL,                 -- laptop, phone, monitor, dock, etc.
  serial_number   VARCHAR(100),
  model           VARCHAR(200),
  manufacturer    VARCHAR(100),
  purchase_date   DATE,
  purchase_cost   NUMERIC(14,2),
  warranty_expiry DATE,
  status          VARCHAR(20) DEFAULT 'available',      -- available, assigned, in_use, deployed, maintenance, retired
  assigned_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_at     TIMESTAMP,
  returned_at     TIMESTAMP,
  location        VARCHAR(200),                         -- office, warehouse, employee_home
  notes           TEXT,
  
  -- Agent linking fields
  agent_device_id UUID REFERENCES agent_devices(id) ON DELETE SET NULL,
  last_agent_heartbeat TIMESTAMP,
  agent_status    VARCHAR(20),                          -- active, inactive, uninstalled, never_installed
  agent_last_seen_ip INET,
  agent_version   VARCHAR(50),
  
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_employee ON assets (assigned_employee_id);
CREATE INDEX idx_assets_status ON assets (status);
CREATE INDEX idx_assets_agent_device ON assets (agent_device_id);
CREATE INDEX idx_assets_tag ON assets (asset_tag);

-- View: Employee assets with agent status
CREATE OR REPLACE VIEW employee_asset_agent_status AS
SELECT 
  a.id AS asset_id,
  a.asset_tag,
  a.name AS asset_name,
  a.asset_type,
  a.serial_number,
  a.model,
  a.manufacturer,
  a.status AS asset_status,
  e.id AS employee_id,
  e.full_name,
  e.employee_code,
  e.work_email,
  ad.id AS agent_device_id,
  ad.device_name,
  ad.os,
  ad.agent_version,
  ad.status AS agent_device_status,
  ad.last_seen_at AS agent_last_heartbeat,
  ad.hw_id,
  ad.last_known_ip,
  ad.last_known_location,
  ad.is_office_network,
  CASE 
    WHEN ad.id IS NULL THEN 'never_installed'
    WHEN ad.status = 'revoked' THEN 'uninstalled'
    WHEN ad.last_seen_at < NOW() - INTERVAL '10 minutes' THEN 'inactive'
    ELSE 'active'
  END AS agent_current_status,
  a.assigned_at,
  a.returned_at
FROM assets a
LEFT JOIN employees e ON e.id = a.assigned_employee_id
LEFT JOIN agent_devices ad ON ad.id = a.agent_device_id
WHERE a.status IN ('assigned', 'in_use', 'deployed')
ORDER BY e.full_name, a.asset_tag;

-- Agent status history for audit trail
CREATE TABLE agent_status_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_device_id UUID NOT NULL REFERENCES agent_devices(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
  old_status      VARCHAR(20),
  new_status      VARCHAR(20) NOT NULL,
  changed_by      UUID REFERENCES staff_accounts(id),
  changed_at      TIMESTAMP DEFAULT NOW(),
  details         JSONB
);

CREATE INDEX idx_agent_status_history_device ON agent_status_history (agent_device_id);
CREATE INDEX idx_agent_status_history_employee ON agent_status_history (employee_id);
CREATE INDEX idx_agent_status_history_asset ON agent_status_history (asset_id);

-- Function to update asset agent status from agent_devices
CREATE OR REPLACE FUNCTION update_asset_agent_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NOT NULL THEN
    UPDATE assets SET
      agent_device_id = NEW.id,
      agent_status = CASE 
        WHEN NEW.status = 'revoked' THEN 'uninstalled'
        WHEN NEW.last_seen_at < NOW() - INTERVAL '10 minutes' THEN 'inactive'
        ELSE 'active'
      END,
      last_agent_heartbeat = NEW.last_seen_at,
      agent_last_seen_ip = NEW.last_known_ip,
      agent_version = NEW.agent_version
    WHERE agent_device_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on agent_devices updates
DROP TRIGGER IF EXISTS trg_agent_device_update_asset ON agent_devices;
CREATE TRIGGER trg_agent_device_update_asset
AFTER UPDATE ON agent_devices
FOR EACH ROW EXECUTE FUNCTION update_asset_agent_status();