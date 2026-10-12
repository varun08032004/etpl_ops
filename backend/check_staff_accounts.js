'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function check() {
  try {
    const result = await pool.query(`SELECT id, email, role FROM staff_accounts LIMIT 10`);
    console.log('Staff accounts:', result.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

check().catch(() => process.exit(1));