-- Performance + Monitoring Integration
-- Run after 018_screenshot_enhancements.sql

-- Add monitoring_score to performance_reviews
ALTER TABLE performance_reviews
  ADD COLUMN IF NOT EXISTS monitoring_score JSONB,           -- { score, label, breakdown, daysTracked, workMode, officePct }
  ADD COLUMN IF NOT EXISTS composite_score INTEGER,          -- Weighted: 30% monitoring + 50% manager + 20% goals
  ADD COLUMN IF NOT EXISTS goals_completion_pct INTEGER,     -- Weighted goals completion %
  ADD COLUMN IF NOT EXISTS monitoring_flags JSONB DEFAULT '[]'; -- Anomaly flags from heartbeat_anomaly_log

-- Add work_mode to agent_sessions for WFH/office tracking
ALTER TABLE agent_sessions
  ADD COLUMN IF NOT EXISTS work_mode VARCHAR(20),            -- 'office', 'wfh', 'hybrid'
  ADD COLUMN IF NOT EXISTS location_verified_at TIMESTAMP,   -- When HR verified the location
  ADD COLUMN IF NOT EXISTS location_verified_by UUID REFERENCES staff_accounts(id);

-- Index for monitoring score queries
CREATE INDEX IF NOT EXISTS idx_performance_reviews_monitoring_score ON performance_reviews USING GIN (monitoring_score);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_work_mode ON agent_sessions (work_mode);

-- View: Employee performance with monitoring data (simplified - computed cols done in application)
CREATE OR REPLACE VIEW employee_performance_summary AS
SELECT 
  e.id AS employee_id,
  e.full_name,
  e.employee_code,
  e.work_email,
  d.name AS department,
  e.manager_id,
  m.full_name AS manager_name,
  -- Latest review cycle
  rc.id AS review_cycle_id,
  rc.name AS review_cycle_name,
  rc.status AS review_cycle_status,
  rc.start_date,
  rc.end_date,
  -- Performance review
  pr.id AS review_id,
  pr.status AS review_status,
  pr.self_rating,
  pr.manager_rating,
  pr.final_rating,
  pr.monitoring_score,
  pr.composite_score,
  pr.monitoring_flags,
  pr.goals_completion_pct,
  -- Monitoring summary (current cycle)
  ms.active_seconds,
  ms.idle_seconds,
  ms.days_tracked,
  ms.office_pct,
  ms.work_mode_distribution,
  ms.productive_pct
FROM employees e
JOIN departments d ON d.id = e.department_id
LEFT JOIN employees m ON m.id = e.manager_id
LEFT JOIN review_cycles rc ON rc.status IN ('active','closed')
LEFT JOIN performance_reviews pr ON pr.review_cycle_id = rc.id AND pr.employee_id = e.id
LEFT JOIN LATERAL (
  SELECT 
    COALESCE(SUM(active_seconds),0)::int AS active_seconds,
    COALESCE(SUM(idle_seconds),0)::int AS idle_seconds,
    COUNT(DISTINCT work_date)::int AS days_tracked,
    AVG(CASE WHEN work_mode = 'office' THEN 1 ELSE 0 END) as office_pct,
    (SELECT jsonb_object_agg(work_mode, cnt) FROM (
      SELECT work_mode, COUNT(*) as cnt
      FROM agent_sessions s2
      WHERE s2.employee_id = e.id 
        AND s2.work_date BETWEEN rc.start_date AND rc.end_date
        AND work_mode IS NOT NULL
      GROUP BY work_mode
    ) sub) as work_mode_distribution,
    COALESCE(AVG(
      CASE 
        WHEN total_tracked > 0 THEN (productive_seconds::numeric / total_tracked) * 100
        ELSE 0
      END
    ), 0) as productive_pct
  FROM agent_sessions s
  LEFT JOIN LATERAL (
    SELECT 
      SUM(CASE WHEN r.category = 'productive' THEN a.duration_seconds ELSE 0 END) as productive_seconds,
      SUM(a.duration_seconds) + SUM(w.duration_seconds) as total_tracked
    FROM app_usage_segments a
    JOIN agent_sessions s2 ON s2.id = a.session_id
    JOIN productivity_rules r ON r.match_type = 'app' AND r.pattern = a.app_name
    LEFT JOIN website_usage_segments w ON w.session_id = a.session_id
    LEFT JOIN productivity_rules r2 ON r2.match_type = 'domain' AND w.domain ILIKE '%' || r2.pattern || '%'
    WHERE s2.work_date BETWEEN rc.start_date AND rc.end_date
  ) p ON true
  WHERE s.employee_id = e.id 
    AND s.work_date BETWEEN rc.start_date AND rc.end_date
  GROUP BY s.employee_id
) ms ON true
WHERE e.status = 'active';