'use strict';
// services/platformClient.js
//
// Thin client for the EtherTrack customer platform's read-only integration
// endpoint (see ethertrack-backend/routes/opsIntegration.js). Uses Node's
// built-in fetch (Node 20 — no extra dependency needed). Read-only by
// construction: this file only ever does GETs.

// Retry configuration for rate limiting
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
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

  const url = `${base.replace(/\/$/, '')}/api/ops-integration/income?from=${fromDate}&to=${toDate}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });

  const data = await resp.json();
  return [...(data.subscriptions || []), ...(data.trades || [])];
}

async function fetchPlatformCustomers(limit = 1000) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;
  if (!base || !token) {
    throw new Error(
      'PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example'
    );
  }
  const url = `${base.replace(/\/$/, '')}/api/ops-integration/customers?limit=${limit}`;

  const resp = await fetchWithRetry(url, { headers: { 'x-service-token': token } });
  const data = await resp.json();
  return data.customers || [];
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
...