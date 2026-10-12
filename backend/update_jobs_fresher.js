'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function updateJobs() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update all jobs to be fresher-friendly (experience_min = 0)
    await client.query(`
      UPDATE job_postings 
      SET experience_min_years = 0, experience_max_years = 2
      WHERE id IN ('713fd8cc-6922-45f1-95d8-08c798b3c9dd', '25dbfbc5-9f01-4011-8241-8b0937e5d2f5', 'ea443e7e-ef5e-442f-84f6-f1a78d59e601', '4f61eedf-7ba9-439b-83c3-665e1fbb9702')
    `);

    // Update Sales Development Executive to have 2 openings
    await client.query(`
      UPDATE job_postings 
      SET openings_count = 2
      WHERE id = '4f61eedf-7ba9-439b-83c3-665e1fbb9702'
    `);

    // Update other jobs to have 1 opening
    await client.query(`
      UPDATE job_postings 
      SET openings_count = 1
      WHERE id IN ('713fd8cc-6922-45f1-95d8-08c798b3c9dd', '25dbfbc5-9f01-4011-8241-8b0937e5d2f5', 'ea443e7e-ef5e-442f-84f6-f1a78d59e601')
    `);

    await client.query('COMMIT');
    console.log('✅ Updated all jobs: fresher-friendly, Sales has 2 openings');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

updateJobs().catch(() => process.exit(1));