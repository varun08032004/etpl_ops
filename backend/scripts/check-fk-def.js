require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function main() {
  try {
    const { rows } = await safeQuery(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'journal_lines'::regclass
    `);
    console.log('Foreign key definitions:');
    for (const r of rows) {
      console.log(' ', r.conname, ':', r.def);
    }
  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
}
main();