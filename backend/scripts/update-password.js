const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    const hash = await bcrypt.hash('Heylove03', 12);
    await pool.query('UPDATE staff_accounts SET password_hash = $1 WHERE email = $2', [hash, 'admin@ethertrack.in']);
    console.log('Password updated');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
}

run().catch(() => process.exit(1));