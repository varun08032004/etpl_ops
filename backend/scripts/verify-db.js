const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    const result = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'failed_login_attempts'");
    console.log('failed_login_attempts columns:', result.rows.map(r => r.column_name + ':' + r.data_type));
    
    const result2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'refresh_tokens'");
    console.log('refresh_tokens columns:', result2.rows.map(r => r.column_name + ':' + r.data_type));
    
    const result3 = await pool.query("SELECT conname FROM pg_constraint WHERE conname = 'chk_expense_claims_amount_positive'");
    console.log('chk_expense_claims_amount_positive exists:', result3.rows.length > 0);
    
    const result4 = await pool.query("SELECT conname FROM pg_constraint WHERE conname = 'chk_automation_trigger_not_empty'");
    console.log('chk_automation_trigger_not_empty exists:', result4.rows.length > 0);
    
    const result5 = await pool.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'expense_claims'");
    console.log('expense_claims RLS:', result5.rows[0]?.relrowsecurity);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
}

run().catch(() => process.exit(1));