require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

pool.query("SELECT conname FROM pg_constraint WHERE conname = 'uq_journal_entries_source_type_source_id'")
  .then(r => {
    console.log('Constraint:', r.rows);
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });