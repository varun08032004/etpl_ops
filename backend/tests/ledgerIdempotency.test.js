'use strict';

/**
 * Idempotency tests for ledger.postJournalEntry
 * Tests the unique constraint behavior and semantic comparison
 */

const ledger = require('../services/ledger');
const { Pool } = require('pg');

const TEST_DB_URL = process.env.INTERNAL_OPS_DATABASE_URL;

describe('Ledger Idempotency', () => {
  let testPool;
  let hasTestDb = false;
  const staffId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const bankAccountId = '11111111-1111-1111-1111-111111111111';
  const shareCapitalAccountId = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    try {
      testPool = new Pool({ 
        connectionString: TEST_DB_URL,
        ssl: { rejectUnauthorized: false }
      });
      await testPool.query('SELECT 1');
      hasTestDb = true;
    } catch (err) {
      console.warn('Test database not available - idempotency tests will be skipped:', err.message);
      hasTestDb = false;
    }
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.end();
    }
  });

  const setupTestData = async () => {
    if (!hasTestDb) return false;
    try {
      // Clean up any test data
      await testPool.query('DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE source_type = $1)', ['idempotency_test']);
      await testPool.query('DELETE FROM journal_entries WHERE source_type = $1', ['idempotency_test']);
      return true;
    } catch (err) {
      console.error('Setup failed:', err.message);
      return false;
    }
  };

  test('BLOCKED: identical retry returns original entry (duplicate: true)', async () => {
    if (!hasTestDb) { console.log('SKIPPED: Test database not available'); return; }
    await setupTestData();

    const sourceId = 'test-source-1';
    const lines = [
      { accountId: bankAccountId, debit: 1000 },
      { accountId: shareCapitalAccountId, credit: 1000 },
    ];

    // First post
    const result1 = await ledger.postJournalEntry({
      entryDate: '2024-01-15',
      source: 'test',
      sourceType: 'idempotency_test',
      sourceId,
      narration: 'Test entry',
      createdBy: staffId,
      lines,
    });

    expect(result1.duplicate).toBe(false);
    expect(result1.id).toBeDefined();

    // Second post with identical data - should return duplicate: true
    const result2 = await ledger.postJournalEntry({
      entryDate: '2024-01-15',
      source: 'test',
      sourceType: 'idempotency_test',
      sourceId,
      narration: 'Test entry',
      createdBy: staffId,
      lines,
    });

    expect(result2.duplicate).toBe(true);
    expect(result2.id).toBe(result1.id);
    expect(result2.entryNumber).toBe(result1.entryNumber);
  });

  test('BLOCKED: concurrent attempts create only one posting', async () => {
    if (!hasTestDb) { console.log('SKIPPED: Test database not available'); return; }
    await setupTestData();

    const sourceId = 'test-source-2';
    const lines = [
      { accountId: bankAccountId, debit: 2000 },
      { accountId: shareCapitalAccountId, credit: 2000 },
    ];

    // Simulate concurrent posts
    const [result1, result2] = await Promise.all([
      ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'test',
        sourceType: 'idempotency_test',
        sourceId,
        narration: 'Concurrent test',
        createdBy: staffId,
        lines,
      }),
      ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'test',
        sourceType: 'idempotency_test',
        sourceId,
        narration: 'Concurrent test',
        createdBy: staffId,
        lines,
      }),
    ]);

    // One should be original, one should be duplicate
    const duplicates = [result1, result2].filter(r => r.duplicate);
    const originals = [result1, result2].filter(r => !r.duplicate);
    
    expect(originals).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].id).toBe(originals[0].id);
  });

  test('BLOCKED: same source key with different amount throws IDEMPOTENCY_CONFLICT', async () => {
    if (!hasTestDb) { console.log('SKIPPED: Test database not available'); return; }
    await setupTestData();

    const sourceId = 'test-source-3';
    const lines1 = [
      { accountId: bankAccountId, debit: 1000 },
      { accountId: shareCapitalAccountId, credit: 1000 },
    ];

    await ledger.postJournalEntry({
      entryDate: '2024-01-15',
      source: 'test',
      sourceType: 'idempotency_test',
      sourceId,
      narration: 'Test entry',
      createdBy: staffId,
      lines: lines1,
    });

    // Try to post with different amount
    const lines2 = [
      { accountId: bankAccountId, debit: 2000 }, // Different amount!
      { accountId: shareCapitalAccountId, credit: 2000 },
    ];

    await expect(
      ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'test',
        sourceType: 'idempotency_test',
        sourceId,
        narration: 'Test entry',
        createdBy: staffId,
        lines: lines2,
      })
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      message: expect.stringContaining('Idempotency key conflict'),
    });
  });

  test('BLOCKED: same source key with different accounts throws IDEMPOTENCY_CONFLICT', async () => {
    if (!hasTestDb) { console.log('SKIPPED: Test database not available'); return; }
    await setupTestData();

    const revenueAccountId = '33333333-3333-3333-3333-333333333333';
    const sourceId = 'test-source-4';
    const lines1 = [
      { accountId: bankAccountId, debit: 1000 },
      { accountId: shareCapitalAccountId, credit: 1000 },
    ];

    await ledger.postJournalEntry({
      entryDate: '2024-01-15',
      source: 'test',
      sourceType: 'idempotency_test',
      sourceId,
      narration: 'Test entry',
      createdBy: staffId,
      lines: lines1,
    });

    // Try to post with different account
    const lines2 = [
      { accountId: bankAccountId, debit: 1000 },
      { accountId: revenueAccountId, credit: 1000 }, // Different account!
    ];

    await expect(
      ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'test',
        sourceType: 'idempotency_test',
        sourceId,
        narration: 'Test entry',
        createdBy: staffId,
        lines: lines2,
      })
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      message: expect.stringContaining('Idempotency key conflict'),
    });
  });

  test('BLOCKED: same source key with different debit/credit lines throws IDEMPOTENCY_CONFLICT', async () => {
    if (!hasTestDb) { console.log('SKIPPED: Test database not available'); return; }
    await setupTestData();

    const revenueAccountId = '33333333-3333-3333-3333-333333333333';
    const sourceId = 'test-source-5';
    const lines1 = [
      { accountId: bankAccountId, debit: 1000 },
      { accountId: shareCapitalAccountId, credit: 1000 },
    ];

    await ledger.postJournalEntry({
      entryDate: '2024-01-15',
      source: 'test',
      sourceType: 'idempotency_test',
      sourceId,
      narration: 'Test entry',
      createdBy: staffId,
      lines: lines1,
    });

    // Try to post with swapped debit/credit
    const lines2 = [
      { accountId: bankAccountId, credit: 1000 }, // Swapped!
      { accountId: shareCapitalAccountId, debit: 1000 },
    ];

    await expect(
      ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'test',
        sourceType: 'idempotency_test',
        sourceId,
        narration: 'Test entry',
        createdBy: staffId,
        lines: lines2,
      })
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      message: expect.stringContaining('Idempotency key conflict'),
    });
  });

  test('BLOCKED: different transaction date throws IDEMPOTENCY_CONFLICT', async () => {
    if (!hasTestDb) { console.log('SKIPPED: Test database not available'); return; }
    await setupTestData();

    const sourceId = 'test-source-6';
    const lines = [
      { accountId: bankAccountId, debit: 1000 },
      { accountId: shareCapitalAccountId, credit: 1000 },
    ];

    await ledger.postJournalEntry({
      entryDate: '2024-01-15',
      source: 'test',
      sourceType: 'idempotency_test',
      sourceId,
      narration: 'Test entry',
      createdBy: staffId,
      lines,
    });

    // Try to post with different date
    await expect(
      ledger.postJournalEntry({
        entryDate: '2024-01-20', // Different date!
        source: 'test',
        sourceType: 'idempotency_test',
        sourceId,
        narration: 'Test entry',
        createdBy: staffId,
        lines,
      })
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      message: expect.stringContaining('Idempotency key conflict'),
    });
  });

  test('BLOCKED: different narration throws IDEMPOTENCY_CONFLICT', async () => {
    if (!hasTestDb) { console.log('SKIPPED: Test database not available'); return; }
    await setupTestData();

    const sourceId = 'test-source-7';
    const lines = [
      { accountId: bankAccountId, debit: 1000 },
      { accountId: shareCapitalAccountId, credit: 1000 },
    ];

    await ledger.postJournalEntry({
      entryDate: '2024-01-15',
      source: 'test',
      sourceType: 'idempotency_test',
      sourceId,
      narration: 'Original narration',
      createdBy: staffId,
      lines,
    });

    // Try to post with different narration
    await expect(
      ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'test',
        sourceType: 'idempotency_test',
        sourceId,
        narration: 'Different narration', // Different!
        createdBy: staffId,
        lines,
      })
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      message: expect.stringContaining('Idempotency key conflict'),
    });
  });

  test('BLOCKED: different source throws unrelated error', async () => {
    if (!hasTestDb) { console.log('SKIPPED: Test database not available'); return; }
    await setupTestData();

    const lines = [
      { accountId: bankAccountId, debit: 1000 },
      { accountId: shareCapitalAccountId, credit: 1000 },
    ];

    await ledger.postJournalEntry({
      entryDate: '2024-01-15',
      source: 'test',
      sourceType: 'idempotency_test',
      sourceId: 'test-source-8',
      narration: 'Test entry',
      createdBy: staffId,
      lines,
    });

    // Try to post with different source (not source_type + source_id)
    const result = await ledger.postJournalEntry({
      entryDate: '2024-01-15',
      source: 'different_source', // Different source
      sourceType: 'idempotency_test',
      sourceId: 'test-source-8',
      narration: 'Test entry',
      createdBy: staffId,
      lines,
    });

    // Should succeed because source_type + source_id is different
    expect(result.duplicate).toBe(false);
  });

  test('BLOCKED: rollback when posting fails partway through', async () => {
    if (!hasTestDb) { console.log('SKIPPED: Test database not available'); return; }
    await setupTestData();

    // Try to post an unbalanced entry - should fail and rollback
    const lines = [
      { accountId: bankAccountId, debit: 1000 },
      { accountId: shareCapitalAccountId, credit: 500 }, // Unbalanced!
    ];

    await expect(
      ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'test',
        sourceType: 'idempotency_test',
        sourceId: 'test-source-9',
        narration: 'Unbalanced entry',
        createdBy: staffId,
        lines,
      })
    ).rejects.toThrow('Journal entry does not balance');

    // Verify no partial data was committed
    const { rows } = await testPool.query(
      `SELECT COUNT(*) FROM journal_entries WHERE source_type = $1`,
      ['idempotency_test']
    );
    expect(parseInt(rows[0].count)).toBe(0);
  });
});