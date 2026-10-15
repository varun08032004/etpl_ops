require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

const sql = `CREATE UNIQUE INDEX uq_journal_entries_source_type_source_id 
ON journal_entries (source_type, source_id) 
WHERE source_type IS NOT NULL AND source_id IS NOT NULL;`;

pool.query(sql)
  .then(r => {
    console.log('Index added');
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });