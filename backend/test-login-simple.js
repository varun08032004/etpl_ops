const { spawn } = require('child_process');
const http = require('http');

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

setTimeout(() => {
  testLogin();
}, 3000);

function testLogin() {
  const loginData = JSON.stringify({ email: 'founder@ethertrack.in', password: 'password123' });

  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Login Status:', res.statusCode);
      console.log('Login Response:', data);
      server.kill();
    });
  });

  req.on('error', (err) => {
    console.error('Login error:', err.message);
    server.kill();
  });

  req.setTimeout(15000, () => {
    console.error('Login timeout');
    server.kill();
  });

  req.write(loginData);
  req.end();
}

setTimeout(() => {
  console.log('Overall timeout');
  server.kill();
}, 25000);