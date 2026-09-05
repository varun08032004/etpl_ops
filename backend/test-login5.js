require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());
const cookieParser = require('cookie-parser');
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/one-time-registrations', require('./routes/oneTimeRegistrations'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/staff-accounts', require('./routes/staff-accounts'));
app.use('/api/platform-sync', require('./routes/platform-sync'));
app.use('/api/sales', require('./routes/sales'));

const request = require('supertest');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function test() {
  // Login with founder credentials
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'founder@ethertrack.in', password: 'admin1234' });
  console.log('Login status:', loginRes.status);
  console.log('Login body:', loginRes.body);
  console.log('Login headers:', loginRes.headers);
  
  pool.end();
  process.exit(0);
}

test().catch(e => { console.error(e); pool.end(); process.exit(1); });