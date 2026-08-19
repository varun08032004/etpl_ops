const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const content = fs.readFileSync('db/009_missing_tables.sql', 'utf8');
    console.log('File length:', content.length);
    
    // Test the problematic statement
    const testStmt = "ALTER TABLE automation_rules ADD CONSTRAINT chk_automation_trigger_not_empty CHECK (length(trim(trigger_event)) > 0);";
    console.log('Testing statement:', testStmt);
    await client.query(testStmt);
    console.log('Statement succeeded');
    
    await client.query('ROLLBACK');
    await client.query('BEGIN');
    await client.query(fs.readFileSync('db/009_missing_tables.sql', 'utf8'));
    await client.query('COMMIT');
    console.log('009 applied');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => process.exit(1));