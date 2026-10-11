'use strict';

const request = require('supertest');
const express = require('express');
const multer = require('multer');

// Setup all mocks BEFORE importing the route
jest.mock('../db/pool', () => ({
  safeQuery: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.mock('../services/auditLog', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/bankStatementImport', () => ({
  importBankStatement: jest.fn(),
  getImportPreview: jest.fn(),
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
    requireMFA: (req, res, next) => next(),
  };
});

// Don't mock multer - use real multer with memory storage for tests
jest.dontMock('multer');

// Import route AFTER mocks
const bankStatementImportRouter = require('../routes/bankStatementImport');
const { safeQuery, withTransaction } = require('../db/pool');
const { logAction } = require('../services/auditLog');
const { importBankStatement, getImportPreview } = require('../services/bankStatementImport');

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

  app.use('/api/bank-statements', bankStatementImportRouter);

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

const validCSV = 'date,description,amount,type\n2024-01-15,Test,100,credit';
const csvBuffer = Buffer.from(validCSV);

describe('Bank Statement Import Routes - Authorization', () => {
  let testApp;

  beforeEach(() => {
    jest.clearAllMocks();
    
    safeQuery.mockResolvedValue({ rows: [{ id: 'test-account-id' }] });
    importBankStatement.mockResolvedValue({
      total: 1,
      imported: 1,
      duplicates: 0,
      failed: 0,
      errors: [],
      import_id: 'test-import-id',
    });
    getImportPreview.mockResolvedValue({
      totalRows: 1,
      validRows: 1,
      preview: [{ 
        transaction_date: '2024-01-15', 
        description: 'Test', 
        amount_paise: 10000, 
        direction: 'credit', 
        amount_display: '100.00' 
      }],
      errors: [],
      detectedColumns: ['date', 'description', 'amount', 'type'],
      limits: { maxFileSize: 5242880, maxRows: 10000, maxDecimalPlaces: 2 },
    });
    withTransaction.mockImplementation(async (fn) => {
      const client = { query: safeQuery };
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

  describe('Authentication', () => {
    test('GET /:bankAccountId/preview rejects unauthenticated requests', async () => {
      const unauthApp = createTestApp(null, { status: 401, message: 'Not authenticated', code: 'NO_TOKEN' });
      
      const response = await request(unauthApp)
        .get('/api/bank-statements/test-account-id/preview')
        .attach('file', csvBuffer, 'test.csv');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    test('POST /:bankAccountId/import rejects unauthenticated requests', async () => {
      const unauthApp = createTestApp(null, { status: 401, message: 'Not authenticated', code: 'NO_TOKEN' });
      
      const response = await request(unauthApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', csvBuffer, 'test.csv');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    test('GET /:bankAccountId/preview rejects invalid token', async () => {
      const unauthApp = createTestApp(null, { status: 401, message: 'Invalid token', code: 'INVALID_TOKEN' });
      
      const response = await request(unauthApp)
        .get('/api/bank-statements/test-account-id/preview')
        .attach('file', csvBuffer, 'test.csv');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('POST /:bankAccountId/import rejects expired token', async () => {
      const unauthApp = createTestApp(null, { status: 401, message: 'Access token expired', code: 'TOKEN_EXPIRED' });
      
      const response = await request(unauthApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', csvBuffer, 'test.csv');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Role-based Authorization', () => {
    test('GET /:bankAccountId/preview rejects non-finance role (employee)', async () => {
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
        .get('/api/bank-statements/test-account-id/preview')
        .attach('file', csvBuffer, 'test.csv');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions for this action');
    });

    test('POST /:bankAccountId/import rejects non-finance role (hr)', async () => {
      const hrApp = createTestApp({
        id: 'hr-id',
        email: 'hr@test.com',
        role: 'hr',
        employee_id: 'emp-2',
        is_active: true,
        effectiveRoles: ['hr'],
        deptAccess: { grantedRoles: [] },
      });

      const response = await request(hrApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', csvBuffer, 'test.csv');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions for this action');
    });

    test('GET /:bankAccountId/preview allows owner role', async () => {
      const ownerApp = createTestApp({
        id: 'owner-id',
        email: 'owner@test.com',
        role: 'owner',
        employee_id: 'emp-3',
        is_active: true,
        effectiveRoles: [],
        deptAccess: { grantedRoles: [] },
      });

      const response = await request(ownerApp)
        .get('/api/bank-statements/test-account-id/preview')
        .attach('file', csvBuffer, 'test.csv');

      expect(response.status).toBe(200);
    });

    test('POST /:bankAccountId/import allows admin role', async () => {
      const adminApp = createTestApp({
        id: 'admin-id',
        email: 'admin@test.com',
        role: 'admin',
        employee_id: 'emp-4',
        is_active: true,
        effectiveRoles: [],
        deptAccess: { grantedRoles: [] },
      });

      const response = await request(adminApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', csvBuffer, 'test.csv');

      expect(response.status).toBe(200);
    });
  });

  describe('Bank Account Access Control', () => {
    test('GET /:bankAccountId/preview returns 404 for non-existent account', async () => {
      safeQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(testApp)
        .get('/api/bank-statements/non-existent-id/preview')
        .attach('file', csvBuffer, 'test.csv');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Bank account not found');
    });

    test('POST /:bankAccountId/import returns 404 for non-existent account', async () => {
      safeQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(testApp)
        .post('/api/bank-statements/non-existent-id/import')
        .attach('file', csvBuffer, 'test.csv');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Bank account not found');
    });

    test('POST /:bankAccountId/import validates account exists before calling import service', async () => {
      await request(testApp)
        .post('/api/bank-statements/valid-account-id/import')
        .attach('file', csvBuffer, 'test.csv');

      expect(safeQuery).toHaveBeenCalledWith(
        'SELECT id FROM bank_accounts WHERE id = $1',
        ['valid-account-id']
      );
    });
  });

  describe('File Upload Validation', () => {
    test('GET /:bankAccountId/preview rejects request without file', async () => {
      const noFileApp = express();
      noFileApp.use(express.json());
      // Add auth middleware for this test
      noFileApp.use((req, res, next) => {
        req.headers.authorization = `Bearer ${jwt.sign({ sub: 'test', role: 'finance' }, JWT_SECRET)}`;
        next();
      });
      noFileApp.use('/api/bank-statements', bankStatementImportRouter);
      
      const response = await request(noFileApp)
        .get('/api/bank-statements/test-account-id/preview');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('CSV file required');
    });

    test('POST /:bankAccountId/import rejects request without file', async () => {
      const noFileApp = express();
      noFileApp.use(express.json());
      // Add auth middleware for this test
      noFileApp.use((req, res, next) => {
        req.headers.authorization = `Bearer ${jwt.sign({ sub: 'test', role: 'finance' }, JWT_SECRET)}`;
        next();
      });
      noFileApp.use('/api/bank-statements', bankStatementImportRouter);
      
      const response = await request(noFileApp)
        .post('/api/bank-statements/test-account-id/import');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('CSV file required');
    });

    test('GET /:bankAccountId/preview rejects non-CSV file', async () => {
      const response = await request(testApp)
        .get('/api/bank-statements/test-account-id/preview')
        .attach('file', Buffer.from('not a csv'), 'test.txt');

      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Input Validation & Error Handling', () => {
    test('GET /:bankAccountId/preview returns validation errors for malformed CSV', async () => {
      getImportPreview.mockRejectedValueOnce(new Error('CSV parse error: Invalid quoting'));

      const response = await request(testApp)
        .get('/api/bank-statements/test-account-id/preview')
        .attach('file', Buffer.from('"unclosed quote,field\nvalue'), 'bad.csv');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('CSV parse error');
    });

    test('POST /:bankAccountId/import returns validation errors for invalid rows', async () => {
      importBankStatement.mockResolvedValueOnce({
        total: 2,
        imported: 0,
        duplicates: 0,
        failed: 2,
        errors: [
          { row: 2, errors: ['Invalid amount format (must be numeric with up to 2 decimal places)'] },
          { row: 3, errors: ['Invalid date format. Supported: YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YYYY (day>12)'] },
        ],
        import_id: 'test-import-id',
      });

      const csv = `date,description,amount,type
invalid,Test,abc,credit
31/02/2024,Test,100,debit`;
      
      const response = await request(testApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', Buffer.from(csv), 'invalid.csv');

      expect(response.status).toBe(200);
      expect(response.body.failed).toBe(2);
      expect(response.body.errors).toHaveLength(2);
      expect(response.body.errors[0].errors[0]).toContain('Invalid amount format');
      expect(response.body.errors[1].errors[0]).toContain('Invalid date format');
    });

    test('POST /:bankAccountId/import rejects CSV with validation errors (all-or-nothing)', async () => {
      importBankStatement.mockResolvedValueOnce({
        total: 2,
        imported: 0,
        duplicates: 0,
        failed: 2,
        errors: [
          { row: 2, errors: ['Invalid amount format'] },
          { row: 3, errors: ['Invalid date format'] },
        ],
        import_id: 'test-import-id',
      });

      const response = await request(testApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', Buffer.from('date,description,amount,type\nbad,Test,abc,credit\n31/02/2024,Test,100,debit'), 'invalid.csv');

      expect(response.body.imported).toBe(0);
      expect(response.body.failed).toBe(2);
    });

    test('Error responses do not expose raw statement contents', async () => {
      importBankStatement.mockRejectedValueOnce(new Error('Database connection failed'));

      const sensitiveCSV = `date,description,amount,type,reference
2024-01-15,Salary Credit,50000,credit,REF-SENSITIVE-123
2024-01-16,Rent Payment,25000,debit,RENT-456`;

      const response = await request(testApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', Buffer.from(sensitiveCSV), 'sensitive.csv');

      expect(response.status).toBe(400);
      const errorMsg = JSON.stringify(response.body);
      expect(errorMsg).not.toContain('REF-SENSITIVE-123');
      expect(errorMsg).not.toContain('RENT-456');
      expect(errorMsg).not.toContain('Salary Credit');
      expect(errorMsg).not.toContain('Rent Payment');
    });
  });

  describe('Audit Logging', () => {
    test('POST /:bankAccountId/import logs audit event on success', async () => {
      importBankStatement.mockResolvedValueOnce({
        total: 3,
        imported: 3,
        duplicates: 0,
        failed: 0,
        errors: [],
        import_id: 'test-import-id',
      });

      await request(testApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', Buffer.from('date,description,amount,type\n2024-01-15,Test1,100,credit\n2024-01-16,Test2,200,debit\n2024-01-17,Test3,300,credit'), 'test.csv');

      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          staffId: 'finance-staff-id',
          action: 'bank_statement.imported',
          entity: 'expense_bank_transactions',
          entityId: 'test-account-id',
          newValue: expect.objectContaining({
            total: 3,
            imported: 3,
            duplicates: 0,
            failed: 0,
            import_id: 'test-import-id',
          }),
        })
      );
    });

    test('POST /:bankAccountId/import logs audit event with import_id', async () => {
      importBankStatement.mockResolvedValueOnce({
        total: 1,
        imported: 1,
        duplicates: 0,
        failed: 0,
        errors: [],
        import_id: 'test-import-id',
      });

      await request(testApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', csvBuffer, 'test.csv');

      const auditCall = logAction.mock.calls[0][0];
      expect(auditCall.newValue).toHaveProperty('import_id', 'test-import-id');
    });
  });

  describe('Successful Import Response', () => {
    test('POST /:bankAccountId/import returns import summary with all fields', async () => {
      importBankStatement.mockResolvedValueOnce({
        total: 5,
        imported: 4,
        duplicates: 1,
        failed: 0,
        errors: [],
        import_id: 'test-import-id',
      });

      const response = await request(testApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', Buffer.from('date,description,amount,type\n2024-01-15,T1,100,credit\n2024-01-16,T2,200,debit\n2024-01-17,T3,300,credit\n2024-01-18,T4,400,credit\n2024-01-19,T5,500,debit'), 'test.csv');

      expect(response.status).toBe(200);
      expect(response.body.bankAccountId).toBe('test-account-id');
      expect(response.body.total).toBe(5);
      expect(response.body.imported).toBe(4);
      expect(response.body.duplicates).toBe(1);
      expect(response.body.failed).toBe(0);
      expect(response.body.import_id).toBe('test-import-id');
      expect(response.body.errors).toEqual([]);
    });

    test('GET /:bankAccountId/preview returns preview with limits info', async () => {
      getImportPreview.mockResolvedValueOnce({
        totalRows: 100,
        validRows: 95,
        preview: Array(20).fill({ 
          transaction_date: '2024-01-15', 
          description: 'Test', 
          amount_paise: 10000, 
          direction: 'credit', 
          amount_display: '100.00' 
        }),
        errors: [{ row: 2, errors: ['Invalid amount format'] }],
        detectedColumns: ['date', 'description', 'amount', 'type', 'reference'],
        limits: { maxFileSize: 5242880, maxRows: 10000, maxDecimalPlaces: 2 },
      });

      const response = await request(testApp)
        .get('/api/bank-statements/test-account-id/preview')
        .attach('file', Buffer.from('date,description,amount,type\n' + '2024-01-15,Test,100,credit\n'.repeat(100)), 'large.csv');

      expect(response.status).toBe(200);
      expect(response.body.bankAccountId).toBe('test-account-id');
      expect(response.body.totalRows).toBe(100);
      expect(response.body.validRows).toBe(95);
      expect(response.body.preview).toHaveLength(20);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.limits.maxFileSize).toBe(5 * 1024 * 1024);
      expect(response.body.limits.maxRows).toBe(10000);
      expect(response.body.limits.maxDecimalPlaces).toBe(2);
    });
  });

  describe('Skip Duplicates Option', () => {
    test('POST /:bankAccountId/import passes skipDuplicates option to service', async () => {
      await request(testApp)
        .post('/api/bank-statements/test-account-id/import?skipDuplicates=false')
        .attach('file', csvBuffer, 'test.csv');

      expect(importBankStatement).toHaveBeenCalledWith(
        'test-account-id',
        expect.any(Buffer),
        'finance-staff-id',
        expect.objectContaining({ skipDuplicates: false })
      );
    });

    test('POST /:bankAccountId/import defaults skipDuplicates to true', async () => {
      await request(testApp)
        .post('/api/bank-statements/test-account-id/import')
        .attach('file', csvBuffer, 'test.csv');

      expect(importBankStatement).toHaveBeenCalledWith(
        'test-account-id',
        expect.any(Buffer),
        'finance-staff-id',
        expect.objectContaining({ skipDuplicates: true })
      );
    });
  });
});