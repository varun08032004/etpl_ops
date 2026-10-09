const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

const sql = `
CREATE TABLE IF NOT EXISTS company_working_hours (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week           INT NOT NULL,
  punch_in_time         TIME NOT NULL DEFAULT '09:30:00',
  punch_out_time        TIME NOT NULL DEFAULT '19:00:00',
  grace_period_minutes  INT DEFAULT 15,
  is_working_day        BOOLEAN DEFAULT TRUE,
  late_penalty_per_min  NUMERIC(5,2) DEFAULT 0.5,
  early_leave_penalty_per_min NUMERIC(5,2) DEFAULT 0.5,
  UNIQUE(day_of_week)
);

-- Seed default working hours (Mon-Fri 9:30 AM - 7:00 PM)
INSERT INTO company_working_hours (day_of_week, punch_in_time, punch_out_time, grace_period_minutes, is_working_day, late_penalty_per_min, early_leave_penalty_per_min) VALUES
  (1, '09:30:00', '19:00:00', 15, true, 0.5, 0.5),
  (2, '09:30:00', '19:00:00', 15, true, 0.5, 0.5),
  (3, '09:30:00', '19:00:00', 15, true, 0.5, 0.5),
  (4, '09:30:00', '19:00:00', 15, true, 0.5, 0.5),
  (5, '09:30:00', '19:00:00', 15, true, 0.5, 0.5),
  (6, '00:00:00', '00:00:00', 0, false, 0, 0),
  (7, '00:00:00', '00:00:00', 0, false, 0, 0)
ON CONFLICT (day_of_week) DO NOTHING;
`;

pool.query(sql)
  .then(r => console.log('company_working_hours table created and seeded'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());