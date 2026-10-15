require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

async function check() {
  try {
    const r = await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'journal_entries'");
    console.log('Indexes on journal_entries:');
    console.table(r.rows);
  } catch (e) {
    console.log('Error:', e.message);
  }
  pool.end();
}
check();