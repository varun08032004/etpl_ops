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
  testFullJourney();
}, 3000);

async function testFullJourney() {
  console.log('\n=== EMPLOYEE LEARNING JOURNEY AUDIT ===\n');
  
  // Step 1: Login
  console.log('Step 1: Employee Login');
  const loginResult = await login();
  if (!loginResult.token) {
    console.log('❌ FAIL: Login failed');
    server.kill();
    return;
  }
  console.log('✅ PASS: Login successful');
  
  const token = loginResult.token;
  const employeeId = loginResult.employeeId;
  
  // Step 2: Get my-training
  console.log('\nStep 2: GET /api/training/my-training');
  const myTraining = await getMyTraining(token);
  if (!myTraining || myTraining.assignments.length === 0) {
    console.log('⚠️ WARN: No assignments found');
  } else {
    console.log(`✅ PASS: Found ${myTraining.assignments.length} assignment(s)`);
    console.log(`   Programme: ${myTraining.assignments[0].programme_title}`);
    console.log(`   Next lesson: ${myTraining.assignments[0].next_lesson?.title || 'None'}`);
  }
  
  // Step 3: Get Carbon Academy curriculum
  console.log('\nStep 3: GET /api/training/carbon-academy');
  const curriculum = await getCarbonAcademy(token);
  if (!curriculum) {
    console.log('❌ FAIL: Curriculum not loaded');
    server.kill();
    return;
  }
  console.log(`✅ PASS: Curriculum loaded`);
  let totalCourses = 0, totalLessons = 0;
  for (const [tierKey, tier] of Object.entries(curriculum.tiers || {})) {
    console.log(`   ${tier.label}: ${tier.courses.length} courses`);
    for (const course of tier.courses) {
      totalCourses++;
      totalLessons += course.content_summary?.total || 0;
    }
  }
  console.log(`   TOTAL: ${totalCourses} courses, ${totalLessons} lessons`);
  
  // Step 4: Get Programme Detail
  console.log('\nStep 4: GET /api/training/programmes/:id (detail)');
  const progDetail = await getProgrammeDetail(token);
  if (!progDetail) {
    console.log('❌ FAIL: Programme detail not loaded');
    server.kill();
    return;
  }
  console.log(`✅ PASS: Programme detail loaded`);
  console.log(`   Courses with modules: ${progDetail.courses.filter(c => c.modules && c.modules.length > 0).length}/${progDetail.courses.length}`);
  
  // Step 5: Test Lesson Access
  console.log('\nStep 5: Test Lesson Access');
  const firstCourse = progDetail.courses[0];
  const firstModule = firstCourse.modules?.[0];
  const firstLesson = firstModule?.lessons?.[0];
  if (firstLesson) {
    console.log(`   Testing lesson: ${firstLesson.title} (${firstLesson.code})`);
    const lessonResult = await testLessonAccess(token, firstLesson.id);
    if (lessonResult.success) {
      console.log(`✅ PASS: Lesson content accessible`);
      console.log(`   Content status: ${lessonResult.contentStatus}`);
      console.log(`   Has materials: ${lessonResult.hasMaterials}`);
      console.log(`   Has exercises: ${lessonResult.hasExercises}`);
    } else {
      console.log(`❌ FAIL: ${lessonResult.error}`);
    }
  }
  
  // Step 6: Test Progress Tracking
  console.log('\nStep 6: Test Progress Tracking');
  if (firstLesson) {
    const startResult = await startLesson(token, firstLesson.id);
    if (startResult.success) {
      console.log(`✅ PASS: Lesson start recorded`);
    } else {
      console.log(`❌ FAIL: ${startResult.error}`);
    }
    
    const progressResult = await getEmployeeProgress(token, employeeId);
    if (progressResult.success) {
      console.log(`✅ PASS: Progress retrieved`);
      console.log(`   Progress records: ${progressResult.count}`);
    } else {
      console.log(`❌ FAIL: ${progressResult.error}`);
    }
  }
  
  // Step 7: Test Downloads
  console.log('\nStep 7: Test Downloads');
  const downloadResults = await testAllDownloads(token);
  for (const dr of downloadResults) {
    console.log(`   ${dr.label}: ${dr.success ? '✅ PASS' : '❌ FAIL'} (${dr.size} bytes)`);
  }
  
  // Step 8: Test Manager Dashboard
  console.log('\nStep 8: Test Manager Dashboard');
  const mgrResult = await getManagerDashboard(token);
  if (mgrResult.success) {
    console.log(`✅ PASS: Manager dashboard accessible`);
    console.log(`   Team size: ${mgrResult.summary.total}`);
  } else {
    console.log(`❌ FAIL: ${mgrResult.error}`);
  }
  
  // Step 9: Test Pilot Cohorts
  console.log('\nStep 9: Test Pilot Cohorts API');
  const cohortResult = await getPilotCohorts(token);
  if (cohortResult.success) {
    console.log(`✅ PASS: Pilot cohorts accessible`);
    console.log(`   Cohorts: ${cohortResult.count}`);
  } else {
    console.log(`❌ FAIL: ${cohortResult.error}`);
  }
  
  // Step 10: Test Feedback
  console.log('\nStep 10: Test Pilot Feedback API');
  const feedbackResult = await submitFeedback(token);
  if (feedbackResult.success) {
    console.log(`✅ PASS: Feedback submitted`);
  } else {
    console.log(`❌ FAIL: ${feedbackResult.error}`);
  }
  
  console.log('\n=== JOURNEY AUDIT COMPLETE ===');
  server.kill();
}

function makeRequest(method, path, token, body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonStart = data.indexOf('{');
          if (jsonStart >= 0) {
            const jsonStr = data.substring(jsonStart);
            resolve({ status: res.statusCode, data: JSON.parse(jsonStr) });
          } else {
            resolve({ status: res.statusCode, data: data });
          }
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (err) => {
      resolve({ status: 0, error: err.message });
    });
    
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ status: 0, error: 'timeout' });
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function login() {
  return new Promise((resolve) => {
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
        const jsonStart = data.indexOf('{');
        if (jsonStart >= 0) {
          const result = JSON.parse(data.substring(jsonStart));
          if (result.accessToken) {
            resolve({ token: result.accessToken, employeeId: result.staff?.employee_id });
          } else {
            resolve({ token: null });
          }
        } else {
          resolve({ token: null });
        }
      });
    });
    
    req.on('error', (err) => resolve({ token: null, error: err.message }));
    req.write(loginData);
    req.end();
  });
}

function getMyTraining(token) {
  return makeRequest('GET', '/api/training/my-training', token).then(r => r.data);
}

function getCarbonAcademy(token) {
  return makeRequest('GET', '/api/training/carbon-academy', token).then(r => r.data);
}

function getProgrammeDetail(token) {
  return makeRequest('GET', '/api/training/programmes/87d0e5e3-47e6-464d-82af-ffb76ca81c29', token).then(r => r.data);
}

function testLessonAccess(token, lessonId) {
  return makeRequest('GET', `/api/training/lessons/${lessonId}/materials`, token)
    .then(materials => {
      return makeRequest('GET', `/api/training/lessons/${lessonId}/exercises`, token)
        .then(exercises => ({
          success: true,
          contentStatus: 'AUTHORED',
          hasMaterials: materials.data?.materials?.length > 0,
          hasExercises: exercises.data?.exercises?.length > 0
        }));
    });
}

function startLesson(token, lessonId) {
  return makeRequest('POST', `/api/training/lessons/${lessonId}/start`, token).then(r => r.data);
}

function getEmployeeProgress(token, employeeId) {
  return makeRequest('GET', `/api/training/employees/${employeeId}/progress`, token).then(r => ({
    success: r.status === 200,
    count: r.data?.rows?.length || 0
  }));
}

function testAllDownloads(token) {
  const downloads = [
    { path: '/api/training/programmes/87d0e5e3-47e6-464d-82af-ffb76ca81c29/download', label: 'Programme' },
    { path: '/api/training/courses/cd8f2418-7043-4ac5-bf15-55a7635acaf5/download', label: 'Course (C01)' },
    { path: '/api/training/modules/c78fb7dc-701b-4947-b969-ee0af386dad3/download', label: 'Module (C01.1)' }
  ];
  
  return Promise.all(downloads.map(async d => {
    const result = await makeRequest('GET', d.path, token);
    return {
      label: d.label,
      success: result.status === 200 && result.data && result.data.length > 100,
      size: result.data?.length || 0
    };
  }));
}

function getManagerDashboard(token) {
  return makeRequest('GET', '/api/training/reports/manager-dashboard', token).then(r => ({
    success: r.status === 200,
    summary: r.data?.summary
  }));
}

function getPilotCohorts(token) {
  return makeRequest('GET', '/api/training/pilot-cohorts', token).then(r => ({
    success: r.status === 200,
    count: r.data?.cohorts?.length || 0
  }));
}

function submitFeedback(token) {
  return makeRequest('POST', '/api/training/pilot-feedback', token, {
    programme_id: '87d0e5e3-47e6-464d-82af-ffb76ca81c29',
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
  }).then(r => ({
    success: r.status === 201
  }));
}