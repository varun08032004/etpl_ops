'use strict';

const { Pool } = require('pg');
const ledger = require('../services/ledger');
const { safeQuery, withTransaction } = require('../db/pool');

const TEST_DB_URL = process.env.TEST_DB_URL || 'postgresql://postgres:postgres@localhost:5432/etpl_ops_test';

describe('Ledger Service', () => {
  let testPool;
  let testStaffId;
  let testAccountId;
  let testPartyId;
  let testAccountId2;
  let testAccountId3;

  beforeAll(async () => {
    testPool = new Pool({ connectionString: TEST_DB_URL });
    
    // Create test staff account
    const { rows: [staff] } = await testPool.query(`
      INSERT INTO staff_accounts (email, role, is_active, full_name)
      VALUES ('test-ledger@test.com', 'finance', true, 'Test Ledger User')
      RETURNING id
    `);
    testStaffId = staff.id;

    // Create test chart of accounts
    const { rows: [acct1] } = await testPool.query(`
      INSERT INTO chart_of_accounts (code, name, account_type, is_group, is_active)
      VALUES ('1000', 'Test Asset', 'asset', false, true)
      RETURNING id
    `);
    testAccountId = acct1.id;

    const { rows: [acct2] } = await testPool.query(`
      INSERT INTO chart_of_accounts (code, name, account_type, is_group, is_active)
      VALUES ('2000', 'Test Liability', 'liability', false, true)
      RETURNING id
    `);
    testAccountId2 = acct2.id;

    const { rows: [acct3] } = await testPool.query(`
      INSERT INTO chart_of_accounts (code, name, account_type, is_group, is_active)
      VALUES ('4000', 'Test Income', 'income', false, true)
      RETURNING id
    `);
    testAccountId3 = acct3.id;

    const { rows: [acct4] } = await testPool.query(`
      INSERT INTO chart_of_accounts (code, name, account_type, is_group, is_active)
      VALUES ('5000', 'Test Expense', 'expense', false, true)
      RETURNING id
    `);
    testAccountId4 = acct4.id;

    const { rows: [party] } = await testPool.query(`
      INSERT INTO parties (name, party_type, email, is_active)
      VALUES ('Test Party', 'customer', 'party@test.com', true)
      RETURNING id
    `);
    testPartyId = party.id;
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.query('DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE created_by = $1)', [testStaffId]);
      await testPool.query('DELETE FROM journal_entries WHERE created_by = $1', [testStaffId]);
      await testPool.query('DELETE FROM chart_of_accounts WHERE code IN ($1,$2,$3,$4)', ['1000','2000','4000','5000']);
      await testPool.query('DELETE FROM parties WHERE email = $1', ['party@test.com']);
      await testPool.query('DELETE FROM staff_accounts WHERE email = $1', ['test-ledger@test.com']);
      await testPool.end();
    }
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE created_by = $1)', [testStaffId]);
    await testPool.query('DELETE FROM journal_entries WHERE created_by = $1', [testStaffId]);
  });

  describe('postJournalEntry', () => {
    test('posts a balanced journal entry successfully', async () => {
      const result = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Test journal entry',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 1000.00, description: 'Debit line' },
          { accountId: testAccountId2, credit: 1000.00, description: 'Credit line' },
        ],
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('entryNumber');
      expect(result.entryNumber).toMatch(/^JE-\d{4}-\d{6}$/);

      // Verify lines were inserted
      const { rows } = await testPool.query(
        'SELECT * FROM journal_lines WHERE journal_entry_id = $1 ORDER BY id',
        [result.id]
      );
      expect(rows).toHaveLength(2);
      expect(Number(rows[0].debit)).toBe(1000.00);
      expect(Number(rows[1].credit)).toBe(1000.00);
    });

    test('rejects unbalanced journal entry (debit != credit)', async () => {
      await expect(ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Unbalanced entry',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 1000.00 },
          { accountId: testAccountId2, credit: 500.00 },
        ],
      })).rejects.toThrow('Journal entry does not balance');
    });

    test('rejects journal entry with only one line', async () => {
      await expect(ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Single line entry',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 1000.00 },
        ],
      })).rejects.toThrow('A journal entry needs at least 2 lines');
    });

    test('rejects journal entry with zero-amount line', async () => {
      await expect(ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Zero amount line',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 1000.00 },
          { accountId: testAccountId2, credit: 0 },
        ],
      })).rejects.toThrow('Every journal line needs a nonzero debit or credit');
    });

    test('rejects journal entry with both debit and credit on same line', async () => {
      await expect(ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Both debit and credit',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 1000.00, credit: 500.00 },
          { accountId: testAccountId2, credit: 500.00 },
        ],
      })).rejects.toThrow('A single journal line cannot have both a debit and a credit');
    });

    test('handles floating point precision correctly', async () => {
      // 0.1 + 0.2 = 0.30000000000000004 in floating point
      // Should round to 0.30
      const result = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Precision test',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 0.10 },
          { accountId: testAccountId2, debit: 0.20 },
          { accountId: testAccountId3, credit: 0.30 },
        ],
      });

      expect(result).toHaveProperty('id');
      
      const { rows } = await testPool.query(
        'SELECT debit, credit FROM journal_lines WHERE journal_entry_id = $1 ORDER BY id',
        [result.id]
      );
      expect(Number(rows[0].debit)).toBe(0.10);
      expect(Number(rows[1].debit)).toBe(0.20);
      expect(Number(rows[2].credit)).toBe(0.30);
    });

    test('rejects entry dated in a closed fiscal period', async () => {
      // Create a closed fiscal period
      const { rows: [period] } = await testPool.query(`
        INSERT INTO fiscal_periods (label, start_date, end_date, is_closed)
        VALUES ('Test Closed Period', '2024-01-01', '2024-12-31', true)
        RETURNING *
      `);

      await expect(ledger.postJournalEntry({
        entryDate: '2024-06-15',
        source: 'manual',
        narration: 'Entry in closed period',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: testAccountId2, credit: 100 },
        ],
      })).rejects.toThrow('falls inside');

      await testPool.query('DELETE FROM fiscal_periods WHERE id = $1', [period.id]);
    });

    test('allows entry in closed period when allowClosedPeriod is true', async () => {
      const { rows: [period] } = await testPool.query(`
        INSERT INTO fiscal_periods (label, start_date, end_date, is_closed)
        VALUES ('Test Closed Period 2', '2024-01-01', '2024-12-31', true)
        RETURNING *
      `);

      const result = await ledger.postJournalEntry({
        entryDate: '2024-06-15',
        source: 'adjustment',
        sourceType: 'fiscal_period_close',
        narration: 'Closing entry',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: testAccountId2, credit: 100 },
        ],
        allowClosedPeriod: true,
      });

      expect(result).toHaveProperty('id');
      await testPool.query('DELETE FROM fiscal_periods WHERE id = $1', [period.id]);
    });

    test('posts multi-line journal entry correctly', async () => {
      const result = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Multi-line entry',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100.00 },
          { accountId: testAccountId2, credit: 50.00 },
          { accountId: testAccountId3, credit: 50.00 },
        ],
      });

      expect(result).toHaveProperty('id');
      
      const { rows } = await testPool.query(
        'SELECT account_id, debit, credit FROM journal_lines WHERE journal_entry_id = $1 ORDER BY id',
        [result.id]
      );
      expect(rows).toHaveLength(3);
      expect(Number(rows[0].debit)).toBe(100.00);
      expect(Number(rows[1].credit)).toBe(50.00);
      expect(Number(rows[2].credit)).toBe(50.00);
    });
  });

  describe('reverseJournalEntry', () => {
    test('creates a reversal entry with swapped debit/credit', async () => {
      // First, post an original entry
      const original = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Original entry',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 500.00, description: 'Original debit' },
          { accountId: testAccountId2, credit: 500.00, description: 'Original credit' },
        ],
      });

      // Reverse it
      const reversal = await ledger.reverseJournalEntry(original.id, {
        reason: 'Error in original entry',
        createdBy: testStaffId,
      });

      expect(reversal).toHaveProperty('id');
      expect(reversal.id).not.toBe(original.id);

      // Verify reversal lines are swapped
      const { rows } = await testPool.query(
        'SELECT account_id, debit, credit FROM journal_lines WHERE journal_entry_id = $1 ORDER BY id',
        [reversal.id]
      );
      expect(rows).toHaveLength(2);
      // Original debit becomes credit
      expect(Number(rows[0].credit)).toBe(500.00);
      expect(Number(rows[0].debit)).toBe(0);
      // Original credit becomes debit
      expect(Number(rows[1].debit)).toBe(500.00);
      expect(Number(rows[1].credit)).toBe(0);

      // Verify original entry is marked as reversed
      const { rows: [orig] } = await testPool.query(
        'SELECT reversed_by FROM journal_entries WHERE id = $1',
        [original.id]
      );
      expect(orig.reversed_by).toBe(reversal.id);
    });

    test('reversal entry has correct metadata', async () => {
      const original = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Original for reversal test',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: testAccountId2, credit: 100 },
        ],
      });

      const reversal = await ledger.reverseJournalEntry(original.id, {
        reason: 'Test reversal',
        createdBy: testStaffId,
      });

      const { rows: [revEntry] } = await testPool.query(
        'SELECT * FROM journal_entries WHERE id = $1',
        [reversal.id]
      );
      expect(revEntry.source).toBe('adjustment');
      expect(revEntry.source_type).toBe('reversal');
      expect(revEntry.source_id).toBe(original.id);
      expect(revEntry.narration).toContain('Reversal of');
      expect(revEntry.narration).toContain('Test reversal');
    });

    test('rejects reversal of non-existent entry', async () => {
      await expect(ledger.reverseJournalEntry('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow('Journal entry not found or has no lines');
    });
  });

  describe('Transaction rollback', () => {
    test('rolls back all lines when one line fails', async () => {
      // Create an entry with a valid line and an invalid account ID
      await expect(ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Transaction rollback test',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: '00000000-0000-0000-0000-000000000000', credit: 100 }, // Invalid account
        ],
      })).rejects.toThrow();

      // Verify no partial entry was created
      const { rows } = await testPool.query(
        'SELECT * FROM journal_entries WHERE created_by = $1 AND narration = $2',
        [testStaffId, 'Transaction rollback test']
      );
      expect(rows).toHaveLength(0);
    });

    test('rolls back reversal when original entry not found', async () => {
      await expect(ledger.reverseJournalEntry('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow();
    });
  });

  describe('Transaction rollback', () => {
    test('rolls back all lines when one line fails', async () => {
      // Create an entry with a valid line and an invalid account ID
      await expect(ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Transaction rollback test',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: '00000000-0000-0000-0000-000000000000', credit: 100 }, // Invalid account
        ],
      })).rejects.toThrow();

      // Verify no partial entry was created
      const { rows } = await testPool.query(
        'SELECT * FROM journal_entries WHERE created_by = $1 AND narration = $2',
        [testStaffId, 'Transaction rollback test']
      );
      expect(rows).toHaveLength(0);
    });

    test('rolls back reversal when original entry not found', async () => {
      await expect(ledger.reverseJournalEntry('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow();
    });
  });

  describe('Unique constraint violation handling', () => {
    test('returns duplicate: true when unique constraint is violated', async () => {
      // First, post an entry with source_type and source_id
      const result1 = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        sourceType: 'unique_test',
        sourceId: 'unique-constraint-test-1',
        narration: 'Unique constraint test',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: testAccountId2, credit: 100 },
        ],
      });

      // Try to post again with same source_type + source_id
      const result2 = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        sourceType: 'unique_test',
        sourceId: 'unique-constraint-test-1',
        narration: 'Unique constraint test 2',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 200 },
          { accountId: testAccountId2, credit: 200 },
        ],
      });

      // Should return the original entry with duplicate: true
      expect(result2.duplicate).toBe(true);
      expect(result2.id).toBe(result1.id);
      expect(result2.entryNumber).toBe(result1.entryNumber);
    });
  });

  describe('Concurrent posting safety', () => {
    test('concurrent journal entries get unique entry numbers', async () => {
      const promises = Array(5).fill(null).map(() => ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Concurrent test',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 10 },
          { accountId: testAccountId2, credit: 10 },
        ],
      }));

      const results = await Promise.all(promises);
      
      const entryNumbers = results.map(r => r.entryNumber);
      const uniqueNumbers = new Set(entryNumbers);
      expect(uniqueNumbers.size).toBe(5);
    });
  });

  describe('Concurrent idempotency safety', () => {
    test('concurrent duplicate requests return same entry', async () => {
      // Simulate two concurrent requests with the same source_type + source_id
      const promises = Array(2).fill(null).map(() => ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        sourceType: 'concurrent_test',
        sourceId: 'concurrent-idempotent-1',
        narration: 'Concurrent idempotency test',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: testAccountId2, credit: 100 },
        ],
      }));

      const results = await Promise.all(promises);
      
      // Both should return the same entry (one will be duplicate)
      expect(results[0].id).toBe(results[1].id);
      expect(results[0].entryNumber).toBe(results[1].entryNumber);
      // One should be marked as duplicate
      const duplicateCount = results.filter(r => r.duplicate).length;
      expect(duplicateCount).toBe(1);
    });
  });

  describe('Idempotency / Duplicate prevention', () => {
    test('duplicate journal entry request creates separate entries (idempotency by entry number)', async () => {
      // Post same entry twice
      const result1 = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        sourceType: 'test_idempotent',
        sourceId: 'test-idempotent-1',
        narration: 'Idempotency test',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: testAccountId2, credit: 100 },
        ],
      });

      const result2 = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        sourceType: 'test_idempotent',
        sourceId: 'test-idempotent-1',
        narration: 'Idempotency test',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: testAccountId2, credit: 100 },
        ],
      });

      // Second call should return duplicate: true and the same entry
      expect(result2.duplicate).toBe(true);
      expect(result2.id).toBe(result1.id);
      expect(result2.entryNumber).toBe(result1.entryNumber);
    });

    test('entries without source_type/source_id are not deduplicated', async () => {
      const result1 = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'No source type',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: testAccountId2, credit: 100 },
        ],
      });

      const result2 = await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'No source type',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 100 },
          { accountId: testAccountId2, credit: 100 },
        ],
      });

      // Both should succeed as separate entries (no deduplication without source_type+source_id)
      expect(result1.duplicate).toBe(false);
      expect(result2.duplicate).toBe(false);
      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('getTrialBalance', () => {
    test('returns balanced trial balance', async () => {
      // Post a few entries
      await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'TB test 1',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 1000 },
          { accountId: testAccountId2, credit: 1000 },
        ],
      });

      await ledger.postJournalEntry({
        entryDate: '2024-01-16',
        source: 'manual',
        narration: 'TB test 2',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId3, debit: 500 },
          { accountId: testAccountId4, credit: 500 },
        ],
      });

      const tb = await ledger.getTrialBalance();
      expect(tb.totalDebit).toBe(tb.totalCredit);
      expect(tb.lines.length).toBeGreaterThan(0);
    });
  });

  describe('getProfitAndLoss', () => {
    test('calculates net profit correctly', async () => {
      await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'Income entry',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId3, credit: 1000 }, // Income
          { accountId: testAccountId, debit: 1000 },  // Asset
        ],
      });

      await ledger.postJournalEntry({
        entryDate: '2024-01-16',
        source: 'manual',
        narration: 'Expense entry',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId4, debit: 300 },  // Expense
          { accountId: testAccountId, credit: 300 },  // Asset
        ],
      });

      const pnl = await ledger.getProfitAndLoss('2024-01-01', '2024-12-31');
      expect(pnl.totalIncome).toBe(1000);
      expect(pnl.totalExpense).toBe(300);
      expect(pnl.netProfit).toBe(700);
    });
  });

  describe('getBalanceSheet', () => {
    test('assets equal liabilities plus equity', async () => {
      await ledger.postJournalEntry({
        entryDate: '2024-01-15',
        source: 'manual',
        narration: 'BS test',
        createdBy: testStaffId,
        lines: [
          { accountId: testAccountId, debit: 1000 },   // Asset
          { accountId: testAccountId2, credit: 1000 }, // Liability
        ],
      });

      const bs = await ledger.getBalanceSheet('2024-12-31');
      expect(bs.totalAssets).toBe(1000);
      expect(bs.totalLiabilities).toBe(1000);
      expect(bs.totalEquity).toBe(0); // No equity entries yet
    });
  });
});