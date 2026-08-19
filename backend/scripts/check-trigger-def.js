require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function main() {
  try {
    const { rows } = await safeQuery(`
      SELECT tgname, pg_get_triggerdef(oid) as def
      FROM pg_trigger
      WHERE tgrelid = 'journal_lines'::regclass
    `);
    console.log('Triggers on journal_lines:');
    for (const r of rows) {
      console.log(' ', r.tgname, ':', r.def);
    }
  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
}
main();