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
      res.on('end', () => resolve({ statusCode: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(10000);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    const loginRes = await new Promise((resolve, reject) => {
      const req = http.request(loginOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data, headers: res.headers }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    console.log('Login:', loginRes.statusCode);
    const token = loginRes.headers['set-cookie']?.find(c => c.startsWith('internal_ops_token='))?.split(';')[0].split('=')[1];
    console.log('Token:', token?.substring(0, 20) + '...');

    const gstOptions = {
      hostname: '127.0.0.1',
      port: 5001,
      path: '/api/accounting/reports/gst-collected?from=2026-07-01&to=2026-08-31&revenue_type=subscription',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    const gstRes = await new Promise((resolve, reject) => {
      const req = http.request(gstOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      });
      req.on('error', reject);
      req.end();
    });
    console.log('GST Collected:', gstRes.statusCode);
    console.log('Response:', gstRes.data);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();