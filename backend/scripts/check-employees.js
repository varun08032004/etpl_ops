'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const { rows } = await pool.query(
    `SELECT e.employee_code, e.full_name, e.work_email, e.status, s.email as staff_email 
     FROM employees e 
     LEFT JOIN staff_accounts s ON s.employee_id = e.id 
     ORDER BY e.employee_code`
  );
  console.table(rows);
  await pool.end();
}

check();