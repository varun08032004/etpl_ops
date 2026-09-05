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
      const jsonStart = data.indexOf('{');
      const jsonStr = data.substring(jsonStart);
      const result = JSON.parse(jsonStr);
      if (result.accessToken) {
        console.log('✓ Login successful');
        testMyTraining(result.accessToken);
      } else {
        console.log('✗ Login failed:', jsonStr);
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
      console.log('\n=== /api/training/my-training ===');
      console.log('Status:', res.statusCode);
      const jsonStart = data.indexOf('{');
      const jsonStr = data.substring(jsonStart);
      try {
        const result = JSON.parse(jsonStr);
        console.log('Assignments:', result.assignments?.length);
        if (result.assignments?.length > 0) {
          const a = result.assignments[0];
          console.log('  Programme:', a.programme_title);
          console.log('  Next lesson:', a.next_lesson?.title);
          console.log('  Upcoming assessments:', a.upcoming_assessments?.length);
        }
        console.log('Certificates:', result.certificates?.length);
        testCarbonAcademy(token);
      } catch (e) {
        console.log('Response:', jsonStr);
        server.kill();
      }
    });
  });

  req.on('error', (err) => {
    console.error('my-training error:', err.message);
    server.kill();
  });

  req.setTimeout(15000, () => {
    console.error('my-training timeout');
    server.kill();
  });

  req.end();
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
      console.log('\n=== /api/training/carbon-academy ===');
      console.log('Status:', res.statusCode);
      const jsonStart = data.indexOf('{');
      const jsonStr = data.substring(jsonStart);
      try {
        const result = JSON.parse(jsonStr);
        console.log('Programme:', result.programme?.title);
        console.log('Tiers:', Object.keys(result.tiers || {}));
        let totalCourses = 0, totalLessons = 0;
        for (const [tierKey, tier] of Object.entries(result.tiers || {})) {
          console.log(`  ${tier.label}: ${tier.courses.length} courses`);
          for (const course of tier.courses) {
            totalCourses++;
            totalLessons += course.content_summary?.total || 0;
          }
        }
        console.log(`  TOTAL: ${totalCourses} courses, ${totalLessons} lessons`);
        testProgrammeDetail(token);
      } catch (e) {
        console.log('Response:', jsonStr);
        server.kill();
      }
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

function testProgrammeDetail(token) {
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/training/programmes/87d0e5e3-47e6-464d-82af-ffb76ca81c29',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('\n=== /api/training/programmes/:id (detail) ===');
      console.log('Status:', res.statusCode);
      const jsonStart = data.indexOf('{');
      const jsonStr = data.substring(jsonStart);
      try {
        const result = JSON.parse(jsonStr);
        console.log('Programme:', result.programme?.title);
        console.log('Courses:', result.courses?.length);
        if (result.courses) {
          result.courses.forEach(c => {
            const moduleCount = c.modules?.length || 0;
            const lessonCount = c.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 0;
            console.log(`  ${c.code}: ${c.title} (${moduleCount} modules, ${lessonCount} lessons)`);
          });
        }
        testDownloads(token);
      } catch (e) {
        console.log('Response:', jsonStr);
        server.kill();
      }
    });
  });

  req.on('error', (err) => {
    console.error('Programme detail error:', err.message);
    server.kill();
  });

  req.setTimeout(15000, () => {
    console.error('Programme detail timeout');
    server.kill();
  });

  req.end();
}

function testDownloads(token) {
  console.log('\n=== Download Endpoints ===');
  
  // Test programme download
  testDownload(token, '/api/training/programmes/87d0e5e3-47e6-464d-82af-ffb76ca81c29/download', 'Programme');
  
  // Test course download (C01)
  setTimeout(() => {
    testDownload(token, '/api/training/courses/cd8f2418-7043-4ac5-bf15-55a7635acaf5/download', 'Course (C01)');
  }, 1000);
  
  // Test module download (C01.1)
  setTimeout(() => {
    testDownload(token, '/api/training/modules/c78fb7dc-701b-4947-b969-ee0af386dad3/download', 'Module (C01.1)');
  }, 2000);
}

function testDownload(token, path, label) {
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: path,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`\n--- ${label} Download ---`);
      console.log('Status:', res.statusCode);
      console.log('Content-Type:', res.headers['content-type']);
      console.log('Content-Disposition:', res.headers['content-disposition']);
      console.log('Content length:', data.length);
      if (res.statusCode === 200) {
        console.log('✓ SUCCESS');
      } else {
        console.log('✗ FAILED:', data.substring(0, 200));
      }
    });
  });

  req.on('error', (err) => {
    console.error(`${label} download error:`, err.message);
  });

  req.setTimeout(15000, () => {
    console.error(`${label} download timeout`);
  });

  req.end();
}

setTimeout(() => {
  console.log('\n=== ALL TESTS COMPLETE ===');
  server.kill();
}, 20000);