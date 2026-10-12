'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function addPdfUrlColumn() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add pdf_url column if it doesn't exist
    await client.query(`
      ALTER TABLE job_postings 
      ADD COLUMN IF NOT EXISTS pdf_url TEXT
    `);

    await client.query('COMMIT');
    console.log('✅ pdf_url column added successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to add pdf_url column:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

addPdfUrlColumn().catch(() => process.exit(1));