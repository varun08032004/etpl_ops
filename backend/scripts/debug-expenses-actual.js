require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  // Check ALL journal entries for expense accounts in May-Jul
  const { rows } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           jl.debit, jl.credit, coa.code, coa.name,
           b.bill_number, p.name as vendor_name
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    LEFT JOIN bills b ON b.journal_entry_id = je.id
    LEFT JOIN parties p ON p.id = b.vendor_id
    WHERE coa.account_type = 'expense'
      AND je.entry_date BETWEEN '2026-05-01' AND '2026-07-31'
    ORDER BY je.entry_date
  `);
  
  console.log('=== ALL Expense Journal Entries May-Jul ===\n');
  
  let mayTotal = 0, junTotal = 0, julTotal = 0;
  
  for (const r of rows) {
    const amt = Number(r.debit) - Number(r.credit);
    const month = r.entry_date.slice(0, 7);
    if (month === '2026-05') mayTotal += amt;
    else if (month === '2026-06') junTotal += amt;
    else if (month === '2026-07') julTotal += amt;
    
    console.log(`  ${r.entry_date} | ${r.code} ${r.name} | Dr: ${r.debit} Cr: ${r.credit} | Net: ${amt}`);
    console.log(`    ${r.narration}`);
    console.log(`    Bill: ${r.bill_number || 'N/A'} | Vendor: ${r.vendor_name || 'N/A'} | Source: ${r.source}/${r.source_type}`);
    console.log('');
  }
  
  console.log(`\n=== Monthly Totals ===`);
  console.log(`May: ₹${mayTotal}`);
  console.log(`Jun: ₹${junTotal}`);
  console.log(`Jul: ₹${julTotal}`);
  
  process.exit(0);
})();