#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  console.log('=== Revenue Growth (MRR source) ===\n');
  
  const now = new Date();
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = d.toISOString().slice(0, 10);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    
    const { rows: accts } = await safeQuery(
      `SELECT code, id FROM chart_of_accounts WHERE code = ANY($1)`,
      [['4100', '4200', '2210', '2220', '2230']]
    );
    const acctMap = Object.fromEntries(accts.map((a) => [a.code, a.id]));
    
    const { rows: [sums] } = await safeQuery(
      `SELECT
         COALESCE(SUM(CASE WHEN jl.account_id = $1 THEN jl.credit - jl.debit ELSE 0 END), 0) AS subscription_revenue,
         COALESCE(SUM(CASE WHEN jl.account_id = $2 THEN jl.credit - jl.debit ELSE 0 END), 0) AS services_revenue,
         COALESCE(SUM(CASE WHEN jl.account_id IN ($3,$4,$5) THEN jl.credit - jl.debit ELSE 0 END), 0) AS gst_collected
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.entry_date BETWEEN $6 AND $7
         AND je.source != 'adjustment'
         AND je.source_type != 'reversal'`,
      [acctMap['4100'] || null, acctMap['4200'] || null, acctMap['2210'] || null, acctMap['2220'] || null, acctMap['2230'] || null, from, to]
    );
    
    const subRev = Math.round((sums.subscription_revenue || 0) * 100) / 100;
    const svcRev = Math.round((sums.services_revenue || 0) * 100) / 100;
    const gst = Math.round((sums.gst_collected || 0) * 100) / 100;
    
    console.log(`  ${from.slice(0,7)}: Sub=₹${subRev} Svc=₹${svcRev} GST=₹${gst} Total=₹${(subRev+svcRev).toFixed(2)}`);
  }
  
  // Also check the MRR from platform-sync
  console.log('\n=== Platform Sync MRR ===');
  // We can't call the API directly but we know the formula
  
  process.exit(0);
})();