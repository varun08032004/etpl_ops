const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function main() {
  const client = await pool.connect();
  try {
    // Check if table exists
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'productivity_rules'
    `);
    console.log('productivity_rules columns:', rows.map(r => r.column_name));
    
    // Check if table exists
    const { rows: tables } = await client.query(`
      SELECT tablename FROM pg_tables WHERE tablename = 'productivity_rules'
    `);
    console.log('Table exists:', tables.length > 0);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();