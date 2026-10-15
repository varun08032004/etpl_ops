const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const fs = require('fs');
const sql = fs.readFileSync('./db/migrations/20261013000000_replace_bps_with_percent.sql', 'utf8');
pool.query(sql).then(r => { console.log('Migration applied successfully!'); console.log('Result:', r); pool.end(); }).catch(e => { console.error('Error:', e.message, e.stack); pool.end(); });