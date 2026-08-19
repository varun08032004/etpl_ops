const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT password_hash FROM staff_accounts WHERE email = $1', ['admin@ethertrack.in']);
    console.log('Hash:', result.rows[0]?.password_hash);
    
    const hash = result.rows[0]?.password_hash;
    if (hash) {
      const match = await bcrypt.compare('Heylove03', hash);
      console.log('Password match:', match);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => process.exit(1));