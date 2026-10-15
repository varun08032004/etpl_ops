const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = require('./db/pool').pool;

pool.query("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'plan_pricing' ORDER BY ordinal_position")
  .then(r => { console.table(r.rows); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });