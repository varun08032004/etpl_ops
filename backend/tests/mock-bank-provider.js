/**
 * Mock Bank Provider - Contract-neutral synthetic bank simulator
 * 
 * IMPORTANT: This is a GENERIC test utility. It does NOT implement the Axis Bank API.
 * All endpoints, fields, and behaviors are synthetic and for testing purposes only.
 * 
 * Supported scenarios (configurable via query params):
 * - success: Normal successful response
 * - empty: Empty transaction collection
 * - paginated: Multiple pages of synthetic transactions
 * - duplicate: Duplicate delivery of same event
 * - delayed: Delayed response
 * - timeout: Request timeout
 * - rate_limit: Rate-limit response (429)
 * - server_error: Transient server error (500/502/503)
 * - malformed_json: Invalid JSON response
 * - invalid_token: Expired or invalid synthetic token
 * - partial_failure: Failure mid-pagination
 * - repeated_refs: Repeated transaction references with different legitimate details
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10mb' }));

// In-memory state for the mock provider
const mockState = {
  // Synthetic token store: token -> { expiresAt, accountId, scope }
  tokens: new Map(),
  
  // Synthetic transaction store: accountId -> transaction[]
  transactions: new Map(),
  
  // Deduplication tracker for duplicate delivery testing
  deliveredEvents: new Set(),
  
  // Pagination state
  paginationCursors: new Map(),
  
  // Configuration
  config: {
    pageSize: 100,           // Records per page for pagination tests
    totalRecords: 500,      // Total synthetic records for pagination
    defaultDelay: 0,         // Delay in ms for delayed scenario
    timeoutMs: 5000,         // Request timeout
  }
};

// Initialize synthetic transactions
function generateSyntheticTransactions(accountId, count = 500) {
  const transactions = [];
  const baseDate = new Date('2026-01-01');
  const modes = ['NEFT', 'RTGS', 'IMPS', 'UPI'];
  const directions = ['credit', 'debit'];
  const counterpartyNames = [
    'ABC CORPORATION', 'XYZ ENTERPRISES', 'PAYROLL PROCESSING', 'VENDOR PAYMENTS',
    'TAX DEPARTMENT', 'UTILITY BILL', 'RENT PAYMENT', 'INSURANCE PREMIUM',
    'LOAN REPAYMENT', 'INTEREST CREDIT', 'DIVIDEND RECEIPT', 'REFUND PROCESSING'
  ];
  
  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + Math.floor(i / 10)); // ~10 transactions per day
    
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const amount = Math.floor(Math.random() * 5000000) + 1000; // 10 to 50,000 in paise
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const counterparty = counterpartyNames[Math.floor(Math.random() * counterpartyNames.length)];
    
    transactions.push({
      utr: `UTR${String(i).padStart(12, '0')}`,
      transaction_date: date.toISOString().split('T')[0],
      value_date: date.toISOString().split('T')[0],
      amount_paise: amount,
      direction,
      narration: `${counterparty} - ${mode} - Ref${String(i).padStart(6, '0')}`,
      counterparty_name: counterparty,
      counterparty_account: `ACC${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      counterparty_ifsc: `IFSC${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      counterparty_bank: ['HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK'][Math.floor(Math.random() * 5)],
      mode,
      running_balance_paise: Math.floor(Math.random() * 100000000) + 1000000,
      source: 'statement',
      raw_payload: { synthetic: true, index: i }
    });
  }
  
  return transactions;
}

// Initialize for a test account
function initAccount(accountId = 'test-account-001') {
  if (!mockState.transactions.has(accountId)) {
    mockState.transactions.set(accountId, generateSyntheticTransactions(accountId, mockState.config.totalRecords));
  }
  return accountId;
}

// Generate synthetic token
function generateToken(accountId) {
  const token = `mock_token_${crypto.randomBytes(16).toString('hex')}`;
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  mockState.tokens.set(token, { accountId, expiresAt, scope: 'statement' });
  return { token, expiresAt };
}

// Validate token
function validateToken(token) {
  const data = mockState.tokens.get(token);
  if (!data) return { valid: false, reason: 'Token not found' };
  if (Date.now() > data.expiresAt) {
    mockState.tokens.delete(token);
    return { valid: false, reason: 'Token expired' };
  }
  return { valid: true, accountId: data.accountId };
}

// Deduplication key for events
function makeDedupeKey(utr, type, hash) {
  return `${utr}|${type}|${hash}`;
}

// Check and mark delivered
function checkAndMarkDelivered(utr, type, hash) {
  const key = makeDedupeKey(utr, type, hash);
  const isDuplicate = mockState.deliveredEvents.has(key);
  if (!isDuplicate) {
    mockState.deliveredEvents.add(key);
  }
  return { isDuplicate, key };
}

// Reset mock state (for test isolation)
function resetMockState() {
  mockState.tokens.clear();
  mockState.transactions.clear();
  mockState.deliveredEvents.clear();
  mockState.paginationCursors.clear();
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mock-bank-provider', synthetic: true });
});

// Token generation (synthetic)
app.post('/auth/token', (req, res) => {
  const { account_id, grant_type, client_id, client_secret } = req.body;
  
  if (grant_type !== 'client_credentials') {
    return res.status(400).json({ error: 'Unsupported grant_type', synthetic: true });
  }
  
  if (!client_id || !client_secret) {
    return res.status(401).json({ error: 'Invalid client credentials', synthetic: true });
  }
  
  const accountId = account_id || 'test-account-001';
  initAccount(accountId);
  
  const { token, expiresAt } = generateToken(accountId);
  
  res.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: Math.floor((expiresAt - Date.now()) / 1000),
    synthetic: true
  });
});

// Account balance (synthetic)
app.get('/accounts/:accountId/balance', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header', synthetic: true });
  }
  
  const tokenValidation = validateToken(auth.slice(7));
  if (!tokenValidation.valid) {
    return res.status(401).json({ error: tokenValidation.reason, synthetic: true });
  }
  
  const accountId = req.params.accountId;
  const balancePaise = Math.floor(Math.random() * 500000000) + 10000000; // 1L to 50Cr
  
  res.json({
    account_id: accountId,
    balance_paise: balancePaise,
    available_balance_paise: balancePaise - Math.floor(Math.random() * 1000000),
    currency: 'INR',
    as_of: new Date().toISOString(),
    synthetic: true
  });
});

// Mini statement (synthetic)
app.get('/accounts/:accountId/mini-statement', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header', synthetic: true });
  }
  
  const tokenValidation = validateToken(auth.slice(7));
  if (!tokenValidation.valid) {
    return res.status(401).json({ error: tokenValidation.reason, synthetic: true });
  }
  
  const accountId = req.params.accountId;
  initAccount(accountId);
  
  const allTxns = mockState.transactions.get(accountId) || [];
  const recentTxns = allTxns.slice(0, 10).map(t => ({
    utr: t.utr,
    transaction_date: t.transaction_date,
    amount_paise: t.amount_paise,
    direction: t.direction,
    narration: t.narration,
    mode: t.mode,
    running_balance_paise: t.running_balance_paise
  }));
  
  res.json({
    account_id: accountId,
    transactions: recentTxns,
    synthetic: true
  });
});

// IFSC validation (synthetic)
app.post('/ifsc/validate', (req, res) => {
  const { ifsc } = req.body;
  if (!ifsc || ifsc.length !== 11) {
    return res.status(400).json({ valid: false, reason: 'Invalid IFSC format', synthetic: true });
  }
  
  // Synthetic validation: accept IFSC starting with known bank codes
  const validPrefixes = ['HDFC', 'ICIC', 'SBIN', 'UTIB', 'KKBK', 'YESB', 'INDL', 'BARB'];
  const prefix = ifsc.slice(0, 4).toUpperCase();
  const isValid = validPrefixes.includes(prefix);
  
  res.json({
    ifsc: ifsc.toUpperCase(),
    valid: isValid,
    bank_name: isValid ? `${prefix} Bank` : 'Unknown',
    branch: isValid ? 'Test Branch' : null,
    synthetic: true
  });
});

// Statement token generation (synthetic - 5 min TTL)
app.post('/statement/token', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header', synthetic: true });
  }
  
  const tokenValidation = validateToken(auth.slice(7));
  if (!tokenValidation.valid) {
    return res.status(401).json({ error: tokenValidation.reason, synthetic: true });
  }
  
  const { token, expiresAt } = generateToken(tokenValidation.accountId);
  
  res.json({
    statement_token: token,
    expires_in: Math.floor((expiresAt - Date.now()) / 1000),
    synthetic: true
  });
});

// Statement fetch (synthetic) - supports pagination, scenarios
app.get('/accounts/:accountId/statement', (req, res) => {
  const statementToken = req.headers['x-statement-token'] || req.query.statement_token;
  if (!statementToken) {
    return res.status(401).json({ error: 'Missing statement token', synthetic: true });
  }
  
  const tokenValidation = validateToken(statementToken);
  if (!tokenValidation.valid) {
    return res.status(401).json({ error: tokenValidation.reason, synthetic: true });
  }
  
  const accountId = req.params.accountId;
  const scenario = req.query.scenario || 'success';
  const page = parseInt(req.query.page || '1', 10);
  const pageSize = parseInt(req.query.page_size || String(mockState.config.pageSize), 10);
  const fromDate = req.query.from;
  const toDate = req.query.to;
  
  initAccount(accountId);
  const allTxns = mockState.transactions.get(accountId) || [];
  
  // Filter by date range if provided
  let filteredTxns = allTxns;
  if (fromDate || toDate) {
    filteredTxns = allTxns.filter(t => {
      if (fromDate && t.transaction_date < fromDate) return false;
      if (toDate && t.transaction_date > toDate) return false;
      return true;
    });
  }
  
  // Handle scenarios
  switch (scenario) {
    case 'empty':
      return res.json({ transactions: [], has_more: false, synthetic: true });
      
    case 'malformed_json':
      // Return invalid JSON - Express will handle this
      return res.status(200).send('{ invalid json }');
      
    case 'server_error':
      return res.status(500).json({ error: 'Internal server error', synthetic: true });
      
    case 'rate_limit':
      return res.status(429).json({ error: 'Rate limit exceeded', retry_after: 60, synthetic: true });
      
    case 'timeout':
      // Hang the request - test should timeout
      return new Promise(() => {}); // Never resolves
      
    case 'invalid_token':
      return res.status(401).json({ error: 'Invalid or expired statement token', synthetic: true });
      
    case 'partial_failure':
      // Fail on page 2
      if (page >= 2) {
        return res.status(502).json({ error: 'Bad gateway', synthetic: true });
      }
      break;
      
    case 'duplicate':
      // Return same transactions as page 1
      break;
      
    case 'repeated_refs':
      // Return transactions with same UTRs but different amounts/dates
      return res.json({
        transactions: [
          { utr: 'UTR000000000001', transaction_date: '2026-01-15', amount_paise: 10000, direction: 'credit', narration: 'Ref 1', synthetic: true },
          { utr: 'UTR000000000001', transaction_date: '2026-01-16', amount_paise: 20000, direction: 'debit', narration: 'Ref 1 duplicate', synthetic: true },
          { utr: 'UTR000000000002', transaction_date: '2026-01-15', amount_paise: 15000, direction: 'credit', narration: 'Ref 2', synthetic: true },
          { utr: 'UTR000000000002', transaction_date: '2026-01-16', amount_paise: 25000, direction: 'debit', narration: 'Ref 2 duplicate', synthetic: true },
        ],
        has_more: false,
        synthetic: true
      });
      
    default:
      // Normal success case
      break;
  }
  
  // Pagination
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageTxns = filteredTxns.slice(start, end);
  const hasMore = end < filteredTxns.length;
  
  // Simulate delay if configured
  if (mockState.config.defaultDelay > 0) {
    return setTimeout(() => {
      res.json({
        transactions: pageTxns,
        has_more: hasMore,
        page,
        page_size: pageSize,
        total_records: filteredTxns.length,
        synthetic: true
      });
    }, mockState.config.defaultDelay);
  }
  
  res.json({
    transactions: pageTxns,
    has_more: hasMore,
    page,
    page_size: pageSize,
    total_records: filteredTxns.length,
    synthetic: true
  });
});

// Debit/Credit Notification webhook (synthetic)
app.post('/webhook/debit-credit', (req, res) => {
  const payload = req.body;
  
  // Validate required fields
  const requiredFields = ['utr', 'transaction_date', 'amount_paise', 'direction', 'narration'];
  for (const field of requiredFields) {
    if (!payload[field]) {
      return res.status(400).json({ error: `Missing required field: ${field}`, synthetic: true });
    }
  }
  
  // Deduplication
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  const { isDuplicate, key } = checkAndMarkDelivered(payload.utr, 'debit_credit', hash);
  
  // In a real implementation, this would queue for processing
  // For testing, we just acknowledge
  res.json({
    received: true,
    deduplicated: isDuplicate,
    dedupe_key: key,
    synthetic: true
  });
});

// Config endpoint for test control
app.post('/test/config', (req, res) => {
  const { pageSize, totalRecords, defaultDelay, timeoutMs } = req.body;
  
  if (pageSize !== undefined) mockState.config.pageSize = pageSize;
  if (totalRecords !== undefined) mockState.config.totalRecords = totalRecords;
  if (defaultDelay !== undefined) mockState.config.defaultDelay = defaultDelay;
  if (timeoutMs !== undefined) mockState.config.timeoutMs = timeoutMs;
  
  res.json({ config: mockState.config, synthetic: true });
});

// Reset endpoint for test isolation
app.post('/test/reset', (req, res) => {
  resetMockState();
  initAccount('test-account-001');
  res.json({ status: 'reset', synthetic: true });
});

// Get state for debugging
app.get('/test/state', (req, res) => {
  res.json({
    accounts: Array.from(mockState.transactions.keys()),
    tokenCount: mockState.tokens.size,
    deliveredEvents: mockState.deliveredEvents.size,
    synthetic: true
  });
});

const PORT = process.env.MOCK_BANK_PORT || 5055;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[MockBankProvider] Listening on port ${PORT}`);
    console.log('[MockBankProvider] SYNTHETIC PROVIDER - NOT AXIS BANK API');
  });
}

module.exports = { app, mockState, generateToken, validateToken, checkAndMarkDelivered, resetMockState, initAccount, generateSyntheticTransactions };