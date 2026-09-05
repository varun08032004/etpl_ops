const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function debug() {
  const client = await pool.connect();
  try {
    // Check module count per course
    const { rows: courseModules } = await client.query(`
      SELECT c.code, c.title, c.display_order, COUNT(m.id) as module_count
      FROM training_courses c
      LEFT JOIN training_modules m ON m.course_id = c.id
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026'
      GROUP BY c.code, c.title, c.display_order
      ORDER BY c.display_order
    `);
    console.log('Modules per course:');
    courseModules.forEach(m => console.log(`  ${m.code}: ${m.title} - ${m.module_count} modules`));
    
    // Check hours per course
    const { rows: hours } = await client.query(`
      SELECT c.code, c.title, c.duration_hours, c.total_instructional_hours, c.total_practical_hours, c.total_assessment_hours, c.total_hours
      FROM training_courses c
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026'
      ORDER BY c.display_order
    `);
    console.log('\nHours per course:');
    hours.forEach(h => console.log(`  ${h.code}: ${h.title} - duration: ${h.duration_hours}, inst: ${h.total_instructional_hours}, prac: ${h.total_practical_hours}, assess: ${h.total_assessment_hours}, total: ${h.total_hours}`));
    
    // Check module details
    const { rows: moduleDetails } = await client.query(`
      SELECT c.code, m.title, m.duration_hours, m.display_order
      FROM training_modules m
      JOIN training_courses c ON c.id = m.course_id
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026'
      ORDER BY c.display_order, m.display_order
    `);
    console.log('\nAll modules:');
    moduleDetails.forEach(m => console.log(`  ${m.code}: ${m.title} (${m.duration_hours}h)`));
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    pool.end();
  }
}

debug();