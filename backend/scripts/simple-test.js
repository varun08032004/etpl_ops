const http = require('http');

const loginData = JSON.stringify({ email: 'founder@ethertrack.in', password: 'password123' });

const loginOptions = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Login status:', res.statusCode);
    const loginRes = JSON.parse(data);
    console.log('Login response:', loginRes);
    
    const cookies = res.headers['set-cookie'];
    if (cookies) {
      const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
      console.log('\nCookie:', cookieHeader);
      
      // Test GET /courses
      const courseOptions = {
        hostname: 'localhost',
        port: 5001,
        path: '/api/training/courses',
        method: 'GET',
        headers: { 'Cookie': cookieHeader }
      };
      
      const courseReq = http.request(courseOptions, (courseRes) => {
        let courseData = '';
        courseRes.on('data', (chunk) => { courseData += chunk; });
        courseRes.on('end', () => {
          console.log('\nGET /courses status:', courseRes.statusCode);
          console.log('Response:', courseData.substring(0, 500));
          
          // Test GET /assessments
          const assessmentOptions = {
            hostname: 'localhost',
            port: 5001,
            path: '/api/training/assessments',
            method: 'GET',
            headers: { 'Cookie': cookieHeader }
          };
          
          const assessmentReq = http.request(assessmentOptions, (assessmentRes) => {
            let assessmentData = '';
            assessmentRes.on('data', (chunk) => { assessmentData += chunk; });
            assessmentRes.on('end', () => {
              console.log('\nGET /assessments status:', assessmentRes.statusCode);
              console.log('Response:', assessmentData.substring(0, 500));
            });
          });
          
          assessmentReq.end();
        });
      });
      
      courseReq.on('error', (e) => console.error('Course request error:', e.message));
      courseReq.end();
    }
  });
});

loginReq.on('error', (e) => console.error('Login error:', e.message));
loginReq.write(loginData);
loginReq.end();