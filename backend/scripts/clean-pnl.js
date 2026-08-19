#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  console.log('=== Clean P&L (excluding reversal entries) ===\n');
  
  const months = [
    { label: 'May 2026', start: '2026-05-01', end: '2026-05-31' },
    { label: 'June 2026', start: '2026-06-01', end: '2026-06-30' },
    { label: 'July 2026', start: '2026-07-01', end: '2026-07-31' },
    { label: 'Aug 2026', start: '2026-08-01', end: '2026-08-31' },
  ];
  
  for (const m of months) {
    const { rows } = await safeQuery(`
      SELECT coa.code, coa.name, coa.account_type,
              COALESCE(SUM(CASE WHEN je.source != 'adjustment' OR je.source_type NOT LIKE '%reversal%' THEN jl.debit ELSE 0 END),0) AS total_debit,
              COALESCE(SUM(CASE WHEN je.source != 'adjustment' OR je.source_type NOT LIKE '%reversal%' THEN jl.credit ELSE 0 END),0) AS total_credit
       FROM chart_of_accounts coa
       LEFT JOIN journal_lines jl ON jl.account_id = coa.id
       LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
         AND je.entry_date BETWEEN $1 AND $2
       WHERE coa.account_type IN ('income','expense') AND coa.is_group = false AND coa.is_active = true
       GROUP BY coa.id, coa.code, coa.name, coa.account_type
       ORDER BY coa.code
    `, [m.start, m.end]);
    
    console.log(`=== ${m.label} (excl. reversals) ===`);
    let totalIncome = 0, totalExpense = 0;
    for (const a of rows) {
      const d = Number(a.total_debit);
      const c = Number(a.total_credit);
      const net = a.account_type === 'income' ? c - d : d - c;
      if (net !== 0) {
        console.log(`  ${a.code} ${a.name}: ${net >= 0 ? '+' : ''}${net.toFixed(2)}`);
        if (a.account_type === 'income') totalIncome += net;
        else totalExpense += net;
      }
    }
    console.log(`  Total Income: ${totalIncome.toFixed(2)}`);
    console.log(`  Total Expense: ${totalExpense.toFixed(2)}`);
    console.log(`  Net: ${(totalIncome - totalExpense).toFixed(2)}`);
    console.log('');
  }
  
  process.exit(0);
})();