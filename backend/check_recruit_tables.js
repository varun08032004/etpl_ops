'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%recruit%' OR table_name LIKE '%job%'
      ORDER BY table_name
    `);
    console.log('Recruitment/Job tables:', result.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkTables().catch(() => process.exit(1));