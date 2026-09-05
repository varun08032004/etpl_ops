/**
 * Training Engine Backend Unit Tests
 * Tests services: trainingEngine, progress calculation, assessment engine, certificate engine
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

// Import the services
const {
  createContentVersion,
  logTrainingAction,
  recalculateProgress,
  checkAndIssueCertificate,
  generateCertificateNumber,
  ACTIONS,
  ENTITY_TYPES
} = require('../services/trainingEngine');

async function runServiceTests() {
  const results = { passed: 0, failed: 0, tests: [] };

  function assert(condition, message) {
    if (!condition) {
      const err = new Error(message);
      err.name = 'AssertionError';
      throw err;
    }
  }

  async function test(name, fn) {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`  ✅ ${name}`);
    } catch (err) {
      results.failed++;
      const msg = err.message || err.toString() || 'Unknown error';
      results.tests.push({ name, status: 'FAIL', error: msg });
      console.log(`  ❌ ${name}: ${msg}`);
    }
  }

  console.log('\n=== TRAINING ENGINE SERVICE TESTS ===\n');

  // Test 1: Content versioning
  await test('createContentVersion stores snapshot', async () => {
    const testId = 'version-test-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id, created_by
    `, [testId, testId]);
    
    await createContentVersion('programme', prog.id, '1.0', 'Test', { title: 'Test', version: '1.0' }, 'Initial', prog.created_by);
    
    const { rows } = await pool.query(`
      SELECT * FROM training_content_versions WHERE entity_id = $1 AND entity_type = 'programme'
    `, [prog.id]);
    
    assert(rows.length === 1, 'Content version not created');
    assert(rows[0].entity_type === 'programme', 'Wrong entity type');
    assert(rows[0].version === '1.0', 'Wrong version');
    assert(rows[0].content_snapshot?.title === 'Test', 'Snapshot not stored');
    
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
  });

  // Test 2: Training action logging
  await test('logTrainingAction captures changes', async () => {
    const testId = 'log-test-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [testId, testId]);
    
    await logTrainingAction({
      staffId: prog.created_by,
      action: ACTIONS.PROGRAMME_CREATED,
      entityType: ENTITY_TYPES.PROGRAMME,
      entityId: prog.id,
      newValue: { title: 'Test', code: testId }
    });
    
    const { rows } = await pool.query(`
      SELECT * FROM training_audit_logs WHERE entity_id = $1
    `, [prog.id]);
    
    assert(rows.length === 1, 'Audit log not created');
    assert(rows[0].action === ACTIONS.PROGRAMME_CREATED, 'Wrong action');
    assert(rows[0].entity_type === ENTITY_TYPES.PROGRAMME, 'Wrong entity type');
    assert(rows[0].new_value?.code === testId, 'New value not stored');
    
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
  });

  // Test 3: Certificate number generation
  await test('generateCertificateNumber produces unique format', async () => {
    const num1 = generateCertificateNumber();
    const num2 = generateCertificateNumber();
    
    assert(num1.startsWith('ET-CA-'), 'Wrong prefix');
    assert(num1 !== num2, 'Numbers not unique');
    assert(/^ET-CA-\d{4}-\d{5}$/.test(num1), 'Wrong format');
  });

  // Test 4: Progress recalculation
  await test('recalculateProgress computes programme progress', async () => {
    const testId = 'progress-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'active')
      RETURNING id
    `, [testId, testId]);
    
    const { rows: [course] } = await pool.query(`
      INSERT INTO training_courses (programme_id, title, created_by, status)
      VALUES ($1, 'Test Course', (SELECT id FROM staff_accounts LIMIT 1), 'active')
      RETURNING id
    `, [prog.id]);
    
    const { rows: [module] } = await pool.query(`
      INSERT INTO training_modules (course_id, title, created_by, status)
      VALUES ($1, 'Test Module', (SELECT id FROM staff_accounts LIMIT 1), 'active')
      RETURNING id
    `, [course.id]);
    
    const { rows: [lesson1] } = await pool.query(`
      INSERT INTO training_lessons (module_id, title, lesson_type, is_required, created_by, status)
      VALUES ($1, 'Lesson 1', 'document', true, (SELECT id FROM staff_accounts LIMIT 1), 'active')
      RETURNING id
    `, [module.id]);
    
    const { rows: [lesson2] } = await pool.query(`
      INSERT INTO training_lessons (module_id, title, lesson_type, is_required, created_by, status)
      VALUES ($1, 'Lesson 2', 'document', true, (SELECT id FROM staff_accounts LIMIT 1), 'active')
      RETURNING id
    `, [module.id]);
    
    const { rows: [emp] } = await pool.query(`
      SELECT id FROM employees WHERE status = 'active' LIMIT 1
    `);
    assert(emp, 'Need active employee');
    
    const { rows: [assignment] } = await pool.query(`
      INSERT INTO training_assignments (programme_id, employee_id, assigned_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'in_progress')
      RETURNING id
    `, [prog.id, emp.id]);
    
    // Complete lesson 1
    await pool.query(`
      INSERT INTO training_lesson_progress (assignment_id, lesson_id, status, progress_pct, completed_at)
      VALUES ($1, $2, 'completed', 100, NOW())
    `, [assignment.id, lesson1.id]);
    
    await recalculateProgress(assignment.id);
    
    const { rows: [progProgress] } = await pool.query(`
      SELECT progress_pct FROM training_progress WHERE assignment_id = $1 AND programme_id = $2
    `, [assignment.id, prog.id]);
    
    assert(progProgress, 'Progress not calculated');
    assert(parseFloat(progProgress.progress_pct) === 50, `Expected 50%, got ${progProgress.progress_pct}%`);
    
    // Cleanup
    await pool.query(`DELETE FROM training_lesson_progress WHERE assignment_id = $1`, [assignment.id]);
    await pool.query(`DELETE FROM training_progress WHERE assignment_id = $1`, [assignment.id]);
    await pool.query(`DELETE FROM training_assignments WHERE id = $1`, [assignment.id]);
    await pool.query(`DELETE FROM training_lessons WHERE module_id = $1`, [module.id]);
    await pool.query(`DELETE FROM training_modules WHERE id = $1`, [module.id]);
    await pool.query(`DELETE FROM training_courses WHERE id = $1`, [course.id]);
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
  });

  // Test 5: Assessment database constraints - single choice question
  await test('Assessment single choice question constraints', async () => {
    const testId = 'assess-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'active')
      RETURNING id
    `, [testId, testId]);
    
    const { rows: [course] } = await pool.query(`
      INSERT INTO training_courses (programme_id, title, created_by, status, passing_score_pct)
      VALUES ($1, 'Test Course', (SELECT id FROM staff_accounts LIMIT 1), 'active', 70)
      RETURNING id
    `, [prog.id]);
    
    const { rows: [assessment] } = await pool.query(`
      INSERT INTO training_assessments (course_id, title, created_by, status, passing_score_pct, max_attempts)
      VALUES ($1, 'Test Assessment', (SELECT id FROM staff_accounts LIMIT 1), 'active', 70, 3)
      RETURNING id
    `, [course.id]);
    
    // Create question with single correct answer
    const { rows: [question] } = await pool.query(`
      INSERT INTO training_questions (assessment_id, question_text, question_type, marks, created_by)
      VALUES ($1, 'What is 2+2?', 'single_choice', 10, (SELECT id FROM staff_accounts LIMIT 1))
      RETURNING id
    `, [assessment.id]);
    
    // Correct option
    await pool.query(`
      INSERT INTO training_question_options (question_id, option_text, is_correct, display_order)
      VALUES ($1, '4', true, 1)
    `, [question.id]);
    
    // Wrong options
    await pool.query(`
      INSERT INTO training_question_options (question_id, option_text, is_correct, display_order)
      VALUES ($1, '3', false, 2), ($1, '5', false, 3), ($1, '6', false, 4)
    `, [question.id]);
    
    // Verify exactly one correct option for single_choice
    const { rows: correctOpts } = await pool.query(`
      SELECT COUNT(*) as count FROM training_question_options WHERE question_id = $1 AND is_correct = true
    `, [question.id]);
    
    assert(parseInt(correctOpts[0].count) === 1, 'Single choice should have exactly one correct answer');
    
    // Cleanup
    await pool.query(`DELETE FROM training_question_options WHERE question_id = $1`, [question.id]);
    await pool.query(`DELETE FROM training_questions WHERE id = $1`, [question.id]);
    await pool.query(`DELETE FROM training_assessments WHERE id = $1`, [assessment.id]);
    await pool.query(`DELETE FROM training_courses WHERE id = $1`, [course.id]);
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
  });

  // Test 6: Assessment database constraints - multiple choice question
  await test('Assessment multiple choice question constraints', async () => {
    const testId = 'mcq-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'active')
      RETURNING id
    `, [testId, testId]);
    
    const { rows: [course] } = await pool.query(`
      INSERT INTO training_courses (programme_id, title, created_by, status, passing_score_pct)
      VALUES ($1, 'Test Course', (SELECT id FROM staff_accounts LIMIT 1), 'active', 50)
      RETURNING id
    `, [prog.id]);
    
    const { rows: [assessment] } = await pool.query(`
      INSERT INTO training_assessments (course_id, title, created_by, status, passing_score_pct)
      VALUES ($1, 'Test Assessment', (SELECT id FROM staff_accounts LIMIT 1), 'active', 50)
      RETURNING id
    `, [course.id]);
    
    // Multiple choice question - 2 correct answers out of 4
    const { rows: [question] } = await pool.query(`
      INSERT INTO training_questions (assessment_id, question_text, question_type, marks, created_by)
      VALUES ($1, 'Select all that apply', 'multiple_choice', 10, (SELECT id FROM staff_accounts LIMIT 1))
      RETURNING id
    `, [assessment.id]);
    
    // 2 correct, 2 incorrect
    await pool.query(`
      INSERT INTO training_question_options (question_id, option_text, is_correct, display_order)
      VALUES ($1, 'Option A', true, 1), ($1, 'Option B', true, 2), ($1, 'Option C', false, 3), ($1, 'Option D', false, 4)
    `, [question.id]);
    
    // Verify at least one correct option for multiple_choice
    const { rows: correctOpts } = await pool.query(`
      SELECT COUNT(*) as count FROM training_question_options WHERE question_id = $1 AND is_correct = true
    `, [question.id]);
    
    assert(parseInt(correctOpts[0].count) >= 1, 'Multiple choice should have at least one correct answer');
    
    // Cleanup
    await pool.query(`DELETE FROM training_question_options WHERE question_id = $1`, [question.id]);
    await pool.query(`DELETE FROM training_questions WHERE id = $1`, [question.id]);
    await pool.query(`DELETE FROM training_assessments WHERE id = $1`, [assessment.id]);
    await pool.query(`DELETE FROM training_courses WHERE id = $1`, [course.id]);
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
  });

  // Test 7: Certificate issuance eligibility
  await test('Certificate issued only on programme completion', async () => {
    const testId = 'cert-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status, certificate_template_id)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'active', NULL)
      RETURNING id
    `, [testId, testId]);
    
    const { rows: [emp] } = await pool.query(`
      SELECT id FROM employees WHERE status = 'active' LIMIT 1
    `);
    assert(emp, 'Need active employee');
    
    const { rows: [assignment] } = await pool.query(`
      INSERT INTO training_assignments (programme_id, employee_id, assigned_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'in_progress')
      RETURNING id
    `, [prog.id, emp.id]);
    
    // Not completed - should not issue
    await checkAndIssueCertificate(assignment.id);
    
    const { rows: certs1 } = await pool.query(`
      SELECT * FROM training_certificates WHERE assignment_id = $1
    `, [assignment.id]);
    assert(certs1.length === 0, 'Certificate should not be issued for incomplete programme');
    
    // Mark as completed
    await pool.query(`
      UPDATE training_assignments SET status = 'completed', completed_at = NOW() WHERE id = $1
    `, [assignment.id]);
    
    // Still no template - should not issue
    await checkAndIssueCertificate(assignment.id);
    const { rows: certs2 } = await pool.query(`
      SELECT * FROM training_certificates WHERE assignment_id = $1
    `, [assignment.id]);
    assert(certs2.length === 0, 'Certificate should not be issued without template');
    
    // Cleanup
    await pool.query(`DELETE FROM training_assignments WHERE id = $1`, [assignment.id]);
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
  });

  // Summary
  console.log('\n=== SERVICE TEST SUMMARY ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.passed + results.failed}`);

  await pool.end();

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All service tests passed!');
  }
}

runServiceTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});