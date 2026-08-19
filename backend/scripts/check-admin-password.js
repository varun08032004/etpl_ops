require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');
const bcrypt = require('bcrypt');

(async () => {
  const { rows } = await safeQuery('SELECT email, password_hash FROM staff_accounts WHERE email = $1', ['admin@ethertrack.in']);
  console.log('admin@ethertrack.in hash:', rows[0]?.password_hash);
  
  const hash = rows[0]?.password_hash;
  const result = await bcrypt.compare('Heylove03', hash);
  console.log('Heylove03 for admin:', result);
  
  process.exit(0);
})();