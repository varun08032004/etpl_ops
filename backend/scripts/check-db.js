const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    // Check programmes
    const { rows: progs } = await client.query("SELECT id, title, code, status FROM training_programmes WHERE code = 'CA-2026'");
    console.log('Programmes:', progs);
    
    if (!progs[0]) {
      console.log('No programme found');
      return;
    }
    
    // Check courses
    const { rows: courses } = await client.query('SELECT id, programme_id, title, code, status, tier FROM training_courses WHERE programme_id = $1 ORDER BY display_order', [progs[0].id]);
    console.log('Courses:', courses.length);
    courses.forEach(c => console.log('  ', c.code, c.title, c.status, c.tier));
    
    // Check modules
    const { rows: modules } = await client.query('SELECT m.id, m.course_id, m.title, m.code, m.status FROM training_modules m JOIN training_courses c ON c.id = m.course_id WHERE c.programme_id = $1 ORDER BY c.display_order, m.display_order', [progs[0].id]);
    console.log('Modules:', modules.length);
    modules.forEach(m => console.log('  ', m.code, m.title, m.status));
    
    // Check lessons
    const { rows: lessons } = await client.query('SELECT l.id, l.module_id, l.title, l.code, l.status, l.content FROM training_lessons l JOIN training_modules m ON m.id = l.module_id JOIN training_courses c ON c.id = m.course_id WHERE c.programme_id = $1 ORDER BY c.display_order, m.display_order, l.display_order', [progs[0].id]);
    console.log('Lessons:', lessons.length);
    const withContent = lessons.filter(l => l.content && l.content.text && l.content.text.trim().length > 0);
    console.log('  With content:', withContent.length);
    console.log('  With content object:', lessons.filter(l => l.content && typeof l.content === 'object').length);
    console.log('  Sample content:', JSON.stringify(lessons[0]?.content).substring(0, 200));
    
    // Check content versions
    const { rows: versions } = await client.query("SELECT entity_type, entity_id, version, content_version_status FROM training_content_versions WHERE entity_type = 'lesson' ORDER BY created_at DESC");
    console.log('Content versions for lessons:', versions.length);
    versions.forEach(v => console.log('  ', v.entity_id, v.version, v.content_version_status));
    
  } finally {
    client.release();
    await pool.end();
  }
}

check();