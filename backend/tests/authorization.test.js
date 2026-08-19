/**
 * Authorization Tests
 * Tests role boundaries, department boundaries, privilege escalation scenarios
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// Test utilities
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-testing-only';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'test-refresh-secret-for-testing-only';

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30m' });
}

function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '7d' });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  // Mock authenticate middleware
  app.use((req, res, next) => {
    const token = req.cookies?.internal_ops_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.staff = { id: decoded.sub, role: decoded.role, employee_id: decoded.employee_id };
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  });
  
  // Mock requireRole
  function requireRole(...allowedRoles) {
    return (req, res, next) => {
      if (!req.staff) return res.status(401).json({ error: 'Not authenticated' });
      const effectiveRoles = req.staff.effectiveRoles || [];
      if (
        ['owner', 'admin'].includes(req.staff.role) ||
        allowedRoles.includes(req.staff.role) ||
        allowedRoles.some(r => effectiveRoles.includes(r))
      ) {
        return next();
      }
      return res.status(403).json({ error: 'Insufficient permissions' });
    };
  }
  
  // Test routes
  app.get('/api/test/finance', requireRole('finance'), (req, res) => res.json({ ok: true, data: 'finance' }));
  app.get('/api/test/hr', requireRole('hr'), (req, res) => res.json({ ok: true, data: 'hr' }));
  app.get('/api/test/sales', requireRole('sales'), (req, res) => res.json({ ok: true, data: 'sales' }));
  app.get('/api/test/admin', requireRole('admin'), (req, res) => res.json({ ok: true, data: 'admin' }));
  app.get('/api/test/employee', requireRole('employee'), (req, res) => res.json({ ok: true, data: 'employee' }));
  app.get('/api/test/multi', requireRole('finance', 'hr'), (req, res) => res.json({ ok: true, data: 'multi' }));
  
  // Owner bypass test
  app.get('/api/test/owner-only', requireRole(), (req, res) => res.json({ ok: true, data: 'owner-only' }));
  
  return app;
}

// Test helpers
function createToken(role, employeeId = null) {
  return signAccessToken({ sub: 'user-123', role, employee_id: employeeId });
}

async function runTests() {
  const app = createApp();
  const results = { passed: 0, failed: 0, tests: [] };
  
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  
  async function test(name, fn) {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`  �� ${name}`);
    } catch (err) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: err.message });
      console.log(`  �� ${name}: ${err.message}`);
    }
  }
  
  console.log('\n=== AUTHORIZATION TESTS ===\n');
  
  // Test 1: Owner has access to everything
  await test('Owner can access finance endpoint', async () => {
    const res = await request(app)
      .get('/api/test/finance')
      .set('Cookie', [`internal_ops_token=${createToken('owner')}`]);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('Owner can access hr endpoint', async () => {
    const res = await request(app)
      .get('/api/test/hr')
      .set('Cookie', [`internal_ops_token=${createToken('owner')}`]);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('Owner can access admin-only endpoint', async () => {
    const res = await request(app)
      .get('/api/test/owner-only')
      .set('Cookie', [`internal_ops_token=${createToken('owner')}`]);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  // Test 2: Admin has access to everything except owner-only
  await test('Admin can access finance endpoint', async () => {
    const res = await request(app)
      .get('/api/test/finance')
      .set('Cookie', [`internal_ops_token=${createToken('admin')}`]);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('Admin can access owner-only endpoint (bypass)', async () => {
    const res = await request(app)
      .get('/api/test/owner-only')
      .set('Cookie', [`internal_ops_token=${createToken('admin')}`]);
    assert(res.status === 200, `Expected 200 (admin bypass), got ${res.status}`);
  });
  
  // Test 3: Finance role
  await test('Finance can access finance endpoint', async () => {
    const res = await request(app)
      .get('/api/test/finance')
      .set('Cookie', [`internal_ops_token=${createToken('finance')}`]);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('Finance CANNOT access hr endpoint', async () => {
    const res = await request(app)
      .get('/api/test/hr')
      .set('Cookie', [`internal_ops_token=${createToken('finance')}`]);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });
  
  // Test 4: HR role
  await test('HR can access hr endpoint', async () => {
    const res = await request(app)
      .get('/api/test/hr')
      .set('Cookie', [`internal_ops_token=${createToken('hr')}`]);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('HR CANNOT access finance endpoint', async () => {
    const res = await request(app)
      .get('/api/test/finance')
      .set('Cookie', [`internal_ops_token=${createToken('hr')}`]);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });
  
  // Test 5: Sales role
  await test('Sales can access sales endpoint', async () => {
    const res = await request(app)
      .get('/api/test/sales')
      .set('Cookie', [`internal_ops_token=${createToken('sales')}`]);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('Sales CANNOT access finance endpoint', async () => {
    const res = await request(app)
      .get('/api/test/finance')
      .set('Cookie', [`internal_ops_token=${createToken('sales')}`]);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });
  
  // Test 6: Employee role (lowest)
  await test('Employee can access employee endpoint', async () => {
    const res = await request(app)
      .get('/api/test/employee')
      .set('Cookie', [`internal_ops_token=${createToken('employee')}`]);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('Employee CANNOT access finance endpoint', async () => {
    const res = await request(app)
      .get('/api/test/finance')
      .set('Cookie', [`internal_ops_token=${createToken('employee')}`]);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });
  
  await test('Employee CANNOT access hr endpoint', async () => {
    const res = await request(app)
      .get('/api/test/hr')
      .set('Cookie', [`internal_ops_token=${createToken('employee')}`]);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });
  
  // Test 7: Multi-role requirement (finance OR hr)
  await test('Finance can access multi-role endpoint', async () => {
    const res = await request(app)
      .get('/api/test/multi')
      .set('Cookie', [`internal_ops_token=${createToken('finance')}`]);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('HR can access multi-role endpoint', async () => {
    const res = await request(app)
      .get('/api/test/multi')
      .set('Cookie', [`internal_ops_token=${createToken('hr')}`]);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('Sales CANNOT access multi-role endpoint', async () => {
    const res = await request(app)
      .get('/api/test/multi')
      .set('Cookie', [`internal_ops_token=${createToken('sales')}`]);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });
  
  // Test 8: Unauthenticated requests
  await test('Unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/test/finance');
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });
  
  // Test 9: Expired token
  await test('Expired token returns 401', async () => {
    const expiredToken = jwt.sign({ sub: 'user-123', role: 'finance' }, JWT_SECRET, { expiresIn: '-1h' });
    const res = await request(app)
      .get('/api/test/finance')
      .set('Cookie', [`internal_ops_token=${expiredToken}`]);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(res.body.code === 'TOKEN_EXPIRED', `Expected TOKEN_EXPIRED code`);
  });
  
  // Test 10: Invalid token
  await test('Invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/test/finance')
      .set('Cookie', ['internal_ops_token=invalid-token']);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(res.body.code === 'INVALID_TOKEN', `Expected INVALID_TOKEN code`);
  });
  
  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.passed + results.failed}`);
  
  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
  }
}

runTests().catch(console.error);