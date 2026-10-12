'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function fixSalesJob() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fix Sales Development Executive salary (stored as 2.4 lakhs instead of 240000 rupees)
    const result = await client.query(`
      UPDATE job_postings 
      SET salary_range_min = 240000, salary_range_max = 360000
      WHERE id = '4f61eedf-7ba9-439b-83c3-665e1fbb9702'
      RETURNING id, title, salary_range_min, salary_range_max
    `);

    await client.query('COMMIT');
    console.log('✅ Fixed Sales job salary:', result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixSalesJob().catch(() => process.exit(1));