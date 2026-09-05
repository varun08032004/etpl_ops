-- Agent & Monitoring tables
-- Run after 002_platform_sync.sql and employees table exists

-- Agent devices: one row per employee + device_name (laptop/desktop)
CREATE TABLE IF NOT EXISTS agent_devices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  device_name     VARCHAR(200) NOT NULL,           -- e.g. "LAPTOP-JOHN"
  os              VARCHAR(100),                    -- windows/mac/linux + version
  agent_version   VARCHAR(50),                     -- agent app version
  status          VARCHAR(20) DEFAULT 'active',    -- active, revoked
  last_seen_at    TIMESTAMP DEFAULT NOW(),
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (employee_id, device_name)
);

-- Agent sessions: a work session (clock-in to clock-out)
CREATE TABLE IF NOT EXISTS agent_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  device_id         UUID NOT NULL REFERENCES agent_devices(id) ON DELETE CASCADE,
  work_date         DATE NOT NULL,                 -- local date (Asia/Kolkata)
  clock_in          TIMESTAMP NOT NULL,
  clock_out         TIMESTAMP,                     -- null while session is open
  active_seconds    INTEGER DEFAULT 0,             -- cumulative for this session
  idle_seconds      INTEGER DEFAULT 0,
  status            VARCHAR(20) DEFAULT 'open',    -- open, closed
  end_reason        VARCHAR(30),                   -- logout, force_logout, timeout
  current_app       VARCHAR(300),                  -- last heartbeat's foreground app
  current_window_title VARCHAR(500),              -- last heartbeat's window title
  current_domain    VARCHAR(300),                  -- last heartbeat's active domain
  last_heartbeat_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_emp_date ON agent_sessions (employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions (status) WHERE status = 'open';

-- App usage segments (per heartbeat batch)
CREATE TABLE IF NOT EXISTS app_usage_segments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  app_name          VARCHAR(300) NOT NULL,
  window_title      VARCHAR(500),
  started_at        TIMESTAMP NOT NULL,
  ended_at          TIMESTAMP NOT NULL,
  duration_seconds  INTEGER NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_usage_session ON app_usage_segments (session_id);

-- Website usage segments (per heartbeat batch)
CREATE TABLE IF NOT EXISTS website_usage_segments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  domain            VARCHAR(300) NOT NULL,
  started_at        TIMESTAMP NOT NULL,
  ended_at          TIMESTAMP NOT NULL,
  duration_seconds  INTEGER NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_usage_session ON website_usage_segments (session_id);

-- Idle periods (per heartbeat batch)
CREATE TABLE IF NOT EXISTS idle_periods (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  started_at        TIMESTAMP NOT NULL,
  ended_at          TIMESTAMP,                    -- null if current idle period
  duration_seconds  INTEGER,                      -- computed when ended
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idle_periods_session ON idle_periods (session_id);

-- Screenshots
CREATE TABLE IF NOT EXISTS screenshots (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  captured_at       TIMESTAMP NOT NULL,
  storage_path      VARCHAR(500) NOT NULL,        -- path in S3/R2 bucket
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screenshots_session ON screenshots (session_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_emp_date ON screenshots (employee_id, captured_at);

-- Monitoring settings (single-row table for company-wide toggles)
CREATE TABLE IF NOT EXISTS monitoring_settings (
  id                        INTEGER PRIMARY KEY DEFAULT 1,
  screenshots_enabled       BOOLEAN DEFAULT TRUE,
  screenshot_interval_sec   INTEGER DEFAULT 300,     -- 5 minutes
  heartbeat_interval_seconds INTEGER DEFAULT 30,     -- agent heartbeat interval
  idle_threshold_seconds    INTEGER DEFAULT 300,     -- 5 minutes idle before marking away
  blur_screenshots          BOOLEAN DEFAULT FALSE,   -- blur sensitive content
  track_apps                BOOLEAN DEFAULT TRUE,
  track_websites            BOOLEAN DEFAULT TRUE,
  track_idle                BOOLEAN DEFAULT TRUE,
  privacy_mode_default      BOOLEAN DEFAULT FALSE,   -- agent starts in privacy mode
  consent_notice            TEXT,                    -- consent notice shown in agent
  restrict_incognito        BOOLEAN DEFAULT FALSE,   -- block tracking in incognito/private
  expected_daily_hours      NUMERIC(4,2) DEFAULT 8.0,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

INSERT INTO monitoring_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Productivity rules: categorize apps/domains as productive/neutral/distracting
CREATE TABLE IF NOT EXISTS productivity_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150) NOT NULL,             -- e.g. "VS Code", "GitHub", "YouTube"
  match_type      VARCHAR(20) NOT NULL,              -- app, domain
  pattern         VARCHAR(300) NOT NULL,             -- exact match or substring (e.g. "code", "youtube.com")
  category        VARCHAR(20) NOT NULL,              -- productive, neutral, distracting, blocked
  applies_to      VARCHAR(20) DEFAULT 'all',         -- all, department:uuid, team:uuid
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES staff_accounts(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- View: today's active sessions for dashboard
CREATE OR REPLACE VIEW agent_active_sessions AS
SELECT
  s.id AS session_id,
  s.employee_id,
  e.full_name,
  e.work_email,
  e.employee_code,
  s.device_id,
  d.device_name,
  s.work_date,
  s.clock_in,
  s.active_seconds,
  s.idle_seconds,
  s.current_app,
  s.current_window_title,
  s.current_domain,
  s.last_heartbeat_at
FROM agent_sessions s
JOIN employees e ON e.id = s.employee_id
JOIN agent_devices d ON d.id = s.device_id
WHERE s.status = 'open'
  AND s.last_heartbeat_at > NOW() - INTERVAL '10 minutes';