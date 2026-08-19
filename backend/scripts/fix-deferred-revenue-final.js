require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function fixDeferredRevenue(dryRun = true) {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  FIX DEFERRED REVENUE - ZERO OUT 2700, RECOGNIZE JULY REVENUE');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  const { rows: [deferredAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2700'`);
  const { rows: [incomeAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '4100'`);
  const { rows: [admin] } = await safeQuery(`SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`);

  if (!deferredAcct || !incomeAcct || !admin) {
    console.error('Missing required accounts or admin user');
    return;
  }

  const amount = 143999.10;

  console.log(`Correcting entry: Dr 2700 (Deferred Revenue) ${amount} / Cr 4100 (Subscription Revenue) ${amount}`);
  console.log(`This will zero out deferred revenue and recognize full subscription revenue in July.`);

  if (!dryRun) {
    console.log('\n🔄 Creating correcting journal entry...');
    
    const je = await ledger.postJournalEntry({
      entryDate: '2026-07-31', // End of July
      source: 'adjustment',
      sourceType: 'deferred_revenue_correction',
      narration: `Correct deferred revenue: recognize full annual subscription in July (point-in-time)`,
      createdBy: admin.id,
      lines: [
        { accountId: deferredAcct.id, debit: 143999.10, description: 'Reverse deferred revenue - recognize full July subscription' },
        { accountId: incomeAcct.id, credit: 143999.10, description: 'Recognize full annual subscription revenue in July (point-in-time)' },
      ],
    });
    console.log(`✅ Created correcting JE: ${je.id}`);
    console.log(`   Debit 2700 (Deferred Revenue): 143,999.10`);
    console.log(`   Credit 4100 (Subscription Revenue): 143,999.10`);
  } else {
    console.log('\n💡 Run with --execute to create correcting entry');
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
fixDeferredRevenue(dryRun).catch(err => { console.error(err); process.exit(1); });