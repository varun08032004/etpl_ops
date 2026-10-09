-- Screenshot Enhancements: Multi-monitor + Watermark + Hash Verification
-- Run after 017_device_fingerprinting.sql

-- Add multi-monitor and integrity columns to screenshots
ALTER TABLE screenshots
  ADD COLUMN IF NOT EXISTS monitor_index INTEGER DEFAULT 0,            -- 0-based monitor index
  ADD COLUMN IF NOT EXISTS monitor_name VARCHAR(200),                 -- monitor display name
  ADD COLUMN IF NOT EXISTS hash VARCHAR(64),                          -- SHA256 hash for integrity verification
  ADD COLUMN IF NOT EXISTS watermark_applied BOOLEAN DEFAULT FALSE;   -- Whether watermark was applied

-- Index for monitor queries
CREATE INDEX IF NOT EXISTS idx_screenshots_session_monitor ON screenshots (session_id, monitor_index);
CREATE INDEX IF NOT EXISTS idx_screenshots_hash ON screenshots (hash);

-- Update monitoring_settings with screenshot security options
ALTER TABLE monitoring_settings
  ADD COLUMN IF NOT EXISTS screenshot_watermark_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS screenshot_hash_verification BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS screenshot_max_monitors INTEGER DEFAULT 4;