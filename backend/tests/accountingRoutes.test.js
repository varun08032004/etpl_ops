'use strict';

const request = require('supertest');
const express = require('express');
const multer = require('multer');

jest.mock('../db/pool', () => ({
  safeQuery: jest.fn(),
  withTransaction: jest.fn((fn) => fn({ query: jest.fn() })),
}));

jest.mock('../services/ledger', () => ({
  postJournalEntry: jest.fn(),
  reverseJournalEntry: jest.fn(),
  getTrialBalance: jest.fn(),
  getProfitAndLoss: jest.fn(),
  getBalanceSheet: jest.fn(),
  listFiscalPeriods: jest.fn(),
  createFiscalPeriod: jest.fn(),
  closeFiscalPeriod: jest.fn(),
  reopenFiscalPeriod: jest.fn(),
}));

jest.mock('../services/auditLog', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../middleware/auth', () => {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = 'test-secret-for-testing-only-64-characters-long-hex-string-here';
  
  return {
    authenticate: (req, res, next) => {
      if (!req.headers.authorization && !req.cookies?.internal_ops_token) {
        return res.status(401).json({ error: 'Not authenticated', code: 'NO_TOKEN' });
      }
      const token = req.headers.authorization?.startsWith('Bearer ') 
        ? req.headers.authorization.slice(7) 
        : req.cookies?.internal_ops_token;
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.staff = {
          id: decoded.sub || 'test-staff-id',
          email: decoded.email || 'finance@test.com',
          role: decoded.role || 'finance',
          employee_id: decoded.employee_id || 'test-emp-id',
          is_active: true,
          effectiveRoles: decoded.effectiveRoles || ['finance'],
          deptAccess: { grantedRoles: [] },
        };
        next();
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
      }
    },
    requireRole: (...allowedRoles) => (req, res, next) => {
      if (!req.staff) return res.status(401).json({ error: 'Not authenticated' });
      const effectiveRoles = req.staff.effectiveRoles || [];
      if (
        ['owner', 'admin'].includes(req.staff.role) ||
        allowedRoles.includes(req.staff.role) ||
        allowedRoles.some((r) => effectiveRoles.includes(r))
      ) {
        return next();
      }
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    },
    requireMFA: (req, res, next) => next()
  };
});

jest.mock('multer', () => {
  const multerMock = () => ({
    single: (fieldName) => (req, res, next) => {
      req.file = req.mockFile || null;
      next();
    },
  });
  multerMock.memoryStorage = () => ({});
  multerMock.MulterError = class MulterError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = 'MulterError';
    }
  };
  return multerMock;
});

const accountingRouter = require('../routes/accounting');
const { safeQuery, withTransaction } = require('../db/pool');
const { logAction } = require('../services/auditLog');
const ledger = require('../services/ledger');

const jwt = require('jsonwebtoken');
const JWT_SECRET = 'test-secret-for-testing-only-64-characters-long-hex-string-here';

function createTestApp(staff = null, authError = null) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (authError) {
    app.use((req, res, next) => {
      return res.status(authError.status || 401).json({ 
        error: authError.message || 'Authentication failed', 
        code: authError.code 
      });
    });
  }

  if (staff) {
    const token = jwt.sign({
      sub: staff.id,
      email: staff.email,
      role: staff.role,
      employee_id: staff.employee_id,
      effectiveRoles: staff.effectiveRoles,
    }, JWT_SECRET, { expiresIn: '1h' });
    
    app.use((req, res, next) => {
      req.headers.authorization = `Bearer ${token}`;
      next();
    });
  }

  app.use('/api/accounting', accountingRouter);

  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });

  return app;
}

describe('Accounting Routes', () => {
  let testApp;
  const mockSafeQuery = require('../db/pool').safeQuery;
  const mockWithTransaction = require('../db/pool').withTransaction;
  const mockLogAction = require('../services/auditLog').logAction;
  const mockPostJournalEntry = ledger.postJournalEntry;
  const mockReverseJournalEntry = ledger.reverseJournalEntry;
  const mockGetTrialBalance = ledger.getTrialBalance;
  const mockGetProfitAndLoss = ledger.getProfitAndLoss;
  const mockGetBalanceSheet = ledger.getBalanceSheet;
  const mockListFiscalPeriods = ledger.listFiscalPeriods;
  const mockCreateFiscalPeriod = ledger.createFiscalPeriod;
  const mockCloseFiscalPeriod = ledger.closeFiscalPeriod;
  const mockReopenFiscalPeriod = ledger.reopenFiscalPeriod;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSafeQuery.mockResolvedValue({ rows: [] });
    mockPostJournalEntry.mockResolvedValue({ id: 'test-je-id', entryNumber: 'JE-2024-000001' });
    mockReverseJournalEntry.mockResolvedValue({ id: 'test-reversal-id', entryNumber: 'JE-2024-000002' });
    mockGetTrialBalance.mockResolvedValue({ lines: [], totalDebit: 0, totalCredit: 0 });
    mockGetProfitAndLoss.mockResolvedValue({ income: [], expenses: [], totalIncome: 0, totalExpense: 0, netProfit: 0 });
    mockGetBalanceSheet.mockResolvedValue({ assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 });
    mockListFiscalPeriods.mockResolvedValue([]);
    mockCreateFiscalPeriod.mockResolvedValue({ id: 'test-period-id', label: 'Test Period' });
    mockCloseFiscalPeriod.mockResolvedValue({ period: { id: 'test-period-id', label: 'Test Period' }, journalEntry: { id: 'test-je-id' } });
    mockReopenFiscalPeriod.mockResolvedValue({ id: 'test-period-id', label: 'Test Period' });
    mockWithTransaction.mockImplementation(async (fn) => {
      const client = { query: mockSafeQuery };
      return fn(client);
    });

    testApp = createTestApp({
      id: 'finance-staff-id',
      email: 'finance@test.com',
      role: 'finance',
      employee_id: 'test-emp-id',
      is_active: true,
      effectiveRoles: ['finance'],
      deptAccess: { grantedRoles: [] },
    });
  });

  const validJournalEntry = {
    entry_date: '2024-01-15',
    narration: 'Test journal entry',
    lines: [
      { account_id: '11111111-1111-1111-1111-111111111111', debit: 100.00 },
      { account_id: '22222222-2222-2222-2222-222222222222', credit: 100.00 },
    ],
  };

  describe('Journal Entries', () => {
    test('POST /journal-entries creates a balanced entry', async () => {
      const response = await request(testApp)
        .post('/api/accounting/journal-entries')
        .send(validJournalEntry);

      expect(response.status).toBe(201);
      expect(response.body.journalEntry).toHaveProperty('id');
      expect(response.body.journalEntry).toHaveProperty('entryNumber');
      expect(mockPostJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          entryDate: '2024-01-15',
          source: 'manual',
          narration: 'Test journal entry',
          createdBy: 'finance-staff-id',
          lines: expect.arrayContaining([
            expect.objectContaining({ accountId: '11111111-1111-1111-1111-111111111111', debit: 100 }),
            expect.objectContaining({ accountId: '22222222-2222-2222-2222-222222222222', credit: 100 }),
          ]),
        })
      );
    });

    test('POST /journal-entries rejects unbalanced entry', async () => {
      const unbalancedEntry = {
        entry_date: '2024-01-15',
        narration: 'Unbalanced',
        lines: [
          { account_id: '11111111-1111-1111-1111-111111111111', debit: 100 },
          { account_id: '22222222-2222-2222-2222-222222222222', credit: 50 },
        ],
      };

      mockPostJournalEntry.mockRejectedValueOnce(new Error('Journal entry does not balance: debit=100 credit=50'));

      const response = await request(testApp)
        .post('/api/accounting/journal-entries')
        .send(unbalancedEntry);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Journal entry does not balance');
    });

    test('POST /journal-entries rejects entry with single line', async () => {
      const singleLineEntry = {
        entry_date: '2024-01-15',
        narration: 'Single line',
        lines: [
          { account_id: '11111111-1111-1111-1111-111111111111', debit: 100 },
        ],
      };

      mockPostJournalEntry.mockRejectedValueOnce(new Error('A journal entry needs at least 2 lines'));

      const response = await request(testApp)
        .post('/api/accounting/journal-entries')
        .send(singleLineEntry);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 2 lines');
    });

    test('POST /journal-entries rejects entry with zero-amount line', async () => {
      const zeroLineEntry = {
        entry_date: '2024-01-15',
        narration: 'Zero line',
        lines: [
          { account_id: '11111111-1111-1111-1111-111111111111', debit: 100 },
          { account_id: '22222222-2222-2222-2222-222222222222', credit: 0 },
        ],
      };

      mockPostJournalEntry.mockRejectedValueOnce(new Error('Every journal line needs a nonzero debit or credit'));

      const response = await request(testApp)
        .post('/api/accounting/journal-entries')
        .send(zeroLineEntry);

      expect(response.status).toBe(400);
      // Accept either the ledger service error or the route validation error
      expect(response.body.error).toMatch(/(nonzero debit or credit|at least 2 lines)/);
    });

    test('GET /journal-entries returns list of entries', async () => {
      mockSafeQuery.mockResolvedValueOnce({ 
        rows: [
          { 
            id: 'je-1', 
            entry_number: 'JE-2024-000001', 
            entry_date: '2024-01-15',
            source: 'manual',
            narration: 'Test entry',
            lines: [
              { account_id: '11111111-1111-1111-1111-111111111111', coa_code: '1000', coa_name: 'Cash', debit: '100.00', credit: '0.00' },
              { account_id: '22222222-2222-2222-2222-222222222222', coa_code: '2000', coa_name: 'Accounts Payable', debit: '0.00', credit: '100.00' }
            ]
          }
        ] 
      });

      const response = await request(testApp)
        .get('/api/accounting/journal-entries');

      expect(response.status).toBe(200);
      expect(response.body.journalEntries).toHaveLength(1);
      expect(response.body.journalEntries[0].entry_number).toBe('JE-2024-000001');
    });
  });

  describe('Fiscal Periods', () => {
    test('GET /fiscal-periods returns list', async () => {
      mockListFiscalPeriods.mockResolvedValueOnce([
        { id: 'fp-1', label: 'FY 2024', start_date: '2024-01-01', end_date: '2024-12-31', is_closed: false }
      ]);

      const response = await request(testApp)
        .get('/api/accounting/fiscal-periods');

      expect(response.status).toBe(200);
      expect(response.body.fiscalPeriods).toHaveLength(1);
    });

    test('POST /fiscal-periods creates new period', async () => {
      const response = await request(testApp)
        .post('/api/accounting/fiscal-periods')
        .send({ label: 'FY 2025', start_date: '2025-01-01', end_date: '2025-12-31' });

      expect(response.status).toBe(201);
      expect(response.body.fiscalPeriod).toHaveProperty('id');
    });

    test('POST /fiscal-periods validates required fields', async () => {
      const response = await request(testApp)
        .post('/api/accounting/fiscal-periods')
        .send({ label: 'FY 2025' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('label, start_date, and end_date are required');
    });

    test('POST /fiscal-periods/:id/close closes period', async () => {
      const ownerApp = createTestApp({
        id: 'owner-id',
        email: 'owner@test.com',
        role: 'owner',
        employee_id: 'emp-1',
        is_active: true,
        effectiveRoles: [],
        deptAccess: { grantedRoles: [] },
      });

      const response = await request(ownerApp)
        .post('/api/accounting/fiscal-periods/test-period-id/close');

      expect(response.status).toBe(200);
      expect(response.body.fiscalPeriod).toHaveProperty('id');
      expect(mockCloseFiscalPeriod).toHaveBeenCalledWith('test-period-id', { closedBy: 'owner-id' });
    });

    test('POST /fiscal-periods/:id/reopen reopens period', async () => {
      const ownerApp = createTestApp({
        id: 'owner-id',
        email: 'owner@test.com',
        role: 'owner',
        employee_id: 'emp-1',
        is_active: true,
        effectiveRoles: [],
        deptAccess: { grantedRoles: [] },
      });

      const response = await request(ownerApp)
        .post('/api/accounting/fiscal-periods/test-period-id/reopen');

      expect(response.status).toBe(200);
      expect(response.body.fiscalPeriod).toHaveProperty('id');
      expect(mockReopenFiscalPeriod).toHaveBeenCalledWith('test-period-id');
    });
  });

  describe('Reports', () => {
    test('GET /reports/trial-balance returns balanced report', async () => {
      mockGetTrialBalance.mockResolvedValueOnce({
        lines: [
          { code: '1000', name: 'Cash', type: 'asset', debit: 1000, credit: 0 },
          { code: '2000', name: 'Accounts Payable', type: 'liability', debit: 0, credit: 1000 }
        ],
        totalDebit: 1000,
        totalCredit: 1000
      });

      const response = await request(testApp)
        .get('/api/accounting/reports/trial-balance');

      expect(response.status).toBe(200);
      expect(response.body.totalDebit).toBe(response.body.totalCredit);
    });

    test('GET /reports/profit-and-loss requires from and to params', async () => {
      const response = await request(testApp)
        .get('/api/accounting/reports/profit-and-loss');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('from and to query params are required');
    });

    test('GET /reports/profit-and-loss returns P&L report', async () => {
      mockGetProfitAndLoss.mockResolvedValueOnce({
        income: [{ code: '4100', name: 'Subscription Revenue', amount: 10000 }],
        expenses: [{ code: '5100', name: 'Salaries', amount: 5000 }],
        totalIncome: 10000,
        totalExpense: 5000,
        netProfit: 5000
      });

      const response = await request(testApp)
        .get('/api/accounting/reports/profit-and-loss?from=2024-01-01&to=2024-12-31');

      expect(response.status).toBe(200);
      expect(response.body.totalIncome).toBe(10000);
      expect(response.body.totalExpense).toBe(5000);
      expect(response.body.netProfit).toBe(5000);
    });

    test('GET /reports/balance-sheet returns balance sheet', async () => {
      mockGetBalanceSheet.mockResolvedValueOnce({
        assets: [{ code: '1000', name: 'Cash', amount: 10000 }],
        liabilities: [{ code: '2000', name: 'Accounts Payable', amount: 5000 }],
        equity: [{ code: '3000', name: 'Retained Earnings', amount: 5000 }],
        totalAssets: 10000,
        totalLiabilities: 5000,
        totalEquity: 5000
      });

      const response = await request(testApp)
        .get('/api/accounting/reports/balance-sheet?as_of=2024-12-31');

      expect(response.status).toBe(200);
      expect(response.body.totalAssets).toBe(response.body.totalLiabilities + response.body.totalEquity);
    });
  });

  describe('Authorization', () => {
    test('POST /journal-entries requires finance role', async () => {
      const employeeApp = createTestApp({
        id: 'employee-id',
        email: 'employee@test.com',
        role: 'employee',
        employee_id: 'emp-1',
        is_active: true,
        effectiveRoles: [],
        deptAccess: { grantedRoles: [] },
      });

      const response = await request(employeeApp)
        .post('/api/accounting/journal-entries')
        .send(validJournalEntry);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions for this action');
    });

    test('GET /reports/trial-balance requires finance role', async () => {
      const employeeApp = createTestApp({
        id: 'employee-id',
        email: 'employee@test.com',
        role: 'employee',
        employee_id: 'emp-1',
        is_active: true,
        effectiveRoles: [],
        deptAccess: { grantedRoles: [] },
      });

      const response = await request(employeeApp)
        .get('/api/accounting/reports/trial-balance');

      expect(response.status).toBe(403);
    });

    test('POST /fiscal-periods/:id/close requires owner/admin only', async () => {
      const financeApp = createTestApp({
        id: 'finance-id',
        email: 'finance@test.com',
        role: 'finance',
        employee_id: 'emp-1',
        is_active: true,
        effectiveRoles: ['finance'],
        deptAccess: { grantedRoles: [] },
      });

      const response = await request(financeApp)
        .post('/api/accounting/fiscal-periods/test-period-id/close');

      expect(response.status).toBe(403);
    });

    test('POST /fiscal-periods/:id/close allows owner', async () => {
      const ownerApp = createTestApp({
        id: 'owner-id',
        email: 'owner@test.com',
        role: 'owner',
        employee_id: 'emp-1',
        is_active: true,
        effectiveRoles: [],
        deptAccess: { grantedRoles: [] },
      });

      const response = await request(ownerApp)
        .post('/api/accounting/fiscal-periods/test-period-id/close');

      expect(response.status).toBe(200);
    });
  });
});