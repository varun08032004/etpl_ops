#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  // Test the exact P&L query with July params
  console.log('=== P&L Query with July params ===');
  const { rows: july } = await safeQuery(`
    SELECT coa.code, coa.name, coa.account_type,
            COALESCE(SUM(jl.debit),0) AS total_debit,
            COALESCE(SUM(jl.credit),0) AS total_credit
     FROM chart_of_accounts coa
     LEFT JOIN journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
       AND je.entry_date BETWEEN $1 AND $2
     WHERE coa.account_type IN ('income','expense') AND coa.is_group = false AND coa.is_active = true
     GROUP BY coa.id, coa.code, coa.name, coa.account_type
     ORDER BY coa.code
  `, ['2026-07-01', '2026-07-31']);
  
  for (const a of july) {
    const d = Number(a.total_debit);
    const c = Number(a.total_credit);
    const net = a.account_type === 'income' ? c - d : d - c;
    if (net !== 0) {
      console.log(`  ${a.code} ${a.name}: Dr=${d} Cr=${c} Net=${net}`);
    }
  }
  
  console.log('\n=== P&L Query with August params ===');
  const { rows: aug } = await safeQuery(`
    SELECT coa.code, coa.name, coa.account_type,
            COALESCE(SUM(jl.debit),0) AS total_debit,
            COALESCE(SUM(jl.credit),0) AS total_credit
     FROM chart_of_accounts coa
     LEFT JOIN journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
       AND je.entry_date BETWEEN $1 AND $2
     WHERE coa.account_type IN ('income','expense') AND coa.is_group = false AND coa.is_active = true
     GROUP BY coa.id, coa.code, coa.name, coa.account_type
     ORDER BY coa.code
  `, ['2026-08-01', '2026-08-31']);
  
  for (const a of aug) {
    const d = Number(a.total_debit);
    const c = Number(a.total_credit);
    const net = a.account_type === 'income' ? c - d : d - c;
    if (net !== 0) {
      console.log(`  ${a.code} ${a.name}: Dr=${d} Cr=${c} Net=${net}`);
    }
  }
  
  process.exit(0);
})();