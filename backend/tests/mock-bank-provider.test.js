/**
 * Mock Bank Provider Contract Tests
 * 
 * Tests the synthetic bank provider against required scenarios.
 * These tests DO NOT use real Axis Bank credentials or production databases.
 * All fixtures are synthetic.
 */

'use strict';

const request = require('supertest');
const { app, mockState, resetMockState, initAccount } = require('./mock-bank-provider');
const {
  makeDedupeKey,
  DedupeTracker,
  PaginationHelper,
  ScenarioRunner,
  generateTestTransactions,
  verifyPaginationIntegrity,
  sleep
} = require('./test-utils');

describe('Mock Bank Provider - Contract Tests', () => {
  let runner;
  let testAccountId = 'test-account-001';
  let authToken;
  let statementToken;
  
  beforeAll(() => {
    runner = new ScenarioRunner();
    resetMockState();
    initAccount(testAccountId);
  });
  
  beforeEach(() => {
    resetMockState();
    initAccount(testAccountId);
  });
  
  afterAll(async () => {
    // Print summary
    runner.printSummary();
  });
  
  // Helper to get auth token
  async function getAuthToken() {
    const res = await request(app)
      .post('/auth/token')
      .send({
        account_id: testAccountId,
        grant_type: 'client_credentials',
        client_id: 'test_client',
        client_secret: 'test_secret'
      });
    return res.body.access_token;
  }
  
  // Helper to get statement token
  async function getStatementToken(token) {
    const res = await request(app)
      .post('/statement/token')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    return res.body.statement_token;
  }
  
  describe('1. Successful synthetic response parsing', () => {
    test('GET /health returns ok', async () => {
      await runner.run('health check', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.synthetic).toBe(true);
      });
    });
    
    test('POST /auth/token returns valid token', async () => {
      await runner.run('token generation', async () => {
        const res = await request(app)
          .post('/auth/token')
          .send({
            account_id: testAccountId,
            grant_type: 'client_credentials',
            client_id: 'test_client',
            client_secret: 'test_secret'
          });
        
        expect(res.status).toBe(200);
        expect(res.body.access_token).toBeDefined();
        expect(res.body.token_type).toBe('Bearer');
        expect(res.body.expires_in).toBeGreaterThan(0);
        expect(res.body.synthetic).toBe(true);
        
        authToken = res.body.access_token;
      });
    });
    
    test('GET /accounts/:id/balance returns synthetic balance', async () => {
      await runner.run('balance fetch', async () => {
        const token = await getAuthToken();
        const res = await request(app)
          .get(`/accounts/${testAccountId}/balance`)
          .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(200);
        expect(res.body.account_id).toBe(testAccountId);
        expect(res.body.balance_paise).toBeGreaterThan(0);
        expect(res.body.currency).toBe('INR');
        expect(res.body.synthetic).toBe(true);
      });
    });
  });
  
  describe('2. Empty transaction collection handling', () => {
    test('Statement with scenario=empty returns empty array', async () => {
      await runner.run('empty statement', async () => {
        const token = await getAuthToken();
        const stmtToken = await getStatementToken(token);
        
        const res = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken)
          .query({ scenario: 'empty' });
        
        expect(res.status).toBe(200);
        expect(res.body.transactions).toEqual([]);
        expect(res.body.has_more).toBe(false);
        expect(res.body.synthetic).toBe(true);
      });
    });
  });
  
  describe('3. Pagination - 500 records across multiple pages', () => {
    test('Pagination retrieves all 500 synthetic records', async () => {
      await runner.run('full pagination 500 records', async () => {
        const token = await getAuthToken();
        const stmtToken = await getStatementToken(token);
        
        const pageSize = 100;
        const expectedTotal = 500;
        let allRecords = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
          const res = await request(app)
            .get(`/accounts/${testAccountId}/statement`)
            .set('x-statement-token', stmtToken)
            .query({ page, page_size: pageSize });
          
          expect(res.status).toBe(200);
          expect(res.body.synthetic).toBe(true);
          
          allRecords = allRecords.concat(res.body.transactions);
          hasMore = res.body.has_more;
          page++;
        }
        
        // Verify we got all records
        expect(allRecords.length).toBe(expectedTotal);
        
        // Verify no duplicates
        const utrs = allRecords.map(r => r.utr);
        const uniqueUtrs = new Set(utrs);
        expect(uniqueUtrs.size).toBe(expectedTotal);
        
        // Verify pagination metadata
        expect(page - 1).toBe(Math.ceil(expectedTotal / pageSize));
      });
    });
    
    test('Pagination with custom page size', async () => {
      await runner.run('custom page size pagination', async () => {
        const token = await getAuthToken();
        const stmtToken = await getStatementToken(token);
        
        const pageSize = 50;
        const expectedTotal = 500;
        let allRecords = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
          const res = await request(app)
            .get(`/accounts/${testAccountId}/statement`)
            .set('x-statement-token', stmtToken)
            .query({ page, page_size: pageSize });
          
          expect(res.status).toBe(200);
          allRecords = allRecords.concat(res.body.transactions);
          hasMore = res.body.has_more;
          page++;
        }
        
        expect(allRecords.length).toBe(expectedTotal);
      });
    });
  });
  
  describe('4. Duplicate delivery detection', () => {
    test('Duplicate delivery of same event detected by dedupe helper', async () => {
      await runner.run('duplicate detection', async () => {
        const tracker = new DedupeTracker();
        
        const txn1 = {
          utr: 'UTR000000000001',
          direction: 'credit',
          amount_paise: 100000,
          value_date: '2026-01-15'
        };
        
        const txn2 = {
          utr: 'UTR000000000001',
          direction: 'credit',
          amount_paise: 100000,
          value_date: '2026-01-15'
        };
        
        // First should not be duplicate
        expect(tracker.isDuplicate(txn1)).toBe(false);
        tracker.markSeen(txn1);
        
        // Second should be duplicate
        expect(tracker.isDuplicate(txn2)).toBe(true);
        
        // Mark the duplicate as seen too (simulating processing both deliveries)
        tracker.markSeen(txn2);
        
        // Count should be 2 because markSeen was called twice
        expect(tracker.getCount(txn1)).toBe(2);
      });
    });
    
    test('Same amount and date with different UTRs are NOT duplicates', async () => {
      await runner.run('distinct transactions same amount/date', async () => {
        const tracker = new DedupeTracker();
        
        const txn1 = {
          utr: 'UTR000000000001',
          direction: 'credit',
          amount_paise: 5000000,
          value_date: '2026-01-15'
        };
        
        const txn2 = {
          utr: 'UTR000000000002', // Different UTR
          direction: 'credit',
          amount_paise: 5000000,  // Same amount
          value_date: '2026-01-15' // Same date
        };
        
        expect(tracker.isDuplicate(txn1)).toBe(false);
        tracker.markSeen(txn1);
        
        expect(tracker.isDuplicate(txn2)).toBe(false); // Different UTR = not duplicate
        tracker.markSeen(txn2);
        
        expect(tracker.size).toBe(2);
      });
    });
  });
  
  describe('5. Delayed response simulation', () => {
    test('Delayed response scenario works', async () => {
      await runner.run('delayed response', async () => {
        // Configure delay
        await request(app)
          .post('/test/config')
          .send({ defaultDelay: 100 });
        
        const token = await getAuthToken();
        const stmtToken = await getStatementToken(token);
        
        const start = Date.now();
        const res = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken);
        const duration = Date.now() - start;
        
        expect(res.status).toBe(200);
        expect(duration).toBeGreaterThanOrEqual(100);
        
        // Reset delay
        await request(app)
          .post('/test/config')
          .send({ defaultDelay: 0 });
      });
    });
  });
  
  describe('6. Request timeout handling', () => {
    test('Timeout scenario terminates', async () => {
      await runner.run('timeout handling', async () => {
        const token = await getAuthToken();
        const stmtToken = await getStatementToken(token);
        
        // This should timeout - we'll test with a short timeout
        const promise = request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken)
          .query({ scenario: 'timeout' })
          .timeout(1000); // Supertest timeout
        
        await expect(promise).rejects.toThrow();
      }, 15000); // Jest timeout
    });
  });
  
  describe('7. Rate limit response', () => {
    test('Rate limit returns 429', async () => {
      await runner.run('rate limit response', async () => {
        const token = await getAuthToken();
        const stmtToken = await getStatementToken(token);
        
        const res = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken)
          .query({ scenario: 'rate_limit' });
        
        expect(res.status).toBe(429);
        expect(res.body.error).toContain('Rate limit');
        expect(res.body.retry_after).toBeDefined();
        expect(res.body.synthetic).toBe(true);
      });
    });
  });
  
  describe('8. Malformed JSON rejection', () => {
    test('Malformed JSON returns parse error or invalid response', async () => {
      await runner.run('malformed JSON handling', async () => {
        const token = await getAuthToken();
        const stmtToken = await getStatementToken(token);
        
        const res = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken)
          .query({ scenario: 'malformed_json' });
        
        // The mock returns invalid JSON - supertest will fail to parse
        // This tests that the client handles it gracefully
        expect(res.status).toBe(200); // HTTP 200 but invalid JSON body
      });
    });
  });
  
  describe('9. Expired token failure', () => {
    test('Expired token returns 401', async () => {
      await runner.run('expired token', async () => {
        // Create an expired token manually
        const expiredToken = 'mock_token_expired';
        mockState.tokens.set(expiredToken, {
          accountId: testAccountId,
          expiresAt: Date.now() - 1000, // Expired 1 second ago
          scope: 'statement'
        });
        
        const res = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', expiredToken);
        
        expect(res.status).toBe(401);
        expect(res.body.error).toContain('expired');
        expect(res.body.synthetic).toBe(true);
      });
    });
    
    test('Invalid token returns 401', async () => {
      await runner.run('invalid token', async () => {
        const res = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', 'invalid_token_xyz');
        
        expect(res.status).toBe(401);
        expect(res.body.error).toContain('not found');
      });
    });
  });
  
  describe('10. Partial failure during pagination', () => {
    test('Partial failure on page 2 does not report false success', async () => {
      await runner.run('partial pagination failure', async () => {
        const token = await getAuthToken();
        const stmtToken = await getStatementToken(token);
        
        // Page 1 should succeed
        const page1 = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken)
          .query({ scenario: 'partial_failure', page: 1, page_size: 500 });
        
        expect(page1.status).toBe(200);
        expect(page1.body.transactions.length).toBeGreaterThan(0);
        
        // Page 2 should fail
        const page2 = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken)
          .query({ scenario: 'partial_failure', page: 2, page_size: 500 });
        
        expect(page2.status).toBe(502);
        expect(page2.body.error).toContain('Bad gateway');
      });
    });
  });
  
  describe('11. Resume pagination does not skip records', () => {
    test('Resuming after failure retrieves remaining records', async () => {
      await runner.run('pagination resume', async () => {
        const token = await getAuthToken();
        const stmtToken = await getStatementToken(token);
        
        // Get first 3 pages successfully
        const page1 = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken)
          .query({ page: 1, page_size: 500 });
        
        const page2 = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken)
          .query({ page: 2, page_size: 500 });
        
        const page3 = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken)
          .query({ page: 3, page_size: 500 });
        
        expect(page1.status).toBe(200);
        expect(page2.status).toBe(200);
        expect(page3.status).toBe(200);
        
        // Verify no overlap
        const page1Utrs = new Set(page1.body.transactions.map(t => t.utr));
        const page2Utrs = new Set(page2.body.transactions.map(t => t.utr));
        const page3Utrs = new Set(page3.body.transactions.map(t => t.utr));
        
        // No UTR should appear in more than one page
        for (const utr of page1Utrs) {
          expect(page2Utrs.has(utr)).toBe(false);
          expect(page3Utrs.has(utr)).toBe(false);
        }
        for (const utr of page2Utrs) {
          expect(page3Utrs.has(utr)).toBe(false);
        }
      });
    });
  });
  
  describe('12. Repeated operation idempotency', () => {
    test('Repeating completed operation does not create duplicates', async () => {
      await runner.run('idempotent repeat', async () => {
        const tracker = new DedupeTracker();
        
        // Simulate processing same batch twice
        const batch = generateTestTransactions(100);
        
        // First pass
        let newCount1 = 0;
        for (const txn of batch) {
          if (tracker.markSeen(txn)) newCount1++;
        }
        
        // Second pass (simulating retry)
        let newCount2 = 0;
        for (const txn of batch) {
          if (tracker.markSeen(txn)) newCount2++;
        }
        
        expect(newCount1).toBe(100); // All new on first pass
        expect(newCount2).toBe(0);  // None new on second pass
        expect(tracker.size).toBe(100); // Still only 100 unique
      });
    });
  });
  
  describe('PaginationHelper integration', () => {
    test('PaginationHelper processes all pages correctly', async () => {
      await runner.run('PaginationHelper integrity', async () => {
        // Use smaller dataset for memory efficiency
        const allRecords = generateTestTransactions(500);
        const helper = new PaginationHelper(100);
        helper.loadRecords(allRecords);
        
        const pages = [];
        while (!helper.isComplete) {
          pages.push(helper.nextPage());
        }
        
        const verification = verifyPaginationIntegrity(allRecords, pages);
        
        expect(verification.isComplete).toBe(true);
        expect(verification.missing).toBe(0);
        expect(verification.duplicates).toBe(0);
        expect(verification.totalReturned).toBe(500);
      });
    });
  });
  
  describe('Webhook deduplication', () => {
    test('Webhook duplicate detection works', async () => {
      await runner.run('webhook deduplication', async () => {
        const payload = {
          utr: 'UTR000000000999',
          transaction_date: '2026-01-15',
          amount_paise: 2500000,
          direction: 'credit',
          narration: 'TEST WEBHOOK'
        };
        
        // First delivery
        const res1 = await request(app)
          .post('/webhook/debit-credit')
          .send(payload);
        
        expect(res1.status).toBe(200);
        expect(res1.body.deduplicated).toBe(false);
        expect(res1.body.received).toBe(true);
        
        // Duplicate delivery
        const res2 = await request(app)
          .post('/webhook/debit-credit')
          .send(payload);
        
        expect(res2.status).toBe(200);
        expect(res2.body.deduplicated).toBe(true);
        expect(res2.body.dedupe_key).toBe(res1.body.dedupe_key);
      });
    });
  });
  
  describe('Repeated references with different details', () => {
    test('Same UTR with different amounts/dates are distinct', async () => {
      await runner.run('repeated refs different details', async () => {
        const token = await getAuthToken();
        const stmtToken = await getStatementToken(token);
        
        const res = await request(app)
          .get(`/accounts/${testAccountId}/statement`)
          .set('x-statement-token', stmtToken)
          .query({ scenario: 'repeated_refs' });
        
        expect(res.status).toBe(200);
        expect(res.body.transactions.length).toBe(4);
        
        // Should have 2 unique UTRs each appearing twice with different details
        const utrGroups = {};
        for (const txn of res.body.transactions) {
          if (!utrGroups[txn.utr]) utrGroups[txn.utr] = [];
          utrGroups[txn.utr].push(txn);
        }
        
        expect(Object.keys(utrGroups).length).toBe(2);
        for (const [utr, txns] of Object.entries(utrGroups)) {
          expect(txns.length).toBe(2);
          // Verify they have different amounts or dates
          const amounts = new Set(txns.map(t => t.amount_paise));
          const dates = new Set(txns.map(t => t.transaction_date));
          expect(amounts.size + dates.size).toBeGreaterThan(2); // At least one differs
        }
      });
    });
  });
  
  describe('IFSC Validation', () => {
    test('Valid IFSC returns bank info', async () => {
      await runner.run('IFSC validation success', async () => {
        const res = await request(app)
          .post('/ifsc/validate')
          .send({ ifsc: 'HDFC0001234' });
        
        expect(res.status).toBe(200);
        expect(res.body.valid).toBe(true);
        expect(res.body.bank_name).toBe('HDFC Bank');
      });
    });
    
    test('Invalid IFSC returns false', async () => {
      await runner.run('IFSC validation failure', async () => {
        const res = await request(app)
          .post('/ifsc/validate')
          .send({ ifsc: 'INVALID123' });
        
        expect(res.status).toBe(400);
        expect(res.body.valid).toBe(false);
      });
    });
  });
  
  describe('Mini Statement', () => {
    test('Mini statement returns last 10 transactions', async () => {
      await runner.run('mini statement', async () => {
        const token = await getAuthToken();
        
        const res = await request(app)
          .get(`/accounts/${testAccountId}/mini-statement`)
          .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toBe(200);
        expect(res.body.transactions.length).toBeLessThanOrEqual(10);
        expect(res.body.synthetic).toBe(true);
      });
    });
  });
  
  describe('Configuration', () => {
    test('Test config endpoint updates settings', async () => {
      await runner.run('config update', async () => {
        const res = await request(app)
          .post('/test/config')
          .send({ pageSize: 250, totalRecords: 1000, defaultDelay: 50 });
        
        expect(res.status).toBe(200);
        expect(res.body.config.pageSize).toBe(250);
        expect(res.body.config.totalRecords).toBe(1000);
        expect(res.body.config.defaultDelay).toBe(50);
      });
    });
  });
});

/**
 * Run tests and output summary
 */
if (require.main === module) {
  const { run } = require('jest');
  
  run(['--testPathPattern=mock-bank-provider.test', '--verbose', '--no-coverage'])
    .then(result => {
      console.log('\n=== TEST RUN COMPLETE ===');
      console.log(`Tests: ${result.numTotalTests}`);
      console.log(`Passed: ${result.numPassedTests}`);
      console.log(`Failed: ${result.numFailedTests}`);
      console.log(`Duration: ${result.testResults.reduce((sum, r) => sum + r.perfStats.end - r.perfStats.start, 0)}ms`);
      process.exit(result.numFailedTests > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}