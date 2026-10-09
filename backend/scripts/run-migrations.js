'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db/pool');

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✅ Migration applied: ${path.basename(filePath)}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration failed: ${path.basename(filePath)}`);
    console.error(err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const migrations = [
    '../db/060_jira_comprehensive.sql',
  ];

  for (const migration of migrations) {
    const fullPath = path.join(__dirname, migration);
    if (fs.existsSync(fullPath)) {
      await runMigration(fullPath);
    } else {
      console.log(`⚠️  Skipping missing: ${migration}`);
    }
  }
  
  await pool.end();
  console.log('All migrations completed');
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});