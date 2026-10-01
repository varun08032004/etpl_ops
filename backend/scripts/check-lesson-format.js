const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const { rows } = await pool.query('SELECT id, content FROM training_lessons WHERE id = $1', ['158b3bac-7c66-4d63-992e-59f182778663']);
  console.log('Lesson content:', JSON.stringify(rows[0].content, null, 2));
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });