const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query("SELECT format_type(atttypid, atttypmod) as full_type FROM pg_attribute WHERE attrelid = 'rag_chunks'::regclass AND attname = 'embedding'")
  .then(r => console.log(r.rows))
  .catch(e => console.error(e.message))
  .finally(() => pool.end());