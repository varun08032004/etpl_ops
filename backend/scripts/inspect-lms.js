const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'training_%' ORDER BY table_name`).then(r => {
  console.log('Training tables:');
  r.rows.forEach(row => console.log(' - ' + row.table_name));
  
  // Check columns for key tables
  const tables = ['training_programmes', 'training_courses', 'training_modules', 'training_lessons', 
                  'training_assignments', 'training_progress', 'training_lesson_progress',
                  'training_assessments', 'training_questions', 'training_assessment_attempts',
                  'training_certificates', 'training_exercises', 'training_materials'];
  
  let promise = Promise.resolve();
  for (const table of tables) {
    promise = promise.then(() => 
      pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table])
        .then(r => {
          console.log(`\n${table}:`);
          r.rows.forEach(col => console.log(`  ${col.column_name} (${col.data_type})`));
        })
    );
  }
  return promise;
}).then(() => {
  pool.end();
}).catch(err => {
  console.error('Error:', err);
  pool.end();
});