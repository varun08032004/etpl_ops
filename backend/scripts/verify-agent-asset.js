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
    // Check assets table
    const { rows: assetCols } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'assets'
      ORDER BY ordinal_position
    `);
    console.log('✅ Assets table columns:', assetCols.map(r => r.column_name).join(', '));

    // Check employee_asset_agent_status view
    const { rows: viewCols } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'employee_asset_agent_status'
      ORDER BY ordinal_position
    `);
    console.log('✅ View columns:', viewCols.map(r => r.column_name).join(', '));

    // Check agent_status_history table
    const { rows: historyCols } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'agent_status_history'
      ORDER BY ordinal_position
    `);
    console.log('✅ agent_status_history columns:', historyCols.map(r => r.column_name).join(', '));

    // Test view query
    const { rows: viewTest } = await client.query('SELECT * FROM employee_asset_agent_status LIMIT 1');
    console.log('✅ View query works:', viewTest.length > 0 ? 'Has data' : 'Empty (no assigned assets)');

    // Check trigger exists
    const { rows: triggers } = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE trigger_name = 'trg_agent_device_update_asset'
    `);
    console.log('✅ Trigger exists:', triggers.length > 0 ? 'Yes' : 'No');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();