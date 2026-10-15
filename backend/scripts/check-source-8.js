require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const entries = await pool.query("SELECT id, entry_number, source_type, source_id FROM journal_entries WHERE source_id = 'test-source-8'");
  console.log('Entries with source_id test-source-8:');
  console.table(entries.rows);
  pool.end();
}
check();