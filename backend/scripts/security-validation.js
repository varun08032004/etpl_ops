const { spawn } = require('child_process');
const http = require('http');

const server = spawn('node', ['server.js'], {
  cwd: 'C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend',
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => console.log('[SERVER]', data.toString().trim()));
server.stderr.on('data', (data) => console.error('[SERVER ERR]', data.toString().trim()));

setTimeout(async () => {
  console.log('\n=== SECURITY VALIDATION ===\n');
  
  // Login as owner
  const ownerToken = await login('founder@ethertrack.in', 'password123');
  console.log('✅ Owner login successful');
  
  // Test 1: Owner can access own data
  await testEndpoint(ownerToken, '/api/training/my-training', 'Owner my-training', 200);
  
  // Test 2: Owner can access all programmes
  await testEndpoint(ownerToken, '/api/training/programmes', 'Owner programmes list', 200);
  
  // Test 3: Owner can access programme detail
  await testEndpoint(ownerToken, '/api/training/programmes/87d0e5e3-47e6-464d-82af-ffb76ca81c29', 'Owner programme detail', 200);
  
  // Test 4: Owner can access carbon academy
  await testEndpoint(ownerToken, '/api/training/carbon-academy', 'Owner carbon academy', 200);
  
  // Test 5: Owner can access assignments
  await testEndpoint(ownerToken, '/api/training/assignments', 'Owner assignments list', 200);
  
  // Test 6: Owner can access reports
  await testEndpoint(ownerToken, '/api/training/reports/overview', 'Owner reports overview', 200);
  
  // Test 7: Owner can access manager dashboard
  await testEndpoint(ownerToken, '/api/training/reports/manager-dashboard', 'Owner manager dashboard', 200);
  
  // Test 8: Owner can access pilot cohorts
  await testEndpoint(ownerToken, '/api/training/pilot-cohorts', 'Owner pilot cohorts', 200);
  
  // Test 9: Owner can access pilot feedback
  await testEndpoint(ownerToken, '/api/training/pilot-feedback', 'Owner pilot feedback', 200);
  
  // Test 10: Owner can access competencies
  await testEndpoint(ownerToken, '/api/training/competencies', 'Owner competencies', 200);
  
  // Test 11: Owner can access employee progress
  await testEndpoint(ownerToken, '/api/training/employees/a88fb6f4-e807-40b6-8142-357400df75b9/progress', 'Owner employee progress', 200);
  
  // Test 12: Test IDOR - try to access another employee's progress directly
  // Create a test employee ID that doesn't belong to owner
  const fakeEmpId = '00000000-0000-0000-0000-000000000000';
  const idorResult = await testEndpoint(ownerToken, `/api/training/employees/${fakeEmpId}/progress`, 'IDOR test (fake employee)', 404);
  
  // Test 13: Test lesson access with invalid ID
  const idorLesson = await testEndpoint(ownerToken, '/api/training/lessons/00000000-0000-0000-0000-000000000000/materials', 'IDOR test (fake lesson)', 404);
  
  // Test 13: Test assignment access with invalid ID
  const idorAssign = await testEndpoint(ownerToken, '/api/training/assignments/00000000-0000-0000-0000-000000000000', 'IDOR test (fake assignment)', 404);
  
  // Test 14: Test cohort access with invalid ID
  const idorCohort = await testEndpoint(ownerToken, '/api/training/pilot-cohorts/00000000-0000-0000-0000-000000000000', 'IDOR test (fake cohort)', 404);
  
  // Test 15: Test assessment attempt access with invalid ID
  const idorAssess = await testEndpoint(ownerToken, '/api/training/assessments/00000000-0000-0000-0000-000000000000/attempts', 'IDOR test (fake assessment)', 404);
  
  // Test 16: Test unauthenticated access
  console.log('\n--- Unauthenticated Access Tests ---');
  await testUnauthenticated('/api/training/my-training', 'Unauth my-training', 401);
  await testUnauthenticated('/api/training/programmes', 'Unauth programmes', 401);
  await testUnauthenticated('/api/training/carbon-academy', 'Unauth carbon academy', 401);
  
  // Test 17: Test invalid token
  await testInvalidToken('/api/training/my-training', 'Invalid token', 401);
  
  // Test 18: Test expired token (not practical to test without waiting)
  
  console.log('\n=== SECURITY VALIDATION COMPLETE ===');
  server.kill();
  process.exit(0);
}, 3000);

function login(email, password) {
  return new Promise((resolve) => {
    const loginData = JSON.stringify({ email, password });
    const options = { hostname: 'localhost', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length } };
    const req = http.request(options, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { const jsonStart = data.indexOf('{'); const result = JSON.parse(data.substring(jsonStart)); resolve(result.accessToken); }); });
    req.on('error', console.error);
    req.write(loginData);
    req.end();
  });
}

function testEndpoint(token, path, label, expectedStatus) {
  return new Promise((resolve) => {
    const options = { hostname: 'localhost', port: 5001, path, method: 'GET', headers: { 'Authorization': 'Bearer ' + token } };
    const req = http.request(options, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { const pass = res.statusCode === expectedStatus; console.log(`${pass ? '✅' : '❌'} ${label}: ${res.statusCode} (expected ${expectedStatus})`); resolve(); }); });
    req.on('error', (err) => { console.error(`❌ ${label}: ${err.message}`); resolve(); });
    req.setTimeout(10000, () => { console.log(`⏱️ ${label}: timeout`); resolve(); });
    req.end();
  });
}

function testUnauthenticated(path, label, expectedStatus) {
  return new Promise((resolve) => {
    const options = { hostname: 'localhost', port: 5001, path, method: 'GET' };
    const req = http.request(options, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { const pass = res.statusCode === expectedStatus; console.log(`${pass ? '✅' : '❌'} ${label}: ${res.statusCode} (expected ${expectedStatus})`); resolve(); }); });
    req.on('error', (err) => { console.error(`❌ ${label}: ${err.message}`); resolve(); });
    req.setTimeout(10000, () => { console.log(`⏱️ ${label}: timeout`); resolve(); });
    req.end();
  });
}

function testInvalidToken(path, label, expectedStatus) {
  return new Promise((resolve) => {
    const options = { hostname: 'localhost', port: 5001, path, method: 'GET', headers: { 'Authorization': 'Bearer invalid.token.here' } };
    const req = http.request(options, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { const pass = res.statusCode === expectedStatus; console.log(`${pass ? '✅' : '❌'} ${label}: ${res.statusCode} (expected ${expectedStatus})`); resolve(); }); });
    req.on('error', (err) => { console.error(`❌ ${label}: ${err.message}`); resolve(); });
    req.setTimeout(10000, () => { console.log(`⏱️ ${label}: timeout`); resolve(); });
    req.end();
  });
}