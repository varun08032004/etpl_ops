// Test setup file - runs before each test file
const { Pool } = require('pg');

// Use a test database URL - defaults to a test database
process.env.TEST_DB_URL = process.env.TEST_DB_URL || 'postgresql://postgres:postgres@localhost:5432/etpl_ops_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-testing-only';
process.env.INTERNAL_OPS_JWT_SECRET = process.env.INTERNAL_OPS_JWT_SECRET || 'test-secret-for-testing-only';
process.env.INTERNAL_OPS_REFRESH_SECRET = process.env.INTERNAL_OPS_REFRESH_SECRET || 'test-secret-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.COMPANY_STATE = 'Maharashtra';

// Global test pool
global.testPool = new Pool({ connectionString: process.env.TEST_DB_URL });

// Helper to sign JWT tokens for testing
global.signTestToken = (payload = {}) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { sub: payload.userId || 'test-user-id', role: payload.role || 'finance', employee_id: payload.employee_id || null },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
};

// Clean up after all tests
afterAll(async () => {
  if (global.testPool) {
    await global.testPool.end();
  }
});

// Helper to create a test app with proper middleware
global.createTestApp = async (pool = global.testPool) => {
  const express = require('express');
  const cookieParser = require('cookie-parser');
  
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  // Mock authenticate middleware
  app.use((req, res, next) => {
    const token = req.cookies?.internal_ops_token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.staff = { 
        id: decoded.sub, 
        role: decoded.role, 
        employee_id: decoded.employee_id,
        effectiveRoles: decoded.effectiveRoles || [],
        deptAccess: {}
      };
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  });
  
  return app;
};

// Helper to run SQL file
global.runSqlFile = async (filePath, pool = global.testPool) => {
  const fs = require('fs');
  const path = require('path');
  const fullPath = path.resolve(__dirname, '..', filePath);
  const sql = fs.readFileSync(fullPath, 'utf8');
  await pool.query(sql);
};