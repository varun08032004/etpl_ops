const http = require('http');

const postData = JSON.stringify({ email: 'admin@ethertrack.in', password: 'Heylove03' });
const loginOptions = { hostname: '127.0.0.1', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } };

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ statusCode: res.statusCode, data: d, headers: res.headers })); });
    req.on('error', reject); req.setTimeout(10000); if (postData) req.write(postData); req.end();
  });
}

async function main() {
  try {
    const loginRes = await makeRequest(loginOptions, JSON.stringify({ email: 'admin@ethertrack.in', password: 'Heylove03' }));
    console.log('Login:', loginRes.statusCode);
    console.log('Cookies:', loginRes.headers['set-cookie']);
    const token = loginRes.headers['set-cookie']?.find(c => c.startsWith('internal_ops_token='))?.split(';')[0].split('=')[1];
    console.log('Token:', token?.substring(0, 20) + '...');

    const meOptions = { hostname: '127.0.0.1', port: 5001, path: '/api/auth/me', method: 'GET', headers: { 'Authorization': 'Bearer ' + token } };
    const meRes = await new Promise((resolve, reject) => { const req = http.request(meOptions, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ statusCode: res.statusCode, data: d })); }); req.on('error', reject); req.end(); });
    console.log('/me:', meRes.statusCode, meRes.data);
  } catch (e) { console.error(e.message); }
}
main();