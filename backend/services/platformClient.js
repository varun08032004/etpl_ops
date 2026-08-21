'use strict';
// services/platformClient.js
//
// Thin client for the EtherTrack customer platform's read-only integration
// endpoint (see ethertrack-backend/routes/opsIntegration.js). Uses Node's
// built-in fetch (Node 20 — no extra dependency needed). Read-only by
// construction: this file only ever does GETs.

// Retry configuration for rate limiting
const MAX_RETRIES = 8;
const BASE_DELAY_MS = 2000;

// Simple rate limiter to space out requests
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 100; // Max 10 requests/second

async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
}

// In-memory cache with TTL
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL_MS) {
    console.log(`[platformClient] Cache HIT: ${key}`);
    return entry.data;
  }
  return null;
}

function setCached(key, data) {
  cache.set(key, { data, time: Date.now() });
  console.log(`[platformClient] Cache SET: ${key}`);
}

function clearCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  await rateLimit();
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let resp;
    try {
      resp = await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
      continue;
    }

    if (resp.ok) {
      return resp;
    }

    if (resp.status === 429) {
      // Rate limited - respect Retry-After header or use exponential backoff
      const retryAfter = resp.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[platformClient] Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);
      if (attempt === retries) {
        const body = await resp.text().catch(() => '');
        throw new Error(`Platform API returned 429 after ${retries + 1} attempts: ${body.slice(0, 300)}`);
      }
      await sleep(delay);
      continue;
    }

    // Other error statuses - don't retry
    const body = await resp.text().catch(() => '');
    throw new Error(`Platform API returned ${resp.status}: ${body.slice(0, 300)}`);
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPlatformIncome(fromDate, toDate) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;

  if (!base || !token) {
    throw new Error(
      'PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example'
    );
  }

  const cacheKey = `income:${fromDate}:${toDate}`;
  const cached = getCached(`income:${fromDate}:${toDate}`);
  if (cached) return cached;

  const url = `${base.replace(/\/$/, '')}/api/ops-integration/income?from=${fromDate}&to=${toDate}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });

  const data = await resp.json();
  const result = [...(data.subscriptions || []), ...(data.trades || [])];
  setCached(`income:${fromDate}:${toDate}`, result);
  return result;
}

async function fetchPlatformCustomers(limit = 1000) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;
  if (!base || !token) {
    throw new Error(
      'PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example'
    );
  }
  const cacheKey = `customers:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `${base.replace(/\/$/, '')}/api/ops-integration/customers?limit=${limit}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });
  const data = await resp.json();
  const result = data.customers || [];
  setCached(cacheKey, result);
  return result;
}

// fetchChurnEvents: paid→free downgrades recorded on the platform, so Sales/
// CS can be alerted for win-back outreach same-day instead of only noticing
// on the next customer-roster pull. `since` is an ISO timestamp; omit to get
// the platform's own default window (last 30 days).
async function fetchChurnEvents(since = null) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;
  if (!base || !token) {
    throw new Error(
      'PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example'
    );
  }
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  const url = `${base.replace(/\/$/, '')}/api/ops-integration/churn-events${qs}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });
  const data = await resp.json();
  return data.events || [];
}

// fetchPlatformRefunds: subscription payments Razorpay has refunded on the
// platform. Read-only, same token as fetchPlatformCustomers/fetchPlatformIncome
// — this doesn't process anything, just tells the ERP a refund happened so
// Finance can check whether that revenue was ever imported and, if so,
// reverse it (via the existing platform-sync void flow).
async function fetchPlatformRefunds(since = null) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;
  if (!base || !token) {
    throw new Error(
      'PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example'
    );
  }

  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  const url = `${base.replace(/\/$/, '')}/api/ops-integration/refunds${qs}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });
  const data = await resp.json();
  return data.refunds || [];
}

// fetchCouponRedemptions: every coupon redemption joined with the payment it
// applied to, so Marketing can see real revenue driven per code, not just a
// usage count. Read-only, same token as the other fetch* functions above.
async function fetchCouponRedemptions(since = null) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;
  if (!base || !token) {
    throw new Error(
      'PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example'
    );
  }
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  const url = `${base.replace(/\/$/, '')}/api/ops-integration/coupon-redemptions${qs}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });
  const data = await resp.json();
  return data.redemptions || [];
}

// fetchSupportTickets: platform support tickets, optionally filtered by
// status. Read-only, same token as the other fetch* functions above.
async function fetchSupportTickets({ since = null, status = null } = {}) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;
  if (!base || !token) {
    throw new Error(
      'PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example'
    );
  }
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  if (status) params.set('status', status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const url = `${base.replace(/\/$/, '')}/api/ops-integration/support-tickets${qs}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });
  const data = await resp.json();
  return data.tickets || [];
}

// fetchDisputes: platform trade/credit disputes. Read-only, same token.
async function fetchDisputes({ since = null, status = null } = {}) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;
  if (!base || !token) {
    throw new Error('PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example');
  }
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  if (status) params.set('status', status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const url = `${base.replace(/\/$/, '')}/api/ops-integration/disputes${qs}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });
  const data = await resp.json();
  return data.disputes || [];
}

// ─────────────────────────────────────────────────────────────────────────
// KYC Status — read-only
// ─────────────────────────────────────────────────────────────────────────

// fetchKycStatus: recent KYC submissions with status/rejection reasons.
// Read-only, same token.
async function fetchKycStatus({ since = null, status = null } = {}) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;
  if (!base || !token) {
    throw new Error('PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example');
  }
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  if (status) params.set('status', status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const url = `${base.replace(/\/$/, '')}/api/ops-integration/kyc-status${qs}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });
  const data = await resp.json();
  return data.submissions || [];
}

// fetchInvoicePdf: pulls the real invoice/bill PDF for a single subscription
// payment or trade, straight from the platform. type must be 'subscription'
// or 'trade'; id is the same ref_id fetchPlatformIncome() returns for that
// record. Returns a Buffer of raw PDF bytes, or throws if not found/not
// yet generated on the platform side.
async function fetchInvoicePdf(type, id) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;
  if (!base || !token) {
    throw new Error(
      'PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example'
    );
  }
  if (!['subscription', 'trade'].includes(type)) {
    throw new Error("type must be 'subscription' or 'trade'");
  }

  const url = `${base.replace(/\/$/, '')}/api/ops-integration/invoice/${type}/${encodeURIComponent(id)}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });

  if (resp.status === 404) {
    throw Object.assign(new Error('Invoice not found or not yet generated on the platform'), { status: 404 });
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Platform API returned ${resp.status}: ${body.slice(0, 300)}`);
  }

  const filename = resp.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || `invoice-${id}.pdf`;
  const arrayBuffer = await resp.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), filename };
}

// ─────────────────────────────────────────────────────────────────────────
// Corporate subscription — WRITE path.
//
// Everything above this line is read-only and goes through
// PLATFORM_SYNC_SERVICE_TOKEN, hitting /api/ops-integration/* — that file's
// own header comment on the platform side is explicit that it should never
// grow write endpoints (deliberate blast-radius limit: a leaked read token
// should never be able to touch billing). Corporate activation is a write,
// so it deliberately uses a DIFFERENT token (PLATFORM_SYNC_CORPORATE_WRITE_TOKEN)
// against a DIFFERENT route namespace (/api/ops-integration-corporate/*) —
// see routes/opsIntegrationCorporate.js on the platform side. If this token
// ever leaks, the read-only sync keeps working and is unaffected; if the
// read-only token leaks, it can't reach this surface at all.
//
// ethertrack.in's Corporate plan is "Contact Sales" only, so the sale
// happens in the ERP's Sales pipeline (routes/sales.js) and the platform
// account just needs to be told the outcome once the deal is won.

async function platformCorporateCall(path, method, body) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_CORPORATE_WRITE_TOKEN;
  if (!base || !token) {
    throw new Error('PLATFORM_API_URL / PLATFORM_SYNC_CORPORATE_WRITE_TOKEN not configured — see .env.example');
  }
  const url = `${base.replace(/\/$/, '')}/api/ops-integration-corporate${path}`;
  let resp;
  try {
    resp = await fetch(url, {
      method,
      headers: { 'x-service-token': token, 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`Could not reach platform API at ${base}: ${err.message}`);
  }
  const text = await resp.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* leave as null, raw text goes in the error below */ }

  if (!resp.ok) {
    const hint = resp.status === 404
      ? ' — routes/opsIntegrationCorporate.js may not be deployed/mounted yet on the platform side'
      : '';
    throw Object.assign(
      new Error(`Platform API returned ${resp.status}${hint}: ${(text || '').slice(0, 300)}`),
      { status: resp.status, body: data }
    );
  }
  return data;
}

// activateCorporate: triggers Corporate plan activation on the platform for
// a specific platform user.
async function activateCorporate(platformUserId, { cycle, seats, customPriceINR, renewalMonths, notes }) {
  return platformCorporateCall(`/${platformUserId}/activate`, 'POST', {
    cycle, seats, customPriceINR, renewalMonths, notes,
  });
}

// updateCorporateRenewal
async function updateCorporateRenewal(platformUserId, { renewalDate, seats, notes }) {
  return platformCorporateCall(`/${platformUserId}/renewal`, 'PATCH', {
    renewalDate, seats, notes,
  });
}

// fetchCorporateActivations — read, but grouped here since it's gated
// behind the same write-scoped token as the two actions above.
async function fetchCorporateActivations() {
  const data = await platformCorporateCall('/activations', 'GET', null);
  return data?.activations || [];
}

module.exports = {
  fetchPlatformIncome, fetchPlatformCustomers, fetchInvoicePdf, fetchChurnEvents, fetchPlatformRefunds, fetchCouponRedemptions, fetchSupportTickets, fetchDisputes, fetchKycStatus,
  activateCorporate, updateCorporateRenewal, fetchCorporateActivations,
  createCoupon, listCoupons, setCouponActive,
  updatePlanPrice, fetchPlanPrices,
};

// ─────────────────────────────────────────────────────────────────────────
// Coupons — WRITE path, own token/namespace (PLATFORM_SYNC_COUPON_WRITE_TOKEN
// against /api/ops-integration-coupons/*), same isolation reasoning as
// Corporate above — see routes/opsIntegrationCoupons.js on the platform side.

async function platformScopedCall(namespace, tokenEnvVar, path, method, body) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env[tokenEnvVar];
  if (!base || !token) {
    throw new Error(`PLATFORM_API_URL / ${tokenEnvVar} not configured — see .env.example`);
  }
  const url = `${base.replace(/\/$/, '')}/api/${namespace}${path}`;
  let resp;
  try {
    resp = await fetch(url, {
      method,
      headers: { 'x-service-token': token, 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`Could not reach platform API at ${base}: ${err.message}`);
  }
  const text = await resp.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* leave as null, raw text goes in the error below */ }

  if (!resp.ok) {
    throw Object.assign(
      new Error(`Platform API returned ${resp.status}: ${(text || '').slice(0, 300)}`),
      { status: resp.status, body: data }
    );
  }
  return data;
}

// createCoupon — plans is restricted to ['starter','growth'] on the
// platform side regardless of what's passed; Corporate is never a coupon
// target (it's manual, per-deal pricing via Corporate Deals instead).
async function createCoupon({
  code, discountType = 'percent', discountValue,
  applicablePlans = ['starter', 'growth'], applicableCycles = ['annual'],
  firstTimeOnly = true, perUserLimit = 1, maxRedemptions = null,
  validFrom = null, validUntil = null, createdBy = null,
}) {
  const data = await platformScopedCall('ops-integration-coupons', 'PLATFORM_SYNC_COUPON_WRITE_TOKEN', '/', 'POST', {
    code, discountType, discountValue, applicablePlans, applicableCycles,
    firstTimeOnly, perUserLimit, maxRedemptions, validFrom, validUntil, createdBy,
  });
  return data?.coupon;
}

async function listCoupons() {
  const data = await platformScopedCall('ops-integration-coupons', 'PLATFORM_SYNC_COUPON_WRITE_TOKEN', '/', 'GET', null);
  return data?.coupons || [];
}

async function setCouponActive(code, active, { validUntil, maxRedemptions } = {}) {
  const data = await platformScopedCall(
    'ops-integration-coupons', 'PLATFORM_SYNC_COUPON_WRITE_TOKEN',
    `/${encodeURIComponent(code)}`, 'PATCH', { active, validUntil, maxRedemptions }
  );
  return data?.coupon;
}

// ─────────────────────────────────────────────────────────────────────────
// Pricing — WRITE path, own token/namespace (PLATFORM_SYNC_PRICING_WRITE_TOKEN
// against /api/ops-integration-pricing/*). Starter/Growth only — Corporate
// pricing is always per-deal via Corporate Deals, never a flat rate here.

async function updatePlanPrice(plan, cycle, priceINR, updatedBy = null) {
  const data = await platformScopedCall(
    'ops-integration-pricing', 'PLATFORM_SYNC_PRICING_WRITE_TOKEN',
    `/${plan}/${cycle}`, 'PATCH', { priceINR, updatedBy }
  );
  return data;
}

async function fetchPlanPrices() {
  const data = await platformScopedCall('ops-integration-pricing', 'PLATFORM_SYNC_PRICING_WRITE_TOKEN', '/', 'GET', null);
  return data?.prices || [];
}

module.exports = {
  fetchPlatformIncome, fetchPlatformCustomers, fetchInvoicePdf, fetchChurnEvents, fetchPlatformRefunds, fetchCouponRedemptions, fetchSupportTickets, fetchDisputes, fetchKycStatus,
  activateCorporate, updateCorporateRenewal, fetchCorporateActivations,
  createCoupon, listCoupons, setCouponActive,
  updatePlanPrice, fetchPlanPrices,
};