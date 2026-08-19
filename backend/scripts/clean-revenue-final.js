require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function cleanRevenueRecognition(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CLEAN REVENUE RECOGNITION - KEEP ONLY ORIGINAL JULY ENTRY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  // JEs to DELETE (all revenue recognition entries except the original platform_sync one)
  const jeIdsToDelete = [
    'bd48499b-1780-4517-acf9-c85d4e60bd57',  // July 30 duplicate
    'aeb7ae45-d8fc-431a-a348-38b37df04ccb',  // Aug 30
    '5c2bdd02-c68d-4c4f-834d-447e49d297d3',  // Sep 30
    '3c8d7401-3ed6-4ca9-ad1b-8dd544481d5c',  // Oct 30
    'a3d00555-bed3-4871-9528-966dc01ef075',  // Nov 30
  ];

  // Reversal JEs created today (Aug 17) - also delete
  const reversalJeIds = [
    '4c12268a-98e0-4f9f-8f48-2509a929f4cd',
    'ce6a1f82-80e4-4637-aa63-0c351b4e5b84',
    '1527a6bb-c431-469c-851f-aa7537c05431',
    'c9f99044-b6f0-4f0c-bb94-4ec4cd669cba',
    '6c85d2a3-b5f5-41b8-8b05-5b6a8ac4c212',
  ];

  const allToDelete = [...jeIdsToDelete, ...reversalJeIds];

  console.log('JEs to DELETE (incorrect recognitions + their reversals):');
  for (const id of allToDelete) {
    const { rows: [je] } = await safeQuery(`SELECT id, entry_date, narration FROM journal_entries WHERE id = $1`, [id]);
    if (je) console.log(`  ${je.id} | ${je.entry_date} | ${je.narration?.substring(0,60)}`);
  }

  if (!dryRun) {
    console.log('\n🔄 Deleting...');
    
    await withTransaction(async (client) => {
      for (const id of allToDelete) {
        await client.query(`DELETE FROM journal_lines WHERE journal_entry_id = $1`, [id]);
        await client.query(`DELETE FROM journal_entries WHERE id = $1`, [id]);
      }
    });
    
    console.log('\n✅ Deleted all incorrect revenue recognition JEs and their reversals');
    console.log('Only the original July 30 platform_sync entry remains');
  } else {
    console.log('\n💡 Run with --execute to delete');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
cleanRevenueRecognition(dryRun).catch(err => { console.error(err); process.exit(1); });