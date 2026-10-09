const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');

// ⚠️ REPLACE THIS WITH YOUR ACTUAL PUNE OFFICE PUBLIC IP CIDR
// Example: '203.0.113.0/24' or '198.51.100.0/24' or '203.0.113.10/32' for single IP
// Get your office public IP from: https://whatismyip.com (from office network)
const PUNE_OFFICE_CIDR = process.env.PUNE_OFFICE_CIDR || 'YOUR_PUNE_OFFICE_CIDR_HERE';

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function main() {
  const client = await pool.connect();
  try {
    if (PUNE_OFFICE_CIDR === 'YOUR_PUNE_OFFICE_CIDR_HERE') {
      console.log('⚠️  Please set PUNE_OFFICE_CIDR environment variable or edit this script');
      console.log('Example: export PUNE_OFFICE_CIDR="203.0.113.0/24"');
      console.log('Get your office public IP from https://whatismyip.com (from office network)');
      process.exit(1);
    }

    // Update or insert Pune office network
    await client.query(`
      INSERT INTO office_networks (name, cidr) 
      VALUES ('Pune HQ', $1)
      ON CONFLICT (cidr) DO UPDATE SET name = EXCLUDED.name
    `, [PUNE_OFFICE_CIDR]);
    
    console.log(`✅ Updated Pune HQ office network: ${PUNE_OFFICE_CIDR}`);

    // Link to monitoring_settings
    const { rows } = await client.query('SELECT id FROM office_networks WHERE cidr = $1', [PUNE_OFFICE_CIDR]);
    if (rows.length > 0) {
      await client.query(
        `UPDATE monitoring_settings SET allowed_office_network_ids = ARRAY[$1]::uuid[] WHERE id = 1`,
        [rows[0].id]
      );
      console.log('✅ Linked to monitoring settings');
    }

    // Enable enforcement
    await client.query(`UPDATE monitoring_settings SET enforce_office_network = true WHERE id = 1`);
    console.log('✅ Office network enforcement ENABLED');

    // Verify
    const { rows: settings } = await client.query('SELECT enforce_office_network, allowed_office_network_ids FROM monitoring_settings WHERE id = 1');
    console.log('⚙️ Settings:', settings[0]);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();