const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%doc%'")
  .then(r => console.log('Doc tables:', r.rows))
  .catch(console.error)
  .finally(() => pool.end());