const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});
pool.query("DELETE FROM attendance_punch_log WHERE employee_id = $1 AND work_date = CURRENT_DATE", ['a88fb6f4-e807-40b6-8142-357400df75b9'])
  .then(() => pool.query("DELETE FROM attendance_records WHERE employee_id = $1 AND work_date = CURRENT_DATE", ['a88fb6f4-e807-40b6-8142-357400df75b9']))
  .then(r => console.log('Deleted:', r.rowCount, 'records - ready for fresh start'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());