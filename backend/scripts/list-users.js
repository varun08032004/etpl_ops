require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  const { rows } = await safeQuery('SELECT email, role FROM staff_accounts ORDER BY created_at');
  console.log('All users:');
  for (const r of rows) {
    console.log(`  ${r.email} (${r.role})`);
  }
  process.exit(0);
})();