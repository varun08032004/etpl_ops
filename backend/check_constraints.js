const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new (require('pg').Pool)({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query("SELECT conname, contype FROM pg_constraint WHERE conrelid = 'plan_pricing'::regclass")
  .then(r => { console.table(r.rows); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });