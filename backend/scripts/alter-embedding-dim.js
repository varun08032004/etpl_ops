const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

// First check current chunks count
pool.query('SELECT COUNT(*) FROM rag_chunks')
  .then(r => console.log('Current chunks:', r.rows[0].count))
  .then(() => pool.query('ALTER TABLE rag_chunks ALTER COLUMN embedding TYPE vector(768)'))
  .then(() => console.log('✅ Altered column to vector(768)'))
  .then(() => pool.query("SELECT format_type(atttypid, atttypmod) as full_type FROM pg_attribute WHERE attrelid = 'rag_chunks'::regclass AND attname = 'embedding'"))
  .then(r => console.log('New type:', r.rows))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());