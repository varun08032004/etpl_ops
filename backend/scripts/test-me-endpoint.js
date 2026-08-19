const http = require('http');

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.setTimeout(10000);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    // Login
    const loginOptions = {
      hostname: '127.0.0.1',
      port: 5001,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    const loginData = JSON.stringify({ email: 'admin@ethertrack.in', password: 'Heylove03' });
    loginOptions.headers['Content-Length'] = Buffer.byteLength(loginData);
    
    console.log('Logging in...');
    const loginRes = await makeRequest(loginOptions, loginData);
    console.log('Login status:', loginRes.statusCode);
    
    let token = null;
    if (loginRes.data.token) {
      token = loginRes.data.token;
    } else if (loginRes.headers['set-cookie']) {
      const cookie = loginRes.headers['set-cookie'].find(c => c.startsWith('internal_ops_token='));
      if (cookie) token = cookie.split(';')[0].split('=')[1];
    }
    
    if (!token) {
      console.log('No token found');
      console.log('Headers:', loginRes.headers);
      return;
    }
    
    console.log('Token:', token.substring(0, 20) + '...');
    
    // Test /me with Authorization header
    const meOptions = {
      hostname: '127.0.0.1',
      port: 5001,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    };
    
    console.log('Calling /me with Bearer token...');
    const meRes = await makeRequest(meOptions);
    console.log('/me status:', meRes.statusCode);
    console.log('/me response:', meRes.data);
    
    // Also test with cookie
    const meOptions2 = {
      hostname: '127.0.0.1',
      port: 5001,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Cookie': `internal_ops_token=${token}` }
    };
    
    console.log('Calling /me with Cookie...');
    const meRes2 = await makeRequest(meOptions2);
    console.log('/me (cookie) status:', meRes2.statusCode);
    console.log('/me (cookie) response:', meRes2.data);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();