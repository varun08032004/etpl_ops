const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT email, role FROM staff_accounts WHERE role IN ('owner', 'admin', 'finance') AND is_active = true")
  .then(r => console.log(JSON.stringify(r.rows, null, 2)))
  .catch(e => console.error(e))
  .finally(() => pool.end());