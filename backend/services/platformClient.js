'use strict';
// services/platformClient.js
//
// Thin client for the EtherTrack customer platform's read-only integration
// endpoint (see ethertrack-backend/routes/opsIntegration.js). Uses Node's
// built-in fetch (Node 20 — no extra dependency needed). Read-only by
// construction: this file only ever does GETs.

async function fetchPlatformIncome(fromDate, toDate) {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SYNC_SERVICE_TOKEN;

  if (!base || !token) {
    throw new Error(
      'PLATFORM_API_URL / PLATFORM_SYNC_SERVICE_TOKEN not configured — see .env.example'
    );
  }

  const url = `${base.replace(/\/$/, '')}/api/ops-integration/income?from=${fromDate}&to=${toDate}`;

  let resp;
  try {
    resp = await fetch(url, { headers: { 'x-service-token': token } });
  } catch (err) {
    throw new Error(`Could not reach platform API at ${base}: ${err.message}`);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Platform API returned ${resp.status}: ${body.slice(0, 300)}`);
  }

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
  let resp;
  try {
    resp = await fetch(url, { headers: { 'x-service-token': token } });
  } catch (err) {
    throw new Error(`Could not reach platform API at ${base}: ${err.message}`);
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Platform API returned ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.customers || [];
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

  let resp;
  try {
    resp = await fetch(url, { headers: { 'x-service-token': token } });
  } catch (err) {
    throw new Error(`Could not reach platform API at ${base}: ${err.message}`);
  }

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
  fetchPlatformIncome, fetchPlatformCustomers, fetchInvoicePdf,
  activateCorporate, updateCorporateRenewal, fetchCorporateActivations,
};