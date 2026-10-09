const { spawn } = require('child_process');
const http = require('http');

// Start server
const server = spawn('node', ['server.js'], {
  cwd: 'C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend',
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log('SERVER:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.error('SERVER ERR:', data.toString().trim());
});

// Wait for server to start
setTimeout(() => {
  // Login
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
          res2.on('end', () => {
            console.log('Settings:', res2.statusCode, d.substring(0, 500));
            server.kill();
            process.exit(0);
          });
        });
      }
    });
  });
  
  req.write(loginData);
  req.end();
}, 5000);

// Timeout
setTimeout(() => {
  console.log('Timeout');
  server.kill();
  process.exit(1);
}, 30000);