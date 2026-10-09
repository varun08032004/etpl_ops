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
    // Add a placeholder office network for Pune HQ
    // CIDR needs to be replaced with actual office IP range
    await client.query(`
      INSERT INTO office_networks (name, cidr) 
      VALUES ('Pune HQ - PLACEHOLDER', '203.0.113.0/24')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Added placeholder office network (replace CIDR with actual)');
    
    // Verify
    const { rows } = await client.query('SELECT * FROM office_networks');
    console.log('🏢 Office networks:', rows);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();