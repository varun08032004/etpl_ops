const http = require('http');

// Start server
const { spawn } = require('child_process');
const server = spawn('node', ['-e', `
const express = require('express');
const app = express();
app.use(require('cors')());
app.use(express.json());
// Mock auth for testing
app.post('/api/auth/login', (req, res) => {
  if (req.body.email === 'founder@ethertrack.in' && req.body.password === 'password123') {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 'd0d7237c-1555-4860-876a-9d13b0ccf7ea', role: 'owner', employee_id: 'a88fb6f4-e807-40b6-8142-357400df75b9' }, 'dev-only-insecure-secret', { expiresIn: '1h' });
    res.json({ accessToken: token, staff: { id: 'd0d7237c-1555-4860-876a-9d13b0ccf7ea', email: 'founder@ethertrack.in', role: 'owner', employee_id: 'a88fb6f4-e807-40b6-8142-357400df75b9' } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
app.use('/api/training', require('./routes/training'));
app.listen(5002, () => console.log('Test server on 5002'));
`], { cwd: 'C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend', stdio: ['ignore', 'pipe', 'pipe'] });

server.stdout.on('data', (data) => console.log('[SERVER]', data.toString().trim()));
server.stderr.on('data', (data) => console.error('[SERVER ERR]', data.toString().trim()));

setTimeout(() => {
  testLogin();
}, 3000);

function testLogin() {
  const loginData = JSON.stringify({ email: 'founder@ethertrack.in', password: 'password123' });
  const options = {
    hostname: 'localhost',
    port: 5002,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
  };
  const req = http.request(options, (res) => {
    let data = ''; res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const jsonStart = data.indexOf('{');
      const result = JSON.parse(data.substring(jsonStart));
      console.log('Login Status:', res.statusCode);
      if (result.accessToken) {
        console.log('Token obtained');
        testRoutes(result.accessToken);
      }
    });
  });
  req.on('error', console.error);
  req.write(loginData);
  req.end();
}

function testRoutes(token) {
  const paths = [
    '/api/training/reports/manager-dashboard',
    '/api/training/pilot-cohorts',
    '/api/training/pilot-feedback'
  ];
  
  paths.forEach(path => {
    const options = { hostname: 'localhost', port: 5002, path, method: 'GET', headers: { 'Authorization': 'Bearer ' + token } };
    const req = http.request(options, (res) => {
      let data = ''; res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(path, 'Status:', res.statusCode);
        if (res.statusCode !== 200) {
          const jsonStart = data.indexOf('{');
          if (jsonStart >= 0) console.log('  Response:', data.substring(jsonStart).substring(0, 200));
        }
      });
    });
    req.on('error', console.error);
    req.end();
  });
  
  // Test POST feedback
  setTimeout(() => {
    const feedbackData = JSON.stringify({ programme_id: '87d0e5e3-47e6-464d-82af-ffb76ca81c29', rating: 5 });
    const options = { hostname: 'localhost', port: 5002, path: '/api/training/pilot-feedback', method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': feedbackData.length } };
    const req = http.request(options, (res) => {
      let data = ''; res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('/api/training/pilot-feedback POST Status:', res.statusCode);
        if (res.statusCode !== 201) {
          const jsonStart = data.indexOf('{');
          if (jsonStart >= 0) console.log('  Response:', data.substring(jsonStart).substring(0, 200));
        }
        server.kill();
      });
    });
    req.on('error', console.error);
    req.write(feedbackData);
    req.end();
  }, 1000);
}

setTimeout(() => { console.log('Timeout'); server.kill(); }, 15000);