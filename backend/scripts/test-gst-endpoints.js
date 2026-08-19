const http = require('http');

const postData = JSON.stringify({ email: 'admin@ethertrack.in', password: 'Heylove03' });
const loginOptions = {
  hostname: '127.0.0.1',
  port: 5001,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
};

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.setTimeout(10000);
    if (postData) req.write(postData);
    req.end();
  });
}

function extractToken(setCookieHeader) {
  if (!setCookieHeader) return null;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const cookie of cookies) {
    const match = cookie.match(/internal_ops_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

async function main() {
  try {
    // Login
    const loginRes = await makeRequest(loginOptions, postData);
    console.log('Login:', loginRes.statusCode);
    const loginData = JSON.parse(loginRes.data);
    const token = extractToken(loginRes.headers['set-cookie']);

    if (!token) {
      console.log('No token received from cookies');
      return;
    }
    console.log('Token extracted:', token.substring(0, 20) + '...');

    // Test GST Collected
    const gstOptions = {
      hostname: '127.0.0.1',
      port: 5001,
      path: '/api/accounting/reports/gst-collected?from=2026-07-01&to=2026-08-31&revenue_type=subscription',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    };
    const gstRes = await makeRequest(gstOptions);
    console.log('GST Collected:', gstRes.statusCode);
    console.log('GST Collected response:', gstRes.data);

  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();