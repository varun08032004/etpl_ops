const { spawn } = require('child_process');

const server = spawn('node', ['server.js'], {
  cwd: 'C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend',
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString().trim());
});

// Wait for server to start
setTimeout(() => {
  const http = require('http');
  const data = JSON.stringify({ email: 'tejas@ethertrack.in', password: 'password123' });
  const req = http.request({
    hostname: 'localhost', port: 5001, path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  }, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ const t=JSON.parse(d).accessToken; 
    http.get({hostname:'localhost',port:5001,path:'/api/v1/attendance/leave/pending',headers:{'Authorization':'Bearer '+t}},(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{console.log('Attendance:',r.statusCode,d); server.kill(); process.exit(0);});}); });
  }); req.write(JSON.stringify({ email: 'tejas@ethertrack.in', password: 'password123' })); req.end();
  }, 5000);

  // Timeout
  setTimeout(() => { console.log('Timeout'); server.kill(); process.exit(1); }, 30000);