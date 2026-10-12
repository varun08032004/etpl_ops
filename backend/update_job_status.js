'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function updateStatus() {
  try {
    const result = await pool.query(`
      UPDATE job_postings 
      SET status = 'published' 
      WHERE id = '4f61eedf-7ba9-439b-83c3-665e1fbb9702' 
      RETURNING id, title, status
    `);
    console.log('Updated:', result.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

updateStatus().catch(() => process.exit(1));