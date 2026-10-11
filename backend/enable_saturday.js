const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

const sql = `
UPDATE company_working_hours 
SET is_working_day = true, 
    punch_in_time = '09:30:00', 
    punch_out_time = '19:00:00', 
    grace_period_minutes = 15, 
    late_penalty_per_min = 0.5, 
    early_leave_penalty_per_min = 0.5 
WHERE day_of_week = 6
`;

pool.query(sql)
  .then(r => console.log('Updated:', r.rowCount, 'rows'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());