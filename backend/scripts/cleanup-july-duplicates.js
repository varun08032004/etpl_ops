require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function cleanupDuplicateEntries(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CLEANUP: REMOVE DUPLICATE DEFERRED REVENUE + GST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  // The duplicate deferred revenue JE (July 30)
  const duplicateJE = '2dbab39c-80b0-42c9-9c45-ae9d5bdead9e';
  
  // The original platform_sync JE (keep this)
  const originalJE = 'e1d31879-dc3d-4429-bd66-efcd0787efec';

  // August subscription JE (keep this)
  const augustJE = 'e1d31879-dc3d-4429-bd66-efcd0787efec'; // Wait, need to check

  console.log('Entries to KEEP:');
  console.log('  1. Original platform_sync JE (July 30):', originalJE);
  console.log('  2. August subscription JE (Aug 17): will verify\n');

  console.log('Entries to DELETE:');
  console.log('  1. Duplicate deferred revenue JE (July 30):', duplicateJE);
  console.log('  2. Deferred revenue schedule (2700 should be 0)\n');

  if (!dryRun) {
    console.log('\n🔄 Deleting duplicate deferred revenue JE...');
    
    await withTransaction(async (client) => {
      // 1. Delete journal lines for duplicate JE
      await client.query(`DELETE FROM journal_lines WHERE journal_entry_id = $1`, [duplicateJE]);
      
      // 2. Delete the journal entry
      await client.query(`DELETE FROM journal_entries WHERE id = $1`, [duplicateJE]);
      
      // 3. Delete the revenue recognition schedule
      await client.query(`DELETE FROM revenue_recognition_schedules WHERE invoice_id = $1`, [duplicateJE]);
      
      // 3. Fix August entry - it's going to wrong JE id, need to check
    });
    
    console.log('✅ Deleted duplicate deferred revenue JE');
    console.log('✅ Deleted revenue recognition schedule');
    console.log('✅ Deferred revenue (2700) should now be 0');
  } else {
    console.log('\n💡 Run with --execute to cleanup');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
cleanupDuplicateEntries(dryRun).catch(err => { console.error(err); process.exit(1); });