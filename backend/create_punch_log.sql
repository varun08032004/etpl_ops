-- Create attendance_punch_log table
CREATE TABLE IF NOT EXISTS attendance_punch_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  work_date         DATE NOT NULL,
  punch_type        VARCHAR(20) NOT NULL,           -- 'in', 'out'
  punch_time        TIMESTAMP NOT NULL,
  source            VARCHAR(50) DEFAULT 'manual',   -- 'manual', 'kiosk', 'mobile', 'agent'
  device_info       JSONB,                          -- IP, user agent, location if available
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_punch_log_emp_date ON attendance_punch_log(employee_id, work_date);