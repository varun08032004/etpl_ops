#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  const { rows } = await safeQuery(`
    SELECT je.entry_date, je.narration, jl.debit, jl.credit, coa.code, coa.name
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.account_type = 'expense'
      AND je.entry_date BETWEEN '2026-08-01' AND '2026-08-31'
    ORDER BY je.entry_date
  `);
  console.log('August 2026 Expenses:');
  let total = 0;
  for (const r of rows) {
    const amt = Number(r.debit) - Number(r.credit);
    total += amt;
    console.log(' ', r.entry_date, '|', r.code, r.name, '| Dr:', r.debit, 'Cr:', r.credit, '| Net:', amt.toFixed(2));
  }
  console.log('Total August Expense:', total.toFixed(2));
  
  // Also check July
  const { rows: july } = await safeQuery(`
    SELECT je.entry_date, je.narration, jl.debit, jl.credit, coa.code, coa.name
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.account_type = 'expense'
      AND je.entry_date BETWEEN '2026-07-01' AND '2026-07-31'
    ORDER BY je.entry_date
  `);
  console.log('\nJuly 2026 Expenses:');
  let julyTotal = 0;
  for (const r of july) {
    const amt = Number(r.debit) - Number(r.credit);
    julyTotal += amt;
    console.log(' ', r.entry_date, '|', r.code, r.name, '| Dr:', r.debit, 'Cr:', r.credit, '| Net:', amt.toFixed(2));
  }
  console.log('Total July Expense:', julyTotal.toFixed(2));
  
  process.exit(0);
})();