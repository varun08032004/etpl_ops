const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const { rows: staff } = await pool.query('SELECT email, role FROM staff_accounts WHERE email = $1', ['sharvarideshmukh@ethertrack.in']);
  console.log('Staff role:', staff[0]);
  
  const { rows: dept } = await pool.query('SELECT id, name, head_employee_id FROM departments WHERE head_employee_id = $1', ['75ead39c-7601-4817-b020-80cb7c91bb0b']);
  console.log('Department head:', dept);
  
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });