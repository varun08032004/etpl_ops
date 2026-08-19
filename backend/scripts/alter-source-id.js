const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query('ALTER TABLE rag_documents ALTER COLUMN source_id TYPE VARCHAR(255)')
  .then(() => console.log('✅ Altered source_id to VARCHAR'))
  .then(() => pool.query('ALTER TABLE rag_chunks ALTER COLUMN source_id TYPE VARCHAR(255)'))
  .then(() => console.log('✅ Altered rag_chunks source_id to VARCHAR'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());