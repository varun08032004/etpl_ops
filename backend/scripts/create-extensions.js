require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
  .then(() => pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto'))
  .then(() => {
    console.log('Extensions created');
    pool.end();
  })
  .catch(e => {
    console.error('Failed:', e.message);
    pool.end();
  });