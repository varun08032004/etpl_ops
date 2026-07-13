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

module.exports = { fetchPlatformIncome, fetchPlatformCustomers, fetchInvoicePdf };