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
app.use('/api/teams', require('./routes/teams'));
app.use('/api/designations', require('./routes/designations'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/recruitment', require('./routes/recruitment'));
app.use('/api/performance', require('./routes/performance'));
app.use('/api/import', require('./routes/import'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/document-templates', require('./routes/document-templates'));
app.use('/api/document-engine', require('./routes/document-engine'));
app.use('/api/document-verify', require('./routes/document-verify')); // public, no auth — QR code target
app.use('/api/sales', require('./routes/sales'));
app.use('/api/automation', require('./routes/automation'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/expense-claims', require('./routes/expenseClaims')); // NEW — employee reimbursement claims, distinct from routes/expenses.js's recurring company bills
app.use('/api/settings', require('./routes/settings')); // NEW — real Settings module (SRS §8.23): compliance rates, PT/tax slabs, app settings
app.use('/api/esignatures', require('./routes/esignatures')); // NEW — lightweight built-in e-signature (internal tracking + public /sign/:token links)
app.use('/api/admin', require('./routes/admin'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/one-time-registrations', require('./routes/oneTimeRegistrations'));
app.use('/api/certifications', require('./routes/certifications')); // NEW — closes SRS §8.14 certifications gap
app.use('/api/ip-assets', require('./routes/ipAssets')); // NEW — closes SRS §8.14 IP tracking gap
app.use('/api/data-governance', require('./routes/dataGovernance')); // NEW — closes SRS §8.14 data governance gap
app.use('/api/finance', require('./routes/finance'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/platform-sync', require('./routes/platform-sync'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/marketing/social-accounts', require('./routes/marketingSocial')); // NEW — Marketing module: Socials portfolio page
app.use('/api/marketing/campaigns', require('./routes/marketingCampaigns')); // NEW — Marketing module: Campaigns page
app.use('/api/marketing/content-calendar', require('./routes/marketingContent')); // NEW — Marketing module: Content Calendar page
app.use('/api/marketing/brand-assets', require('./routes/marketingAssets')); // NEW — Marketing module: Brand Assets page
app.use('/api/marketing/leads', require('./routes/marketingLeads')); // NEW — Marketing module: Leads page (converts into CRM parties)
app.use('/api/marketing/competitors', require('./routes/marketingCompetitors')); // NEW — Marketing module: Competitor tracker page
app.use('/api/marketing/events', require('./routes/marketingEvents')); // NEW — Marketing module: Events & Webinars page
app.use('/api/marketing/press', require('./routes/marketingPress')); // NEW — Marketing module: Press & Media page
app.use('/api/marketing/newsletter', require('./routes/marketingNewsletter')); // NEW — Marketing module: Newsletter/Email tracker page
app.use('/api/marketing/seo', require('./routes/marketingSeo')); // NEW — Marketing module: SEO/website analytics page
app.use('/api/marketing/dashboard', require('./routes/marketingDashboard')); // NEW — Marketing module: Dashboard overview page
app.use('/api/partnerships/firms', require('./routes/partnershipFirms')); // NEW — Partnerships module: BDE target account tracker (CA/audit/ESG firms)
app.use('/api/partnerships/activities', require('./routes/partnershipActivities')); // NEW — Partnerships module: call log + follow-ups

app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.INTERNAL_OPS_PORT || 5050;
app.listen(PORT, () => console.log(`[internal-ops] listening on :${PORT}`));