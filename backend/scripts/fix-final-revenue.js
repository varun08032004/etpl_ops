require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function fixFinalRevenue(dryRun = true) {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  FINAL REVENUE FIX - ZERO OUT 2700, CORRECT JULY REVENUE');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  // Check current state
  const { rows: [deferredAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2700'`);
  const { rows: [incomeAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '4100'`);
  const { rows: [admin] } = await safeQuery(`SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`);

  if (!deferredAcct || !incomeAcct || !admin) {
    console.error('Missing required accounts or admin user');
    return;
  }

  // Check current 2700 balance
  const { rows: [bal2700] } = await safeQuery(`
    SELECT COALESCE(SUM(jl.debit),0) as dr, COALESCE(SUM(jl.credit),0) as cr
    FROM journal_lines jl
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '2700'
  `);
  const deferredBal = Number(bal2700.cr) - Number(bal2700.dr);
  console.log(`Current 2700 balance: ${deferredBal.toFixed(2)} (credit = liability)`);

  const amount = 143999.10;

  console.log(`\nCorrecting: Dr 2700 (Deferred Revenue) ${amount} / Cr 4100 (Subscription Revenue) ${amount}`);
  console.log(`This zeros out deferred revenue. July revenue should be 143,999.10 only.`);

  if (!dryRun) {
    console.log('\n🔄 Creating final correcting entry...');
    
    const je = await ledger.postJournalEntry({
      entryDate: '2026-07-31',
      source: 'adjustment',
      sourceType: 'deferred_revenue_final_correction',
      narration: `Final correction: zero deferred revenue, recognize annual subscription in July only`,
      createdBy: (await safeQuery(`SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`)).rows[0].id,
      lines: [
        { accountId: (await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2700'`)).rows[0].id, debit: 143999.10, description: 'Zero out deferred revenue - annual subscription recognized in July' },
        { accountId: (await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '4100'`)).rows[0].id, credit: 143999.10, description: 'Recognize full annual subscription in July (point-in-time)' },
      ],
    });
    console.log(`✅ Created correcting JE`);
  } else {
    console.log('\n💡 Run with --execute to apply correction');
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
fixFinalRevenue(dryRun).catch(err => { console.error(err); process.exit(1); });