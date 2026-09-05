const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

const results = [];

function pass(msg) {
  results.push({ status: 'PASS', message: msg });
  console.log('✅ PASS:', msg);
}

function warn(msg) {
  results.push({ status: 'WARN', message: msg });
  console.log('⚠️  WARN:', msg);
}

function fail(msg) {
  results.push({ status: 'FAIL', message: msg });
  console.log('❌ FAIL:', msg);
}

async function main() {
  console.log('=== ETHERTRACK CARBON ACADEMY — PILOT READINESS VALIDATION ===\n');

  // ============ CURRICULUM VALIDATION ============
  console.log('\n--- CURRICULUM ---');
  const prog = await pool.query(`SELECT * FROM training_programmes WHERE code = 'CA-2026'`);
  if (prog.rows.length === 1) pass('1 programme (CA-2026) exists');
  else fail('CA-2026 programme not found or duplicate');

  const courses = await pool.query(`SELECT c.*, COUNT(m.id) as module_count FROM training_courses c LEFT JOIN training_modules m ON m.course_id = c.id WHERE c.programme_id = $1 GROUP BY c.id ORDER BY c.display_order`, [prog.rows[0].id]);
  if (courses.rows.length === 16) pass(`16 courses found`);
  else fail(`Expected 16 courses, found ${courses.rows.length}`);

  const modules = await pool.query(`SELECT COUNT(*) FROM training_modules m JOIN training_courses c ON c.id = m.course_id WHERE c.programme_id = $1`, [prog.rows[0].id]);
  if (parseInt(modules.rows[0].count) === 49) pass('49 modules found');
  else fail(`Expected 49 modules, found ${modules.rows[0].count}`);

  const lessons = await pool.query(`SELECT COUNT(*) FROM training_lessons l JOIN training_modules m ON m.id = l.module_id JOIN training_courses c ON c.id = m.course_id WHERE c.programme_id = $1`, [prog.rows[0].id]);
  if (parseInt(lessons.rows[0].count) === 147) pass('147 lessons found');
  else fail(`Expected 147 lessons, found ${lessons.rows[0].count}`);

  // ============ CONTENT VALIDATION ============
  console.log('\n--- CONTENT ---');
  const contentCheck = await pool.query(`
    SELECT COUNT(*) as total, 
           COUNT(*) FILTER (WHERE l.content IS NOT NULL AND l.content != '{}'::jsonb AND l.content->>'text' IS NOT NULL AND length(l.content->>'text') > 0) as with_content
    FROM training_lessons l
    JOIN training_modules m ON m.id = l.module_id
    JOIN training_courses c ON c.id = m.course_id
    WHERE c.programme_id = $1
  `, [prog.rows[0].id]);
  
  if (parseInt(contentCheck.rows[0].with_content) === 147) pass('All 147 lessons have authored content');
  else fail(`Only ${contentCheck.rows[0].with_content}/147 lessons have content`);

  const nullContent = await pool.query(`
    SELECT l.code FROM training_lessons l
    JOIN training_modules m ON m.id = l.module_id
    JOIN training_courses c ON c.id = m.course_id
    WHERE c.programme_id = $1 AND (l.content IS NULL OR l.content = '{}'::jsonb OR l.content->>'text' IS NULL OR length(l.content->>'text') = 0)
  `, [prog.rows[0].id]);
  if (nullContent.rows.length === 0) pass('No lessons with NULL content');
  else fail(`${nullContent.rows.length} lessons have NULL content: ${nullContent.rows.map(r => r.code).join(', ')}`);

  // ============ DATA INTEGRITY ============
  console.log('\n--- DATA INTEGRITY ---');
  const dupLessons = await pool.query(`
    SELECT l.code, COUNT(*) as cnt FROM training_lessons l
    JOIN training_modules m ON m.id = l.module_id
    JOIN training_courses c ON c.id = m.course_id
    WHERE c.programme_id = $1
    GROUP BY l.code HAVING COUNT(*) > 1
  `, [prog.rows[0].id]);
  if (dupLessons.rows.length === 0) pass('No duplicate lesson codes');
  else fail(`Duplicate lesson codes: ${dupLessons.rows.map(r => r.code).join(', ')}`);

  const orphanLessons = await pool.query(`
    SELECT l.id FROM training_lessons l
    LEFT JOIN training_modules m ON m.id = l.module_id
    WHERE m.id IS NULL
  `);
  if (orphanLessons.rows.length === 0) pass('No orphan lessons');
  else fail(`${orphanLessons.rows.length} orphan lessons`);

  const orphanModules = await pool.query(`
    SELECT m.id FROM training_modules m
    LEFT JOIN training_courses c ON c.id = m.course_id
    WHERE c.id IS NULL
  `);
  if (orphanModules.rows.length === 0) pass('No orphan modules');
  else fail(`${orphanModules.rows.length} orphan modules`);

  // ============ ASSIGNMENTS VALIDATION ============
  console.log('\n--- ASSIGNMENTS ---');
  const assignments = await pool.query(`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE ta.employee_id NOT IN (SELECT id FROM employees)) as bad_emp,
           COUNT(*) FILTER (WHERE ta.programme_id NOT IN (SELECT id FROM training_programmes)) as bad_prog
    FROM training_assignments ta
  `);
  if (parseInt(assignments.rows[0].bad_emp) === 0) pass('All assignments reference valid employees');
  else fail(`${assignments.rows[0].bad_emp} assignments reference invalid employees`);
  if (parseInt(assignments.rows[0].bad_prog) === 0) pass('All assignments reference valid programmes');
  else fail(`${assignments.rows[0].bad_prog} assignments reference invalid programmes`);

  const dupAssignments = await pool.query(`
    SELECT employee_id, programme_id, COUNT(*) as cnt
    FROM training_assignments
    WHERE status IN ('assigned', 'in_progress')
    GROUP BY employee_id, programme_id
    HAVING COUNT(*) > 1
  `);
  if (dupAssignments.rows.length === 0) pass('No duplicate active assignments per employee/programme');
  else warn(`${dupAssignments.rows.length} duplicate active assignments found`);

  // ============ PROGRESS VALIDATION ============
  console.log('\n--- PROGRESS ---');
  const progressIssues = await pool.query(`
    SELECT tp.*, ta.employee_id, ta.programme_id
    FROM training_progress tp
    JOIN training_assignments ta ON ta.id = tp.assignment_id
    WHERE tp.progress_pct < 0 OR tp.progress_pct > 100
       OR tp.lessons_completed > tp.lessons_total
       OR tp.assessments_completed > tp.assessments_total
  `);
  if (progressIssues.rows.length === 0) pass('No impossible progress percentages');
  else fail(`${progressIssues.rows.length} progress records have impossible values`);

  const completedProgIncompleteCourse = await pool.query(`
    SELECT tp.assignment_id FROM training_progress tp
    JOIN training_assignments ta ON ta.id = tp.assignment_id
    WHERE tp.progress_pct >= 100 AND ta.programme_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM training_courses c
      WHERE c.programme_id = ta.programme_id
      AND c.status IN ('published', 'active')
      AND c.is_mandatory = true
      AND NOT EXISTS (
        SELECT 1 FROM training_progress tp2
        WHERE tp2.assignment_id = ta.id AND tp2.course_id = c.id AND tp2.progress_pct >= 100
      )
    )
  `);
  if (completedProgIncompleteCourse.rows.length === 0) pass('No completed programme with incomplete mandatory courses');
  else warn(`${completedProgIncompleteCourse.rows.length} completed programmes have incomplete mandatory courses`);

  // ============ ASSESSMENTS VALIDATION ============
  console.log('\n--- ASSESSMENTS ---');
  const assessmentIssues = await pool.query(`
    SELECT aa.*, ta.employee_id
    FROM training_assessment_attempts aa
    JOIN training_assignments ta ON ta.id = aa.assignment_id
    WHERE aa.score_pct < 0 OR aa.score_pct > 100
       OR aa.total_marks < 0
       OR aa.earned_marks < 0
       OR aa.earned_marks > aa.total_marks
  `);
  if (assessmentIssues.rows.length === 0) pass('All assessment scores within valid ranges');
  else fail(`${assessmentIssues.rows.length} assessment attempts have invalid scores`);

  // ============ REPORTS VALIDATION ============
  console.log('\n--- REPORTS ---');
  const { rows: overview } = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM employees WHERE status = 'active') as total_employees,
      (SELECT COUNT(DISTINCT employee_id) FROM training_assignments WHERE status IN ('assigned', 'in_progress', 'completed')) as employees_in_training
  `);
  if (overview.length === 1) pass('Overview report query executes');

  // ============ SUMMARY ============
  console.log('\n=== VALIDATION SUMMARY ===');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`\nTotal Checks: ${results.length}`);
  console.log(`✅ PASS: ${passCount}`);
  console.log(`⚠️  WARN: ${warnCount}`);
  console.log(`❌ FAIL: ${failCount}`);
  
  if (failCount === 0) {
    console.log('\n🎉 ALL CRITICAL CHECKS PASSED — READY FOR PILOT');
  } else {
    console.log(`\n⚠️  ${failCount} CRITICAL FAILURES — NOT READY FOR PILOT`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Validation error:', err);
  pool.end();
});