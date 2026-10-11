/**
 * Test Utilities for Bank Integration Testing
 * 
 * Provides helper functions for deduplication, pagination, and scenario testing
 * These are SYNTHETIC test utilities - not production code.
 */

'use strict';

const crypto = require('crypto');

/**
 * Creates a deduplication key from transaction fields
 * @param {Object} txn - Transaction object
 * @returns {string} Deduplication key
 */
function makeDedupeKey(txn) {
  // Use UTR + direction + amount + value_date for deduplication
  // This matches the unique constraint on bank_transactions table
  const utr = txn.utr || txn.externalTransactionId || txn.reference || '';
  const direction = txn.direction || (txn.amount_paise < 0 ? 'debit' : 'credit');
  const amount = Math.abs(txn.amount_paise || txn.amount || 0);
  const date = txn.value_date || txn.transaction_date || txn.transactionDate || '';
  
  return `${utr}|${direction}|${amount}|${date}`;
}

/**
 * Simple in-memory deduplication tracker for tests
 */
class DedupeTracker {
  constructor() {
    this.seen = new Set();
    this.counts = new Map();
  }
  
  /**
   * Check if a transaction is a duplicate
   * @param {Object} txn - Transaction object
   * @returns {boolean} True if duplicate
   */
  isDuplicate(txn) {
    const key = makeDedupeKey(txn);
    return this.seen.has(key);
  }
  
  /**
   * Mark a transaction as seen
   * @param {Object} txn - Transaction object
   * @returns {boolean} True if this was a new transaction (not duplicate)
   */
  markSeen(txn) {
    const key = makeDedupeKey(txn);
    const isNew = !this.seen.has(key);
    this.seen.add(key);
    this.counts.set(key, (this.counts.get(key) || 0) + 1);
    return isNew;
  }
  
  /**
   * Get count of how many times a transaction was seen
   * @param {Object} txn - Transaction object
   * @returns {number}
   */
  getCount(txn) {
    const key = makeDedupeKey(txn);
    return this.counts.get(key) || 0;
  }
  
  /**
   * Reset the tracker
   */
  reset() {
    this.seen.clear();
    this.counts.clear();
  }
  
  /**
   * Get total unique transactions
   */
  get size() {
    return this.seen.size;
  }
}

/**
 * Pagination helper for testing
 */
class PaginationHelper {
  constructor(pageSize = 500) {
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.totalRecords = 0;
    this.allRecords = [];
  }
  
  /**
   * Load all records for pagination testing
   * @param {Array} records - All records to paginate
   */
  loadRecords(records) {
    this.allRecords = records;
    this.totalRecords = records.length;
    this.currentPage = 1;
  }
  
  /**
   * Get next page
   * @returns {Object} Page result with records and metadata
   */
  nextPage() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const records = this.allRecords.slice(start, end);
    const hasMore = end < this.totalRecords;
    
    const result = {
      records,
      page: this.currentPage,
      pageSize: this.pageSize,
      totalRecords: this.totalRecords,
      hasMore,
      startIndex: start,
      endIndex: Math.min(end, this.totalRecords)
    };
    
    if (hasMore) {
      this.currentPage++;
    }
    
    return result;
  }
  
  /**
   * Get a specific page
   * @param {number} page - Page number (1-indexed)
   * @returns {Object} Page result
   */
  getPage(page) {
    this.currentPage = page;
    return this.nextPage();
  }
  
  /**
   * Reset to first page
   */
  reset() {
    this.currentPage = 1;
  }
  
  /**
   * Check if all records have been retrieved
   * Returns true when the last page has already been fetched.
   * currentPage is the next page to fetch, so (currentPage - 1) is the last fetched page.
   */
  get isComplete() {
    return (this.currentPage - 1) * this.pageSize >= this.totalRecords;
  }
}

/**
 * Scenario runner for test scenarios
 */
class ScenarioRunner {
  constructor(mockProvider) {
    this.mockProvider = mockProvider;
    this.results = [];
  }
  
  /**
   * Run a scenario and record results
   * @param {string} name - Scenario name
   * @param {Function} fn - Async function to run
   * @returns {Promise<Object>} Result
   */
  async run(name, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      const record = { name, success: true, result, duration };
      this.results.push(record);
      return record;
    } catch (error) {
      const duration = Date.now() - start;
      const record = { name, success: false, error: error.message, duration };
      this.results.push(record);
      throw error;
    }
  }
  
  /**
   * Get all results
   */
  getResults() {
    return this.results;
  }
  
  /**
   * Print summary
   */
  printSummary() {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    console.log(`\n=== Scenario Summary ===`);
    console.log(`Total: ${this.results.length} | Passed: ${passed} | Failed: ${failed}`);
    this.results.forEach(r => {
      const status = r.success ? 'PASS' : 'FAIL';
      console.log(`  [${status}] ${r.name} (${r.duration}ms)`);
      if (!r.success) console.log(`    Error: ${r.error}`);
    });
  }
}

/**
 * Generate synthetic test transactions
 * @param {number} count - Number of transactions
 * @param {Object} options - Generation options
 * @returns {Array} Array of synthetic transactions
 */
function generateTestTransactions(count, options = {}) {
  const {
    startDate = '2026-01-01',
    accounts = ['test-account-001'],
    modes = ['NEFT', 'RTGS', 'IMPS', 'UPI'],
    directions = ['credit', 'debit'],
    counterparties = ['TEST CORP', 'VENDOR ABC', 'PAYROLL', 'TAX DEPT']
  } = options;
  
  const transactions = [];
  const baseDate = new Date(startDate);
  
  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + Math.floor(i / 10));
    
    const direction = directions[i % directions.length];
    const amount = (Math.floor(Math.random() * 50000) + 1) * 100; // 1 to 50,000 rupees in paise
    const mode = modes[i % modes.length];
    const counterparty = counterparties[i % counterparties.length];
    const account = accounts[i % accounts.length];
    
    transactions.push({
      utr: `UTR${String(i).padStart(12, '0')}`,
      transaction_date: date.toISOString().split('T')[0],
      value_date: date.toISOString().split('T')[0],
      amount_paise: amount,
      direction,
      narration: `${counterparty} - ${mode} - ${String(i).padStart(6, '0')}`,
      counterparty_name: counterparty,
      counterparty_account: `ACC${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      counterparty_ifsc: `IFSC${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      counterparty_bank: ['HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK'][Math.floor(Math.random() * 5)],
      mode,
      running_balance_paise: Math.floor(Math.random() * 100000000) + 1000000,
      account_id: account,
      raw_payload: { synthetic: true, index: i }
    });
  }
  
  return transactions;
}

/**
 * Verify pagination integrity - no skipped records
 * @param {Array} allRecords - All records that should have been returned
 * @param {Array} pages - Array of page results
 * @returns {Object} Verification result
 */
function verifyPaginationIntegrity(allRecords, pages) {
  const allReturned = pages.flatMap(p => p.records || p);
  const returnedIds = new Set(allReturned.map(r => r.utr || r.externalTransactionId || JSON.stringify(r)));
  const expectedIds = new Set(allRecords.map(r => r.utr || r.externalTransactionId || JSON.stringify(r)));
  
  const missing = [];
  for (const id of expectedIds) {
    if (!returnedIds.has(id)) missing.push(id);
  }
  
  const duplicates = [];
  const seen = new Set();
  for (const id of returnedIds) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  
  return {
    totalExpected: expectedIds.size,
    totalReturned: returnedIds.size,
    missing: missing.length,
    duplicates: duplicates.length,
    isComplete: missing.length === 0 && duplicates.length === 0,
    missingIds: missing.slice(0, 10),
    duplicateIds: duplicates.slice(0, 10)
  };
}

/**
 * Sleep utility for async tests
 * @param {number} ms - Milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  makeDedupeKey,
  DedupeTracker,
  PaginationHelper,
  ScenarioRunner,
  generateTestTransactions,
  verifyPaginationIntegrity,
  sleep
};