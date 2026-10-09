'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const { rows } = await pool.query(
    "SELECT id, full_name, id_photo_url FROM employees WHERE id = 'a88fb6f4-e807-40b6-8142-357400df75b9'"
  );
  console.table(rows);
  
  // Also check documents
  const { rows: docs } = await pool.query(
    "SELECT id, title, doc_type, storage_path, file_name FROM documents WHERE entity_type = 'employee' AND entity_id = 'a88fb6f4-e807-40b6-8142-357400df75b9' AND doc_type = 'id_proof'"
  );
  console.table(docs);
  
  await pool.end();
}

check();