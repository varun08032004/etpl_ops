'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  const { rows } = await pool.query("SELECT storage_path FROM documents WHERE doc_type = 'id_proof' LIMIT 1");
  console.log('Storage path:', rows[0]?.storage_path);
  
  // Test the file endpoint
  const docId = 'cd4a7184-b8f4-4475-8469-a932126eaa92';
  const res = await axios.get(`http://localhost:5001/api/documents/${docId}/file`);
  console.log('Status:', res.status);
  console.log('Content-Type:', res.headers['content-type']);
  
  await pool.end();
}

test().catch(console.error);