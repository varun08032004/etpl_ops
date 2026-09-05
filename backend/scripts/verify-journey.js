const http = require('http');

const server = require('child_process').spawn('node', ['server.js'], {
  cwd: 'C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend',
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => console.log('[SERVER]', data.toString().trim()));
server.stderr.on('data', (data) => console.error('[SERVER ERR]', data.toString().trim()));

setTimeout(async () => {
  console.log('\n=== EMPLOYEE JOURNEY VERIFICATION ===\n');
  
  try {
    // Login
    const ownerToken = await login('founder@ethertrack.in', 'password123');
    console.log('✅ Owner login successful');
    
    // Test endpoints
    await testEndpoint(ownerToken, '/api/training/pilot-cohorts', 'Pilot Cohorts', 200);
    await testEndpoint(ownerToken, '/api/training/programmes/87d0e5e3-47e6-464d-82af-ffb76ca81c29', 'Programme Detail', 200);
    await testEndpoint(ownerToken, '/api/training/carbon-academy', 'Carbon Academy', 200);
    await testEndpoint(ownerToken, '/api/training/my-training', 'My Training', 200);
    
    const progDetail = await testEndpoint(ownerToken, '/api/training/programmes/87d0e5e3-47e6-464d-82af-ffb76ca81c29', 'Programme Detail (full)', 200);
    
    // Test lesson content
    if (progDetail && progDetail.courses && progDetail.courses[0] && progDetail.courses[0].modules && progDetail.courses[0].modules[0] && progDetail.courses[0].modules[0].lessons && progDetail.courses[0].modules[0].lessons[0]) {
      const firstLesson = progDetail.courses[0].modules[0].lessons[0];
      await testEndpoint(ownerToken, '/api/training/lessons/' + firstLesson.id + '/materials', 'Lesson Materials', 200);
      await testEndpoint(ownerToken, '/api/training/lessons/' + firstLesson.id + '/exercises', 'Lesson Exercises', 200);
    }
    
    // Test downloads
    await testEndpoint(ownerToken, '/api/training/programmes/87d0e5e3-47e6-464d-82af-ffb76ca81c29/download', 'Programme Download', 200);
    await testEndpoint(ownerToken, '/api/training/courses/cd8f2418-7043-4ac5-bf15-55a7635acaf5/download', 'Course Download', 200);
    await testEndpoint(ownerToken, '/api/training/modules/c78fb7dc-701b-4947-b969-ee0af386dad3/download', 'Module Download', 200);
    
    // Test feedback
    await testFeedbackSubmission(ownerToken);
    
    // Test competency endpoints
    await testEndpoint(ownerToken, '/api/training/competencies', 'Competencies', 200);
    await testEndpoint(ownerToken, '/api/training/employees/a88fb6f4-e807-40b6-8142-357400df75b9/competencies', 'Employee Competencies', 200);
    
    console.log('\n=== VERIFICATION COMPLETE ===');
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  server.kill();
  process.exit(0);
}, 5000);

function login(email, password) {
  return new Promise((resolve, reject) => {
    const loginData = JSON.stringify({ email, password });
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
        try {
          const jsonStart = data.indexOf('{');
          const result = JSON.parse(data.substring(jsonStart));
          if (result.accessToken) resolve(result.accessToken);
          else reject(new Error('Login failed'));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
}

function testEndpoint(token, path, label, expectedStatus) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const pass = res.statusCode === expectedStatus;
        console.log((pass ? '✅' : '❌') + ' ' + label + ': ' + res.statusCode + ' (expected ' + expectedStatus + ')');
        try {
          const jsonStart = data.indexOf('{');
          const result = jsonStart >= 0 ? JSON.parse(data.substring(jsonStart)) : null;
          resolve(result);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { console.log('⏱️ ' + label + ': timeout'); resolve(null); });
    req.end();
  });
}

function testFeedbackSubmission(token) {
  return new Promise((resolve, reject) => {
    const feedbackData = JSON.stringify({
      lesson_id: '4ea7350d-29fb-425a-be5b-3a79fb6f1ea4',
      rating: 5,
      q1_relevant: 5,
      q2_understandable: 4,
      q3_useful: 5,
      q4_difficulty: 3,
      q5_applicable: 4,
      unclear_text: 'None',
      improvement_text: 'More examples',
      unnecessary_text: 'None',
      missing_text: 'Advanced topics'
    });
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: '/api/training/pilot-feedback',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': feedbackData.length
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const pass = res.statusCode === 201;
        console.log((pass ? '✅' : '❌') + ' Pilot Feedback Submit: ' + res.statusCode + ' (expected 201)');
        resolve();
      });
    });
    req.on('error', reject);
    req.write(feedbackData);
    req.end();
  });
}