const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // Check if trim function exists
    const trimResult = await client.query("SELECT trim('  test  ')");
    console.log('trim works:', trimResult.rows[0]);
    
    // Check if btrim exists
    try {
      await client.query('SELECT btrim(\'  test  \')');
      console.log('btrim works');
    } catch (e) {
      console.log('btrim does not exist:', e.message);
    }
    
    // Check if trim exists
    try {
      await client.query("SELECT trim('  test  ')");
      console.log('trim works');
    } catch (e) {
      console.log('trim does not exist:', e.message);
    }
    
    // Check if the constraint already exists
    const result = await pool.query(
      "SELECT conname FROM pg_constraint WHERE conname = 'chk_automation_trigger_not_empty'"
    );
    console.log('Constraint exists:', result.rows.length > 0);
    
    // Check automation_rules table
    const cols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'automation_rules'"
    );
    console.log('automation_rules columns:', cols.rows.map(r => r.column_name + ':' + r.data_type));
    
    // Check if constraint exists
    const constraint = await pool.query(
      "SELECT conname FROM pg_constraint WHERE conname = 'chk_automation_trigger_not_empty'"
    );
    console.log('Constraint exists:', constraint.rows.length > 0);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
}

run().catch(() => process.exit(1));