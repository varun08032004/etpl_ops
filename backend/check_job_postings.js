'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'job_postings'
      ORDER BY ordinal_position
    `);
    console.log('job_postings columns:');
    result.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? 'NOT NULL' : ''} ${r.column_default ? 'DEFAULT ' + r.column_default : ''}`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkColumns().catch(() => process.exit(1));