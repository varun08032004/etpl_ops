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
    // Add missing columns
    await client.query(`ALTER TABLE productivity_rules ADD COLUMN IF NOT EXISTS name VARCHAR(150)`);
    await client.query(`ALTER TABLE productivity_rules ADD COLUMN IF NOT EXISTS applies_to VARCHAR(20) DEFAULT 'all'`);
    await client.query(`ALTER TABLE productivity_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
    await client.query(`ALTER TABLE productivity_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    console.log('✅ Added missing columns to productivity_rules');
    
    // Verify
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'productivity_rules'
    `);
    console.log('productivity_rules columns:', rows.map(r => r.column_name));
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();