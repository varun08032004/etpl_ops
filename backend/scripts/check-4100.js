#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  // Check all 4100 entries by month
  const { rows } = await safeQuery(`
    SELECT je.id, je.entry_date, je.source, je.source_type, je.narration,
           jl.credit, jl.debit
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '4100'
    ORDER BY je.entry_date
  `);
  
  console.log('=== All Account 4100 Entries ===\n');
  
  const byMonth = {};
  for (const r of rows) {
    const month = r.entry_date.slice(0, 7);
    const amt = Number(r.credit) - Number(r.debit);
    byMonth[month] = (byMonth[month] || 0) + amt;
    console.log(`  ${r.entry_date} | ${r.source}/${r.source_type} | Cr: ${r.credit} Dr: ${r.debit} | Net: ${amt}`);
    console.log(`    ${r.narration}`);
  }
  
  console.log('\n=== By Month ===');
  for (const [month, total] of Object.entries(byMonth).sort()) {
    console.log(`  ${month}: ₹${total.toFixed(2)}`);
  }
  
  process.exit(0);
})();