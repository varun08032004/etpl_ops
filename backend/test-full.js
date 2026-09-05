const { spawn } = require('child_process');
const http = require('http');

// Start server
const server = spawn('node', ['server.js'], {
  cwd: 'C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend',
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log('[SERVER]', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.error('[SERVER ERR]', data.toString().trim());
});

// Wait for server to start
setTimeout(() => {
  testAPI();
}, 3000);

function testAPI() {
  // First login
  const loginData = JSON.stringify({ email: 'founder@ethertrack.in', password: 'password123' });

  const loginOptions = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  };

  const loginReq = http.request(loginOptions, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Login Status:', res.statusCode);
      try {
        const result = JSON.parse(data);
        if (result.token) {
          console.log('Token received');
          testMyTraining(result.token);
        } else {
          console.log('Login failed:', data);
          server.kill();
        }
      } catch (e) {
        console.log('Login parse error:', data);
        server.kill();
      }
    });
  });

  loginReq.on('error', (err) => {
    console.error('Login error:', err.message);
    server.kill();
  });

  loginReq.setTimeout(10000, () => {
    console.error('Login timeout');
    server.kill();
  });

  loginReq.write(loginData);
  loginReq.end();
}

// Wait for login response before proceeding
setTimeout(() => {}, 1000);

function testMyTraining(token) {
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/training/my-training',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('my-training Status:', res.statusCode);
      console.log('my-training Data:', data);
      server.kill();
    });
  });

  req.on('error', (err) => {
    console.error('my-training error:', err.message);
    server.kill();
  });

  req.end();
}

// Timeout
setTimeout(() => {
  console.log('Timeout - killing server');
  server.kill();
}, 30000);