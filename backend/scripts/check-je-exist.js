require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function main() {
  try {
    const { rows } = await safeQuery(`
      SELECT je.id, je.entry_number, je.narration
      FROM journal_entries je
      WHERE je.id IN ('cce0cca8-acea-431f-9a06-de40aebd9517', '2dbab39c-80b0-42c9-9c45-ae9d5bdead9e')
    `);
    for (const r of rows) {
      console.log(`JE: ${r.id} | Num: ${r.entry_number} | Narration: ${r.narration}`);
    }
  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
}
main();