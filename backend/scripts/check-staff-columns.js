require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'staff_accounts'")
  .then(r => {
    console.log('Columns:', r.rows);
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });