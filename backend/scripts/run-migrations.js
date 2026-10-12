'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../db/pool');

/**
 * Runs a single migration with proper transaction handling and registry tracking.
 * 
 * @param {string} filePath - Path to the migration SQL file
 * @param {Object} customPool - Optional pool for testing (uses default pool if not provided)
 * @returns {Promise<Object>} Result object with success/skipped status
 */
async function runMigration(filePath, customPool) {
  const activePool = customPool || pool;
  const sql = fs.readFileSync(filePath, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  const migrationId = path.basename(filePath, '.sql');

  const client = await activePool.connect();
  // Convert migration ID to 64-bit integer for advisory lock
  const lockKey = parseInt(crypto.createHash('sha256').update(`migration:${migrationId}`).digest('hex').slice(0, 16), 16);
  
  try {
    await client.query('BEGIN');
    
    // Advisory lock prevents concurrent runners
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [lockKey]);
    
    const { rows: [existing] } = await client.query(
      `SELECT * FROM schema_migrations WHERE migration_id = $1 FOR UPDATE`,
      [migrationId]
    );
    
    if (existing) {
      if (existing.checksum !== checksum) {
        throw new Error(`CHECKSUM MISMATCH: ${migrationId} changed since applied`);
      }
      if (existing.status === 'applied') return { skipped: true };
      if (existing.status === 'applying') throw new Error(`Migration ${migrationId} already running`);
      // failed -> allow retry
    }
    
    // Record applying state BEFORE execution (survives rollback)
    await client.query(`
      INSERT INTO schema_migrations (migration_id, filename, checksum, status, applied_by)
      VALUES ($1, $2, $3, 'applying', $4)
      ON CONFLICT (migration_id) DO UPDATE SET
        status = 'applying', applied_at = NULL, error_message = NULL, checksum = EXCLUDED.checksum
    `, [migrationId, path.basename(filePath), checksum, process.env.STAFF_ID || '00000000-0000-0000-0000-000000000000']);
    
    await client.query('COMMIT'); // Persist "applying" state
    await client.query('BEGIN');  // New transaction for actual migration
    
    try {
      const start = Date.now();
      await client.query(sql);
      const execTime = Date.now() - start;
      
      await client.query(`
        UPDATE schema_migrations 
        SET status = 'applied', applied_at = NOW(), execution_time_ms = $1, checksum_verified = TRUE
        WHERE migration_id = $2
      `, [execTime, migrationId]);
      
      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      await activePool.query(`
        UPDATE schema_migrations 
        SET status = 'failed', error_message = $1, execution_time_ms = $2
        WHERE migration_id = $3
      `, [err.message, Date.now() - start, migrationId]);
      throw err;
    }
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const migrations = [
    '../db/079_migration_registry.sql',  // Registry table creation
    '../db/080_encrypt_bank_credentials.sql',
    '../db/081_encrypt_employee_pii.sql',
    '../db/082_backfill_bank_credentials.sql',
    '../db/083_backfill_employee_pii.sql',
    '../db/084_journal_entry_idempotency.sql',
    '../db/085_bank_reconciliation_schema.sql',
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

module.exports = { runMigration };