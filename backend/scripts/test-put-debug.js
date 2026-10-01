const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const lessonId = '158b3bac-7c66-4d63-992e-59f182778663';
  const content = { format: 'markdown', text: '# Updated Content\n\nThis is updated.' };
  const staffId = 'd0d7237c-1555-4860-876a-9d13b0ccf7ea';
  
  try {
    // Test the exact query that the route uses
    const allowed = ['title', 'description', 'lesson_type', 'duration_minutes', 'is_required', 'content', 'display_order', 'status'];
    const body = { content };
    
    const sets = [];
    const params = [];
    
    for (const key of allowed) {
      if (key in body) {
        let value = body[key];
        if (value === '') value = null;
        params.push(value);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) {
      console.log('No sets');
      return;
    }
    
    params.push(staffId);
    sets.push(`updated_by = $${params.length}`);
    params.push(lessonId);
    
    console.log('Query:', `UPDATE training_lessons SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`);
    console.log('Params:', params);
    
    const { rows: [lesson] } = await pool.query(
      `UPDATE training_lessons SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    console.log('Update successful:', lesson.id, lesson.content);
    
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Code:', e.code);
    console.error('Detail:', e.detail);
    console.error('Stack:', e.stack);
  }
  
  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });