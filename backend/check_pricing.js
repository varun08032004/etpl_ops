const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new (require('pg').Pool)({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

pool.query('SELECT plan_name, billing_cycle, price_inr, buyer_fee_percent, seller_fee_percent FROM plan_pricing').then(r => { console.table(r.rows); pool.end(); }).catch(e => { console.error(e.message); pool.end(); });