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

    // Update 0002 to Girish
    await client.query(
      'UPDATE employees SET full_name = $1, work_email = $2, personal_email = $3 WHERE employee_code = $4',
      ['Girish', 'girish@ethertrack.in', 'girish@ethertrack.in', 'ET-EMP-0002']
    );
    console.log('Updated 0002 to Girish');

    // Update 0004 to Sharvari
    await client.query(
      'UPDATE employees SET full_name = $1, work_email = $2, personal_email = $3 WHERE employee_code = $4',
      ['Sharvari', 'sharvari@ethertrack.in', 'sharvari@ethertrack.in', 'ET-EMP-0004']
    );
    console.log('Updated 0004 to Sharvari');

    // Verify
    const { rows } = await client.query('SELECT employee_code, full_name, work_email, status FROM employees ORDER BY employee_code');
    console.table(rows);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

update();