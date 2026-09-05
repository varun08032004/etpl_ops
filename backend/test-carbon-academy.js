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
  testFullFlow();
}, 3000);

function testFullFlow() {
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
      const result = JSON.parse(data);
      if (result.accessToken) {
        console.log('Token received, testing /carbon-academy...');
        testCarbonAcademy(result.accessToken);
      } else {
        console.log('Login failed:', data);
        server.kill();
      }
    });
  });

  loginReq.on('error', (err) => {
    console.error('Login error:', err.message);
    server.kill();
  });

  loginReq.setTimeout(15000, () => {
    console.error('Login timeout');
    server.kill();
  });

  loginReq.write(loginData);
  loginReq.end();
}

function testCarbonAcademy(token) {
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/training/carbon-academy',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('carbon-academy Status:', res.statusCode);
      try {
        const result = JSON.parse(data);
        console.log('Programme:', result.programme?.title);
        console.log('Tiers:', Object.keys(result.tiers || {}));
        let totalCourses = 0, totalLessons = 0;
        for (const [tierKey, tier] of Object.entries(result.tiers || {})) {
          console.log(`  ${tier.label}: ${tier.courses.length} courses`);
          for (const course of tier.courses) {
            totalCourses++;
            totalLessons += course.content_summary?.total || 0;
            console.log(`    ${course.code}: ${course.title} - ${course.content_summary?.total} lessons (${course.content_summary?.authored} authored)`);
          }
        }
        console.log(`\nTotal: ${totalCourses} courses, ${totalLessons} lessons`);
      } catch (e) {
        console.log('carbon-academy Response:', data);
      }
      server.kill();
    });
  });

  req.on('error', (err) => {
    console.error('carbon-academy error:', err.message);
    server.kill();
  });

  req.setTimeout(15000, () => {
    console.error('carbon-academy timeout');
    server.kill();
  });

  req.end();
}

setTimeout(() => {
  console.log('Overall timeout');
  server.kill();
}, 30000);