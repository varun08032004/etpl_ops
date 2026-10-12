'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function test() {
  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'job_postings'
      ORDER BY ordinal_position
    `);
    console.log('Columns:', result.rows.map(r => r.column_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test().catch(() => process.exit(1));