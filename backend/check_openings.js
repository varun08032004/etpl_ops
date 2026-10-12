'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function check() {
  try {
    const result = await pool.query(`SELECT id, title, openings_count FROM job_postings WHERE id = '4f61eedf-7ba9-439b-83c3-665e1fbb9702'`);
    console.log('Job:', result.rows[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

check().catch(() => process.exit(1));