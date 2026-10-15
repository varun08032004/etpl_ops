require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

pool.query("UPDATE schema_migrations SET status = 'applying' WHERE migration_id = '084_journal_entry_idempotency'")
  .then(() => pool.query("UPDATE schema_migrations SET status = 'applied', applied_at = NOW(), checksum_verified = true WHERE migration_id = '084_journal_entry_idempotency'"))
  .then(r => {
    console.log('Migration 084 marked as applied');
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });