require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  // Check all May JEs with their bill info
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
      AND je.entry_date BETWEEN '2026-05-01' AND '2026-05-31'
    ORDER BY je.entry_date
  `);
  
  console.log('=== May 2026 Expense JEs ===\n');
  
  for (const r of rows) {
    const amt = Number(r.debit) - Number(r.credit);
    console.log(`  ${r.entry_date} | ${r.code} | Dr: ${r.debit} Cr: ${r.credit} | Net: ${amt}`);
    console.log(`    Narration: ${r.narration}`);
    console.log(`    Bill: ${r.bill_number || 'N/A'} | Vendor: ${r.vendor_name || 'N/A'}`);
    console.log('');
  }
  
  // Also check the bills table for May
  const { rows: bills } = await safeQuery(`
    SELECT b.*, p.name as vendor_name
    FROM bills b
    LEFT JOIN parties p ON p.id = b.vendor_id
    WHERE b.bill_date BETWEEN '2026-05-01' AND '2026-05-31'
    ORDER BY b.bill_date
  `);
  
  console.log('\n=== Bills in May ===');
  for (const b of bills) {
    console.log(`  ${b.bill_date} | ${b.bill_number} | ₹${b.total_amount} | ${b.vendor_name} | JE: ${b.journal_entry_id}`);
  }
  
  process.exit(0);
})();