require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  // Check all entries for account 1120
  const { rows } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           jl.debit, jl.credit, coa.code, coa.name
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '1120'
    ORDER BY je.entry_date
  `);
  console.log('=== Account 1120 (Platform Settlement) ===');
  let totalDr = 0, totalCr = 0;
  for (const r of rows) {
    const net = Number(r.debit) - Number(r.credit);
    totalDr += Number(r.debit);
    totalCr += Number(r.credit);
    console.log(`  ${r.entry_date} | ${r.source}/${r.source_type} | Dr: ${r.debit} Cr: ${r.credit} | Net: ${net} | ${r.narration}`);
  }
  console.log('Total Dr:', totalDr, 'Total Cr:', totalCr, 'Balance:', totalDr - totalCr);
  
  // Check deferred revenue 2700
  const { rows: dr } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           jl.debit, jl.credit
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '2700'
    ORDER BY je.entry_date
  `);
  console.log('\n=== Account 2700 (Deferred Revenue) ===');
  for (const r of dr) {
    console.log(`  ${r.entry_date} | ${r.source}/${r.source_type} | Dr: ${r.debit} Cr: ${r.credit} | ${r.narration}`);
  }
  
  // Check all revenue entries
  const { rows: rev } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           jl.debit, jl.credit, coa.code, coa.name,
           jl.description
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.account_type = 'income'
    ORDER BY je.entry_date
  `);
  console.log('\n=== All Income Entries ===');
  for (const r of rev) {
    console.log(`  ${r.entry_date} | ${r.code} ${r.name} | Dr: ${r.debit} Cr: ${r.credit} | ${r.narration} | Desc: ${r.description}`);
  }
  
  // Check GST output entries
  const { rows: gst } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           jl.debit, jl.credit, coa.code, coa.name
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code IN ('2210','2220','2230')
    ORDER BY je.entry_date
  `);
  console.log('\n=== GST Output (2210/2220/2230) ===');
  for (const r of gst) {
    console.log(`  ${r.entry_date} | ${r.code} ${r.name} | Dr: ${r.debit} Cr: ${r.credit} | ${r.narration}`);
  }
  
  process.exit(0);
})();