'use strict';
// Check what tables exist

require('dotenv').config();
const { pool } = require('./db/pool');

async function checkTables() {
  console.log('Connecting to database...');
  console.log('Database URL:', process.env.INTERNAL_OPS_DATABASE_URL?.slice(0, 50) + '...');
  
  const client = await pool.connect();
  console.log('Connected successfully');
  
  try {
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('Tables:', result.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
    console.log('Done');
  }
}

checkTables().catch(e => { console.error('Fatal:', e); process.exit(1); });