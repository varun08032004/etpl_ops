const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

const sql = `
CREATE TABLE IF NOT EXISTS attendance_punch_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  work_date         DATE NOT NULL,
  punch_type        VARCHAR(20) NOT NULL,
  punch_time        TIMESTAMP NOT NULL,
  source            VARCHAR(50) DEFAULT 'manual',
  device_info       JSONB,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_punch_log_emp_date ON attendance_punch_log(employee_id, work_date);
`;

pool.query(sql)
  .then(r => console.log('Table created'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());