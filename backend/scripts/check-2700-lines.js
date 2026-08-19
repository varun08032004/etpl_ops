require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function main() {
  try {
    // Check journal_lines directly for account 2700
    const { rows: lines2700 } = await safeQuery(`
      SELECT jl.*, coa.code, coa.name
      FROM journal_lines jl
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE coa.code = '2700'
      ORDER BY jl.id
    `);
    console.log('=== Journal Lines for Account 2700 (direct) ===');
    for (const l of lines2700) {
      console.log(`  JL ID: ${l.id} | JE ID: ${l.journal_entry_id} | Dr: ${l.debit} Cr: ${l.credit} | Desc: ${l.description}`);
    }

    // Check journal_entries for any entries related to deferred revenue
    const { rows: jes } = await safeQuery(`
      SELECT je.*, COUNT(jl.id) as line_count
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE coa.code = '2700'
      GROUP BY je.id
      ORDER BY je.entry_date
    `);
    console.log('\n=== Journal Entries touching 2700 ===');
    for (const je of jes) {
      console.log(`  ${je.id} | ${je.entry_date} | ${je.source}/${je.source_type} | ${je.narration} | Lines: ${je.line_count}`);
    }

    // Check if there are any journal_lines with account 2700 that don't have a valid journal_entry
    const { rows: orphanLines } = await safeQuery(`
      SELECT jl.*, coa.code
      FROM journal_lines jl
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE coa.code = '2700' AND je.id IS NULL
    `);
    console.log('\n=== Orphan Journal Lines (no JE) for 2700 ===');
    for (const l of orphanLines) {
      console.log(`  JL ID: ${l.id} | JE ID: ${l.journal_entry_id} | Dr: ${l.debit} Cr: ${l.credit}`);
    }

  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
}

main();