const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

pool.query("SELECT * FROM rag_documents LIMIT 5")
  .then(r => console.log('rag_documents:', r.rows))
  .catch(console.error)
  .finally(() => pool.end());