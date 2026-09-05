'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`
  SELECT code, title, 
         CASE WHEN content IS NULL THEN 'NULL' 
              WHEN content::text = '' THEN 'EMPTY' 
              ELSE 'HAS CONTENT' END as content_status,
         content->>'markdown' as markdown_preview
  FROM training_lessons 
  WHERE code IN ('10.1.3', '11.1.3', '16.4.3')
`)
  .then(r => console.table(r.rows))
  .catch(e => console.error(e))
  .finally(() => pool.end());