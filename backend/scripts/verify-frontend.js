'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`
  SELECT code, title, content->>'text' as text_preview
  FROM training_lessons
  WHERE code IN ('10.1.1', '11.1.1', '12.1.1')
`)
  .then(r => {
    console.table(r.rows.map(r => ({
      code: r.code,
      title: r.title,
      hasText: !!r.text_preview,
      preview: r.text_preview?.substring(0, 80)
    })));
    pool.end();
  })
  .catch(e => { console.error(e); pool.end(); });