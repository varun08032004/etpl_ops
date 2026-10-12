'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function check() {
  try {
    const result = await pool.query(`SELECT id, name FROM departments`);
    console.log('Departments:', result.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

check().catch(() => process.exit(1));