require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');

async function main() {
  try {
    console.log('════════════════════════════════════════════════════════════════');
    console.log('  NUCLEAR REVENUE RESET - KEEP ONLY ORIGINAL + AUGUST');
    console.log('════════════════════════════════════════════════════════════════');

    const keepIds = ['e1d31879-dc3d-4429-bd66-efcd0787efec', 'af5c64b1-f84d-4a79-a910-c683bc8a839d'];

    const { rows: toDelete } = await safeQuery(`
      SELECT je.id, je.entry_number, je.narration
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE coa.code = '4100'
        AND je.entry_date BETWEEN '2026-07-01' AND '2026-08-31'
        AND je.id NOT IN ('e1d31879-dc3d-4429-bd66-efcd0787efec', 'af5c64b1-f84d-4a79-a910-c683bc8a839d')
      ORDER BY je.entry_date
    `);

    console.log('Entries to DELETE (all except original July + August):');
    for (const r of toDelete) {
      console.log(`  ${r.id} | ${r.entry_number} | ${r.narration}`);
    }

    console.log('\n🔄 Deleting all extra revenue entries...');
    await withTransaction(async (client) => {
      for (const r of toDelete) {
        await client.query(`DELETE FROM journal_lines WHERE journal_entry_id = $1`, [r.id]);
        await client.query(`DELETE FROM journal_entries WHERE id = $1`, [r.id]);
      }
      console.log(`✅ Deleted ${toDelete.length} extra revenue entries`);
    });

    // Also clean up 2700 orphan lines
    await safeQuery(`
      DELETE FROM journal_lines
      WHERE account_id = (SELECT id FROM chart_of_accounts WHERE code = '2700')
        AND journal_entry_id NOT IN (
          SELECT id FROM journal_entries WHERE id IS NOT NULL
        )
    `);
    console.log('✅ Cleaned orphan 2700 lines');

    // Delete revenue recognition schedule
    await safeQuery(`DELETE FROM revenue_recognition_schedules`);
    console.log('✅ Deleted revenue recognition schedules');

    console.log('\n✅ NUCLEAR RESET COMPLETE');
    console.log('Kept: Original July (JE-000001) + August (JE-000066) subscriptions only');
  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
  process.exit(0);
}