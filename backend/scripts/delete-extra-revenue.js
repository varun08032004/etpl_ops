require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');

(async () => {
  try {
    const deleteIds = [
      'cce0cca8-acea-431f-9a06-de40aebd9517', // JE-2026-000067
      '33427740-0f2e-4e88-a27f-4752215bb18c', // JE-2026-000069
      '5e783b8d-0bee-4005-b751-e10018bc182f', // JE-2026-000070
      '9e4dd3b6-d408-4d87-8011-aef878b4a7c7', // JE-2026-000068 (reversal)
      'e5cb9b63-692a-4c42-a04c-8c96c0740493', // JE-2026-000071
    ];

    console.log('Deleting extra revenue entries...');
    await withTransaction(async (client) => {
      for (const id of deleteIds) {
        await client.query(`DELETE FROM journal_lines WHERE journal_entry_id = $1`, [id]);
        await client.query(`DELETE FROM journal_entries WHERE id = $1`, [id]);
        console.log(`✅ Deleted ${id}`);
      }
    });
    console.log('✅ All extra revenue entries deleted');

    // Clean up orphan 2700 lines
    await safeQuery(`
      DELETE FROM journal_lines
      WHERE account_id = (SELECT id FROM chart_of_accounts WHERE code = '2700')
        AND journal_entry_id NOT IN (SELECT id FROM journal_entries WHERE id IS NOT NULL)
    `);
    console.log('✅ Cleaned orphan 2700 lines');

    // Delete revenue recognition schedule
    await safeQuery(`DELETE FROM revenue_recognition_schedules`);
    console.log('✅ Deleted revenue recognition schedules');

    console.log('\n✅ CLEANUP COMPLETE');
  } catch (e) { console.error('Error:', e.message, e.stack); }
  process.exit(0);
})();