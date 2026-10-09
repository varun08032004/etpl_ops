'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function reset() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const newHash = await bcrypt.hash('password123', 10);
    
    await client.query(
      `UPDATE staff_accounts SET password_hash = $1 WHERE email = 'founder@ethertrack.in'`,
      [newHash]
    );
    
    console.log('Password reset for founder@ethertrack.in to "password123"');
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();