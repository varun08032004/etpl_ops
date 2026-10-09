const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

async function main() {
  const { rows } = await pool.query(`
    SELECT sa.id, sa.email, sa.role, sa.employee_id, e.full_name, e.employee_code
    FROM staff_accounts sa
    LEFT JOIN employees e ON e.id = sa.employee_id
    WHERE sa.is_active = true
  `);
  console.log('ACTIVE STAFF:');
  rows.forEach(r => console.log(' ', r.email, '| role:', r.role, '| emp:', r.employee_code, r.full_name));
  await pool.end();
}
main().catch(console.error);