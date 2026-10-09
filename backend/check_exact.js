const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});
pool.query("SELECT id, work_date, pg_typeof(work_date) FROM attendance_records WHERE employee_id = $1", ['a88fb6f4-e807-40b6-8142-357400df75b9'])
  .then(r => console.log('Work dates:', r.rows))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());