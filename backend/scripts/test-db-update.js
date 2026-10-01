const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  // Test manual update
  const lessonId = '158b3bac-7c66-4d63-992e-59f182778663';
  const content = { format: 'markdown', text: '# Updated Content\n\nThis is updated.' };
  
  try {
    const { rows: [lesson] } = await pool.query(
      'UPDATE training_lessons SET content = $1, updated_by = $2 WHERE id = $3 RETURNING *',
      [content, 'd0d7237c-1555-4860-876a-9d13b0ccf7ea', lessonId]
    );
    console.log('Update successful:', lesson.id);
  } catch (e) {
    console.error('DB Error:', e.message);
    console.error('Code:', e.code);
    console.error('Detail:', e.detail);
  }
  
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });