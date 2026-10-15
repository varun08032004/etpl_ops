require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const pool = new (require('pg').Pool)({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

const sql = `
UPDATE plan_pricing SET 
  seller_fee_percent = 0.00000
WHERE plan_name = 'free';
`;

pool.query(sql).then(r => { console.log('Updated Free tier:', r.rowCount); pool.end(); }).catch(e => { console.error(e.message); pool.end(); });