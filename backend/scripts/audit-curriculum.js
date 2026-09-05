const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function audit() {
  const client = await pool.connect();
  try {
    // Get all lessons with their course/module hierarchy
    const result = await client.query(`
      SELECT 
        l.id as lesson_id,
        l.code as lesson_code,
        l.title as lesson_title,
        l.content,
        l.status as lesson_status,
        m.code as module_code,
        m.title as module_title,
        c.code as course_code,
        c.title as course_title,
        c.id as course_id,
        m.id as module_id
      FROM training_lessons l
      JOIN training_modules m ON m.id = l.module_id
      JOIN training_courses c ON c.id = m.course_id
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026'
      ORDER BY c.display_order, m.display_order, l.display_order
    `);
    
    console.log('TOTAL LESSONS IN DB:', result.rows.length);
    console.log('');
    
    // Group by course
    const byCourse = {};
    result.rows.forEach(row => {
      const key = row.course_code;
      if (!byCourse[key]) byCourse[key] = [];
      byCourse[key].push(row);
    });
    
    console.log('COURSE BREAKDOWN:');
    Object.keys(byCourse).sort().forEach(courseCode => {
      const lessons = byCourse[courseCode];
      const withContent = lessons.filter(l => l.content && l.content.text && l.content.text.trim().length > 0).length;
      const withoutContent = lessons.length - withContent;
      console.log(`  ${courseCode}: ${lessons.length} lessons, ${withContent} with content, ${withoutContent} without content`);
    });
    
    // Detailed lesson list
    console.log('');
    console.log('DETAILED LESSON LIST:');
    result.rows.forEach(row => {
      const hasContent = row.content && row.content.text && row.content.text.trim().length > 0;
      const contentLen = hasContent ? row.content.text.length : 0;
      console.log(`${row.course_code} | ${row.module_code} | ${row.lesson_code} | ${row.lesson_title.substring(0,60)} | Content: ${hasContent ? 'YES (' + contentLen + ' chars)' : 'NO'} | Status: ${row.lesson_status}`);
    });
    
    // Check for C03.4 specifically
    console.log('');
    console.log('CHECKING FOR C03.4:');
    const c034 = result.rows.filter(r => r.module_code && r.module_code.startsWith('3.4'));
    console.log('C03.4 lessons found:', c034.length);
    c034.forEach(r => console.log(`  ${r.module_code} | ${r.lesson_code} | ${r.lesson_title}`));
    
  } finally {
    client.release();
    await pool.end();
  }
}

audit().catch(console.error);