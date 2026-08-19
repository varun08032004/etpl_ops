#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

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
    console.log(`��� Migration applied: ${filePath}`);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.message.includes('already exists') || err.message.includes('duplicate_object')) {
      console.log(`������  Already exists, skipping: ${filePath}`);
      return;
    }
    console.error(`��� Migration failed: ${filePath}`);
    console.error(err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const migrations = [
    '../db/007_ai_access.sql',
    '../db/008_ai_tools.sql',
    '../db/009_missing_tables.sql',
  ];

  for (const migration of migrations) {
    const fullPath = path.join(__dirname, migration);
    if (!fs.existsSync(fullPath)) {
      console.error(`��� File not found: ${fullPath}`);
      process.exit(1);
    }
    await runMigration(fullPath);
  }
  console.log('���� All migrations applied successfully');
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});