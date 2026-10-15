require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

const sql = `
SELECT source_type, source_id, COUNT(*) 
FROM journal_entries 
WHERE source_type IS NOT NULL AND source_id IS NOT NULL
GROUP BY source_type, source_id 
HAVING COUNT(*) > 1;
`;

pool.query(sql)
  .then(r => {
    console.log('Duplicates:', r.rows);
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });