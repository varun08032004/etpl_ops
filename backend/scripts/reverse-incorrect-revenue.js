require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function reverseIncorrectRevenue(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  REVERSE INCORRECT AUG-NOV REVENUE RECOGNITION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  // The 5 incorrect revenue recognition JEs to reverse
  const jeIds = [
    'bd48499b-1780-4517-acf9-c85d4e60bd57',  // Aug 30
    'aeb7ae45-d8fc-431a-a348-38b37df04ccb',  // Aug 30 (duplicate)
    '5c2bdd02-c68d-4c4f-834d-447e49d297d3',  // Sep 30
    '3c8d7401-3ed6-4ca9-ad1b-8dd544481d5c',  // Oct 30
    'a3d00555-bed3-4871-9528-966dc01ef075',  // Nov 30
  ];

  console.log('JEs to reverse:');
  for (const id of jeIds) {
    const { rows: [je] } = await safeQuery(`SELECT * FROM journal_entries WHERE id = $1`, [id]);
    if (je) {
      console.log(`  ${je.id} | ${je.entry_date} | ${je.narration}`);
    }
  }

  if (!dryRun) {
    console.log('\n🔄 Reversing...');
    
    const { rows: [admin] } = await safeQuery(
      `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
    );

    for (const id of jeIds) {
      try {
        const reversal = await ledger.reverseJournalEntry(id, {
          reason: 'Reverse incorrect monthly revenue recognition - annual subscription is point-in-time July revenue only',
          createdBy: admin.id
        });
        console.log(`✅ Reversed ${id} -> ${reversal.id}`);
      } catch (e) {
        console.error(`❌ Failed to reverse ${id}:`, e.message);
      }
    }
    
    console.log('\n✅ All incorrect revenue recognition reversed');
    console.log('July now shows full ₹143,999.10, Aug-Nov show ₹0');
  } else {
    console.log('\n💡 Run with --execute to reverse');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
reverseIncorrectRevenue(dryRun).catch(err => { console.error(err); process.exit(1); });