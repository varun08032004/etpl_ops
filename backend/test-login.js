require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query('SELECT email, password_hash, is_active FROM staff_accounts WHERE email = $1', ['test@test.com']).then(async r => {
  if (r.rows.length === 0) {
    console.log('No user found');
  } else {
    const user = r.rows[0];
    console.log('User:', user.email, 'active:', user.is_active);
    console.log('Hash starts with:', user.password_hash.substring(0, 20));
    const ok = await bcrypt.compare('test123', user.password_hash);
    console.log('bcrypt.compare test123:', ok);
    const ok2 = await bcrypt.compare('test1234', user.password_hash);
    console.log('bcrypt.compare test1234:', ok2);
  }
  pool.end();
}).catch(e => { console.error(e); pool.end(); });