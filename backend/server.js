'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Security headers - CSP and Permissions-Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // React dev needs unsafe-eval
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for React dev compatibility
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// Permissions-Policy header
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
    'interest-cohort=()',
  ].join(', '));
  next();
});

// CORS - Support multiple origins (dev + production)
const allowedOrigins = (process.env.INTERNAL_OPS_ALLOWED_ORIGIN || 'http://localhost:3001')
  .split(',')
  .map(o => o.trim());

// Also allow Vercel preview deployments and the production domain
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Allow Vercel preview deployments (*.vercel.app)
  if (origin.endsWith('.vercel.app')) return true;
  // Allow the production domain
  if (origin === 'https://ops.ethertrack.in') return true;
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
}));

app.use(cookieParser());

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Structured logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    if (res.statusCode >= 400) {
      console.warn('[HTTP]', JSON.stringify(log));
    } else {
      console.log('[HTTP]', JSON.stringify(log));
    }
  });
  next();
});

// Webhooks need raw body for signature verification — mount BEFORE express.json().
app.use('/api/payroll/webhooks/axis-payout', express.raw({ type: 'application/json' }));
app.use('/api/attendance/webhooks/trackpilot', express.raw({ type: 'application/json', limit: '50mb' }));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMIT_EXCEEDED' },
}));

app.get('/health', (req, res) => res.json({ ok: true, service: 'ethertrack-internal-ops' }));
app.get('/ready', (req, res) => res.json({ ok: true, service: 'ethertrack-internal-ops', ready: true }));

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
// routes/expenseClaims.js REMOVED from mounting — Finance.jsx exclusively calls
// /finance/expense-claims/* (routes/finance.js), which is the hardened,
// canonical implementation (row-lock on decide, receipt-upload flow,
// cross-level visibility). expenseClaims.js used a different data model
// (category_id FK + manager->finance flow vs. finance.js's category free-text
// + levels_required chain) and was still live and reachable even though
// nothing in the frontend used it — dead but exploitable duplicate code.
// The file itself is left in routes/ in case anything is worth porting from
// it, but do not re-mount it without reconciling the two expense_claims
// schemas/flows first.
app.use('/api/settings', require('./routes/settings')); // NEW — real Settings module (SRS §8.23): compliance rates, PT/tax slabs, app settings
app.use('/api/esignatures', require('./routes/esignatures')); // NEW — lightweight built-in e-signature (internal tracking + public /sign/:token links)
app.use('/api/admin', require('./routes/admin'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/one-time-registrations', require('./routes/oneTimeRegistrations'));
app.use('/api/certifications', require('./routes/certifications')); // NEW — closes SRS §8.14 certifications gap
app.use('/api/ip-assets', require('./routes/ipAssets')); // NEW — closes SRS §8.14 IP tracking gap
app.use('/api/data-governance', require('./routes/dataGovernance')); // NEW — closes SRS §8.14 data governance gap
app.use('/api/finance', require('./routes/finance'));
app.use('/api/finance/bills', require('./routes/bills')); // NEW — one-off vendor bills/expenses, surfaced as the "Expenses" tab inside Finance.jsx (distinct from routes/expenses.js's recurring flow)
app.use('/api/purchase-requests', require('./routes/purchaseRequests')); // FIXED — built but never mounted; Finance.jsx's Purchase Requests section 404'd on every call until this line was added
app.use('/api/bank-accounts', require('./routes/bankAccounts')); // FIXED — built but never mounted; the entire Bank Accounts page 404'd on every call until this line was added
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/platform-sync', require('./routes/platform-sync'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/agent', require('./routes/agent'));           // NEW — desktop agent: login, session start/heartbeat/stop, screenshots
app.use('/api/monitoring', require('./routes/monitoring'));  // NEW — dashboard side of the above: live view, day drilldown, productivity rules, settings
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
app.use('/api/marketing/coupon-performance', require('./routes/marketingCouponPerformance')); // NEW — Marketing module: coupon ROI/attribution
app.use('/api/marketing/blog', require('./routes/marketingBlog')); // was built but never mounted — no frontend page exists yet either, this just makes the API reachable
app.use('/api/partnerships/firms', require('./routes/partnershipFirms')); // NEW — Partnerships module: BDE target account tracker (CA/audit/ESG firms)
app.use('/api/partnerships/activities', require('./routes/partnershipActivities')); // NEW — Partnerships module: call log + follow-ups
app.use('/api/product/features', require('./routes/productFeatures')); // NEW — Product module: Roadmap page
app.use('/api/product/releases', require('./routes/productReleases')); // NEW — Product module: Releases / changelog page
app.use('/api/product/feedback', require('./routes/productFeedback')); // NEW — Product module: Feedback & Bugs page
app.use('/api/product/beta-users', require('./routes/productBetaUsers')); // NEW — Product module: Beta / Pilot Users page
app.use('/api/product/subscriptions', require('./routes/productSubscriptions')); // NEW — Product module: Subscriptions page (ethertrack.in plan visibility + Corporate renewal)
app.use('/api/product/pricing', require('./routes/productPricing')); // Product/Sales module: Starter/Growth dynamic pricing
app.use('/api/product/coupons', require('./routes/productCoupons')); // Product/Sales module: coupon codes (e.g. EARLYBIRD50)
app.use('/api/product/corporate-deals', require('./routes/corporateDeals')); // Product/Sales module: Corporate deal setup + installment invoicing
app.use('/api/support-tickets-view', require('./routes/supportTicketsView')); // NEW — Sales/CS module: read-only platform support ticket visibility
app.use('/api/analytics', require('./routes/analytics')); // NEW — MRR/ARR/Churn analytics dashboard
app.use('/api/renewals', require('./routes/renewals')); // NEW — Automated Renewal Workflow (120/90/60/30 day)
app.use('/api/churn-prediction', require('./routes/churnPrediction')); // NEW — AI Churn Prediction Model
app.use('/api/health-scores', require('./routes/healthScores')); // NEW — Customer Health Scores (composite)
app.use('/api/pipeline-analytics', require('./routes/pipelineAnalytics')); // NEW — Deal Velocity & Pipeline Analytics
app.use('/api/kpi-pack', require('./routes/kpiPack')); // NEW — Board-Ready KPI Pack (PDF)
app.use('/api/invoice-anomalies', require('./routes/invoiceAnomaly')); // NEW — Invoice Anomaly Detection
app.use('/api/vendor-intelligence', require('./routes/vendorIntelligence')); // NEW — Vendor Spend Intelligence
app.use('/api/referrals', require('./routes/referralTracking')); // NEW — Internal Referral Tracking
app.use('/api/fee-rules', require('./routes/platformFeeEngine')); // NEW — Dynamic Platform Fee/Commission Engine

// Global error handler (must be last middleware)
app.use(errorHandler);

const PORT = process.env.PORT || process.env.INTERNAL_OPS_PORT || 5050;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[internal-ops] listening on 0.0.0.0:${PORT}`);
  // Required here, AFTER the server starts listening, so a scheduler failing
  // to initialize doesn't prevent the API from coming up at all — each one
  // logs its own errors internally and degrades to "manual trigger only"
  // rather than crashing the process.
  require('./services/expenseScheduler');  // daily 06:00 — recurring expense sweep (built earlier, never wired in until now)
  require('./services/financeScheduler');  // daily 07:00 — budget alert check (same gap, same fix)
  require('./services/corporateDealsScheduler'); // daily 08:00 — Corporate deal installment reminders
  require('./services/churnAlertScheduler'); // daily 09:00 — paid→free downgrade alerts to Sales/CS
  require('./services/refundAlertScheduler'); // daily 09:30 — refunds needing a ledger reversal
  require('./services/agentStaleSessionCron'); // every 5 min — auto-close stale agent sessions
  require('./services/renewalWorkflow'); // daily 07:30 — automated renewal check (cron inside)
  require('./services/churnPrediction'); // weekly Mon 06:00 — AI churn scoring (cron inside)
  require('./services/healthScore'); // daily 05:00 — customer health scoring (cron inside)
  require('./services/slackBot'); // Slack bot for /mrr, /pipeline, /renewals, /approve-invoice
});

// Health check endpoint (no auth required - for keep-alive pings)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (must be last middleware)
app.use(errorHandler);