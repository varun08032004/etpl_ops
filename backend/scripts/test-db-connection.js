require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  try {
    const { rows } = await safeQuery('SELECT * FROM staff_accounts WHERE id = $1', ['7b3e93f5-c76b-40f3-bed2-828f2f7d6ff7']);
    console.log('DB query works:', rows.length, rows[0]?.email);
  } catch (e) {
    console.log('DB error:', e.message, e.code);
  }
  process.exit(0);
})();