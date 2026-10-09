const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

// First check the exact value
pool.query("SELECT id, work_date, work_date::text FROM attendance_records WHERE employee_id = $1", ['a88fb6f4-e807-40b6-8142-357400df75b9'])
  .then(r => {
    console.log('Records:', r.rows);
    return pool.query("UPDATE attendance_records SET work_date = '2026-10-08' WHERE employee_id = $1 AND work_date = '2026-10-07'", ['a88fb6f4-e807-40b6-8142-357400df75b9']);
  })
  .then(r => console.log('Updated:', r.rowCount, 'rows'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());