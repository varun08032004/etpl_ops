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
    const result = await client.query('SELECT * FROM staff_accounts WHERE email = $1', ['admin@ethertrack.in']);
    console.log('User:', JSON.stringify(result.rows[0], null, 2));
    
    if (result.rows[0]) {
      const match = await bcrypt.compare(process.env.TEST_ADMIN_PASSWORD || 'Heylove03', result.rows[0].password_hash);
      console.log('Password match:', match);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}