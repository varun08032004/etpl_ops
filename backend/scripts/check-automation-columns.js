const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'automation_rules'")
  .then(r => console.log(r.rows.map(c => c.column_name)))
  .catch(e => console.error(e))
  .finally(() => pool.end());