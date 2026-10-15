const { Pool } = require('pg');
require('dotenv').config({ path: '../ethertrack-backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query("SELECT * FROM plan_prices")
  .then(r => { console.table(r.rows); pool.end(); })
  .catch(e => { console.error('Error:', e.message, e.stack); pool.end(); });