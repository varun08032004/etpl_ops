require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  const { rows } = await safeQuery('SELECT email, password_hash, role FROM staff_accounts WHERE email = $1', ['founder@ethertrack.in']);
  console.log(rows);
  process.exit(0);
})();