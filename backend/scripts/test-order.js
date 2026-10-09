'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  const { rows } = await pool.query(
    "SELECT employee_code, full_name FROM employees ORDER BY CAST(SUBSTRING(employee_code FROM '\\d+$') AS INTEGER) DESC"
  );
  console.table(rows);
  await pool.end();
}

test();