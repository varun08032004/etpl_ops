const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});
pool.query('SELECT id, employee_code, full_name, work_email, status FROM employees WHERE work_email = $1', ['founder@ethertrack.in'])
  .then(r => console.log('Employee:', r.rows))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());