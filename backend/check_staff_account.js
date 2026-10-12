'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function check() {
  try {
    const result = await pool.query(`SELECT id, email FROM staff_accounts WHERE email = 'varun@ethertrack.in' LIMIT 1`);
    console.log('Staff account:', result.rows[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

check().catch(() => process.exit(1));