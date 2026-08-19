require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');

async function cleanupOrphan2700(dryRun = true) {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  CLEANUP ORPHAN JOURNAL LINES FOR ACCOUNT 2700');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  // Find orphan journal lines for account 2700
  const { rows: orphanLines } = await safeQuery(`
    SELECT jl.id, jl.journal_entry_id, jl.debit, jl.credit
    FROM journal_lines jl
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE coa.code = '2700' AND je.id IS NULL
  `);

  console.log(`Found ${orphanLines.length} orphan journal lines for account 2700:\n`);
  let totalDebit = 0, totalCredit = 0;
  for (const l of orphanLines) {
    totalDebit += Number(l.debit || 0);
    totalCredit += Number(l.credit || 0);
    console.log(`  ${l.id} | JE: ${l.journal_entry_id} | Dr: ${l.debit} Cr: ${l.credit}`);
  }
  console.log(`\nTotal Orphan Dr: ${totalDebit} | Cr: ${totalCredit} | Net: ${totalCredit - totalDebit}`);

  if (!dryRun && orphanLines.length > 0) {
    console.log('\n🔄 Deleting orphan journal lines...');
    await withTransaction(async (client) => {
      for (const l of orphanLines) {
        await client.query(`DELETE FROM journal_lines WHERE id = $1`, [l.id]);
      }
    });
    console.log('✅ Deleted all orphan journal lines for account 2700');
  } else if (dryRun) {
    console.log('\n💡 Run with --execute to delete orphan lines');
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
cleanupOrphan2700(dryRun).catch(err => { console.error(err); process.exit(1); });