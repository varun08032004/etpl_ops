require('dotenv').config();
const fs = require('fs');
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

async function run() {
  try {
    const sql = fs.readFileSync('./db/085_bank_reconciliation_schema.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration 085 applied successfully');
  } catch (e) {
    console.error('Failed:', e.message);
  } finally {
    pool.end();
  }
}
run();