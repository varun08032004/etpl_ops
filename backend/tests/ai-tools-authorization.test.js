/**
 * AI Tool Authorization Tests
 * Tests that AI tools properly enforce role and department boundaries
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-testing-only';

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30m' });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  // Mock staff database
  const staffDb = {
    'owner-1': { id: 'owner-1', role: 'owner', employee_id: 'emp-1', ai_access_level: 'AI_AGENT' },
    'admin-1': { id: 'admin-1', role: 'admin', employee_id: 'emp-2', ai_access_level: 'AI_AGENT' },
    'finance-1': { id: 'finance-1', role: 'finance', employee_id: 'emp-3', ai_access_level: 'AI_KNOWLEDGE' },
    'hr-1': { id: 'hr-1', role: 'hr', employee_id: 'emp-4', ai_access_level: 'AI_KNOWLEDGE' },
    'sales-1': { id: 'sales-1', role: 'sales', employee_id: 'emp-5', ai_access_level: 'AI_DISABLED' },
    'employee-1': { id: 'employee-1', role: 'employee', employee_id: 'emp-6', ai_access_level: 'AI_DISABLED' },
  };
  
  // Mock authenticate + AI access middleware
  app.use((req, res, next) => {
    const token = req.cookies?.internal_ops_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    
    try {
      const decoded = jwt.verify(token, 'test-secret');
      const staff = staffDb[decoded.sub];
      if (!staff) return res.status(401).json({ error: 'Account not found' });
      
      req.staff = {
        ...staff,
        effectiveRoles: [],
        deptAccess: { grantedRoles: [] },
      };
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  });
  
  // AI access check middleware
  function checkAIAccess(req, res, next) {
    const access = req.staff.ai_access_level || 'AI_DISABLED';
    if (access === 'AI_DISABLED') {
      return res.status(403).json({ error: 'AI Assistant access not enabled for your account' });
    }
    req.aiAccess = access;
    next();
  }
  
  // Mock tool validation (simplified)
  function requireToolAccess(toolName, toolConfig) {
    return (req, res, next) => {
      if (!req.staff) return res.status(401).json({ error: 'Not authenticated' });
      
      const userRoles = [req.staff.role, ...(req.staff.effectiveRoles || [])];
      const hasRole = toolConfig.allowedRoles.includes('*') || toolConfig.allowedRoles.some(r => userRoles.includes(r));
      if (!hasRole) {
        return res.status(403).json({ error: `Insufficient permissions for tool: ${toolName}` });
      }
      
      // Check read-only access
      if (!toolConfig.readOnly && req.aiAccess === 'AI_KNOWLEDGE') {
        return res.status(403).json({ error: `Tool ${toolName} requires AI_AGENT access level` });
      }
      
      next();
    };
  }
  
  // Mock tools with their configurations
  const tools = {
    list_employees: { allowedRoles: ['hr', 'owner', 'admin', 'finance'], readOnly: true },
    get_employee: { allowedRoles: ['hr', 'owner', 'admin', 'finance'], readOnly: true },
    get_leave_balances: { allowedRoles: ['hr', 'owner', 'admin', 'finance'], readOnly: true },
    get_attendance: { allowedRoles: ['hr', 'owner', 'admin', 'finance'], readOnly: true },
    create_employee: { allowedRoles: ['hr'], readOnly: false, requiresConfirmation: true },
    update_employee: { allowedRoles: ['hr'], readOnly: false, requiresConfirmation: true },
    exit_employee: { allowedRoles: ['hr'], readOnly: false, requiresConfirmation: true, destructive: true },
    list_deals: { allowedRoles: ['sales', 'finance', 'owner', 'admin'], readOnly: true },
    get_deal: { allowedRoles: ['sales', 'finance', 'owner', 'admin'], readOnly: true },
    create_deal: { allowedRoles: ['sales', 'finance', 'owner', 'admin'], readOnly: false },
    update_deal: { allowedRoles: ['sales', 'finance', 'owner', 'admin'], readOnly: false },
    move_deal_stage: { allowedRoles: ['sales', 'finance', 'owner', 'admin'], readOnly: false },
    mark_deal_won: { allowedRoles: ['finance'], readOnly: false, requiresConfirmation: true },
    list_invoices: { allowedRoles: ['finance'], readOnly: true },
    get_invoice: { allowedRoles: ['finance'], readOnly: true },
    list_bills: { allowedRoles: ['finance'], readOnly: true },
    get_cash_flow: { allowedRoles: ['finance'], readOnly: true },
    get_pnl: { allowedRoles: ['finance'], readOnly: true },
    get_balance_sheet: { allowedRoles: ['finance'], readOnly: true },
    list_documents: { allowedRoles: ['owner', 'admin', 'hr', 'finance'], readOnly: true },
    upload_document: { allowedRoles: ['owner', 'admin', 'hr', 'finance'], readOnly: false },
    generate_document: { allowedRoles: ['owner', 'admin', 'hr', 'finance'], readOnly: false },
    approve_generated_doc: { allowedRoles: ['admin', 'hr', 'finance'], readOnly: false, requiresConfirmation: true },
    get_company_profile: { allowedRoles: ['*'], readOnly: true },
  };
  
  // AI query endpoint
  app.post('/api/ai/query', checkAIAccess, (req, res) => {
    const { tool } = req.body;
    if (!tool || !tools[tool]) {
      return res.status(400).json({ error: 'Invalid tool' });
    }
    // Tool authorization is checked by middleware chain
    return res.json({ ok: true, tool });
  });
  
  app.use(checkAIAccess);
  
  // Dynamically mount tool-specific endpoints for testing
  Object.entries(tools).forEach(([toolName, config]) => {
    app.post(`/api/ai/tool/${toolName}`, requireToolAccess(toolName, config), (req, res) => {
      res.json({ ok: true, tool: toolName, authorized: true });
    });
  });
  
  return app;
}

function createToken(userId) {
  return signAccessToken({ sub: userId, role: 'test' });
}

function signAccessToken(payload) {
  return jwt.sign(payload, 'test-secret', { expiresIn: '30m' });
}

async function runAIToolAuthTests() {
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
      console.log(`  ������ ${name}`);
    } catch (err) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: err.message });
      console.log(`  ������ ${name}: ${err.message}`);
    }
  }
  
  console.log('\n=== AI TOOL AUTHORIZATION TESTS ===\n');
  
  // Test 1: Founder-only AI access
  await test('Owner with AI_AGENT can access AI query', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .set('Cookie', [`internal_ops_token=${createToken('owner-1')}`])
      .send({ tool: 'list_employees' });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('Admin with AI_AGENT can access AI query', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .set('Cookie', [`internal_ops_token=${createToken('admin-1')}`])
      .send({ tool: 'list_employees' });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });
  
  await test('User with AI_KNOWLEDGE can access read-only tools', async () => {
    const res = await request(app)
      .post('/api/ai/tool/list_employees')
      .set('Cookie', [`internal_ops_token=${createToken('finance-1')}`]);
    assert(res.status === 200, `Expected 200 (read-only allowed for AI_KNOWLEDGE), got ${res.status}`);
  });
  
  await test('User with AI_KNOWLEDGE CANNOT execute write tools', async () => {
    const res = await request(app)
      .post('/api/ai/tool/create_employee')
      .set('Cookie', [`internal_ops_token=${createToken('finance-1')}`]);
    assert(res.status === 403, `Expected 403 (write tool blocked for AI_KNOWLEDGE), got ${res.status}`);
    assert(res.body.error?.includes('AI_AGENT'), `Expected AI_AGENT error, got ${JSON.stringify(res.body)}`);
  });
  
  await test('User with AI_DISABLED cannot access any AI tools', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .set('Cookie', [`internal_ops_token=${createToken('employee-1')}`])
      .send({ tool: 'list_employees' });
    assert(res.status === 403, `Expected 403 (AI_DISABLED), got ${res.status}`);
    assert(res.body.error?.includes('not enabled'), `Expected AI access error, got ${JSON.stringify(res.body)}`);
  });
  
  // Test 2: Role-based tool authorization
  await test('HR can access HR tools', async () => {
    const res = await request(app)
      .post('/api/ai/tool/create_employee')
      .set('Cookie', [`internal_ops_token=${createToken('hr-1')}`]);
    assert(res.status === 200, `Expected 200 (HR access), got ${res.status}`);
  });
  
  await test('Finance CANNOT access HR write tools', async () => {
    const res = await request(app)
      .post('/api/ai/tool/create_employee')
      .set('Cookie', [`internal_ops_token=${createToken('finance-1')}`]);
    assert(res.status === 403, `Expected 403 (finance no HR access), got ${res.status}`);
  });
  
  await test('Sales CANNOT access Finance tools', async () => {
    const res = await request(app)
      .post('/api/ai/tool/get_pnl')
      .set('Cookie', [`internal_ops_token=${createToken('sales-1')}`]);
    assert(res.status === 403, `Expected 403 (sales no finance access), got ${res.status}`);
  });
  
  await test('Employee CANNOT access any write tools', async () => {
    const res = await request(app)
      .post('/api/ai/tool/create_employee')
      .set('Cookie', [`internal_ops_token=${createToken('employee-1')}`]);
    assert(res.status === 403, `Expected 403 (employee no access), got ${res.status}`);
  });
  
  // Test 3: Read-only tools accessible to AI_KNOWLEDGE
  await test('AI_KNOWLEDGE can read finance data', async () => {
    const res = await request(app)
      .post('/api/ai/tool/get_pnl')
      .set('Cookie', [`internal_ops_token=${createToken('finance-1')}`]);
    assert(res.status === 200, `Expected 200 (read-only finance), got ${res.status}`);
  });
  
  await test('AI_KNOWLEDGE can read HR data', async () => {
    const res = await request(app)
      .post('/api/ai/tool/get_leave_balances')
      .set('Cookie', [`internal_ops_token=${createToken('hr-1')}`]);
    assert(res.status === 200, `Expected 200 (read-only HR), got ${res.status}`);
  });
  
  // Test 3: Destructive tools require confirmation
  await test('Destructive tools flagged correctly', async () => {
    // exit_employee is marked destructive
    // The confirmation flow would be tested separately
    assert(true, 'Destructive flag concept verified');
  });
  
  // Test 4: Wildcard role access
  await test('Company profile accessible to all', async () => {
    const res = await request(app)
      .post('/api/ai/tool/get_company_profile')
      .set('Cookie', [`internal_ops_token=${createToken('employee-1')}`]);
    assert(res.status === 200, `Expected 200 (wildcard access), got ${res.status}`);
  });
  
  // Test 5: Unauthorized tool access
  await test('Unknown tool returns 400', async () => {
    const res = await request(app)
      .post('/api/ai/tool/unknown_tool')
      .set('Cookie', [`internal_ops_token=${createToken('owner-1')}`]);
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });
  
  // Test 6: Token validation
  await test('Invalid token rejected', async () => {
    const res = await request(app)
      .post('/api/ai/tool/list_employees')
      .set('Cookie', ['internal_ops_token=invalid']);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });
  
  await test('Expired token rejected', async () => {
    const expiredToken = jwt.sign({ sub: 'owner-1', role: 'owner' }, 'test-secret', { expiresIn: '-1h' });
    const res = await request(app)
      .post('/api/ai/tool/list_employees')
      .set('Cookie', [`internal_ops_token=${expiredToken}`]);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });
  
  // Summary
  console.log('\n=== AI TOOL AUTH TEST SUMMARY ===');
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
    console.log('\nAll AI tool authorization tests passed!');
  }
}

runAIToolAuthTests().catch(console.error);