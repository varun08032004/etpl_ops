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
    // Link office network to monitoring_settings
    const networkResult = await client.query('SELECT id FROM office_networks LIMIT 1');
    if (networkResult.rows.length > 0) {
      await client.query(
        `UPDATE monitoring_settings SET allowed_office_network_ids = ARRAY[$1]::uuid[] WHERE id = 1`,
        [networkResult.rows[0].id]
      );
      console.log('✅ Linked office network to monitoring settings');
    }
    
    // Enable office network enforcement (can be toggled later)
    await client.query(`UPDATE monitoring_settings SET enforce_office_network = false WHERE id = 1`);
    console.log('✅ Office network enforcement set to false (can enable later)');
    
    // Verify
    const settingsResult = await client.query('SELECT enforce_office_network, allowed_office_network_ids FROM monitoring_settings WHERE id = 1');
    console.log('⚙️ Settings:', settingsResult.rows[0]);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();