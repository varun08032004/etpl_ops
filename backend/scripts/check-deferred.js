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
    const token = loginRes.headers['set-cookie']?.find(c => c.startsWith('internal_ops_token='))?.split(';')[0].split('=')[1];
    console.log('Token:', token?.substring(0, 20) + '...');

    // Test trial balance to see deferred revenue
    const tbOptions = { hostname: '127.0.0.1', port: 5001, path: '/api/accounting/reports/trial-balance', method: 'GET', headers: { 'Authorization': 'Bearer ' + token } };
    const tbRes = await makeRequest(tbOptions);
    console.log('Trial Balance:', tbRes.statusCode);
    const tbData = JSON.parse(tbRes.data);
    console.log('Deferred Revenue (2700):', tbData.lines.find(l => l.code === '2700'));
    console.log('Prepaid Expenses (1500):', tbData.lines.find(l => l.code === '1500'));
    console.log('Platform Settlement (1120):', tbData.lines.find(l => l.code === '1120'));
    
    // Check P&L for deferred revenue
    const pnlOptions = { hostname: '127.0.0.1', port: 5001, path: '/api/accounting/reports/profit-and-loss?from=2026-07-01&to=2026-07-31', method: 'GET', headers: { 'Authorization': 'Bearer ' + token } };
    const pnlRes = await makeRequest(pnlOptions);
    console.log('\nP&L July:', pnlRes.statusCode);
    const pnlData = JSON.parse(pnlRes.data);
    console.log('Income:', pnlData.income);
    console.log('Expenses:', pnlData.expenses);
    
  } catch (e) { console.error(e.message); }
}
main();