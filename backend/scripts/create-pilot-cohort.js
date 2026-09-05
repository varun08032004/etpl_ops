const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const programmeId = '87d0e5e3-47e6-464d-82af-ffb76ca81c29'; // CA-2026
  const creatorId = 'd0d7237c-1555-4860-876a-9d13b0ccf7ea'; // founder
  
  // Create pilot cohort
  const { rows: [cohort] } = await pool.query(`
    INSERT INTO training_pilot_cohorts (name, description, programme_id, track, start_date, end_date, created_by, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'active') RETURNING *
  `, [
    'Carbon Academy Pilot - Cohort 1',
    'First pilot cohort for EtherTrack Carbon Academy CA-2026 programme',
    programmeId,
    'management',
    new Date('2026-09-01'),
    new Date('2026-12-31'),
    creatorId
  ]);
  
  console.log('Created cohort:', cohort);
  
  // Get all active employees
  const { rows: employees } = await pool.query(`
    SELECT id FROM employees WHERE status = 'active'
  `);
  
  console.log('Active employees:', employees.length);
  
  // Get all courses in the programme
  const { rows: courses } = await pool.query(`
    SELECT id FROM training_courses WHERE programme_id = $1 AND status IN ('published', 'active', 'draft')
  `, [programmeId]);
  
  console.log('Courses in programme:', courses.length);
  
  // Create cohort course assignments for all courses
  for (const course of courses) {
    await pool.query(`
      INSERT INTO training_cohort_course_assignments (cohort_id, course_id, is_required, due_date, created_by)
      VALUES ($1, $2, true, $3, $4)
      ON CONFLICT (cohort_id, course_id) DO NOTHING
    `, [cohort.id, course.id, new Date('2026-12-31'), creatorId]);
  }
  console.log('Created cohort course assignments for all', courses.length, 'courses');
  
  // Get all active employees
  const { rows: allEmployees } = await pool.query(`
    SELECT id FROM employees WHERE status = 'active'
  `);
  
  // Add all employees to cohort and create course-level assignments
  for (const emp of allEmployees) {
    // Add employee to cohort
    const { rows: [member] } = await pool.query(`
      INSERT INTO training_cohort_members (cohort_id, employee_id, assigned_by)
      VALUES ($1,$2,$3)
      ON CONFLICT (cohort_id, employee_id) DO UPDATE SET status = 'active', assigned_by = $3, assigned_at = NOW()
      RETURNING *
    `, [cohort.id, emp.id, creatorId]);
    
    console.log(`Added employee ${emp.id} to cohort`);
    
    // Create course-level assignments for this employee (only course_id, not programme_id)
    for (const course of courses) {
      await pool.query(`
        INSERT INTO training_assignments (programme_id, course_id, employee_id, assigned_by, status, due_date, cohort_id)
        VALUES ($1, $2, $3, $4, 'assigned', $5, $6)
        ON CONFLICT DO NOTHING
      `, [null, course.id, emp.id, creatorId, new Date('2026-12-31'), cohort.id]);
    }
    
    console.log(`Created ${courses.length} course assignments for employee ${emp.id}`);
  }
  
  console.log('\n✅ Pilot cohort created with all employees and course assignments!');
  pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
});