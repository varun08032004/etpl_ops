const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query('SELECT * FROM staff_accounts WHERE email = $1', ['founder@ethertrack.in'])
  .then(r => console.log('User:', r.rows[0] ? 'found' : 'NOT FOUND'))
  .catch(e => console.error(e.message))
  .finally(() => pool.end());