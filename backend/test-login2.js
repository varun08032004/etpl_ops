require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Add debug logging for all routes
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use(require('./routes/auth'));

const request = require('supertest');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function test() {
  // Login
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'test@test.com', password: 'test123' });
  console.log('Login status:', loginRes.status);
  console.log('Login body:', loginRes.body);
  console.log('Login headers:', loginRes.headers);
  
  pool.end();
  process.exit(0);
}

test().catch(e => { console.error(e); pool.end(); process.exit(1); });