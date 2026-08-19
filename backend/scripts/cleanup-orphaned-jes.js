require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');

async function cleanupOrphanedJEs(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CLEANUP ORPHANED JOURNAL ENTRIES (no matching bill)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  // Find JEs with source=bill that don't have a matching bill
  const { rows: orphans } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type
    FROM journal_entries je
    LEFT JOIN bills b ON b.journal_entry_id = je.id
    WHERE je.source = 'bill' AND je.source_type = 'bill'
      AND b.id IS NULL
      AND je.entry_date BETWEEN '2026-05-01' AND '2026-07-31'
    ORDER BY je.entry_date
  `);

  console.log(`Found ${orphans.length} orphaned JEs (no matching bill):\n`);
  
  for (const o of orphans) {
    console.log(`  ${o.entry_date} | ${o.id} | ${o.narration}`);
  }
  
  if (!dryRun && orphans.length > 0) {
    console.log('\n🔄 Deleting orphaned JEs...');
    
    await withTransaction(async (client) => {
      for (const o of orphans) {
        await client.query(`DELETE FROM journal_lines WHERE journal_entry_id = $1`, [o.id]);
        await client.query(`DELETE FROM journal_entries WHERE id = $1`, [o.id]);
      }
    });
    console.log(`\n✅ Deleted ${orphans.length} orphaned JEs!`);
  } else if (dryRun) {
    console.log(`\n💡 Run with --execute to delete ${orphans.length} orphaned JEs`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
cleanupOrphanedJEs(dryRun).catch(err => { console.error(err); process.exit(1); });