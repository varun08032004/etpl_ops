'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const { rows } = await pool.query("SELECT id, full_name, id_photo_url FROM employees WHERE work_email = 'founder@ethertrack.in'");
  console.table(rows);
  
  const { rows: docs } = await pool.query("SELECT id, title, doc_type, storage_path FROM documents WHERE entity_type = 'employee' AND entity_id = (SELECT id FROM employees WHERE work_email = 'founder@ethertrack.in') AND doc_type = 'id_proof'");
  console.table(docs);
  
  await pool.end();
}

check();