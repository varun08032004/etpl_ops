require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

// Check if there's any audit log or point-in-time recovery info
pool.query("SELECT * FROM information_schema.tables WHERE table_name = 'audit_log'")
  .then(r => {
    console.log('Audit log table exists:', r.rows.length > 0);
    if (r.rows.length > 0) {
      return pool.query("SELECT COUNT(*) FROM audit_log");
    }
  })
  .then(r => {
    if (r) console.log('Audit log count:', r.rows[0].count);
    return pool.query("SELECT * FROM pg_settings WHERE name LIKE '%wal%' OR name LIKE '%replication%' OR name LIKE '%archive%' OR name LIKE '%pitr%' OR name LIKE '%point_in_time%'");
  })
  .then(r => {
    console.log('PITR-related settings:');
    console.table(r.rows);
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });