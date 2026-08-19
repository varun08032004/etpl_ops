const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await pool.query('UPDATE staff_accounts SET ai_access_level = $1 WHERE email = $2', ['AI_AGENT', 'admin@ethertrack.in']);
    console.log('AI access granted');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
}

run().catch(() => process.exit(1));