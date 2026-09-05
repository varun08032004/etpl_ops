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
  
  const cookie = loginRes.headers['set-cookie'][0];
  console.log('Cookie:', cookie);
  
  // Test one-time-registrations
  const regRes = await request(app).get('/api/one-time-registrations').set('Cookie', cookie);
  console.log('Registrations:', regRes.status, JSON.stringify(regRes.body, null, 2));
  
  // Test analytics
  const anRes = await request(app).get('/api/analytics').set('Cookie', cookie);
  console.log('Analytics:', anRes.status, JSON.stringify(anRes.body, null, 2));
  
  // Test documents
  const docRes = await request(app).get('/api/documents').set('Cookie', cookie);
  console.log('Documents:', docRes.status, JSON.stringify(docRes.body, null, 2));
  
  // Test staff-accounts
  const staffRes = await request(app).get('/api/staff-accounts').set('Cookie', cookie);
  console.log('Staff-accounts:', staffRes.status, JSON.stringify(staffRes.body, null, 2));
  
  // Test platform-sync
  const syncRes = await request(app).get('/api/platform-sync/records?month=8&year=2026').set('Cookie', cookie);
  console.log('Platform sync:', syncRes.status, JSON.stringify(syncRes.body, null, 2));
  
  pool.end();
  process.exit(0);
}

test().catch(e => { console.error(e); pool.end(); process.exit(1); });