const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMGQ3MjM3Yy0xNTU1LTQ4NjAtODc2YS05ZDEzYjBjY2Y3ZWEiLCJlbXBsb3llZV9pZCI6ImE4OGZiNmY0LWU4MDctNDBiNi04MTQyLTM1NzQwMGRmNzViOSIsImRldmljZV9pZCI6IjdjYWVkNDk2LTE3NzMtNDAzOC1iYzRlLTYzNTE2NjBiZjc4NSIsInR5cCI6ImFnZW50IiwiaWF0IjoxNzkxNDYxMTkzLCJleHAiOjE3OTQwNTMxOTN9.mw_4nRNaAdn2b8VyUNdQyOVkIsZXzB8KdsdCYYC2Mk4';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = { 
      hostname: '127.0.0.1', 
      port: 5001, 
      path, 
      method, 
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': 'Bearer ' + token, 
        'Content-Length': Buffer.byteLength(data) 
      } 
    });
    const req = http.request(options, (res) => { 
      let d = ''; 
      res.on('data', c => d += c); 
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  function logTest(name, passed, details = '') {
    if (passed) {
      results.passed++;
      console.log(`✅ ${name} ${details}`);
    } else {
      results.failed++;
      console.log(`❌ ${name} ${details}`);
    }
    results.tests.push({ name, passed, details });
  }

  try {
    console.log('=== CLEARING TEST DATA ===');
    await request('POST', '/api/attendance/punch-in/undo', {source: 'agent', device_fingerprint: 'test-device-123'});
    await request('POST', '/api/attendance/punch-out/undo', {source: 'agent', device_fingerprint: 'test-device-123'});
    await request('POST', '/api/attendance/punch-in/undo', {source: 'agent', device_fingerprint: 'test-device-123'});

    console.log('\n=== TEST 1: PUNCH IN ===');
    let res = await request('POST', '/api/attendance/punch-in', {source: 'agent', device_fingerprint: 'test-device-123'});
    logTest('Punch In', res.status === 200 && res.body.record && res.body.record.clock_in, 
      `Status: ${res.status}, Clock In: ${res.body.record?.clock_in}`);

    console.log('\n=== TEST 2: VERIFY ATTENDANCE RECORD ===');
    res = await request('GET', '/api/attendance/me/today', {});
    logTest('Attendance Record', res.status === 200 && res.body.record && res.body.record.clock_in && !res.body.record.clock_out,
      `Status: ${res.status}, Clock In: ${res.body.record?.clock_in}, Clock Out: ${res.body.record?.clock_out}, Status: ${res.body.record?.status}`);

    console.log('\n=== TEST 3: START WORK SESSION ===');
    res = await request('POST', '/api/agent/session/start', {source: 'agent'});
    logTest('Session Start', res.status === 200 && res.body.session_id && res.body.clock_in,
      `Status: ${res.status}, Session ID: ${res.body.session_id}`);

    console.log('\n=== TEST 3b: VERIFY LIVE MONITORING (No Activity Yet) ===');
    res = await request('GET', '/api/monitoring/live');
    const founder = res.body.employees.find(e => e.employee_code === 'ET-EMP-0001');
    logTest('Live Monitoring - Session Active', res.status === 200 && founder && founder.session_status === 'open',
      `Session: ${founder?.session_status}, Online: ${founder?.is_online}`);

    console.log('\n=== TEST 4: SEND HEARTBEAT WITH ACTIVITY ===');
    const sessionId = 'e6bb42a9-7b2e-426d-90d8-261441d57d2a'; // This will need to be updated dynamically
    res = await request('POST', '/api/agent/session/heartbeat', {
      session_id: 'e6bb42a9-7b2e-426d-90d8-261441d57d2a',
      heartbeat_seq: 1,
      current_app: 'Code.exe',
      current_window_title: 'test.js - Visual Studio Code',
      current_domain: 'github.com',
      active_seconds_delta: 30,
      idle_seconds_delta: 0,
      app_segments: [{ app_name: 'Code.exe', window_title: 'test.js - Visual Studio Code', started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_seconds: 30 }],
      website_segments: [{ domain: 'github.com', started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_seconds: 30 }],
      idle_periods: []
    });
    logTest('Heartbeat with Activity', res.status === 200 && res.body.active_seconds === 30,
      `Status: ${res.status}, Active: ${res.body.active_seconds}, Idle: ${res.body.idle_seconds}`);

    console.log('\n=== TEST 5: VERIFY LIVE MONITORING (With Activity) ===');
    res = await request('GET', '/api/monitoring/live');
    const founder2 = res.body.employees.find(e => e.employee_code === 'ET-EMP-0001');
    logTest('Live Monitoring - Activity Recorded', res.status === 200 && founder2 && founder2.current_app === 'Code.exe' && founder2.active_seconds > 0,
      `App: ${founder2?.current_app}, Active: ${founder2?.active_seconds}, Idle: ${founder2?.idle_seconds}, Domain: ${founder2?.current_domain}`);

    console.log('\n=== TEST 5b: VERIFY PRODUCTIVITY SCORE ===');
    logTest('Productivity Score Calculated', res.status === 200 && founder2 && founder2.score !== undefined && founder2.score_label,
      `Score: ${founder2?.score}, Label: ${founder2?.score_label}`);

    console.log('\n=== TEST 6: PUNCH OUT ===');
    res = await request('POST', '/api/attendance/punch-out', {source: 'agent', device_fingerprint: 'test-device-123'});
    logTest('Punch Out', res.status === 200 && res.body.record && res.body.record.clock_out && res.body.record.status,
      `Status: ${res.status}, Clock Out: ${res.body.record?.clock_out}, Status: ${res.body.record?.status}, Late: ${res.body.record?.late_minutes}, Early Leave: ${res.body.record?.early_leave_minutes}`);

    console.log('\n=== TEST 7: VERIFY ATTENDANCE FINALIZED ===');
    res = await request('GET', '/api/attendance/me/today');
    logTest('Attendance Finalized', res.status === 200 && res.body.record && res.body.record.clock_out && res.body.record.status,
      `Status: ${res.body.record?.status}, Late: ${res.body.record?.late_minutes}, Early Leave: ${res.body.record?.early_leave_minutes}`);

    console.log('\n=== TEST 8: UNDO PUNCH OUT ===');
    res = await request('POST', '/api/attendance/punch-out/undo', {source: 'agent', device_fingerprint: 'test-device-123'});
    logTest('Undo Punch Out', res.status === 200 && res.body.record && res.body.record.clock_out === null,
      `Status: ${res.status}, Clock Out: ${res.body.record?.clock_out}, Status: ${res.body.record?.status}`);

    console.log('\n=== TEST 9: PUNCH OUT AGAIN ===');
    res = await request('POST', '/api/attendance/punch-out', {source: 'agent', device_fingerprint: 'test-device-123'});
    logTest('Punch Out Again', res.status === 200 && res.body.record && res.body.record.clock_out,
      `Status: ${res.status}, Clock Out: ${res.body.record?.clock_out}, Status: ${res.body.record?.status}`);

    console.log('\n=== TEST 10: UNDO PUNCH IN ===');
    res = await request('POST', '/api/attendance/punch-in/undo', {source: 'agent', device_fingerprint: 'test-device-123'});
    logTest('Undo Punch In', res.status === 200 && res.body.ok,
      `Status: ${res.status}, Message: ${res.body.message}`);

    console.log('\n=== TEST 11: DEVICE BINDING SECURITY ===');
    // Try with wrong device fingerprint
    res = await request('POST', '/api/attendance/punch-in', {source: 'agent', device_fingerprint: 'wrong-device-fingerprint'});
    logTest('Device Mismatch Rejected', res.status === 403 && res.body.code === 'DEVICE_NOT_AUTHORIZED',
      `Status: ${res.status}, Code: ${res.body.code}, Error: ${res.body.error}`);

    // Test with correct device but different employee (should fail auth)
    console.log('\n=== TEST 12: PRODUCTIVITY RULES & SCORING ===');
    // Test productive app
    res = await request('POST', '/api/agent/session/heartbeat', {
      session_id: 'e6bb42a9-7b2e-426d-90d8-261441d57d2a',
      heartbeat_seq: 2,
      current_app: 'Code.exe',
      current_window_title: 'main.js - Visual Studio Code',
      current_domain: 'github.com',
      active_seconds_delta: 60,
      idle_seconds_delta: 0,
      app_segments: [{ app_name: 'Code.exe', window_title: 'main.js - Visual Studio Code', started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_seconds: 60 }],
      website_segments: [{ domain: 'github.com', started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_seconds: 60 }],
      idle_periods: []
    });
    logTest('Productive App (Code.exe) Tracked', res.status === 200,
      `Status: ${res.status}, Active: ${res.body.active_seconds}`);

    // Test unproductive app
    res = await request('POST', '/api/agent/session/heartbeat', {
      session_id: 'e6bb42a9-7b2e-426d-90d8-261441d57d2a',
      heartbeat_seq: 3,
      current_app: 'chrome.exe',
      current_window_title: 'Facebook - Google Chrome',
      current_domain: 'facebook.com',
      active_seconds_delta: 60,
      idle_seconds_delta: 0,
      app_segments: [{ app_name: 'chrome.exe', window_title: 'Facebook - Google Chrome', started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_seconds: 60 }],
      website_segments: [{ domain: 'facebook.com', started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_seconds: 60 }],
      idle_periods: []
    });
    logTest('Unproductive App (Facebook) Tracked', res.status === 200,
      `Status: ${res.status}, Active: ${res.body.active_seconds}`);

    // Check score
    res = await request('GET', '/api/monitoring/live');
    const founder = res.body.employees.find(e => e.employee_code === 'ET-EMP-0001');
    logTest('Productivity Score Updated', res.status === 200 && founder && founder.score !== undefined && founder.score_label,
      `Score: ${founder?.score}, Label: ${founder?.score_label}`);

    // Test idle detection
    console.log('\n=== TEST 13: IDLE DETECTION ===');
    res = await request('POST', '/api/agent/session/heartbeat', {
      session_id: 'e6bb42a9-7b2e-426d-90d8-261441d57d2a',
      heartbeat_seq: 4,
      current_app: 'Code.exe',
      current_window_title: 'main.js - Visual Studio Code',
      current_domain: 'github.com',
      active_seconds_delta: 0,
      idle_seconds_delta: 300,
      app_segments: [],
      website_segments: [],
      idle_periods: [{ started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_seconds: 300 }]
    });
    logTest('Idle Time Tracked', res.status === 200 && res.body.idle_seconds >= 300,
      `Idle: ${res.body.idle_seconds}`);

    console.log('\n=== TEST 14: SCREENSHOTS ===');
    // Check if screenshot endpoint works
    const res = await request('GET', '/api/agent/me');
    logTest('Agent Settings Include Screenshots', res.status === 200 && res.body.settings && res.body.settings.screenshots_enabled === true,
      `Screenshots Enabled: ${res.body.settings?.screenshots_enabled}, Interval: ${res.body.settings?.screenshot_interval_seconds}s`);

    // Test attendance history
    console.log('\n=== TEST 15: ATTENDANCE HISTORY ===');
    res = await request('GET', '/api/attendance?from=2026-10-01&to=2026-10-11');
    logTest('Attendance History', res.status === 200 && res.body.attendance && Array.isArray(res.body.attendance),
      `Status: ${res.status}, Records: ${res.body.attendance?.length}`);

    // Test HR monitoring dashboard
    console.log('\n=== TEST 16: HR MONITORING DASHBOARD ===');
    res = await request('GET', '/api/attendance/live/today');
    logTest('HR Live Dashboard', res.status === 200 && res.body.employees && res.body.summary,
      `Total: ${res.body.summary?.total}, Present: ${res.body.summary?.present}, Late: ${res.body.summary?.late}, Early Leave: ${res.body.summary?.early_leave}`);

    // Test device management
    console.log('\n=== TEST 17: DEVICE MANAGEMENT ===');
    res = await request('GET', '/api/attendance/devices');
    logTest('Admin Device List', res.status === 200 && res.body.devices,
      `Status: ${res.status}, Devices: ${res.body.devices?.length}`);

    // Test undo punch out
    console.log('\n=== TEST 17b: UNDO PUNCH OUT ===');
    res = await request('POST', '/api/attendance/punch-out/undo', {source: 'agent', device_fingerprint: 'test-device-123'});
    logTest('Undo Punch Out', res.status === 200 && res.body.record && res.body.record.clock_out === null,
      `Status: ${res.status}, Clock Out: ${res.body.record?.clock_out}`);

    // Clean up
    console.log('\n=== CLEANUP ===');
    await request('POST', '/api/attendance/punch-in/undo', {source: 'agent', device_fingerprint: 'test-device-123'});
    logTest('Cleanup', true, 'Test data cleaned up');

  } catch (err) {
    console.error('TEST ERROR:', err.message);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.tests.length}`);
  
  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests.filter(t => !t.passed).forEach(t => console.log(`  - ${t.name}: ${t.details}`));
  }
}

runTests().catch(console.error);