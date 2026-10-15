const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new (require('pg').Pool)({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

const sql = `
ALTER TABLE plan_pricing ADD CONSTRAINT plan_pricing_plan_key_billing_cycle_key UNIQUE (plan_key, billing_cycle);
`;

pool.query(sql).then(r => { console.log('Constraint added successfully!'); pool.end(); }).catch(e => { console.error('Error:', e.message); pool.end(); });