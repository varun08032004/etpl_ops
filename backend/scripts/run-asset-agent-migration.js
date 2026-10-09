const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
    console.error(err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const migrations = [
    '../db/020_asset_device_agent_link.sql',
  ];

  for (const migration of migrations) {
    const fullPath = path.join(__dirname, migration);
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
  console.error('Fatal:', err.message);
  process.exit(1);
});