require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function resetRevenue(dryRun = true) {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  COMPLETE REVENUE RESET - ONLY ORIGINAL PLATFORM_SYNC ENTRY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  // Identify all problematic entries to reverse
  const entriesToReverse = [
    { id: 'cce0cca8-acea-431f-9a06-de40aebd9517', reason: 'First correction attempt - doubled revenue' },
    { id: '2dbab39c-80b0-42c9-9c45-ae9d5bdead9e', reason: 'Deferred revenue entry that recreated liability' },
    { id: 'cce0cca8-acea-431f-9a06-de40aebd9517', reason: 'First correction attempt - doubled revenue' }, // duplicate check
  ];

  // Get unique IDs
  const uniqueIds = [...new Set(entriesToReverse.map(e => e.id))];
  
  console.log('Entries to reverse (all corrections/deferred revenue entries):');
  for (const id of uniqueIds) {
    const { rows: [je] } = await safeQuery(`SELECT id, entry_number, narration FROM journal_entries WHERE id = $1`, [id]);
    if (je) console.log(`  ${je.id} | ${je.entry_number} | ${je.narration}`);
  }

  if (!dryRun) {
    console.log('\n🔄 Reversing all correction/deferred revenue entries...');
    const { rows: [admin] } = await safeQuery(`SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`);

    for (const id of uniqueIds) {
      try {
        const reversal = await ledger.reverseJournalEntry(id, {
          reason: 'Complete revenue reset - remove all corrections/deferred entries',
          createdBy: admin.id
        });
        console.log(`✅ Reversed ${id} -> ${reversal.id}`);
      } catch (e) {
        console.error(`❌ Failed to reverse ${id}:`, e.message);
      }
    }

    // Delete revenue recognition schedule
    await safeQuery(`DELETE FROM revenue_recognition_schedules WHERE invoice_id = 'e1d31879-dc3d-4429-bd66-efcd0787efec'`);
    console.log('✅ Deleted revenue recognition schedule');

  } else {
    console.log('\n💡 Run with --execute to reset');
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
resetRevenue(dryRun).catch(err => { console.error(err); process.exit(1); });