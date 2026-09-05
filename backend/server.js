'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
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
const allowedOrigins = (process.env.INTERNAL_OPS_ALLOWED_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001')
  .split(',')
  .map(o => o.trim());

// Also allow Vercel preview deployments and the production domain
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  // Normalize: remove trailing slash
  const normalized = origin.replace(/\/$/, '');
  if (allowedOrigins.includes(normalized)) return true;
  // Allow Vercel preview deployments (*.vercel.app)
  if (normalized.endsWith('.vercel.app')) return true;
  // Allow the production domain
  if (normalized === 'https://ops.ethertrack.in') return true;
  // Allow local React dev server (127.0.0.1 variant) and common Vite port
  if (normalized === 'http://127.0.0.1:3001' || normalized === 'http://localhost:3000' || normalized === 'http://127.0.0.1:3000' || normalized === 'http://localhost:5173' || normalized === 'http://127.0.0.1:5173') return true;
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    // Normalize origin by removing trailing slash for comparison
    const normalizedOrigin = origin?.replace(/\/$/, '');
    console.log('[CORS DEBUG] Origin received:', origin, '-> normalized:', normalizedOrigin);
    console.log('[CORS DEBUG] Allowed origins:', allowedOrigins);
    console.log('[CORS DEBUG] isAllowedOrigin result:', isAllowedOrigin(normalizedOrigin));
    if (!normalizedOrigin) return callback(null, true);
    if (isAllowedOrigin(normalizedOrigin)) return callback(null, true);
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

// Structured HTTP logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    if (res.statusCode >= 400) {
      console.warn('[HTTP]', JSON.stringify(logEntry));
    } else {
      console.log('[HTTP]', JSON.stringify(logEntry));
    }
  });
  next();
});

// Webhooks need raw body for signature verification — mount BEFORE express.json().
app.use('/api/payroll/webhooks/axis-payout', express.raw({ type: 'application/json' }));
app.use('/api/attendance/webhooks/agent', express.raw({ type: 'application/json', limit: '50mb' }));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting — tiered by endpoint sensitivity
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: message || 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
  keyGenerator: ipKeyGenerator,
  skip: (req) => req.path === '/health' || req.path === '/ready',
});

// General API: 5000 req/15min per IP (increased for development)
app.use('/api/', createRateLimiter(15 * 60 * 1000, 5000));

// Auth endpoints: stricter — 20 req/15min per IP
app.use('/api/auth/login', createRateLimiter(15 * 60 * 1000, 20, 'Too many login attempts'));
app.use('/api/auth/register', createRateLimiter(15 * 60 * 1000, 10, 'Too many registration attempts'));
app.use('/api/auth/refresh', createRateLimiter(15 * 60 * 1000, 60));

// Heavy analytics: 100 req/15min per IP
app.use('/api/analytics', createRateLimiter(15 * 60 * 1000, 100));

// File upload endpoints: 30 req/15min per IP
app.use('/api/documents', createRateLimiter(15 * 60 * 1000, 30));
app.use('/api/import', createRateLimiter(15 * 60 * 1000, 30));

// Webhooks: no rate limit (external services)
app.use('/api/payroll/webhooks', (req, res, next) => next());
app.use('/api/attendance/webhooks', (req, res, next) => next());

app.get('/health', async (req, res) => {
  const { getCircuitBreakerState } = require('./services/platformClient');
  const { pool } = require('./db/pool');
  const cbState = getCircuitBreakerState();
  const dbPool = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
  res.json({
    ok: true,
    service: 'ethertrack-internal-ops',
    version: 'v1',
    timestamp: new Date().toISOString(),
    circuitBreaker: cbState,
    dbPool,
  });
});

// Alias for frontend proxy (/api/health -> /health)
app.get('/api/health', async (req, res) => {
  const { getCircuitBreakerState } = require('./services/platformClient');
  const { pool } = require('./db/pool');
  const cbState = getCircuitBreakerState();
  const dbPool = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
  res.json({
    ok: true,
    service: 'ethertrack-internal-ops',
    version: 'v1',
    timestamp: new Date().toISOString(),
    circuitBreaker: cbState,
    dbPool,
  });
});

// WebSocket endpoint not implemented - return 404 with info
app.get('/ws', (req, res) => {
  res.status(404).json({ error: 'WebSocket endpoint not implemented. Use HTTP polling or Server-Sent Events instead.' });
});
app.all('/ws', (req, res) => {
  res.status(404).json({ error: 'WebSocket endpoint not implemented. Use HTTP polling or Server-Sent Events instead.' });
});

// Alias for /refresh -> /api/auth/refresh (for clients calling without /api prefix)
app.all('/refresh', (req, res) => {
  // Rewrite the URL and pass to the auth router
  req.url = '/auth/refresh';
  // We need to handle this by proxying to the auth router
  // Since auth router is mounted at /api/auth, we can't directly call it here
  // Return a redirect or 404 with info
  res.status(404).json({ error: 'Use /api/auth/refresh endpoint instead', redirect: '/api/auth/refresh' });
});

app.get('/ready', async (req, res) => {
  const { safeQuery } = require('./db/pool');
  try {
    await safeQuery('SELECT 1');
    res.json({ ok: true, service: 'ethertrack-internal-ops', ready: true });
  } catch (e) {
    res.status(503).json({ ok: false, service: 'ethertrack-internal-ops', ready: false, reason: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// API v1 Router — canonical versioned endpoints
// ──────────────────────────────────────────────────────────────────────────
const v1 = express.Router();

v1.use('/employees', require('./routes/employees'));
v1.use('/parties', require('./routes/parties'));
v1.use('/staff-accounts', require('./routes/staff-accounts'));
v1.use('/approvals', require('./routes/approvals'));
v1.use('/departments', require('./routes/departments'));
v1.use('/teams', require('./routes/teams'));
v1.use('/designations', require('./routes/designations'));
v1.use('/assets', require('./routes/assets'));
v1.use('/notifications', require('./routes/notifications'));
v1.use('/recruitment', require('./routes/recruitment'));
v1.use('/performance', require('./routes/performance'));
v1.use('/import', require('./routes/import'));
v1.use('/documents', require('./routes/documents'));
v1.use('/document-templates', require('./routes/document-templates'));
v1.use('/document-engine', require('./routes/document-engine'));
v1.use('/document-verify', require('./routes/document-verify')); // public, no auth — QR code target
v1.use('/auth', require('./routes/auth')); // Auth routes: login, refresh, 2FA, security settings
v1.use('/sales', require('./routes/sales'));
v1.use('/automation', require('./routes/automation'));
v1.use('/ai', require('./routes/ai'));
v1.use('/analytics', require('./routes/analytics'));
v1.use('/expenses', require('./routes/expenses'));
v1.use('/settings', require('./routes/settings'));
v1.use('/esignatures', require('./routes/esignatures'));
v1.use('/admin', require('./routes/admin'));
v1.use('/compliance', require('./routes/compliance'));
v1.use('/one-time-registrations', require('./routes/oneTimeRegistrations'));
v1.use('/certifications', require('./routes/certifications'));
v1.use('/ip-assets', require('./routes/ipAssets'));
v1.use('/data-governance', require('./routes/dataGovernance'));
v1.use('/finance', require('./routes/finance'));
v1.use('/finance/bills', require('./routes/bills'));
v1.use('/purchase-requests', require('./routes/purchaseRequests'));
v1.use('/bank-accounts', require('./routes/bankAccounts'));
v1.use('/accounting', require('./routes/accounting'));
v1.use('/platform-sync', require('./routes/platform-sync'));
v1.use('/invoices', require('./routes/invoices'));
v1.use('/payroll', require('./routes/payroll'));
v1.use('/attendance', require('./routes/attendance'));
v1.use('/agent', require('./routes/agent'));
v1.use('/monitoring', require('./routes/monitoring'));
v1.use('/marketing/social-accounts', require('./routes/marketingSocial'));
v1.use('/marketing/campaigns', require('./routes/marketingCampaigns'));
v1.use('/marketing/content-calendar', require('./routes/marketingContent'));
v1.use('/marketing/brand-assets', require('./routes/marketingAssets'));
v1.use('/marketing/leads', require('./routes/marketingLeads'));
v1.use('/marketing/competitors', require('./routes/marketingCompetitors'));
v1.use('/marketing/events', require('./routes/marketingEvents'));
v1.use('/marketing/press', require('./routes/marketingPress'));
v1.use('/marketing/newsletter', require('./routes/marketingNewsletter'));
v1.use('/marketing/seo', require('./routes/marketingSeo'));
v1.use('/marketing/dashboard', require('./routes/marketingDashboard'));
v1.use('/marketing/coupon-performance', require('./routes/marketingCouponPerformance'));
v1.use('/marketing/blog', require('./routes/marketingBlog'));
v1.use('/partnerships/firms', require('./routes/partnershipFirms'));
v1.use('/partnerships/activities', require('./routes/partnershipActivities'));
v1.use('/product/features', require('./routes/productFeatures'));
v1.use('/product/releases', require('./routes/productReleases'));
v1.use('/product/feedback', require('./routes/productFeedback'));
v1.use('/product/beta-users', require('./routes/productBetaUsers'));
v1.use('/product/subscriptions', require('./routes/productSubscriptions'));
v1.use('/product/pricing', require('./routes/productPricing'));
v1.use('/product/coupons', require('./routes/productCoupons'));
v1.use('/product/corporate-deals', require('./routes/corporateDeals'));
v1.use('/support-tickets-view', require('./routes/supportTicketsView'));
v1.use('/renewals', require('./routes/renewals'));
v1.use('/churn-prediction', require('./routes/churnPrediction'));
v1.use('/health-scores', require('./routes/healthScores'));
v1.use('/pipeline-analytics', require('./routes/pipelineAnalytics'));
v1.use('/kpi-pack', require('./routes/kpiPack'));
v1.use('/invoice-anomalies', require('./routes/invoiceAnomaly'));
v1.use('/vendor-intelligence', require('./routes/vendorIntelligence'));
v1.use('/referrals', require('./routes/referralTracking'));
v1.use('/fee-rules', require('./routes/platformFeeEngine'));
v1.use('/training', require('./routes/training'));

// Mount v1 at /api/v1
app.use('/api/v1', v1);

// ──────────────────────────────────────────────────────────────────────────
// Legacy /api/* paths — DEPRECATED but kept for backward compatibility
// ──────────────────────────────────────────────────────────────────────────
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
app.use('/api/document-verify', require('./routes/document-verify'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/automation', require('./routes/automation'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/esignatures', require('./routes/esignatures'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/one-time-registrations', require('./routes/oneTimeRegistrations'));
app.use('/api/certifications', require('./routes/certifications'));
app.use('/api/ip-assets', require('./routes/ipAssets'));
app.use('/api/data-governance', require('./routes/dataGovernance'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/finance/bills', require('./routes/bills'));
app.use('/api/purchase-requests', require('./routes/purchaseRequests'));
app.use('/api/bank-accounts', require('./routes/bankAccounts'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/platform-sync', require('./routes/platform-sync'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/monitoring', require('./routes/monitoring'));
app.use('/api/marketing/social-accounts', require('./routes/marketingSocial'));
app.use('/api/marketing/campaigns', require('./routes/marketingCampaigns'));
app.use('/api/marketing/content-calendar', require('./routes/marketingContent'));
app.use('/api/marketing/brand-assets', require('./routes/marketingAssets'));
app.use('/api/marketing/leads', require('./routes/marketingLeads'));
app.use('/api/marketing/competitors', require('./routes/marketingCompetitors'));
app.use('/api/marketing/events', require('./routes/marketingEvents'));
app.use('/api/marketing/press', require('./routes/marketingPress'));
app.use('/api/marketing/newsletter', require('./routes/marketingNewsletter'));
app.use('/api/marketing/seo', require('./routes/marketingSeo'));
app.use('/api/marketing/dashboard', require('./routes/marketingDashboard'));
app.use('/api/marketing/coupon-performance', require('./routes/marketingCouponPerformance'));
app.use('/api/marketing/blog', require('./routes/marketingBlog'));
app.use('/api/partnerships/firms', require('./routes/partnershipFirms'));
app.use('/api/partnerships/activities', require('./routes/partnershipActivities'));
app.use('/api/product/features', require('./routes/productFeatures'));
app.use('/api/product/releases', require('./routes/productReleases'));
app.use('/api/product/feedback', require('./routes/productFeedback'));
app.use('/api/product/beta-users', require('./routes/productBetaUsers'));
app.use('/api/product/subscriptions', require('./routes/productSubscriptions'));
app.use('/api/product/pricing', require('./routes/productPricing'));
app.use('/api/product/coupons', require('./routes/productCoupons'));
app.use('/api/product/corporate-deals', require('./routes/corporateDeals'));
app.use('/api/support-tickets-view', require('./routes/supportTicketsView'));
app.use('/api/renewals', require('./routes/renewals'));
app.use('/api/churn-prediction', require('./routes/churnPrediction'));
app.use('/api/health-scores', require('./routes/healthScores'));
app.use('/api/pipeline-analytics', require('./routes/pipelineAnalytics'));
app.use('/api/kpi-pack', require('./routes/kpiPack'));
app.use('/api/invoice-anomalies', require('./routes/invoiceAnomaly'));
app.use('/api/vendor-intelligence', require('./routes/vendorIntelligence'));
app.use('/api/referrals', require('./routes/referralTracking'));
app.use('/api/fee-rules', require('./routes/platformFeeEngine'));
app.use('/api/training', require('./routes/training'));

// Global error handler (must be last middleware)
app.use(errorHandler);

const PORT = process.env.PORT || process.env.INTERNAL_OPS_PORT || 5050;
const server = app.listen(PORT, '0.0.0.0', () => {
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
  require('./services/analyticsScheduler'); // daily 05:30 — pre-compute analytics snapshots
  require('./services/slackBot'); // Slack bot for /mrr, /pipeline, /renewals, /approve-invoice
});

// Graceful shutdown
let isShuttingDown = false;
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[internal-ops] ${signal} received, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('[internal-ops] HTTP server closed');
    
    // Close DB pool
    try {
      const { pool } = require('./db/pool');
      await pool.end();
      console.log('[internal-ops] Database pool closed');
    } catch (e) {
      console.error('[internal-ops] Error closing DB pool:', e.message);
    }
    
    console.log('[internal-ops] Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 30s
  setTimeout(() => {
    console.error('[internal-ops] Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));