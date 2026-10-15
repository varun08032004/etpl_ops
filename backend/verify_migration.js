const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = require('./db/pool').pool;

pool.query("SELECT plan_name, buyer_fee_percent, seller_fee_percent FROM plan_pricing")
  .then(r => { console.table(r.rows); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });