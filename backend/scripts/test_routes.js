const http = require('http');
const { spawn } = require('child_process');

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
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzOTRjNTJiMC1hYzVkLTQ1ZmMtOWQxYS05Mjc0YWUxMjY5NzMiLCJyb2xlIjoib3duZXIiLCJpYXQiOjE3OTE0MzU4ODAsImV4cCI6MTc5MTQzNzY4MH0.n2k3NaQ2x8GKt5enGx7R4mLQ7Hqvq8RKcOk6OUwOPWI';
  
  // Test attendance leave pending
  http.get({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/attendance/leave/pending',
    headers: { 'Authorization': 'Bearer ' + token }
  }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      console.log('Attendance leave pending:', res.statusCode, d.substring(0, 200));
      server.kill();
      process.exit(0);
    });
  }).on('error', e => {
    console.log('Error:', e.message);
    server.kill();
    process.exit(1);
  });
}, 5000);

// Timeout
setTimeout(() => {
  console.log('Timeout');
  server.kill();
  process.exit(1);
}, 30000);