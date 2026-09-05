const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function applyFix() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', '019_carbon_academy_course_columns.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Course columns added successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Fix failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

applyFix().catch(() => process.exit(1));