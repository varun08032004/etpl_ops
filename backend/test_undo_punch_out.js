const http = require('http');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMGQ3MjM3Yy0xNTU1LTQ4NjAtODc2YS05ZDEzYjBjY2Y3ZWEiLCJlbXBsb3llZV9pZCI6ImE4OGZiNmY0LWU4MDctNDBiNi04MTQyLTM1NzQwMGRmNzViOSIsImRldmljZV9pZCI6IjdjYWVkNDk2LTE3NzMtNDAzOC1iYzRlLTYzNTE2NjBiZjc4NSIsInR5cCI6ImFnZW50IiwiaWF0IjoxNzkxNDYxMTkzLCJleHAiOjE3OTQwNTMxOTN9.mw_4nRNaAdn2b8VyUNdQyOVkIsZXzB8KdsdCYYC2Mk4';
const data = JSON.stringify({source: 'agent', device_fingerprint: 'test-device-123'});
const options = { hostname: '127.0.0.1', port: 5001, path: '/api/attendance/punch-out/undo', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Content-Length': Buffer.byteLength(data) }};
const req = http.request(options, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>console.log('UNDO PUNCH OUT:', res.statusCode, d)); });
req.on('error', e => console.error('Error:', e.message));
req.write(data);
req.end();