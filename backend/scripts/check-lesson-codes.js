const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT l.code 
      FROM training_lessons l 
      JOIN training_modules m ON m.id = l.module_id 
      JOIN training_courses c ON c.id = m.course_id 
      JOIN training_programmes p ON p.id = c.programme_id 
      WHERE p.code = 'CA-2026' 
      ORDER BY c.display_order, m.display_order, l.display_order
    `);
    console.log('DB lesson codes (first 20):');
    rows.slice(0, 20).forEach(r => console.log(' ', r.code));
    console.log('...');
    rows.slice(-20).forEach(r => console.log(' ', r.code));
  } finally {
    client.release();
    await pool.end();
  }
}

check();