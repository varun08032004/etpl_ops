require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function main() {
  try {
    const { rows } = await safeQuery(`
      SELECT conname, contype, confrelid::regclass as ref_table
      FROM pg_constraint
      WHERE conrelid = 'journal_lines'::regclass
    `);
    console.log('Constraints on journal_lines:');
    for (const r of rows) {
      console.log(' ', r.conname, r.contype, r.ref_table);
    }
  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
}
main();