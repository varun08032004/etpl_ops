const http = require('http');

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
    if (result.token) {
      console.log('Token received');
      testMyTraining(result.token);
    } else {
      console.log('Login failed:', data);
    }
  });
});

loginReq.on('error', (err) => {
  console.error('Login error:', err.message);
});

loginReq.write(loginData);
loginReq.end();

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
      console.log('my-training Status:', res.statusCode);
      console.log('my-training Data:', data);
    });
  });

  req.on('error', (err) => {
    console.error('my-training error:', err.message);
  });

  req.end();
}