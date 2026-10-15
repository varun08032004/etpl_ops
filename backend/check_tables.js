const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%plan%'")
  .then(r => { console.table(r.rows); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });