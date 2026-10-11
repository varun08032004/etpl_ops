const http = require('http');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMGQ3MjM3Yy0xNTU1LTQ4NjAtODc2YS05ZDEzYjBjY2Y3ZWEiLCJlbXBsb3llZV9pZCI6ImE4OGZiNmY0LWU4MDctNDBiNi04MTQyLTM1NzQwMGRmNzViOSIsImRldmljZV9pZCI6IjdjYWVkNDk2LTE3NzMtNDAzOC1iYzRlLTYzNTE2NjBiZjc4NSIsInR5cCI6ImFnZW50IiwiaWF0IjoxNzkxNDYxMTkzLCJleHAiOjE3OTQwNTMxOTN9.mw_4nRNaAdn2b8VyUNdQyOVkIsZXzB8KdsdCYYC2Mk4';

async function request(method, path, body) {
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
        'Content-Length': Buffer.byteLength(JSON.stringify(body)) 
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

async function test() {
  console.log('=== TEST 1: PUNCH IN ===');
  let res = await request('POST', '/api/attendance/punch-in', {source: 'agent', device_fingerprint: 'test-device-123'});
  console.log('PUNCH IN:', res.status, res.body);
  
  console.log('\n=== TEST 2: PUNCH OUT ===');
  res = await request('POST', '/api/attendance/punch-out', {source: 'agent', device_fingerprint: 'test-device-123'});
  console.log('PUNCH OUT:', res.status, res.body);
  
  console.log('\n=== TEST 3: UNDO PUNCH OUT ===');
  res = await request('POST', '/api/attendance/punch-out/undo', {source: 'agent', device_fingerprint: 'test-device-123'});
  console.log('UNDO PUNCH OUT:', res.status, res.body);
  
  console.log('\n=== TEST 4: PUNCH IN AGAIN ===');
  res = await request('POST', '/api/attendance/punch-in', {source: 'agent', device_fingerprint: 'test-device-123'});
  console.log('PUNCH IN 2:', res.status, res.body);
  
  console.log('\n=== TEST 5: UNDO PUNCH IN ===');
  res = await request('POST', '/api/attendance/punch-in/undo', {source: 'agent', device_fingerprint: 'test-device-123'});
  console.log('UNDO PUNCH IN:', res.status, res.body);
  
  console.log('\n=== ALL TESTS PASSED ===');
}

test().catch(console.error);