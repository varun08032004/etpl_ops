const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function main() {
  const client = await pool.connect();
  try {
    // Set company timezone to Pune (Asia/Kolkata)
    await client.query(`UPDATE monitoring_settings SET company_timezone = 'Asia/Kolkata' WHERE id = 1`);
    console.log('✅ Company timezone set to Asia/Kolkata');
    
    // Verify
    const { rows } = await client.query('SELECT company_timezone FROM monitoring_settings WHERE id = 1');
    console.log('📍 Current timezone:', rows[0]?.company_timezone);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();