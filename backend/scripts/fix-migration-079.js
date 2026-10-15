require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

pool.query("UPDATE schema_migrations SET status = 'failed' WHERE migration_id = '079_migration_registry'")
  .then(r => {
    console.log('Fixed');
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });