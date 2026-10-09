'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function update() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update 0002 to Girish Namdeo Deshmukh
    await client.query(
      'UPDATE employees SET full_name = $1 WHERE employee_code = $2',
      ['Girish Namdeo Deshmukh', 'ET-EMP-0002']
    );
    console.log('Updated 0002 to Girish Namdeo Deshmukh');

    // Update 0003 to Archana Girish Deshmukh
    await client.query(
      'UPDATE employees SET full_name = $1 WHERE employee_code = $2',
      ['Archana Girish Deshmukh', 'ET-EMP-0003']
    );
    console.log('Updated 0003 to Archana Girish Deshmukh');

    // Update 0004 to Sharvari Girish Deshmukh
    await client.query(
      'UPDATE employees SET full_name = $1 WHERE employee_code = $2',
      ['Sharvari Girish Deshmukh', 'ET-EMP-0004']
    );
    console.log('Updated 0004 to Sharvari Girish Deshmukh');

    // Update 0005 to Tejas Pankaj Deshmukh (already correct)
    // await client.query(
    //   'UPDATE employees SET full_name = $1 WHERE employee_code = $2',
    //   ['Tejas Pankaj Deshmukh', 'ET-EMP-0005']
    // );
    // console.log('Updated 0005 to Tejas Pankaj Deshmukh');

    await client.query('COMMIT');

    // Verify
    const { rows } = await pool.query('SELECT employee_code, full_name, work_email, status FROM employees ORDER BY employee_code');
    console.table(rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

update();