const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

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
    
    console.log(`Found ${modules.length} modules`);
    
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
    console.log('Lesson cleanup complete');
    
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

cleanupLessons();