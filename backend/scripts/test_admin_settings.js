const http = require('http');

// Login first
const loginData = JSON.stringify({ email: 'tejas@ethertrack.in', password: 'password123' });

const req = http.request({
  hostname: 'localhost',
  port: 5001,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const loginRes = JSON.parse(data);
    console.log('Login:', res.statusCode);
    if (loginRes.accessToken) {
      // Test settings API
      http.get({
        hostname: 'localhost',
        port: 5001,
        path: '/api/v1/admin/settings/company',
        headers: { 'Authorization': 'Bearer ' + loginRes.accessToken }
      }, (res2) => {
        let d = '';
        res2.on('data', c => d += c);
        res2.on('end', () => console.log('Settings:', res2.statusCode, d.substring(0, 500)));
      });
    }
  });
});

req.write(loginData);
req.end();