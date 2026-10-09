'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const { rows } = await pool.query(
    "SELECT typname FROM pg_type WHERE typtype = 'e' AND typname LIKE '%doc%'"
  );
  console.table(rows);
  await pool.end();
}

check();