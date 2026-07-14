'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.INTERNAL_OPS_ALLOWED_ORIGIN, credentials: true }));
app.use(cookieParser());

// Webhooks need raw body for signature verification — mount BEFORE express.json()
app.use('/api/payroll/webhooks/razorpay-payout', express.raw({ type: 'application/json' }));
app.use('/api/attendance/webhooks/trackpilot', express.raw({ type: 'application/json', limit: '50mb' }));

app.use(express.json());

app.set('trust proxy', 1); // needed so express-rate-limit doesn't choke on X-Forwarded-For locally

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

app.get('/health', (req, res) => res.json({ ok: true, service: 'ethertrack-internal-ops' }));

app.use('/api/auth', require('./routes/auth'));               // TODO: login route (bcrypt compare -> signToken)
app.use('/api/employees', require('./routes/employees'));
app.use('/api/parties', require('./routes/parties'));
app.use('/api/staff-accounts', require('./routes/staff-accounts'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/import', require('./routes/import'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/automation', require('./routes/automation'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/platform-sync', require('./routes/platform-sync'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/attendance', require('./routes/attendance'));

app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.INTERNAL_OPS_PORT || 5050;
app.listen(PORT, () => console.log(`[internal-ops] listening on :${PORT}`));