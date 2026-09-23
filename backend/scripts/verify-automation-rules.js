const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT name, trigger_event, action_type, config FROM automation_rules WHERE trigger_event IN ('compliance_item.due_soon', 'compliance_item.escalated')")
  .then(r => console.log(JSON.stringify(r.rows, null, 2)))
  .catch(e => console.error(e))
  .finally(() => pool.end());