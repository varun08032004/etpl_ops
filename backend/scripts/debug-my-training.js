const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

// Simulate the /my-training query
const employeeId = 'a88fb6f4-e807-40b6-8142-357400df75b9';

pool.query(`
  SELECT ta.*, 
          p.title AS programme_title, p.code AS programme_code, p.version AS programme_version,
          c.title AS course_title, c.code AS course_code,
          tp.progress_pct, tp.lessons_completed, tp.lessons_total, tp.assessments_completed, tp.assessments_total, tp.average_score_pct,
          tp.started_at, tp.completed_at
   FROM training_assignments ta
   LEFT JOIN training_programmes p ON p.id = ta.programme_id
   LEFT JOIN training_courses c ON c.id = ta.course_id
   LEFT JOIN training_progress tp ON tp.assignment_id = ta.id AND tp.programme_id = ta.programme_id
   WHERE ta.employee_id = $1 AND ta.status != 'cancelled'
   ORDER BY ta.assigned_at DESC
`, [employeeId]).then(r => {
  console.log('Assignments query result:');
  r.rows.forEach(row => console.log(' - ', row));
  
  // Now test the next_lesson query for each assignment
  for (const a of r.rows) {
    console.log('\n--- Testing next_lesson query for assignment:', a.id);
    pool.query(`
      SELECT l.id, l.title, l.module_id, m.title as module_title, lp.status, lp.progress_pct
      FROM training_lessons l
      JOIN training_modules m ON m.id = l.module_id
      JOIN training_courses c ON c.id = m.course_id
      LEFT JOIN training_lesson_progress lp ON lp.lesson_id = l.id AND lp.assignment_id = $1
      WHERE c.programme_id = $2
         AND l.is_required = true
         AND (lp.status IS NULL OR lp.status != 'completed')
      ORDER BY m.display_order, l.display_order
      LIMIT 1
    `, [a.id, a.programme_id]).then(r2 => {
      console.log('next_lesson result:', r2.rows);
      
      // Test upcomingAssessments query
      console.log('\n--- Testing upcomingAssessments query for assignment:', a.id);
      return pool.query(`
        SELECT a.id, a.title, a.time_limit_minutes, a.max_attempts,
                (SELECT COUNT(*) FROM training_assessment_attempts WHERE assignment_id = $1 AND assessment_id = a.id) as attempts_used
         FROM training_assessments a
         JOIN training_courses c ON c.id = a.course_id
         WHERE a.programme_id = $2
            AND a.status IN ('published', 'active')
         ORDER BY a.created_at
      `, [a.id, a.programme_id]);
    }).then(r3 => {
      console.log('upcomingAssessments result:', r3.rows);
    }).catch(err => {
      console.error('ERROR:', err.message);
    });
  }
}).catch(err => {
  console.error('Error:', err);
  pool.end();
});