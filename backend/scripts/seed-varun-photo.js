'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  const docId = 'cd4a7184-b8f4-4475-8469-a932126eaa92'; // Varun's existing photo document
  const photoUrl = `/api/documents/${docId}/download`;
  
  await pool.query(
    "UPDATE employees SET id_photo_url = $1 WHERE work_email = 'founder@ethertrack.in'",
    [photoUrl]
  );
  
  console.log(`Updated founder@ethertrack.in with photo URL: ${photoUrl}`);
  
  const { rows } = await pool.query("SELECT id, full_name, id_photo_url FROM employees WHERE work_email = 'founder@ethertrack.in'");
  console.table(rows);
  
  await pool.end();
}

seed();