require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function main() {
  try {
    // Run the exact trial balance query from ledger.js
    const { rows } = await safeQuery(
      `SELECT coa.id, coa.code, coa.name, coa.account_type,
              COALESCE(SUM(jl.debit),0) AS total_debit,
              COALESCE(SUM(jl.credit),0) AS total_credit
       FROM chart_of_accounts coa
       LEFT JOIN journal_lines jl ON jl.account_id = coa.id
       LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
         AND (NULL::date IS NULL OR je.entry_date <= NULL::date)
       WHERE coa.is_group = false AND coa.is_active = true
       GROUP BY coa.id, coa.code, coa.name, coa.account_type
       ORDER BY coa.code`,
      [null]
    );

    console.log('=== Trial Balance Query Result ===');
    for (const a of rows) {
      const debit = Number(a.total_debit);
      const credit = Number(a.total_credit);
      const debitNormal = ['asset', 'expense'].includes(a.account_type);
      const bal = debitNormal ? debit - credit : credit - debit;
      if (bal !== 0 || a.code === '2700' || a.code === '1120' || a.code === '1500') {
        console.log(`  ${a.code} ${a.name} (${a.account_type}): Dr=${debit} Cr=${credit} Bal=${bal}`);
      }
    }

    // Also check account 2700 specifically
    const { rows: specific } = await safeQuery(`
      SELECT coa.code, coa.name, coa.account_type,
             COALESCE(SUM(jl.debit),0) AS total_debit,
             COALESCE(SUM(jl.credit),0) AS total_credit
      FROM chart_of_accounts coa
      LEFT JOIN journal_lines jl ON jl.account_id = coa.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE coa.code = '2700'
      GROUP BY coa.id, coa.code, coa.name, coa.account_type
    `);
    console.log('\n=== Account 2700 Specific ===');
    for (const a of specific) {
      const debit = Number(a.total_debit);
      const credit = Number(a.total_credit);
      const debitNormal = ['asset', 'expense'].includes(a.account_type);
      const bal = debitNormal ? debit - credit : credit - debit;
      console.log(`  ${a.code} ${a.name} (${a.account_type}): Dr=${debit} Cr=${credit} Bal=${bal}`);
    }

    // Check if there are any entries in journal_lines for account 2700
    const { rows: lines2700 } = await safeQuery(`
      SELECT jl.*, je.entry_date, je.narration, je.source, je.source_type
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE coa.code = '2700'
      ORDER BY je.entry_date
    `);
    console.log('\n=== Journal Lines for Account 2700 ===');
    for (const l of lines2700) {
      console.log(`  ${l.entry_date} | ${l.source}/${l.source_type} | Dr: ${l.debit} Cr: ${l.credit} | ${l.narration}`);
    }

  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
}

main();