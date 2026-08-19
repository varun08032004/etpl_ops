#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  // Check journal entries for revenue in July 2026
  const { rows } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           jl.debit, jl.credit, coa.code, coa.name, coa.account_type
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.account_type = 'income'
      AND je.entry_date BETWEEN '2026-07-01' AND '2026-07-31'
    ORDER BY je.entry_date, je.id
  `);
  console.log('Income journal entries in July 2026:');
  for (const r of rows) {
    console.log(`  ${r.id} | ${r.entry_date} | ${r.source}/${r.source_type} | Dr: ${r.debit} Cr: ${r.credit} | ${r.code} ${r.name}`);
    console.log(`    ${r.narration}`);
  }
  
  // Check all income entries in 2026
  const { rows: allIncome } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           SUM(jl.debit) as total_debit, SUM(jl.credit) as total_credit
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.account_type = 'income'
      AND je.entry_date BETWEEN '2026-01-01' AND '2026-12-31'
    GROUP BY je.id, je.entry_date, je.narration, je.source, je.source_type
    ORDER BY je.entry_date
  `);
  console.log('\nAll income entries in 2026 (aggregated):');
  for (const r of allIncome) {
    console.log(`  ${r.id} | ${r.entry_date} | ${r.source}/${r.source_type} | Dr: ${r.total_debit} Cr: ${r.total_credit}`);
    console.log(`    ${r.narration}`);
  }
  
  process.exit(0);
})();