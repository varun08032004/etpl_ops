'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  const sql = fs.readFileSync(path.join(__dirname, '../db/031_org_hierarchy_tiers.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration 031_org_hierarchy_tiers.sql executed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();