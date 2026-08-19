#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  // Check all deferred revenue (2700) journal entries
  const { rows } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           jl.debit, jl.credit, coa.code, coa.name, coa.account_type
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '2700'
    ORDER BY je.entry_date
  `);
  console.log('Deferred Revenue (2700) journal entries:');
  for (const r of rows) {
    console.log(`  ${r.entry_date} | ${r.id} | ${r.source}/${r.source_type} | Dr: ${r.debit} Cr: ${r.credit} | ${r.code} ${r.name}`);
    console.log(`    ${r.narration}`);
  }
  
  // Check platform settlement (1120)
  const { rows: rows2 } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           jl.debit, jl.credit, coa.code, coa.name, coa.account_type
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '1120'
    ORDER BY je.entry_date
  `);
  console.log('\nPlatform Settlement (1120) journal entries:');
  for (const r of rows2) {
    console.log(`  ${r.entry_date} | ${r.id} | ${r.source}/${r.source_type} | Dr: ${r.debit} Cr: ${r.credit} | ${r.code} ${r.name}`);
    console.log(`    ${r.narration}`);
  }
  
  process.exit(0);
})();