'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function check() {
  try {
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%staff%' OR table_name LIKE '%employee%' OR table_name LIKE '%user%')
      ORDER BY table_name
    `);
    console.log('Tables:', result.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

check().catch(() => process.exit(1));