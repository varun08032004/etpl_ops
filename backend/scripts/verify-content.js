const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

pool.query(`
  SELECT c.code as course_code, c.tier, COUNT(l.id) as lesson_count,
         SUM(CASE WHEN l.content IS NOT NULL AND l.content != '{}'::jsonb AND l.content->>'text' IS NOT NULL AND length(l.content->>'text') > 0 THEN 1 ELSE 0 END) as with_content
  FROM training_courses c
  JOIN training_modules m ON m.course_id = c.id
  JOIN training_lessons l ON l.module_id = m.id
  WHERE c.programme_id = (SELECT id FROM training_programmes WHERE code = 'CA-2026')
  GROUP BY c.code, c.tier, c.display_order
  ORDER BY c.display_order
`).then(r => {
  let total = 0, withContent = 0;
  r.rows.forEach(row => {
    total += parseInt(row.lesson_count);
    withContent += parseInt(row.with_content);
    console.log(row.course_code + ' (' + row.tier + '): ' + row.lesson_count + ' lessons, ' + row.with_content + ' with content');
  });
  console.log('TOTAL: ' + total + ' lessons, ' + withContent + ' with content');
  pool.end();
});