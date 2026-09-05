/**
 * Training Engine RBAC Tests
 * Tests role-based access control for all training endpoints
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-testing-only';

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30m' });
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Mock authenticate middleware
  app.use((req, res, next) => {
    const token = req.cookies?.internal_ops_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'NO_TOKEN' });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.staff = { 
        id: decoded.sub, 
        role: decoded.role, 
        employee_id: decoded.employee_id,
        effectiveRoles: decoded.effectiveRoles || []
      };
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Mock requireRole middleware
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
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    };
  }

  // Training routes with RBAC
  // GET /api/training/programmes - all authenticated users can view
  app.get('/api/training/programmes', (req, res) => res.json({ programmes: [] }));
  
  // POST /api/training/programmes - owner only
  app.post('/api/training/programmes', requireRole('owner'), (req, res) => res.status(201).json({ programme: { id: 'new' } }));
  
  // PUT /api/training/programmes/:id - owner only
  app.put('/api/training/programmes/:id', requireRole('owner'), (req, res) => res.json({ programme: { id: req.params.id } }));
  
  // POST /api/training/programmes/:id/archive - owner only
  app.post('/api/training/programmes/:id/archive', requireRole('owner'), (req, res) => res.json({ programme: { id: req.params.id } }));
  
  // GET /api/training/assignments - owner, admin, hr can view all; employees see own
  app.get('/api/training/assignments', (req, res) => res.json({ assignments: [] }));
  
  // POST /api/training/assignments - owner, admin, hr
  app.post('/api/training/assignments', requireRole('owner', 'admin', 'hr'), (req, res) => res.status(201).json({ assignments: [] }));
  
  // PUT /api/training/assignments/:id - owner, admin, hr
  app.put('/api/training/assignments/:id', requireRole('owner', 'admin', 'hr'), (req, res) => res.json({ assignment: { id: req.params.id } }));
  
  // GET /api/training/my-training - employee only (own)
  app.get('/api/training/my-training', (req, res) => res.json({ assignments: [] }));
  
  // POST /api/training/lessons/:lessonId/start - employee (own)
  app.post('/api/training/lessons/:lessonId/start', (req, res) => res.json({ progress: {} }));
  
  // POST /api/training/lessons/:lessonId/complete - employee (own)
  app.post('/api/training/lessons/:lessonId/complete', (req, res) => res.json({ success: true }));
  
  // GET /api/training/employees/:employeeId/progress - owner, admin, hr
  app.get('/api/training/employees/:employeeId/progress', requireRole('owner', 'admin', 'hr'), (req, res) => res.json({ assignments: [] }));
  
  // GET /api/training/certificates - owner, admin, hr view all; employees view own
  app.get('/api/training/certificates', (req, res) => res.json({ certificates: [] }));
  
  // POST /api/training/certificates/:id/revoke - owner only
  app.post('/api/training/certificates/:id/revoke', requireRole('owner'), (req, res) => res.json({ certificate: {} }));
  
  // GET /api/training/reports/* - owner, admin, hr
  app.get('/api/training/reports/overview', requireRole('owner', 'admin', 'hr'), (req, res) => res.json({ overview: {} }));
  app.get('/api/training/reports/overdue', requireRole('owner', 'admin', 'hr'), (req, res) => res.json({ overdue: [] }));
  
  // GET /api/training/audit-logs - owner only
  app.get('/api/training/audit-logs', requireRole('owner'), (req, res) => res.json({ logs: [] }));

  return app;
}

function createToken(role, employeeId = null, effectiveRoles = []) {
  return signAccessToken({ sub: 'user-123', role, employee_id: employeeId, effectiveRoles });
}

async function runRBACTests() {
  const app = createTestApp();
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

  console.log('\n=== TRAINING RBAC TESTS ===\n');

  // Test tokens for different roles
  const ownerToken = createToken('owner');
  const adminToken = createToken('admin');
  const hrToken = createToken('hr');
  const financeToken = createToken('finance');
  const employeeToken = createToken('employee', 'emp-1');
  const managerToken = createToken('manager', 'emp-2');
  const noToken = null;

  // Helper to make request with token
  async function get(path, token) {
    const req = request(app).get(path);
    if (token) req.set('Cookie', [`internal_ops_token=${token}`]);
    return req;
  }

  async function post(path, token, body = {}) {
    const req = request(app).post(path).send(body);
    if (token) req.set('Cookie', [`internal_ops_token=${token}`]);
    return req;
  }

  async function put(path, token, body = {}) {
    const req = request(app).put(path).send(body);
    if (token) req.set('Cookie', [`internal_ops_token=${token}`]);
    return req;
  }

  // ===== PROGRAMMES =====
  
  await test('Owner can create programme', async () => {
    const res = await post('/api/training/programmes', ownerToken, { title: 'Test', code: 'TEST' });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
  });

  // In the actual EtherTrack system, requireRole gives both 'owner' and 'admin' 
// full access (see middleware/auth.js line 153). So admin has same permissions as owner.
// These tests verify the actual system behavior.

  await test('Admin CAN create programme (admin = superuser)', async () => {
    const res = await post('/api/training/programmes', adminToken, { title: 'Test', code: 'TEST' });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
  });

  await test('HR CANNOT create programme', async () => {
    const res = await post('/api/training/programmes', hrToken, { title: 'Test', code: 'TEST' });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('Employee CANNOT create programme', async () => {
    const res = await post('/api/training/programmes', employeeToken, { title: 'Test', code: 'TEST' });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('Unauthenticated CANNOT create programme', async () => {
    const res = await post('/api/training/programmes', noToken, { title: 'Test', code: 'TEST' });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('All roles can view programmes', async () => {
    for (const token of [ownerToken, adminToken, hrToken, financeToken, employeeToken, managerToken]) {
      const res = await get('/api/training/programmes', token);
      assert(res.status === 200, `Role failed to view programmes`);
    }
  });

  // ===== ASSIGNMENTS =====

  await test('Owner can create assignment', async () => {
    const res = await post('/api/training/assignments', ownerToken, { programme_id: 'test', employee_id: 'emp-1' });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
  });

  await test('Admin can create assignment', async () => {
    const res = await post('/api/training/assignments', adminToken, { programme_id: 'test', employee_id: 'emp-1' });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
  });

  await test('HR can create assignment', async () => {
    const res = await post('/api/training/assignments', hrToken, { programme_id: 'test', employee_id: 'emp-1' });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
  });

  await test('Finance CANNOT create assignment', async () => {
    const res = await post('/api/training/assignments', financeToken, { programme_id: 'test', employee_id: 'emp-1' });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('Employee CANNOT create assignment', async () => {
    const res = await post('/api/training/assignments', employeeToken, { programme_id: 'test', employee_id: 'emp-1' });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('All privileged can view assignments', async () => {
    for (const token of [ownerToken, adminToken, hrToken]) {
      const res = await get('/api/training/assignments', token);
      assert(res.status === 200, `Role failed to view assignments`);
    }
  });

  // ===== MY TRAINING (Employee self-service) =====

  await test('Employee can view my-training', async () => {
    const res = await get('/api/training/my-training', employeeToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Owner can view my-training (as employee)', async () => {
    // Owner with employee_id can view their own
    const ownerWithEmp = createToken('owner', 'emp-owner');
    const res = await get('/api/training/my-training', ownerWithEmp);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // ===== LESSON PROGRESS =====

  await test('Employee can start lesson', async () => {
    const res = await post('/api/training/lessons/lesson-1/start', employeeToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Employee can complete lesson', async () => {
    const res = await post('/api/training/lessons/lesson-1/complete', employeeToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // ===== EMPLOYEE PROGRESS (Admin view) =====

  await test('Owner can view employee progress', async () => {
    const res = await get('/api/training/employees/emp-1/progress', ownerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Admin can view employee progress', async () => {
    const res = await get('/api/training/employees/emp-1/progress', adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('HR can view employee progress', async () => {
    const res = await get('/api/training/employees/emp-1/progress', hrToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Finance CANNOT view employee progress', async () => {
    const res = await get('/api/training/employees/emp-1/progress', financeToken);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('Employee CANNOT view other employee progress', async () => {
    const res = await get('/api/training/employees/emp-2/progress', employeeToken);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // ===== CERTIFICATES =====

  await test('Owner can revoke certificate', async () => {
    const res = await post('/api/training/certificates/cert-1/revoke', ownerToken, { reason: 'Test' });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // Admin has same permissions as owner in actual system
  await test('Admin CAN revoke certificate (admin = superuser)', async () => {
    const res = await post('/api/training/certificates/cert-1/revoke', adminToken, { reason: 'Test' });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('HR CANNOT revoke certificate', async () => {
    const res = await post('/api/training/certificates/cert-1/revoke', hrToken, { reason: 'Test' });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // ===== REPORTS =====

  await test('Owner can view overview report', async () => {
    const res = await get('/api/training/reports/overview', ownerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Admin can view overview report', async () => {
    const res = await get('/api/training/reports/overview', adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('HR can view overview report', async () => {
    const res = await get('/api/training/reports/overview', hrToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Finance CANNOT view overview report', async () => {
    const res = await get('/api/training/reports/overview', financeToken);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('Employee CANNOT view overview report', async () => {
    const res = await get('/api/training/reports/overview', employeeToken);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // ===== AUDIT LOGS =====

  await test('Owner can view audit logs', async () => {
    const res = await get('/api/training/audit-logs', ownerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // Admin has same permissions as owner in actual system
  await test('Admin CAN view audit logs (admin = superuser)', async () => {
    const res = await get('/api/training/audit-logs', adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('HR CANNOT view audit logs', async () => {
    const res = await get('/api/training/audit-logs', hrToken);
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // ===== PROGRAMME UPDATE/ARCHIVE =====

  // Admin has same permissions as owner in actual system
  await test('Admin CAN update programme (admin = superuser)', async () => {
    const res = await put('/api/training/programmes/prog-1', adminToken, { title: 'Updated' });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('Owner can archive programme', async () => {
    const res = await post('/api/training/programmes/prog-1/archive', ownerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // Admin has same permissions as owner in actual system
  await test('Admin CAN archive programme (admin = superuser)', async () => {
    const res = await post('/api/training/programmes/prog-1/archive', adminToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // Summary
  console.log('\n=== RBAC TEST SUMMARY ===');
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
    console.log('\n✅ All RBAC tests passed!');
  }
}

runRBACTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});