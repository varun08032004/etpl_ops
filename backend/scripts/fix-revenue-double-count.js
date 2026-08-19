require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function fixRevenueDoubleCount(dryRun = true) {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  FIX REVENUE DOUBLE-COUNT - REVERSE PROBLEMATIC ENTRIES');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  const { rows: [admin] } = await safeQuery(`SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`);
  if (!admin) { console.error('No admin user found'); return; }

  // Entries to reverse:
  // 1. cce0cca8-acea-431f-9a06-de40aebd9517 - correcting entry (double-count)
  // 2. 2dbab39c-80b0-42c9-9c45-ae9d5bdead9e - new deferred revenue entry (recreated the problem)
  const entriesToReverse = [
    { id: 'cce0cca8-acea-431f-9a06-de40aebd9517', reason: 'Reverse correcting entry - double counted July revenue' },
    { id: '2dbab39c-80b0-42c9-9c45-ae9d5bdead9e', reason: 'Reverse new deferred revenue entry - recreated deferred revenue balance' },
  ];

  console.log('Entries to reverse:');
  for (const e of entriesToReverse) {
    console.log(`  ${e.id} - ${e.reason}`);
  }

  if (!dryRun) {
    console.log('\n🔄 Reversing entries...');
    const { rows: [admin] } = await safeQuery(`SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`);

    for (const entry of entriesToReverse) {
      try {
        const reversal = await ledger.reverseJournalEntry(entry.id, {
          reason: entry.reason,
          createdBy: admin.id
        });
        console.log(`✅ Reversed ${entry.id} -> ${reversal.id}`);
      } catch (e) {
        console.error(`❌ Failed to reverse ${entry.id}:`, e.message);
      }
    }

    // Also delete the revenue recognition schedule since subscription is point-in-time
    console.log('\n🔄 Deleting revenue recognition schedule (point-in-time subscription)...');
    await safeQuery(`DELETE FROM revenue_recognition_schedules WHERE invoice_id = 'e1d31879-dc3d-4429-bd66-efcd0787efec'`);
    console.log('✅ Deleted revenue recognition schedule');

  } else {
    console.log('\n💡 Run with --execute to reverse entries');
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
fixRevenueDoubleCount(dryRun).catch(err => { console.error(err); process.exit(1); });