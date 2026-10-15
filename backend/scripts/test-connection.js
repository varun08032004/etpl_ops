require('dotenv').config();
console.log('INTERNAL_OPS_DATABASE_URL:', process.env.INTERNAL_OPS_DATABASE_URL ? 'SET' : 'NOT SET');

const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

pool.query('SELECT 1')
  .then(r => {
    console.log('Connected successfully');
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });