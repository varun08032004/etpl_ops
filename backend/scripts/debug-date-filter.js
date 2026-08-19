#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  // Check entry dates for account 4100
  const { rows } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, jl.debit, jl.credit
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '4100'
    ORDER BY je.entry_date
  `);
  
  console.log('All entries for account 4100:');
  for (const r of rows) {
    console.log(`  ${r.entry_date} (${typeof r.entry_date}) | ${r.id} | Dr: ${r.debit} Cr: ${r.credit}`);
  }
  
  // Test date filter directly
  const { rows: aug } = await safeQuery(`
    SELECT je.id, je.entry_date
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '4100'
      AND je.entry_date BETWEEN '2026-08-01' AND '2026-08-31'
  `);
  
  console.log('\nAugust entries for 4100:');
  for (const r of aug) {
    console.log(`  ${r.entry_date} | ${r.id}`);
  }
  
  const { rows: jul } = await safeQuery(`
    SELECT je.id, je.entry_date
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '4100'
      AND je.entry_date BETWEEN '2026-07-01' AND '2026-07-31'
  `);
  
  console.log('\nJuly entries for 4100:');
  for (const r of jul) {
    console.log(`  ${r.entry_date} | ${r.id}`);
  }
  
  process.exit(0);
})();