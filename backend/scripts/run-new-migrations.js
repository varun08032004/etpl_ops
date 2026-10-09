const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('📦 Loading environment...');
console.log('DATABASE_URL:', process.env.INTERNAL_OPS_DATABASE_URL ? 'SET' : 'NOT SET');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function runMigration(filePath) {
  console.log('📄 Reading:', filePath);
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log('🔗 Connecting to database...');
  const client = await pool.connect();
  try {
    console.log('🔄 Starting transaction...');
    await client.query('BEGIN');
    console.log('⚡ Executing SQL...');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration applied:', filePath);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.message.includes('already exists') || err.message.includes('duplicate_object') || err.message.includes('duplicate column')) {
      console.log('⚠️  Already exists, skipping:', filePath);
      return;
    }
    console.error('❌ Migration failed:', filePath);
    console.error('Error:', err.message);
    console.error('Code:', err.code);
    console.error('Detail:', err.detail);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const migrations = [
    '../db/017_device_fingerprinting.sql',
    '../db/018_screenshot_enhancements.sql',
    '../db/019_performance_monitoring_integration.sql',
  ];

  for (const migration of migrations) {
    const fullPath = path.join(__dirname, migration);
    console.log('🔍 Checking:', fullPath);
    if (!fs.existsSync(fullPath)) {
      console.error('❌ File not found:', fullPath);
      process.exit(1);
    }
    await runMigration(fullPath);
  }
  console.log('🎉 All migrations applied successfully');
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
});