const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function validate() {
  const client = await pool.connect();
  try {
    console.log('\n=== CARBON ACADEMY V1.2 VALIDATION ===\n');
    
    // 1. Programme count
    const { rows: [progCount] } = await client.query(`SELECT COUNT(*) as count FROM training_programmes WHERE code = 'CA-2026'`);
    console.log(`Programme: ${progCount.count} (expected 1)`);
    
    // 2. Course count
    const { rows: [courseCount] } = await client.query(`SELECT COUNT(*) as count FROM training_courses WHERE programme_id = (SELECT id FROM training_programmes WHERE code = 'CA-2026')`);
    console.log(`Courses: ${courseCount.count} (expected 16)`);
    
    // 3. Module count
    const { rows: [moduleCount] } = await client.query(`
      SELECT COUNT(*) as count FROM training_modules m
      JOIN training_courses c ON c.id = m.course_id
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026'
    `);
    console.log(`Modules: ${moduleCount.count} (expected 49)`);
    
    // 4. Lesson count
    const { rows: [lessonCount] } = await client.query(`
      SELECT COUNT(*) as count FROM training_lessons l
      JOIN training_modules m ON m.id = l.module_id
      JOIN training_courses c ON c.id = m.course_id
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026'
    `);
    console.log(`Lessons: ${lessonCount.count} (expected 147)`);
    
    // 5. Hours reconciliation
    const { rows: [hours] } = await client.query(`
      SELECT 
        SUM(c.total_instructional_hours) as instructional,
        SUM(c.total_practical_hours) as practical,
        SUM(c.total_assessment_hours) as assessment,
        SUM(c.total_hours) as total
      FROM training_courses c
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026'
    `);
    console.log(`\nHours reconciliation (RECONCILED - based on module-level detail):`);
    console.log(`  Instructional: ${hours.instructional} (blueprint detail sum: 73.0; blueprint summary said 71.5)`);
    console.log(`  Practical: ${hours.practical} (blueprint detail sum: 39.0; blueprint summary said 37.0)`);
    console.log(`  Assessment: ${hours.assessment} (expected 10.5)`);
    console.log(`  Total: ${hours.total} (expected 119.0)`);
    
    // 6. Specialist tracks
    const { rows: tracks } = await client.query(`SELECT track_type, track_name FROM carbon_academy_specialist_tracks ORDER BY track_type`);
    console.log(`\nSpecialist tracks (${tracks.length}):`);
    tracks.forEach(t => console.log(`  - ${t.track_type}: ${t.track_name}`));
    
    // 7. Certification levels
    const { rows: certs } = await client.query(`SELECT level_name, level_number, title FROM carbon_academy_certification_levels ORDER BY level_number`);
    console.log(`\nCertification levels (${certs.length}):`);
    certs.forEach(c => console.log(`  - Level ${c.level_number}: ${c.title} (${c.level_name})`));
    
    // 9. Capstone requirements
    const { rows: capstone } = await client.query(`SELECT component_name, weight_percentage FROM carbon_academy_capstone_requirements WHERE programme_id = (SELECT id FROM training_programmes WHERE code = 'CA-2026')`);
    console.log(`\nCapstone components (${capstone.length}):`);
    capstone.forEach(c => console.log(`  - ${c.component_name}: ${c.weight_percentage}%`));
    
    // 10. Role-track mappings
    const { rows: roleTracks } = await client.query(`
      SELECT r.role_name, r.department, m.track_type as mandatory_track
      FROM carbon_academy_role_tracks r
      JOIN carbon_academy_specialist_tracks m ON m.id = r.mandatory_track_id
      ORDER BY r.role_name
    `);
    console.log(`\nRole-track mappings (${roleTracks.length}):`);
    roleTracks.forEach(r => console.log(`  - ${r.role_name} (${r.department}) → ${r.mandatory_track}`));
    
    console.log('\n=== VALIDATION COMPLETE ===');
    
  } catch (err) {
    console.error('Validation error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

validate();