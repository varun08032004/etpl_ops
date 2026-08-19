require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function main() {
  try {
    // Check all entries for account 2700
    const { rows } = await safeQuery(`
      SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
             jl.debit, jl.credit
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE coa.code = '2700'
      ORDER BY je.entry_date
    `);
    console.log('=== Account 2700 (Deferred Revenue) Entries ===');
    for (const r of rows) {
      console.log(`  ${r.entry_date} | ${r.source}/${r.source_type} | Dr: ${r.debit} Cr: ${r.credit} | ${r.narration}`);
    }

    // Also check 1120 platform settlement
    const { rows: rows1120 } = await safeQuery(`
      SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
             jl.debit, jl.credit
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE coa.code = '1120'
      ORDER BY je.entry_date
    `);
    console.log('\n=== Account 1120 (Platform Settlement) Entries ===');
    for (const r of rows1120) {
      console.log(`  ${r.entry_date} | ${r.source}/${r.source_type} | Dr: ${r.debit} Cr: ${r.credit} | ${r.narration}`);
    }

    // Check for any stale revenue recognition schedules
    const { rows: sched } = await safeQuery(`SELECT * FROM revenue_recognition_schedules`);
    console.log('\n=== Revenue Recognition Schedules ===');
    for (const s of sched) {
      console.log(`  ${s.id} | Invoice: ${s.invoice_id} | Total: ${s.total_amount} | Recognized: ${s.recognized_amount} | Next: ${s.next_recognition_date} | Complete: ${s.is_complete}`);
    }

    // Check prepaid expense schedules
    const { rows: prepaid } = await safeQuery(`SELECT * FROM prepaid_expense_schedules`);
    console.log('\n=== Prepaid Expense Schedules ===');
    for (const p of prepaid) {
      console.log(`  ${p.id} | Bill: ${p.bill_id} | Total: ${p.total_amount} | Expensed: ${p.expensed_amount} | Next: ${p.next_expense_date} | Complete: ${p.is_complete}`);
    }

  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
}

main();