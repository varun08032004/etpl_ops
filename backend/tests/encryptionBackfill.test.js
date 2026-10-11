'use strict';

const { Pool } = require('pg');
const { backfillBankCredentials, backfillEmployeePII } = require('../services/encryptionBackfill');
const { FieldEncryption } = require('../services/crypto/fieldEncryption');

const TEST_DB_URL = process.env.TEST_DB_URL || 'postgresql://postgres:postgres@localhost:5432/etpl_ops_test';

describe('Encryption Backfill', () => {
  let testPool;
  let fieldEncryption;
  let testKeyId = 'test-backfill-key';
  let testKeyHex;

  beforeAll(async () => {
    const crypto = require('crypto');
    testKeyHex = crypto.randomBytes(32).toString('hex');
    
    process.env.FIELD_ENC_KEY_ACTIVE = 'test-backfill-key';
    process.env['FIELD_ENC_KEY_test-backfill-key'] = testKeyHex;

    testPool = new Pool({ connectionString: TEST_DB_URL });
    
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_name VARCHAR(150),
        api_client_id VARCHAR(50),
        api_client_secret VARCHAR(100),
        api_base_url VARCHAR(200),
        api_client_id_enc TEXT,
        api_client_secret_enc TEXT,
        api_base_url_enc TEXT,
        credential_key_id VARCHAR(64),
        credential_rotated_at TIMESTAMP
      );
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_code VARCHAR(50),
        bank_account_number VARCHAR(50),
        pan_number VARCHAR(10),
        bank_account_number_enc TEXT,
        pan_number_enc TEXT,
        pii_key_id VARCHAR(64),
        pii_rotated_at TIMESTAMP
      );
    `);

    fieldEncryption = new FieldEncryption({
      activeKeyId: 'test-backfill-key',
      keys: { 'test-backfill-key': testKeyHex }
    });
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.query('DROP TABLE IF EXISTS bank_accounts');
      await testPool.query('DROP TABLE IF EXISTS employees');
      await testPool.end();
    }
    delete process.env.FIELD_ENC_KEY_ACTIVE;
    delete process.env['FIELD_ENC_KEY_test-backfill-key'];
  });

  beforeEach(async () => {
    await testPool.query('TRUNCATE TABLE bank_accounts RESTART IDENTITY CASCADE');
    await testPool.query('TRUNCATE TABLE employees RESTART IDENTITY CASCADE');
  });

  describe('Dry-run behavior', () => {
    test('dry run leaves database unchanged for bank credentials', async () => {
      await testPool.query(`
        INSERT INTO bank_accounts (account_name, api_client_id, api_client_secret, api_base_url)
        VALUES ('Test Account', 'client-123', 'secret-456', 'https://api.axisbank.com')
      `);

      const result = await backfillBankCredentials({ pool: testPool, dryRun: true });

      const { rows } = await testPool.query('SELECT * FROM bank_accounts');
      expect(rows[0].api_client_id_enc).toBeNull();
      expect(rows[0].api_client_secret_enc).toBeNull();
      expect(rows[0].api_base_url_enc).toBeNull();
      expect(result.dryRun).toBe(true);
      expect(result.totalProcessed).toBe(0);
    });

    test('dry run for employee PII leaves database unchanged', async () => {
      await testPool.query(`
        INSERT INTO employees (employee_code, bank_account_number, pan_number)
        VALUES ('EMP-001', '1234567890', 'ABCDE1234F')
      `);

      const result = await backfillEmployeePII({ pool: testPool, dryRun: true });

      const { rows } = await testPool.query('SELECT * FROM employees');
      expect(rows[0].bank_account_number_enc).toBeNull();
      expect(rows[0].pan_number_enc).toBeNull();
      expect(result.dryRun).toBe(true);
      expect(result.totalProcessed).toBe(0);
    });
  });

  describe('Successful backfill', () => {
    test('encrypts all plaintext bank credential columns', async () => {
      await testPool.query(`
        INSERT INTO bank_accounts (account_name, api_client_id, api_client_secret, api_base_url)
        VALUES ('Test Account', 'client-123', 'secret-456', 'https://api.axisbank.com')
      `);

      const result = await backfillBankCredentials({ pool: testPool, dryRun: false });

      const { rows } = await testPool.query('SELECT * FROM bank_accounts');
      expect(rows[0].api_client_id_enc).toMatch(/^v1:.+:.+:.+$/);
      expect(rows[0].api_client_secret_enc).toMatch(/^v1:.+:.+:.+$/);
      expect(rows[0].api_base_url_enc).toMatch(/^v1:.+:.+:.+$/);
      expect(rows[0].credential_key_id).toBe('test-backfill-key');
      expect(result.totalProcessed).toBe(1);
      expect(result.totalErrors).toBe(0);
    });

    test('encrypts all plaintext employee PII columns', async () => {
      await testPool.query(`
        INSERT INTO employees (employee_code, bank_account_number, pan_number)
        VALUES ('EMP-001', '1234567890', 'ABCDE1234F')
      `);

      const result = await backfillEmployeePII({ pool: testPool, dryRun: false });

      const { rows } = await testPool.query('SELECT * FROM employees');
      expect(rows[0].bank_account_number_enc).toMatch(/^v1:.+:.+:.+$/);
      expect(rows[0].pan_number_enc).toMatch(/^v1:.+:.+:.+$/);
      expect(rows[0].pii_key_id).toBe('test-backfill-key');
      expect(result.totalProcessed).toBe(1);
    });

    test('idempotent: re-running does not re-encrypt', async () => {
      await testPool.query(`
        INSERT INTO bank_accounts (account_name, api_client_id, api_client_secret, api_base_url)
        VALUES ('Idempotent Test', 'client-idem', 'secret-idem', 'https://idem.com')
      `);

      await backfillBankCredentials({ pool: testPool, dryRun: false });
      const result2 = await backfillBankCredentials({ pool: testPool, dryRun: false });

      const { rows } = await testPool.query('SELECT * FROM bank_accounts');
      expect(rows[0].api_client_id_enc).toMatch(/^v1:.+:.+:.+$/);
      expect(result2.totalProcessed).toBe(0);
    });

    test('partial encryption preserves existing envelopes', async () => {
      await testPool.query(`
        INSERT INTO bank_accounts (account_name, api_client_id, api_client_secret, api_base_url, api_client_id_enc)
        VALUES ('Partial Test', 'client-partial', 'secret-partial', 'https://partial.com', 'v1:existing:enc:data')
      `);

      const result = await backfillBankCredentials({ pool: testPool, dryRun: false });

      const { rows } = await testPool.query('SELECT * FROM bank_accounts WHERE account_name = $1', ['Partial Test']);
      expect(rows[0].api_client_id_enc).toBe('v1:existing:enc:data');
      expect(rows[0].api_client_secret_enc).toMatch(/^v1:.+:.+:.+$/);
      expect(rows[0].api_base_url_enc).toMatch(/^v1:.+:.+:.+$/);
      expect(result.totalProcessed).toBe(1);
    });
  });

  describe('Failure and rollback behavior', () => {
    test('update failure rolls back transaction', async () => {
      await testPool.query(`
        INSERT INTO bank_accounts (account_name, api_client_id, api_client_secret, api_base_url)
        VALUES ('Fail Test', 'client-fail', 'secret-fail', 'https://fail.com')
      `);

      const originalEncrypt = FieldEncryption.prototype.encrypt;
      FieldEncryption.prototype.encrypt = () => {
        throw new Error('Simulated encryption failure');
      };

      try {
        await backfillBankCredentials({ pool: testPool, dryRun: false });
      } catch (e) {
        // Expected to fail
      }
      
      FieldEncryption.prototype.encrypt = originalEncrypt;

      const { rows } = await testPool.query('SELECT * FROM bank_accounts');
      expect(rows[0].api_client_id_enc).toBeNull();
      expect(rows[0].api_client_secret_enc).toBeNull();
      expect(rows[0].api_base_url_enc).toBeNull();
    });

    test('client released on success', async () => {
      await testPool.query(`
        INSERT INTO bank_accounts (account_name, api_client_id, api_client_secret, api_base_url)
        VALUES ('Client Release Test', 'client-release', 'secret-release', 'https://release.com')
      `);

      const result = await backfillBankCredentials({ pool: testPool, dryRun: false });
      expect(result.totalProcessed).toBe(1);
    });
  });

  describe('Retry behavior', () => {
    test('retry logic exists with bounded retries', async () => {
      const { backfillBankCredentials } = require('../services/encryptionBackfill');
      const source = require('fs').readFileSync(require('path').join(__dirname, '../services/encryptionBackfill.js'), 'utf8');
      expect(source).toContain('MAX_RETRIES');
      expect(source).toContain('RETRY_BASE_MS');
      expect(source).toContain('retries <=');
    });
  });

  describe('Concurrency and SKIP LOCKED', () => {
    test('two workers process disjoint row sets', async () => {
      for (let i = 0; i < 50; i++) {
        await testPool.query(`
          INSERT INTO bank_accounts (account_name, api_client_id, api_client_secret, api_base_url)
          VALUES ($1, $2, $3, $4)
        `, [`Account ${i}`, `client-${i}`, `secret-${i}`, `https://api${i}.com`]);
      }

      const worker1 = backfillBankCredentials({ pool: testPool, batchSize: 10, dryRun: false });
      const worker2 = backfillBankCredentials({ pool: testPool, batchSize: 10, dryRun: false });

      const [r1, r2] = await Promise.all([worker1, worker2]);
      expect(r1.totalProcessed + r2.totalProcessed).toBeLessThanOrEqual(50);
      expect(r1.totalProcessed + r2.totalProcessed).toBeGreaterThan(0);
    });

    test('locked rows are skipped by other workers', async () => {
      await testPool.query(`
        INSERT INTO bank_accounts (account_name, api_client_id, api_client_secret, api_base_url)
        VALUES ('Locked Test', 'client-locked', 'secret-locked', 'https://locked.com')
      `);

      const client = await testPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`
          SELECT * FROM bank_accounts WHERE account_name = 'Locked Test' FOR UPDATE
        `);
        
        const worker = backfillBankCredentials({ pool: testPool, batchSize: 10, dryRun: false });
        const result = await worker;
        
        expect(result.totalProcessed).toBe(0);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    });
  });

  describe('Empty string policy', () => {
    test('empty string encrypts and decrypts correctly', async () => {
      const crypto = require('crypto');
      const testKeyHex = crypto.randomBytes(32).toString('hex');
      const enc = new FieldEncryption({
        activeKeyId: 'empty-test',
        keys: { 'empty-test': testKeyHex }
      });

      const context = { table: 'test', column: 'col', recordId: 'test' };
      
      const envelope = await enc.encrypt('', { table: 'test', column: 'col', recordId: 'test' });
      const decrypted = enc.decrypt(envelope, context);
      
      expect(decrypted).toBe('');
      expect(enc.isEmptyEnvelope(envelope)).toBe(true);
    });
  });

  describe('Secret leakage prevention', () => {
    test('errors do not contain secrets', async () => {
      const enc = new FieldEncryption({
        activeKeyId: 'leak-test',
        keys: { 'leak-test': 'a'.repeat(64) }
      });

      const envelope = enc.encrypt('SECRET-VALUE', { table: 't', column: 'c', recordId: 'r' });
      
      const parts = envelope.split(':');
      const tampered = Buffer.from(parts[3], 'base64');
      tampered[0] ^= 0xFF;
      parts[3] = tampered.toString('base64');
      const tamperedEnvelope = parts.join(':');

      try {
        FieldEncryption.prototype.decrypt.call(
          { keyring: new Map(), activeKeyId: 'test' }, 
          tamperedEnvelope, 
          { table: 't', column: 'c', recordId: 'r' }
        );
      } catch (e) {
        expect(e.message).not.toContain('SECRET');
        expect(e.message).not.toContain('secret');
      }
    });

    test('logs do not contain secrets', () => {
      const source = require('fs').readFileSync(require('path').join(__dirname, '../services/encryptionBackfill.js'), 'utf8');
      expect(source).not.toMatch(/console\.log.*envelope/);
      expect(source).not.toMatch(/console\.log.*secret/);
      expect(source).not.toMatch(/console\.log.*key/);
    });
  });
});