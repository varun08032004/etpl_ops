'use strict';

const { Pool } = require('pg');
const { runMigration } = require('../scripts/run-migrations');
const fs = require('fs');
const path = require('path');

const TEST_DB_URL = process.env.TEST_DB_URL || 'postgresql://postgres:postgres@localhost:5432/etpl_ops_test';

describe('Migration Registry', () => {
  let testPool;

  beforeAll(async () => {
    testPool = new Pool({ connectionString: TEST_DB_URL });
    
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        migration_id VARCHAR(50) NOT NULL UNIQUE,
        filename VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        applied_at TIMESTAMP,
        applied_by UUID,
        execution_time_ms INTEGER,
        error_message TEXT,
        checksum_verified BOOLEAN DEFAULT FALSE,
        rolled_back_at TIMESTAMP,
        rolled_back_by UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await testPool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_migrations_id 
      ON schema_migrations(migration_id);
    `);

    await testPool.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_status 
      ON schema_migrations(status);
    `);
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.query('DROP TABLE IF EXISTS schema_migrations');
      await testPool.end();
    }
  });

  beforeEach(async () => {
    await testPool.query('TRUNCATE TABLE schema_migrations RESTART IDENTITY CASCADE');
  });

  const createTestMigration = (name, sql) => {
    const testFile = `/tmp/${name}.sql`;
    fs.writeFileSync(testFile, sql);
    return testFile;
  };

  test('fresh installation applies migration and records it', async () => {
    const testFile = createTestMigration('test_migration_001', `
      CREATE TABLE IF NOT EXISTS test_migration_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100)
      );
    `);
    
    try {
      const result = await runMigration(testFile, testPool);
      expect(result.success).toBe(true);
      
      const { rows } = await testPool.query(
        'SELECT * FROM schema_migrations WHERE migration_id = $1',
        ['test_migration_001']
      );
      
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('applied');
      expect(rows[0].checksum).toBeDefined();
      expect(rows[0].checksum_verified).toBe(true);
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test('duplicate migration is skipped', async () => {
    const testFile = createTestMigration('test_duplicate_001', `
      CREATE TABLE IF NOT EXISTS test_duplicate_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        value TEXT
      );
    `);
    
    try {
      await runMigration(testFile, testPool);
      const result = await runMigration(testFile, testPool);
      expect(result.skipped).toBe(true);
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test('checksum mismatch throws error', async () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS test_checksum_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
    `;
    const testFile = createTestMigration('test_checksum_001', sql);
    
    try {
      await runMigration(testFile, testPool);
      fs.writeFileSync(testFile, sql + '\n-- modified');
      
      await expect(runMigration(testFile, testPool)).rejects.toThrow('CHECKSUM MISMATCH');
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test('concurrent runners are prevented by advisory lock', async () => {
    const testFile = createTestMigration('test_concurrent_001', `
      CREATE TABLE IF NOT EXISTS test_concurrent_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
    `);
    
    try {
      const runner1 = runMigration(testFile, testPool);
      const runner2 = runMigration(testFile, testPool);
      
      const [r1, r2] = await Promise.all([runner1, runner2]);
      
      const successCount = [r1, r2].filter(r => r.success || r.skipped).length;
      expect(successCount).toBe(1);
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test('failed migration can be retried after fixing', async () => {
    const testFile = createTestMigration('test_fail_001', `
      CREATE TABLE IF NOT EXISTS test_fail_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
      INVALID SQL STATEMENT;
    `);
    
    try {
      try {
        await runMigration(testFile, testPool);
      } catch (e) {
        // Expected to fail
      }
      
      const fixedMigration = `
        CREATE TABLE IF NOT EXISTS test_fail_table_fixed (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid()
        );
      `;
      fs.writeFileSync(testFile, fixedMigration);
      
      const result = await runMigration(testFile, testPool);
      expect(result.success).toBe(true);
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test('checksum mismatch stops execution even on retry', async () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS test_checksum_stop (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
    `;
    const testFile = createTestMigration('test_checksum_stop_001', sql);
    
    try {
      await runMigration(testFile, testPool);
      fs.writeFileSync(testFile, sql + '\n-- changed');
      
      await expect(runMigration(testFile, testPool)).rejects.toThrow('CHECKSUM MISMATCH');
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test('applied_by uses valid UUID not arbitrary string', async () => {
    const testFile = createTestMigration('test_applied_by_001', `
      CREATE TABLE IF NOT EXISTS test_applied_by_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
    `);
    
    try {
      await runMigration(testFile, testPool);
      
      const { rows } = await testPool.query(
        'SELECT applied_by FROM schema_migrations WHERE migration_id = $1',
        ['test_applied_by_001']
      );
      
      expect(rows[0].applied_by).toBe('00000000-0000-0000-0000-000000000000');
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test('execution_time_ms is recorded', async () => {
    const testFile = createTestMigration('test_exec_time_001', `
      CREATE TABLE IF NOT EXISTS test_exec_time_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
    `);
    
    try {
      await runMigration(testFile, testPool);
      
      const { rows } = await testPool.query(
        'SELECT execution_time_ms FROM schema_migrations WHERE migration_id = $1',
        ['test_exec_time_001']
      );
      
      expect(rows[0].execution_time_ms).toBeGreaterThanOrEqual(0);
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test('state transitions are enforced', async () => {
    const testFile = createTestMigration('test_state_001', `
      CREATE TABLE IF NOT EXISTS test_state_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      );
    `);
    
    try {
      await runMigration(testFile, testPool);
      
      // Try invalid transition: applied -> applying (should fail via trigger)
      await expect(
        testPool.query(`
          UPDATE schema_migrations SET status = 'applying' WHERE migration_id = 'test_state_001'
        `)
      ).rejects.toThrow('Invalid status transition');
    } finally {
      fs.unlinkSync(testFile);
    }
  });
});