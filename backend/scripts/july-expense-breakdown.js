#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  // July 2026 expense breakdown by bill
  const { rows } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration,
           jl.debit, jl.credit, coa.code, coa.name,
           b.bill_number, b.bill_date, b.vendor_id, p.name as vendor_name
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    LEFT JOIN bills b ON b.journal_entry_id = je.id
    LEFT JOIN parties p ON p.id = b.vendor_id
    WHERE coa.code = '5700'
      AND je.entry_date BETWEEN '2026-07-01' AND '2026-07-31'
      AND jl.debit > 0
    ORDER BY je.entry_date
  `);
  
  console.log('=== July 2026 Expense Breakdown (5700 Legal & Professional Fees) ===\n');
  
  let total = 0;
  const byVendor = {};
  
  for (const r of rows) {
    const amt = Number(r.debit);
    total += amt;
    const vendor = r.vendor_name || 'Unknown';
    byVendor[vendor] = (byVendor[vendor] || 0) + amt;
    console.log(`  ${r.entry_date} | ${r.bill_number || 'N/A'} | ${vendor} | ₹${amt.toFixed(2)}`);
    console.log(`    JE: ${r.id} | Narration: ${r.narration}`);
  }
  
  console.log('\n=== By Vendor ===');
  for (const [vendor, amt] of Object.entries(byVendor)) {
    console.log(`  ${vendor}: ₹${amt.toFixed(2)}`);
  }
  
  console.log(`\n=== Total July Expense: ₹${total.toFixed(2)} ===`);
  
  process.exit(0);
})();