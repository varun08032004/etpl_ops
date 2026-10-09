'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update staff_accounts email for 0002 (Girish)
    await client.query(
      `UPDATE staff_accounts SET email = $1 WHERE employee_id = (SELECT id FROM employees WHERE employee_code = $2)`,
      ['girish@ethertrack.in', 'ET-EMP-0002']
    );
    console.log('Updated staff_accounts for 0002 (Girish)');

    // Update staff_accounts email for 0004 (Sharvari)
    await client.query(
      `UPDATE staff_accounts SET email = $1 WHERE employee_id = (SELECT id FROM employees WHERE employee_code = $2)`,
      ['sharvari@ethertrack.in', 'ET-EMP-0004']
    );
    console.log('Updated staff_accounts for 0004 (Sharvari)');

    // Set Sharvari (0004) status to active
    await client.query(
      `UPDATE employees SET status = 'active', date_of_exit = NULL, exit_reason = NULL WHERE employee_code = $1`,
      ['ET-EMP-0004']
    );
    console.log('Set Sharvari (0004) status to active');

    // Also reactivate staff_account for Sharvari
    await client.query(
      `UPDATE staff_accounts SET is_active = true WHERE employee_id = (SELECT id FROM employees WHERE employee_code = $1)`,
      ['ET-EMP-0004']
    );
    console.log('Reactivated staff_account for Sharvari (0004)');

    await client.query('COMMIT');

    // Verify
    const { rows } = await pool.query(
      `SELECT e.employee_code, e.full_name, e.work_email, e.status, s.email as staff_email, s.is_active
       FROM employees e 
       LEFT JOIN staff_accounts s ON s.employee_id = e.id 
       ORDER BY e.employee_code`
    );
    console.table(rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

fix();