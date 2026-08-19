const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['compliance_settings'])
  .then(r => console.log(r.rows))
  .catch(e => console.error(e.message))
  .finally(() => pool.end());