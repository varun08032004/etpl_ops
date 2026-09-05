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
        console.log('Token received, testing programme detail...');
        testProgrammeDetail(result.accessToken);
      } else {
        console.log('Login failed:', jsonStr);
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
      console.log('Programme Detail Status:', res.statusCode);
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
          
          // Find a course ID for download test
          const firstCourse = result.courses[0];
          if (firstCourse) {
            testDownloadCourse(token, firstCourse.id);
          } else {
            server.kill();
          }
        }
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

function testDownloadCourse(token, courseId) {
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: `/api/training/courses/${courseId}/download`,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('\nDownload Course Status:', res.statusCode);
      console.log('Content-Type:', res.headers['content-type']);
      console.log('Content-Disposition:', res.headers['content-disposition']);
      console.log('Content length:', data.length);
      console.log('First 1000 chars:', data.substring(0, 1000));
      testDownloadModule(token);
    });
  });

  req.on('error', (err) => {
    console.error('Download error:', err.message);
    server.kill();
  });

  req.setTimeout(15000, () => {
    console.error('Download timeout');
    server.kill();
  });

  req.end();
}

function testDownloadModule(token) {
  // Find a module ID from the first course
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
      const jsonStart = data.indexOf('{');
      const jsonStr = data.substring(jsonStart);
      try {
        const result = JSON.parse(jsonStr);
        const firstModule = result.courses?.[0]?.modules?.[0];
        if (firstModule) {
          downloadModule(token, firstModule.id);
        } else {
          console.log('No modules found');
          server.kill();
        }
      } catch (e) {
        console.log('Error parsing programme detail');
        server.kill();
      }
    });
  });

  req.on('error', (err) => {
    console.error('Error:', err.message);
    server.kill();
  });

  req.end();
}

function downloadModule(token, moduleId) {
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: `/api/training/modules/${moduleId}/download`,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('\nDownload Module Status:', res.statusCode);
      console.log('Content-Type:', res.headers['content-type']);
      console.log('Content-Disposition:', res.headers['content-disposition']);
      console.log('Content length:', data.length);
      console.log('First 1000 chars:', data.substring(0, 1000));
      server.kill();
    });
  });

  req.on('error', (err) => {
    console.error('Download module error:', err.message);
    server.kill();
  });

  req.setTimeout(15000, () => {
    console.error('Download module timeout');
    server.kill();
  });

  req.end();
}

setTimeout(() => {
  console.log('Overall timeout');
  server.kill();
}, 30000);