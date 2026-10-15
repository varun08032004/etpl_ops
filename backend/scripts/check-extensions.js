require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

pool.query("SELECT * FROM pg_available_extensions WHERE name IN ('pg_cron', 'pg_stat_statements', 'uuid-ossp', 'pgcrypto')")
  .then(r => {
    console.log('Extensions:');
    console.table(r.rows);
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });