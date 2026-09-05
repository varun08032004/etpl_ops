const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

pool.query(`UPDATE training_programmes SET version = '1.0', updated_at = NOW() WHERE code = 'CA-2026'`).then(() => {
  console.log('Programme version updated to CA-2026-V1.0');
  pool.end();
});