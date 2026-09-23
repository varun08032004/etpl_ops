const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  // Deactivate old duplicate rules (keep only our new ones with to_template)
  const result = await pool.query(
    `UPDATE automation_rules 
     SET is_active = FALSE 
     WHERE name IN (
       'Email founder+admin when a compliance filing is due soon',
       'Notify finance/hr when a compliance filing is due soon',
       'Email founder+admin when a compliance filing is escalated'
     ) AND config->>'to_template' IS NULL`
  );
  console.log(`Deactivated ${result.rowCount} old rules`);
  
  // Verify active rules
  const active = await pool.query(
    `SELECT name, trigger_event, config FROM automation_rules 
     WHERE trigger_event IN ('compliance_item.due_soon', 'compliance_item.escalated') AND is_active = TRUE`
  );
  console.log('Active rules:', JSON.stringify(active.rows, null, 2));
  
  await pool.end();
}

cleanup().catch(console.error);