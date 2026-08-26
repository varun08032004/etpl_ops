const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function cleanupModules() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get programme ID
    const { rows: [prog] } = await client.query("SELECT id FROM training_programmes WHERE code = 'CA-2026'");
    if (!prog) return console.log('Programme not found');
    
    // Get course IDs
    const { rows: courses } = await client.query('SELECT id, code FROM training_courses WHERE programme_id = $1', [prog.id]);
    console.log(`Found ${courses.length} courses`);
    
    for (const course of courses) {
      // Get modules for this course - find duplicates by code
      const { rows: modules } = await client.query('SELECT id, code, title, display_order FROM training_modules WHERE course_id = $1 ORDER BY display_order', [course.id]);
      
      // Group by code to find duplicates
      const moduleGroups = {};
      modules.forEach(m => {
        if (!moduleGroups[m.code]) moduleGroups[m.code] = [];
        moduleGroups[m.code].push(m);
      });
      
      // Delete duplicate modules (keep the first one, delete the rest)
      for (const [code, dupes] of Object.entries(moduleGroups)) {
        if (dupes.length > 1) {
          console.log(`Course ${course.code} Module ${code}: ${dupes.length} duplicates, keeping first (display_order ${dupes[0].display_order}), deleting ${dupes.length - 1}`);
          const keepId = dupes[0].id;
          const deleteIds = dupes.slice(1).map(d => d.id);
          
          // Delete lessons for duplicate modules first
          await client.query('DELETE FROM training_lessons WHERE module_id = ANY($1)', [deleteIds]);
          console.log(`  Deleted lessons for ${deleteIds.length} duplicate modules`);
          
          // Delete duplicate modules
          await client.query('DELETE FROM training_modules WHERE id = ANY($1)', [deleteIds]);
          console.log(`  Deleted ${deleteIds.length} duplicate modules`);
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('Module cleanup committed');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
  }
}

async function cleanupLessons() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get all modules for Carbon Academy
    const { rows: modules } = await client.query(
      `SELECT m.id, m.code FROM training_modules m 
       JOIN training_courses c ON c.id = m.course_id 
       JOIN training_programmes p ON p.id = c.programme_id 
       WHERE p.code = 'CA-2026'`
    );
    
    console.log(`Found ${modules.length} modules for lesson cleanup`);
    
    for (const module of modules) {
      const { rows: lessons } = await client.query(
        `SELECT l.id, l.code, l.title FROM training_lessons l WHERE l.module_id = $1 ORDER BY l.display_order`,
        [module.id]
      );
      
      const lessonGroups = {};
      lessons.forEach(l => {
        if (!lessonGroups[l.code]) lessonGroups[l.code] = [];
        lessonGroups[l.code].push(l);
      });
      
      for (const [code, dupes] of Object.entries(lessonGroups)) {
        if (dupes.length > 1) {
          console.log(`Module ${module.code} Lesson ${code}: ${dupes.length} duplicates, keeping first, deleting ${dupes.length - 1}`);
          const deleteIds = dupes.slice(1).map(d => d.id);
          
          await client.query('DELETE FROM training_lessons WHERE id = ANY($1)', [deleteIds]);
          console.log(`  Deleted ${deleteIds.length} duplicate lessons`);
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('Lesson cleanup committed');
    
    // Verify
    const { rows: lessonsFinal } = await client.query(
      `SELECT COUNT(*) as count FROM training_lessons l 
       JOIN training_modules m ON m.id = l.module_id 
       JOIN training_courses c ON c.id = m.course_id 
       JOIN training_programmes p ON p.id = c.programme_id 
       WHERE p.code = 'CA-2026'`
    );
    console.log(`Final lessons: ${lessonsFinal[0].count}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  await cleanupModules();
  // Small delay to ensure commit is visible
  await new Promise(r => setTimeout(r, 1000));
  await cleanupLessons();
}

main();