require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: {rejectUnauthorized: false}});
pool.query("SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'journal_source')")
  .then(r => {console.log('journal_source enum values:', r.rows); pool.end();})
  .catch(e => {console.error('Failed:', e.message); pool.end();});