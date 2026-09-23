require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runSeed() {
  const pool = new Pool({
    connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed_compliance_automation_rules.sql'), 'utf8');
    console.log('Running automation rules seed...');
    await pool.query(sql);
    console.log('✅ Automation rules seeded successfully');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeed();