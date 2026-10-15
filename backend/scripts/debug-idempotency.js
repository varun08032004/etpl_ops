require('dotenv').config();
const ledger = require('../services/ledger');

async function test() {
  const staffId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const bankAccountId = '11111111-1111-1111-1111-111111111111';
  const shareCapitalAccountId = '22222222-2222-2222-2222-222222222222';

  const lines = [
    { accountId: bankAccountId, debit: 1000 },
    { accountId: shareCapitalAccountId, credit: 1000 },
  ];

  // First call
  console.log('First call...');
  const result1 = await ledger.postJournalEntry({
    entryDate: '2024-01-15',
    source: 'manual',
    sourceType: 'idempotency_test_debug',
    sourceId: 'test-source-debug-1',
    narration: 'Test entry 1',
    createdBy: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    lines,
  });
  console.log('Result 1:', JSON.stringify(result1, null, 2));

  // Second call with different source_type
  console.log('Second call...');
  const result2 = await ledger.postJournalEntry({
    entryDate: '2024-01-15',
    source: 'manual',
    sourceType: 'different_source_type_debug',
    sourceId: 'test-source-debug-1',
    narration: 'Test entry 2',
    createdBy: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    lines,
  });
  console.log('Result 2:', JSON.stringify(result2, null, 2));

  // Check database
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const entries = await pool.query("SELECT id, entry_number, source_type, source_id FROM journal_entries WHERE source_id = 'test-source-debug-1'");
  console.log('Entries in DB:', entries.rows);
  
  pool.end();
}

test().catch(console.error);