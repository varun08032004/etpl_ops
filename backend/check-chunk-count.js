const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

pool.query("SELECT COUNT(*) FROM rag_chunks")
  .then(r => console.log('Chunks in rag_chunks:', r.rows[0].count))
  .catch(console.error)
  .finally(() => pool.end());