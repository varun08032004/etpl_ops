require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

pool.query("SELECT migration_id, status FROM schema_migrations")
  .then(r => {
    console.table(r.rows);
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });