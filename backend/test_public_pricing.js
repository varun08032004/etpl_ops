require('dotenv').config({ path: '.env' });
const http = require('http');

const req = require('http').request({
  hostname: 'localhost',
  port: 5001,
  path: '/api/public/pricing',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Data:', data));
});
req.on('error', e => console.log('Error:', e.message));
req.end();