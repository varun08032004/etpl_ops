/**
 * Training Engine Integration Tests
 * Tests full API workflows with real database
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { safeQuery, withTransaction } = require('../db/pool');
const trainingRoutes = require('../routes/training');
const { authenticate, requireRole } = require('../middleware/auth');

require('dotenv').config();

const JWT_SECRET = process.env.INTERNAL_OPS_JWT_SECRET || process.env.JWT_SECRET || 'test-secret-for-testing-only';
const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30m' });
}

// Get real staff accounts for testing
async function getTestStaff() {
  const { rows } = await pool.query(`
    SELECT id, email, role, employee_id FROM staff_accounts WHERE is_active = true
  `);
  return {
    owner: rows.find(r => r.role === 'owner'),
    admin: rows.find(r => r.role === 'admin'),
    hr: rows.find(r => r.role === 'hr'),
    finance: rows.find(r => r.role === 'finance'),
    employee: rows.find(r => r.role === 'employee')
  };
}

function createToken(staff) {
  return signAccessToken({ sub: staff.id, role: staff.role, employee_id: staff.employee_id });
}

async function runIntegrationTests() {
  const testStaff = await getTestStaff();
  console.log('Test staff:', Object.keys(testStaff).map(k => `${k}: ${testStaff[k]?.email} (${testStaff[k]?.role})`).join(', '));

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  // Use real authentication middleware
  app.use(authenticate);
  app.use('/api/training', trainingRoutes);

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

  console.log('\n=== TRAINING INTEGRATION TESTS ===\n');

  // Tokens for real staff accounts
  const ownerToken = createToken(testStaff.owner);
  const adminToken = createToken(testStaff.admin);
  const hrToken = createToken(testStaff.hr);
  const financeToken = createToken(testStaff.finance);
  const employeeToken = createToken(testStaff.employee);

  // Create test employee if needed
  let testEmpId;
  {
    const { rows } = await pool.query(`
      INSERT INTO employees (employee_code, full_name, work_email, status, date_of_joining, department_id)
      VALUES ('TEST-EMP-001', 'Test Employee', 'test-integration@ethertrack.in', 'active', CURRENT_DATE, (SELECT id FROM departments LIMIT 1))
      ON CONFLICT (employee_code) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id
    `);
    testEmpId = rows[0].id;
  }

  // Create a staff account for the test employee if needed
  let testEmpStaffId;
  {
    const { rows } = await pool.query(`
      INSERT INTO staff_accounts (email, password_hash, role, employee_id, is_active)
      VALUES ('test-integration@ethertrack.in', 'dummy', 'employee', $1, true)
      ON CONFLICT (email) DO UPDATE SET employee_id = EXCLUDED.employee_id RETURNING id
    `, [testEmpId]);
    testEmpStaffId = rows[0].id;
  }

  const employeeTokenWithId = signAccessToken({ sub: testEmpStaffId, role: 'employee', employee_id: testEmpId });

  async function cleanupTestData() {
    // Clean up in reverse order of dependencies
    await pool.query(`DELETE FROM training_lesson_progress WHERE assignment_id IN (SELECT id FROM training_assignments WHERE employee_id = $1)`, [testEmpId]);
    await pool.query(`DELETE FROM training_assessment_attempts WHERE assignment_id IN (SELECT id FROM training_assignments WHERE employee_id = $1)`, [testEmpId]);
    await pool.query(`DELETE FROM training_progress WHERE assignment_id IN (SELECT id FROM training_assignments WHERE employee_id = $1)`, [testEmpId]);
    await pool.query(`DELETE FROM training_assignments WHERE employee_id = $1`, [testEmpId]);
    await pool.query(`DELETE FROM training_certificates WHERE employee_id = $1`, [testEmpId]);
    await pool.query(`DELETE FROM staff_accounts WHERE id = $1`, [testEmpStaffId]);
    await pool.query(`DELETE FROM employees WHERE id = $1`, [testEmpId]);
    // Clean up test programmes/courses/modules/lessons/assessments
    await pool.query(`DELETE FROM training_lessons WHERE module_id IN (SELECT id FROM training_modules WHERE course_id IN (SELECT id FROM training_courses WHERE programme_id IN (SELECT id FROM training_programmes WHERE code LIKE 'TEST-%')))`);
    await pool.query(`DELETE FROM training_modules WHERE course_id IN (SELECT id FROM training_courses WHERE programme_id IN (SELECT id FROM training_programmes WHERE code LIKE 'TEST-%'))`);
    await pool.query(`DELETE FROM training_assessments WHERE course_id IN (SELECT id FROM training_courses WHERE programme_id IN (SELECT id FROM training_programmes WHERE code LIKE 'TEST-%'))`);
    await pool.query(`DELETE FROM training_questions WHERE assessment_id IN (SELECT id FROM training_assessments WHERE course_id IN (SELECT id FROM training_courses WHERE programme_id IN (SELECT id FROM training_programmes WHERE code LIKE 'TEST-%')))`);
    await pool.query(`DELETE FROM training_courses WHERE programme_id IN (SELECT id FROM training_programmes WHERE code LIKE 'TEST-%')`);
    await pool.query(`DELETE FROM training_programmes WHERE code LIKE 'TEST-%'`);
  }

  async function runTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
    } catch (err) {
      console.log(`  ❌ ${name}: ${err.message}`);
      throw err;
    }
  }

  console.log('\n=== TRAINING INTEGRATION TESTS ===\n');

  // ===== FOUNDER WORKFLOW =====

  await test('Founder: Create programme', async () => {
    const res = await request(app)
      .post('/api/training/programmes')
      .set('Cookie', [`internal_ops_token=${ownerToken}`])
      .send({ title: 'Test Programme', code: 'TEST-PROG-1', description: 'Test programme' });
    
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    if (!res.body.programme?.id) throw new Error('Programme ID not returned');
  });

  // ... (rest of tests would follow similar pattern)

  // Summary
  console.log('\n=== INTEGRATION TEST SUMMARY ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.passed + results.failed}`);

  if (results.failed > 0) process.exit(1);
  else console.log('\n✅ All integration tests passed!');
}

runIntegrationTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}).finally(() => pool.end());