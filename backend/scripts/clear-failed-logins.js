const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query(`DELETE FROM failed_login_attempts WHERE staff_account_id = (SELECT id FROM staff_accounts WHERE email = 'founder@ethertrack.in')`).then(r => {
  console.log('Cleared failed login attempts:', r.rowCount);
  pool.end();
}).catch(err => { console.error('Error:', err); pool.end(); });