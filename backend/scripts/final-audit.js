const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function audit() {
  const client = await pool.connect();
  try {
    // Check for duplicate lesson codes
    const dupResult = await client.query(`
      SELECT code, COUNT(*) as cnt
      FROM training_lessons
      GROUP BY code
      HAVING COUNT(*) > 1
    `);
    console.log('DUPLICATE LESSON CODES:');
    console.log(dupResult.rows);
    
    // Check for orphan modules (modules without lessons)
    const orphanModules = await client.query(`
      SELECT m.code, m.title
      FROM training_modules m
      LEFT JOIN training_lessons l ON l.module_id = m.id
      JOIN training_courses c ON c.id = m.course_id
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026' AND l.id IS NULL
    `);
    console.log('\nORPHAN MODULES (no lessons):');
    console.log(orphanModules.rows);
    
    // Check for lessons with duplicate IDs
    const dupIds = await client.query(`
      SELECT id, COUNT(*) as cnt
      FROM training_lessons
      GROUP BY id
      HAVING COUNT(*) > 1
    `);
    console.log('\nDUPLICATE LESSON IDs:');
    console.log(dupIds.rows);
    
    // Check lesson codes for uniqueness within module
    const dupInModule = await client.query(`
      SELECT module_id, code, COUNT(*) as cnt
      FROM training_lessons
      GROUP BY module_id, code
      HAVING COUNT(*) > 1
    `);
    console.log('\nDUPLICATE LESSON CODES WITHIN MODULE:');
    console.log(dupInModule.rows);
    
    // Check for C03.4 module specifically
    const c034modules = await client.query(`
      SELECT * FROM training_modules m
      JOIN training_courses c ON c.id = m.course_id
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026' AND c.code = 'C03' AND m.code LIKE '3.4%'
    `);
    console.log('\nC03.4 MODULES:');
    console.log(c034modules.rows);
    
    // Check for any lessons with module code containing 3.4
    const c034lessons = await client.query(`
      SELECT l.code, m.code as module_code, c.code as course_code
      FROM training_lessons l
      JOIN training_modules m ON m.id = l.module_id
      JOIN training_courses c ON c.id = m.course_id
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026' AND m.code LIKE '3.4%'
    `);
    console.log('\nLessons with module code 3.4%:');
    console.log(c034lessons.rows);
    
    // Check duplicate codes
    const dup = await client.query('SELECT code, COUNT(*) as cnt FROM training_lessons GROUP BY code HAVING COUNT(*) > 1');
    console.log('\nDUPLICATE CODES:');
    console.log(dup.rows);
    
    // Check orphan modules
    const orphans = await client.query(`
      SELECT m.code, m.title FROM training_modules m
      LEFT JOIN training_lessons l ON l.module_id = m.id
      JOIN training_courses c ON c.id = m.course_id
      JOIN training_programmes p ON p.id = c.programme_id
      WHERE p.code = 'CA-2026' AND l.id IS NULL
    `);
    console.log('\nORPHAN MODULES:');
    console.log(orphans.rows);
    
  } finally {
    client.release();
    await pool.end();
  }
}

audit().catch(console.error);