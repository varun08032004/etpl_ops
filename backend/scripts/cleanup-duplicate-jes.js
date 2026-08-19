require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function cleanupDuplicateJEs(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CLEANUP DUPLICATE JOURNAL ENTRIES');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  // Find duplicate JEs by narration and entry_date (keep first)
  const { rows: dupes } = await safeQuery(`
    SELECT narration, entry_date, COUNT(*) as cnt,
           array_agg(id ORDER BY id) as ids,
           array_agg(narration ORDER BY id) as narrations
    FROM journal_entries
    WHERE source = 'bill' AND source_type = 'bill'
      AND entry_date BETWEEN '2026-05-01' AND '2026-07-31'
    GROUP BY narration, entry_date
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `);

  console.log(`Found ${dupes.length} groups with duplicate JEs:\n`);
  
  let totalToDelete = 0;
  for (const group of dupes) {
    console.log(`  Date: ${group.entry_date} | Count: ${group.cnt}`);
    console.log(`  Narration: ${group.narration}`);
    const toDelete = group.ids.slice(1); // Keep first, delete rest
    console.log(`  Keep: ${group.ids[0]} | Delete: ${toDelete.join(', ')}`);
    totalToDelete += toDelete.length;
    console.log('');
  }

  if (!dryRun) {
    console.log(`\n🔄 Deleting ${totalToDelete} duplicate JEs...`);
    
    await withTransaction(async (client) => {
      for (const group of dupes) {
        const toDelete = group.ids.slice(1);
        for (const jeId of toDelete) {
          // First, nullify the journal_entry_id in bills table
          await client.query(`UPDATE bills SET journal_entry_id = NULL WHERE journal_entry_id = $1`, [jeId]);
          // Delete journal lines first
          await client.query(`DELETE FROM journal_lines WHERE journal_entry_id = $1`, [jeId]);
          // Delete journal entry
          await client.query(`DELETE FROM journal_entries WHERE id = $1`, [jeId]);
        }
      }
    });
    console.log(`\n✅ Deleted ${totalToDelete} duplicate JEs!`);
  } else {
    console.log(`\n💡 Run with --execute to delete ${totalToDelete} duplicate JEs`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
cleanupDuplicateJEs(dryRun).catch(err => { console.error(err); process.exit(1); });