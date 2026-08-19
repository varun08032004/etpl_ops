const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM failed_login_attempts WHERE staff_account_id = (SELECT id FROM staff_accounts WHERE email = $1)', ['admin@ethertrack.in']);
    console.log('Failed login attempts:', result.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
}

run().catch(() => process.exit(1));