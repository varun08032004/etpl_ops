/**
 * Training Engine Database Tests
 * Tests table structure, constraints, indexes, triggers, and RLS policies
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function runDatabaseTests() {
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

  // 2. Primary keys exist
  await test('All training tables have UUID primary keys', async () => {
    const { rows } = await pool.query(`
      SELECT t.table_name, k.column_name
      FROM information_schema.tables t
      LEFT JOIN information_schema.key_column_usage k 
        ON k.table_name = t.table_name AND k.constraint_name LIKE '%pkey%'
      WHERE t.table_schema = 'public' AND t.table_name LIKE 'training_%'
      ORDER BY t.table_name
    `);
    
    for (const r of rows) {
      assert(r.column_name === 'id', `${r.table_name}: PK column is not 'id' (got ${r.column_name})`);
    }
  });

  // 3. Foreign keys exist
  await test('Foreign keys reference correct tables', async () => {
    const fkChecks = [
      { table: 'training_courses', column: 'programme_id', ref: 'training_programmes' },
      { table: 'training_modules', column: 'course_id', ref: 'training_courses' },
      { table: 'training_lessons', column: 'module_id', ref: 'training_modules' },
      { table: 'training_materials', column: 'lesson_id', ref: 'training_lessons' },
      { table: 'training_exercises', column: 'lesson_id', ref: 'training_lessons' },
      { table: 'training_questions', column: 'assessment_id', ref: 'training_assessments' },
      { table: 'training_question_options', column: 'question_id', ref: 'training_questions' },
      { table: 'training_assignments', column: 'programme_id', ref: 'training_programmes' },
      { table: 'training_assignments', column: 'course_id', ref: 'training_courses' },
      { table: 'training_assignments', column: 'employee_id', ref: 'employees' },
      { table: 'training_assignments', column: 'assigned_by', ref: 'staff_accounts' },
      { table: 'training_progress', column: 'assignment_id', ref: 'training_assignments' },
      { table: 'training_lesson_progress', column: 'assignment_id', ref: 'training_assignments' },
      { table: 'training_lesson_progress', column: 'lesson_id', ref: 'training_lessons' },
      { table: 'training_assessment_attempts', column: 'assignment_id', ref: 'training_assignments' },
      { table: 'training_assessment_attempts', column: 'assessment_id', ref: 'training_assessments' },
      { table: 'training_certificates', column: 'assignment_id', ref: 'training_assignments' },
      { table: 'training_certificates', column: 'programme_id', ref: 'training_programmes' },
      { table: 'training_certificates', column: 'employee_id', ref: 'employees' },
      { table: 'training_certificates', column: 'issued_by', ref: 'staff_accounts' },
    ];

    for (const fk of fkChecks) {
      const { rows } = await pool.query(`
        SELECT 1 FROM information_schema.key_column_usage k
        JOIN information_schema.referential_constraints r 
          ON k.constraint_name = r.constraint_name
        JOIN information_schema.key_column_usage rk
          ON r.unique_constraint_name = rk.constraint_name
        WHERE k.table_name = $1 AND k.column_name = $2
          AND rk.table_name = $3
      `, [fk.table, fk.column, fk.ref]);
      
      assert(rows.length > 0, `FK missing: ${fk.table}.${fk.column} -> ${fk.ref}`);
    }
  });

  // 4. Check constraints exist
  await test('Check constraints enforce data integrity', async () => {
    const { rows } = await pool.query(`
      SELECT conname, conrelid::regclass as table_name
      FROM pg_constraint
      WHERE contype = 'c' 
        AND conrelid::regclass::text LIKE 'training_%'
      ORDER BY conrelid::regclass::text, conname
    `);
    
    const constraintNames = rows.map(r => r.conname);
    const expectedConstraints = [
      'chk_assessment_scope',
      'chk_assignment_scope',
    ];
    
    for (const ec of expectedConstraints) {
      assert(constraintNames.some(c => c.includes(ec)), `Missing constraint: ${ec}`);
    }
  });

  // 5. Updated_at triggers exist
  await test('Updated_at triggers on all mutable tables', async () => {
    const { rows } = await pool.query(`
      SELECT tgname, tgrelid::regclass as table_name
      FROM pg_trigger
      WHERE tgname LIKE '%updated_at%'
        AND tgrelid::regclass::text LIKE 'training_%'
      ORDER BY tgrelid::regclass::text
    `);
    
    const triggeredTables = rows.map(r => r.table_name);
    const expectedTables = [
      'training_programmes',
      'training_courses', 
      'training_modules',
      'training_lessons',
      'training_materials',
      'training_exercises',
      'training_assessments',
      'training_questions',
      'training_assignments',
      'training_progress',
      'training_lesson_progress',
      'training_assessment_attempts',
      'training_certificates'
    ];
    
    for (const t of expectedTables) {
      assert(triggeredTables.includes(t), `Missing updated_at trigger on ${t}`);
    }
  });

  // 6. Indexes exist on key columns
  await test('Key indexes exist for query performance', async () => {
    const { rows } = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public' 
        AND tablename LIKE 'training_%'
      ORDER BY tablename, indexname
    `);
    
    const indexMap = {};
    for (const r of rows) {
      if (!indexMap[r.tablename]) indexMap[r.tablename] = [];
      indexMap[r.tablename].push(r.indexname);
    }
    
    assert(indexMap['training_assignments']?.some(i => i.includes('employee')), 'Missing employee_id index on assignments');
    assert(indexMap['training_assignments']?.some(i => i.includes('programme_id')), 'Missing programme_id index on assignments');
    assert(indexMap['training_assignments']?.some(i => i.includes('status')), 'Missing status index on assignments');
    assert(indexMap['training_progress']?.some(i => i.includes('assignment')), 'Missing assignment_id index on progress');
    assert(indexMap['training_lesson_progress']?.some(i => i.includes('assignment_id')), 'Missing assignment_id index on lesson_progress');
    assert(indexMap['training_assessment_attempts']?.some(i => i.includes('assignment_id')), 'Missing assignment_id index on attempts');
    assert(indexMap['training_assessment_attempts']?.some(i => i.includes('assessment_id')), 'Missing assessment_id index on attempts');
    assert(indexMap['training_certificates']?.some(i => i.includes('employee')), 'Missing employee_id index on certificates');
    assert(indexMap['training_audit_logs']?.some(i => i.includes('entity')), 'Missing entity_type index on audit_logs');
  });

  // 7. RLS policies enabled
  await test('RLS enabled on all training tables', async () => {
    const { rows } = await pool.query(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relname LIKE 'training_%'
        AND relkind = 'r'
      ORDER BY relname
    `);
    
    for (const r of rows) {
      assert(r.relrowsecurity === true, `RLS not enabled on ${r.relname}`);
    }
  });

  // 8. Enum types exist
  await test('Training enum types created', async () => {
    const { rows } = await pool.query(`
      SELECT typname FROM pg_type WHERE typname LIKE 'training_%' ORDER BY typname
    `);
    
    const expectedEnums = [
      'training_programme_status',
      'training_course_status', 
      'training_content_status',
      'training_assignment_status',
      'training_lesson_type',
      'training_question_type',
      'training_certificate_status'
    ];
    
    const foundEnums = rows.map(r => r.typname);
    for (const e of expectedEnums) {
      assert(foundEnums.includes(e), `Missing enum: ${e} (found: ${foundEnums.join(', ')})`);
    }
  });

  // 9. Unique constraints work
  await test('Unique constraints prevent duplicates', async () => {
    const { rows: [prog1] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ('Test Prog', 'TEST-PROG', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `);
    
    try {
      await pool.query(`
        INSERT INTO training_programmes (title, code, created_by, status)
        VALUES ('Test Prog 2', 'TEST-PROG', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      `);
      assert(false, 'Should have thrown unique violation');
    } catch (err) {
      assert(err.code === '23505', 'Unique constraint not enforced on programme code');
    }
    
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog1.id]);
  });

  // 10. Content versioning works
  await test('Content versioning stores snapshots', async () => {
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, description, created_by, status)
      VALUES ('Version Test', 'VER-TEST', 'Desc v1', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id, version
    `);
    
    await pool.query(`
      INSERT INTO training_content_versions (entity_type, entity_id, version, title, content_snapshot, change_summary, created_by)
      VALUES ('programme', $1, '1.0', 'Version Test', $2, 'Initial', (SELECT id FROM staff_accounts LIMIT 1))
    `, [prog.id, JSON.stringify({ title: 'Version Test', description: 'Desc v1', version: '1.0' })]);
    
    const { rows: [ver] } = await pool.query(`
      SELECT * FROM training_content_versions WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [prog.id]);
    
    assert(ver !== undefined, 'Content version not created');
    assert(ver.entity_type === 'programme', 'Wrong entity type');
    assert(ver.content_snapshot?.description === 'Desc v1', 'Snapshot not stored correctly');
    
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
  });

  // 11. Audit logging works
  await test('Training audit logs capture changes', async () => {
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ('Audit Test', 'AUD-TEST', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `);
    
    await pool.query(`
      INSERT INTO training_audit_logs (staff_id, action, entity_type, entity_id, old_value, new_value)
      VALUES ((SELECT id FROM staff_accounts LIMIT 1), 'TRAINING_PROGRAMME_CREATED', 'programme', $1, null, '{"title": "Audit Test"}')
    `, [prog.id]);
    
    const { rows } = await pool.query(`
      SELECT * FROM training_audit_logs WHERE entity_id = $1
    `, [prog.id]);
    
    assert(rows.length === 1, 'Audit log not created');
    assert(rows[0].action === 'TRAINING_PROGRAMME_CREATED', 'Wrong action');
    assert(rows[0].entity_type === 'programme', 'Wrong entity type');
    
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
  });

  // 12. Soft deletion / archive behavior
  await test('Archive status preserves historical data', async () => {
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ('Archive Test', 'ARC-TEST', (SELECT id FROM staff_accounts LIMIT 1), 'active')
      RETURNING id
    `);
    
    await pool.query(`
      UPDATE training_programmes SET status = 'archived', archived_at = NOW(), archived_by = (SELECT id FROM staff_accounts LIMIT 1) WHERE id = $1
    `, [prog.id]);
    
    const { rows: [archived] } = await pool.query(`
      SELECT status, archived_at, archived_by FROM training_programmes WHERE id = $1
    `, [prog.id]);
    
    assert(archived.status === 'archived', 'Status not archived');
    assert(archived.archived_at !== null, 'Archived_at not set');
    assert(archived.archived_by !== null, 'Archived_by not set');
    
    const { rows: [stillExists] } = await pool.query(`SELECT 1 FROM training_programmes WHERE id = $1`, [prog.id]);
    assert(stillExists !== undefined, 'Archived record deleted');
    
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
  });

  // 13. Assessment scope constraint
  await test('Assessment scope constraint enforces single parent', async () => {
    const testId = 'scope-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ('Scope Prog', $1, (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [testId]);
    
    const { rows: [course] } = await pool.query(`
      INSERT INTO training_courses (programme_id, title, created_by, status)
      VALUES ($1, 'Scope Course', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [prog.id]);
    
    const { rows: [module] } = await pool.query(`
      INSERT INTO training_modules (course_id, title, created_by, status)
      VALUES ($1, 'Scope Module', (SELECT id FROM staff_accounts LIMIT 1), 'draft')
      RETURNING id
    `, [course.id]);
    
    // Valid: course-level assessment
    await pool.query(`
      INSERT INTO training_assessments (course_id, title, created_by, status)
      VALUES ($1, 'Course Assessment', (SELECT id FROM staff_accounts LIMIT 1), 'draft')
    `, [course.id]);
    
    // Valid: module-level assessment
    await pool.query(`
      INSERT INTO training_assessments (module_id, title, created_by, status)
      VALUES ($1, 'Module Assessment', (SELECT id FROM staff_accounts LIMIT 1), 'draft')
    `, [module.id]);
    
    // Invalid: both course and module
    try {
      await pool.query(`
        INSERT INTO training_assessments (course_id, module_id, title, created_by, status)
        VALUES ($1, $2, 'Invalid Assessment', (SELECT id FROM staff_accounts LIMIT 1), 'draft')
      `, [course.id, module.id]);
      assert(false, 'Should have thrown check constraint violation');
    } catch (err) {
      assert(err.code === '23514', 'Scope constraint not enforced');
    }
    
    await pool.query(`DELETE FROM training_modules WHERE id = $1`, [module.id]);
    await pool.query(`DELETE FROM training_courses WHERE id = $1`, [course.id]);
  });

  // 14. Assignment scope constraint
  await test('Assignment scope constraint enforces single target', async () => {
    const testId = 'assign-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ('Assign Prog', $1, (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [testId]);
    const { rows: [course] } = await pool.query(`
      INSERT INTO training_courses (programme_id, title, created_by, status)
      VALUES ($1, 'Assign Course', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [prog.id]);
    const { rows: [emp] } = await pool.query(`
      SELECT id FROM employees WHERE status = 'active' LIMIT 1
    `);
    
    if (!emp) {
      console.log('Skipping test: no active employees');
      return;
    }
    
    // Valid: programme assignment
    await pool.query(`
      INSERT INTO training_assignments (programme_id, employee_id, assigned_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'assigned')
    `, [prog.id, emp.id]);
    
    // Valid: course assignment
    await pool.query(`
      INSERT INTO training_assignments (course_id, employee_id, assigned_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'assigned')
    `, [course.id, emp.id]);
    
    // Invalid: both programme and course
    try {
      await pool.query(`
        INSERT INTO training_assignments (programme_id, course_id, employee_id, assigned_by, status)
        VALUES ($1, $2, $3, (SELECT id FROM staff_accounts LIMIT 1), 'assigned')
      `, [prog.id, course.id, emp.id]);
      assert(false, 'Should have thrown check constraint violation');
    } catch (err) {
      assert(err.code === '23514', 'Assignment scope constraint not enforced');
    }
  });

  // 15. Progress unique constraints
  await test('Progress unique constraints prevent duplicates', async () => {
    const testId = 'progress-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ('Prog Test', $1, (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [testId]);
    const { rows: [course] } = await pool.query(`
      INSERT INTO training_courses (programme_id, title, created_by, status)
      VALUES ($1, 'Course Test', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [prog.id]);
    const { rows: [emp] } = await pool.query(`
      SELECT id FROM employees WHERE status = 'active' LIMIT 1
    `);
    
    if (!emp) {
      console.log('Skipping test: no active employees');
      return;
    }
    
    const { rows: [assignment] } = await pool.query(`
      INSERT INTO training_assignments (programme_id, employee_id, assigned_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'assigned')
      RETURNING id
    `, [prog.id, emp.id]);
    
    await pool.query(`
      INSERT INTO training_progress (assignment_id, programme_id, course_id, progress_pct)
      VALUES ($1, $2, $3, 50)
    `, [assignment.id, prog.id, course.id]);
    
    try {
      await pool.query(`
        INSERT INTO training_progress (assignment_id, programme_id, course_id, progress_pct)
        VALUES ($1, $2, $3, 75)
      `, [assignment.id, prog.id, course.id]);
      assert(false, 'Should have thrown unique violation');
    } catch (err) {
      assert(err.code === '23505', 'Unique constraint not enforced on progress');
    }
  });

  // 16. Lesson progress unique constraint
  await test('Lesson progress unique constraint prevents duplicates', async () => {
    const testId = 'lesson-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ('Lesson Prog', $1, (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [testId]);
    const { rows: [course] } = await pool.query(`
      INSERT INTO training_courses (programme_id, title, created_by, status)
      VALUES ($1, 'Lesson Course', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [prog.id]);
    const { rows: [module] } = await pool.query(`
      INSERT INTO training_modules (course_id, title, created_by, status)
      VALUES ($1, 'Lesson Module', (SELECT id FROM staff_accounts LIMIT 1), 'draft')
      RETURNING id
    `, [course.id]);
    const { rows: [lesson] } = await pool.query(`
      INSERT INTO training_lessons (module_id, title, created_by, status)
      VALUES ($1, 'Lesson Test', (SELECT id FROM staff_accounts LIMIT 1), 'draft')
      RETURNING id
    `, [module.id]);
    const { rows: [emp] } = await pool.query(`
      SELECT id FROM employees WHERE status = 'active' LIMIT 1
    `);
    
    if (!emp) {
      console.log('Skipping test: no active employees');
      return;
    }
    
    const { rows: [assignment] } = await pool.query(`
      INSERT INTO training_assignments (programme_id, employee_id, assigned_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'assigned')
      RETURNING id
    `, [prog.id, emp.id]);
    
    await pool.query(`
      INSERT INTO training_lesson_progress (assignment_id, lesson_id, status, progress_pct)
      VALUES ($1, $2, 'completed', 100)
    `, [assignment.id, lesson.id]);
    
    try {
      await pool.query(`
        INSERT INTO training_lesson_progress (assignment_id, lesson_id, status, progress_pct)
        VALUES ($1, $2, 'in_progress', 50)
      `, [assignment.id, lesson.id]);
      assert(false, 'Should have thrown unique violation');
    } catch (err) {
      assert(err.code === '23505', 'Unique constraint not enforced on lesson_progress');
    }
  });

  // 17. Certificate unique number
  await test('Certificate number is unique', async () => {
    const testId = 'cert-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ('Cert Prog', $1, (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [testId]);
    const { rows: [emp] } = await pool.query(`
      SELECT id FROM employees WHERE status = 'active' LIMIT 1
    `);
    
    if (!emp) {
      console.log('Skipping test: no active employees');
      return;
    }
    
    const { rows: [assignment] } = await pool.query(`
      INSERT INTO training_assignments (programme_id, employee_id, assigned_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'completed')
      RETURNING id
    `, [prog.id, emp.id]);
    
    const certNum = 'ET-TEST-' + Date.now();
    
    await pool.query(`
      INSERT INTO training_certificates (certificate_number, assignment_id, programme_id, employee_id, programme_version, issued_by, status)
      VALUES ($1, $2, $3, $4, '1.0', (SELECT id FROM staff_accounts LIMIT 1), 'issued')
    `, [certNum, assignment.id, prog.id, emp.id]);
    
    try {
      await pool.query(`
        INSERT INTO training_certificates (certificate_number, assignment_id, programme_id, employee_id, programme_version, issued_by, status)
        VALUES ($1, $2, $3, $4, '1.0', (SELECT id FROM staff_accounts LIMIT 1), 'issued')
      `, [certNum, assignment.id, prog.id, emp.id]);
      assert(false, 'Should have thrown unique violation');
    } catch (err) {
      assert(err.code === '23505', 'Certificate number unique constraint not enforced');
    }
  });

  // 18. Training program status enum values
  await test('Programme status enum accepts valid values', async () => {
    const validStatuses = ['draft', 'placeholder', 'ready_for_review', 'published', 'active', 'archived'];
    
    for (const status of validStatuses) {
      const { rows: [prog] } = await pool.query(`
        INSERT INTO training_programmes (title, code, created_by, status)
        VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), $3)
        RETURNING id
      `, [`Test ${status}`, `TEST-${status.toUpperCase()}`, status]);
      
      assert(prog.id !== undefined, `Failed to insert with status: ${status}`);
      await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
    }
  });

  // 19. Assessment attempt unique constraint
  await test('Assessment attempt unique constraint (assignment, assessment, attempt_number)', async () => {
    const testId = 'attempt-' + Date.now();
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ('Attempt Prog', $1, (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [testId]);
    const { rows: [course] } = await pool.query(`
      INSERT INTO training_courses (programme_id, title, created_by, status)
      VALUES ($1, 'Attempt Course', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [prog.id]);
    const { rows: [assessment] } = await pool.query(`
      INSERT INTO training_assessments (course_id, title, created_by, status)
      VALUES ($1, 'Attempt Assessment', (SELECT id FROM staff_accounts LIMIT 1), 'draft')
      RETURNING id
    `, [course.id]);
    const { rows: [emp] } = await pool.query(`
      SELECT id FROM employees WHERE status = 'active' LIMIT 1
    `);
    
    if (!emp) {
      console.log('Skipping test: no active employees');
      return;
    }
    
    const { rows: [assignment] } = await pool.query(`
      INSERT INTO training_assignments (programme_id, employee_id, assigned_by, status)
      VALUES ($1, $2, (SELECT id FROM staff_accounts LIMIT 1), 'assigned')
      RETURNING id
    `, [prog.id, emp.id]);
    
    await pool.query(`
      INSERT INTO training_assessment_attempts (assignment_id, assessment_id, attempt_number, status)
      VALUES ($1, $2, 1, 'in_progress')
    `, [assignment.id, assessment.id]);
    
    try {
      await pool.query(`
        INSERT INTO training_assessment_attempts (assignment_id, assessment_id, attempt_number, status)
        VALUES ($1, $2, 1, 'in_progress')
      `, [assignment.id, assessment.id]);
      assert(false, 'Should have thrown unique violation');
    } catch (err) {
      assert(err.code === '23505', 'Attempt unique constraint not enforced');
    }
  });

  // 20. Cascade delete behavior
  await test('Cascade delete removes child records', async () => {
    const { rows: [prog] } = await pool.query(`
      INSERT INTO training_programmes (title, code, created_by, status)
      VALUES ('Cascade Test', 'CAS-TEST', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `);
    
    const { rows: [course] } = await pool.query(`
      INSERT INTO training_courses (programme_id, title, created_by, status)
      VALUES ($1, 'Cascade Course', (SELECT id FROM staff_accounts LIMIT 1), 'placeholder')
      RETURNING id
    `, [prog.id]);
    
    await pool.query(`
      INSERT INTO training_modules (course_id, title, created_by, status)
      VALUES ($1, 'Cascade Module', (SELECT id FROM staff_accounts LIMIT 1), 'draft')
    `, [course.id]);
    
    await pool.query(`
      INSERT INTO training_lessons (module_id, title, created_by, status)
      VALUES ((SELECT id FROM training_modules LIMIT 1), 'Cascade Lesson', (SELECT id FROM staff_accounts LIMIT 1), 'draft')
    `);
    
    await pool.query(`DELETE FROM training_programmes WHERE id = $1`, [prog.id]);
    
    const { rows: courses } = await pool.query(`SELECT id FROM training_courses WHERE programme_id = $1`, [prog.id]);
    const { rows: modules } = await pool.query(`SELECT id FROM training_modules WHERE course_id = $1`, [course.id]);
    const { rows: lessons } = await pool.query(`SELECT id FROM training_lessons WHERE module_id IN (SELECT id FROM training_modules WHERE course_id = $1)`, [course.id]);
    
    assert(courses.length === 0, 'Courses not cascade deleted');
    assert(modules.length === 0, 'Modules not cascade deleted');
    assert(lessons.length === 0, 'Lessons not cascade deleted');
  });

  // Summary
  console.log('\n=== DATABASE TEST SUMMARY ===');
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
    console.log('\n✅ All database tests passed!');
  }
}

runDatabaseTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});