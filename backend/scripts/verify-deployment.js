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
    const { rows } = await client.query('SELECT * FROM employee_performance_summary LIMIT 1');
    console.log('✅ View employee_performance_summary works');
    console.log('Columns:', Object.keys(rows[0] || {}));
    
    const { rows: settings } = await client.query('SELECT company_timezone, enforce_office_network, allowed_office_network_ids FROM monitoring_settings WHERE id = 1');
    console.log('✅ monitoring_settings:', settings[0]);
    
    const { rows: networks } = await client.query('SELECT * FROM office_networks');
    console.log('✅ office_networks:', networks.length, 'networks');
    
    const { rows: reviews } = await client.query('SELECT id, monitoring_score, composite_score, goals_completion_pct, monitoring_flags FROM performance_reviews LIMIT 1');
    console.log('✅ performance_reviews new columns:', reviews[0] ? 'EXIST' : 'NO DATA YET');
    
    const { rows: sessions } = await client.query('SELECT id, work_mode, location_verified_at, location_verified_by FROM agent_sessions LIMIT 1');
    console.log('✅ agent_sessions new columns:', sessions[0] ? 'EXIST' : 'NO DATA YET');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();