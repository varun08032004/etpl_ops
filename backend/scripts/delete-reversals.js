#!/usr/bin/env node
/**
 * DELETE ALL REVERSAL ENTRIES
 * Run this to permanently remove reversal journal entries and their lines
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery, withTransaction } = require('../db/pool');

async function deleteReversals(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DELETE REVERSAL ENTRIES');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE - PERMANENT DELETE'}\n`);

  // Find all reversal entries
  const { rows: reversals } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           COUNT(jl.id) as line_count,
           SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE 0 END) as total_debit,
           SUM(CASE WHEN jl.credit > 0 THEN jl.credit ELSE 0 END) as total_credit
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    WHERE je.source = 'adjustment' AND je.source_type = 'reversal'
    GROUP BY je.id, je.entry_date, je.narration, je.source, je.source_type
    ORDER BY je.entry_date
  `);

  console.log(`Found ${reversals.length} reversal entries:\n`);
  
  let totalLines = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  
  for (const r of reversals) {
    totalLines += Number(r.line_count);
    totalDebit += Number(r.total_debit || 0);
    totalCredit += Number(r.total_credit || 0);
    console.log(`  ${r.id} | ${r.entry_date} | Lines: ${r.line_count} | Dr: ${r.total_debit} Cr: ${r.total_credit}`);
    console.log(`    ${r.narration}`);
  }
  
  console.log(`\nTotal: ${reversals.length} JEs, ${totalLines} lines, Dr: ${totalDebit.toFixed(2)}, Cr: ${totalCredit.toFixed(2)}`);

  if (!dryRun) {
    console.log('\n🔄 Deleting...');
    
    // First, nullify reversed_by references
    await safeQuery(`UPDATE journal_entries SET reversed_by = NULL WHERE reversed_by IN (SELECT id FROM journal_entries WHERE source = 'adjustment' AND source_type = 'reversal')`);
    console.log('✅ Nullified reversed_by references');
    
    // Delete in transaction
    await withTransaction(async (client) => {
      for (const r of reversals) {
        // Delete journal lines first
        await client.query(`DELETE FROM journal_lines WHERE journal_entry_id = $1`, [r.id]);
        // Delete journal entry
        await client.query(`DELETE FROM journal_entries WHERE id = $1`, [r.id]);
      }
    });
    
    console.log('\n✅ All reversal entries deleted!');
  } else {
    console.log('\n💡 Run with --execute to permanently delete');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
deleteReversals(dryRun).catch(err => { console.error(err); process.exit(1); });