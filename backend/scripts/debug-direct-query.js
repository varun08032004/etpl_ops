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

    // Test the exact SQL query from the route
    const { safeQuery } = require('../db/pool');
    const { rows: accts } = await safeQuery(
      `SELECT code, id FROM chart_of_accounts WHERE code = ANY($1)`,
      [['4100', '4200', '2210', '2220', '2230']]
    );
    const acctMap = Object.fromEntries(accts.map((a) => [a.code, a.id]));
    console.log('Account map:', acctMap);

    const { rows } = await safeQuery(
      `SELECT 
         je.id as journal_entry_id,
         je.entry_date,
         je.narration,
         je.source,
         je.source_type,
         COALESCE(SUM(CASE WHEN jl.account_id = $1 THEN jl.credit - jl.debit ELSE 0 END), 0) as subscription_revenue,
         COALESCE(SUM(CASE WHEN jl.account_id = $2 THEN jl.credit - jl.debit ELSE 0 END), 0) as services_revenue,
         COALESCE(SUM(CASE WHEN jl.account_id = $3 THEN jl.credit - jl.debit ELSE 0 END), 0) as cgst,
         COALESCE(SUM(CASE WHEN jl.account_id = $4 THEN jl.credit - jl.debit ELSE 0 END), 0) as sgst,
         COALESCE(SUM(CASE WHEN jl.account_id = $5 THEN jl.credit - jl.debit ELSE 0 END), 0) as igst
       FROM journal_entries je
       JOIN journal_lines jl ON jl.journal_entry_id = je.id
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       WHERE je.entry_date BETWEEN $6 AND $7
         AND je.source != 'adjustment'
         AND je.source_type != 'reversal'
         AND ($8 = 'all' OR je.source_type = $8 OR je.source = $8)
       GROUP BY je.id, je.entry_date, je.narration, je.source, je.source_type
       ORDER BY je.entry_date`,
      [null, null, null, null, null, '2026-07-01', '2026-08-31', 'subscription']
    );
    console.log('Direct query result:', rows);
  } catch (e) { console.error('Error:', e.message, e.stack); }
}
main();