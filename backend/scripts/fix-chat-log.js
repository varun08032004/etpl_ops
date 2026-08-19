const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query('ALTER TABLE ai_chat_log ADD COLUMN IF NOT EXISTS retrieved_chunks JSONB')
  .then(() => console.log('✅ Added retrieved_chunks column'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());