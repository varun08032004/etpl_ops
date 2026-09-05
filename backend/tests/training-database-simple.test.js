const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function runTests() {
  const results = { passed: 0, failed: 0, tests: [] };

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  async function test(name, fn) {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`  ✅ ${name}`);
    } catch (err) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: err.message });
      console.log(`  ❌ ${name}: ${err.message}`);
    }
  }

  console.log('\n=== TRAINING ENGINE DATABASE TESTS ===\n');

  // 1. All training tables exist
  await test('All 16 training tables exist', async () => {
    const expectedTables = [
      'training_programmes',
      'training_courses',
      'training_modules',
      'training_lessons',
      'training_materials',
      'training_exercises',
      'training_assessments',
      'training_questions',
      'training_question_options',
      'training_assignments',
      'training_progress',
      'training_lesson_progress',
      'training_assessment_attempts',
      'training_certificates',
      'training_content_versions',
      'training_audit_logs'
    ];

    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'training_%'
    `);
    const foundTables = rows.map(r => r.table_name);
    
    for (const t of expectedTables) {
      assert(foundTables.includes(t), `Missing table: ${t}`);
    }
  });

  // Summary
  console.log('\n=== DATABASE TEST SUMMARY ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.passed + results.failed}`);

  await pool.end();

  if (results.failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);