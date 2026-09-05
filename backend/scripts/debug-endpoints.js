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

setTimeout(async () => {
  console.log('\n=== DEBUGGING FAILED ENDPOINTS ===\n');
  
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
      const jsonStart = data.indexOf('{');
      const result = JSON.parse(data.substring(jsonStart));
      const token = result.accessToken;
      console.log('Token obtained');
      
      // Test manager dashboard
      testEndpoint(token, '/api/training/reports/manager-dashboard', 'Manager Dashboard');
      
      // Test pilot cohorts
      setTimeout(() => testEndpoint(token, '/api/training/pilot-cohorts', 'Pilot Cohorts'), 500);
      
      // Test feedback
      setTimeout(() => testFeedback(token), 1000);
    });
  });

  loginReq.on('error', (err) => {
    console.error('Login error:', err.message);
    server.kill();
  });

  loginReq.write(loginData);
  loginReq.end();

  function testEndpoint(token, path, label) {
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
        console.log(`\n${label}:`);
        console.log('  Status:', res.statusCode);
        const jsonStart = data.indexOf('{');
        if (jsonStart >= 0) {
          try {
            const result = JSON.parse(data.substring(jsonStart));
            console.log('  Response:', JSON.stringify(result).substring(0, 500));
          } catch (e) {
            console.log('  Raw:', data.substring(0, 500));
          }
        } else {
          console.log('  Raw:', data.substring(0, 500));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`${label} error:`, err.message);
    });

    req.end();
  }

  function testFeedback(token) {
    const feedbackData = JSON.stringify({
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
        console.log('\nFeedback Submit:');
        console.log('  Status:', res.statusCode);
        const jsonStart = data.indexOf('{');
        if (jsonStart >= 0) {
          try {
            const result = JSON.parse(data.substring(jsonStart));
            console.log('  Response:', JSON.stringify(result));
          } catch (e) {
            console.log('  Raw:', data.substring(0, 500));
          }
        } else {
          console.log('  Raw:', data.substring(0, 500));
        }
        setTimeout(() => server.kill(), 1000);
      });
    });

    req.on('error', (err) => {
      console.error('Feedback error:', err.message);
      server.kill();
    });

    req.write(feedbackData);
    req.end();
  }
}, 3000);