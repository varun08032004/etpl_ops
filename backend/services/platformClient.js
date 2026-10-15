'use strict';
const MAX_RETRIES = 8;
const BASE_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;

const { pool } = require('../db/pool');

function getPlatformUrls() {
  const urls = [];
  if (process.env.PLATFORM_API_URL_LOCALHOST) urls.push(process.env.PLATFORM_API_URL_LOCALHOST);
  if (process.env.PLATFORM_API_URL) urls.push(process.env.PLATFORM_API_URL);
  if (!urls.length) urls.push('http://localhost:5000');
  return urls;
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  await rateLimit();
  circuitBreakerCheck();

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let resp;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (err.name === 'AbortError') lastError = new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`);
      if (attempt === retries) { circuitBreakerRecordFailure(); throw lastError; }
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
      continue;
    }

    if (resp.ok) { circuitBreakerRecordSuccess(); return resp; }

    if (resp.status === 429) {
      const retryAfter = resp.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[platformClient] Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);
      if (attempt === retries) { const body = await resp.text().catch(() => ''); circuitBreakerRecordFailure(); throw new Error(`Platform API returned 429 after ${retries + 1} attempts: ${body.slice(0, 300)}`); }
      await sleep(delay); continue;
    }

    if (resp.status >= 500) {
      const body = await resp.text().catch(() => '');
      lastError = new Error(`Platform API returned ${resp.status}: ${body.slice(0, 300)}`);
      if (attempt === retries) { circuitBreakerRecordFailure(); throw lastError; }
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt)); continue;
    }

    const body = await resp.text().catch(() => '');
    circuitBreakerRecordFailure();
    throw new Error(`Platform API returned ${resp.status}: ${body.slice(0, 300)}`);
  }
  circuitBreakerRecordFailure();
throw lastError;
  }

  function getPlatformUrls() {
  const urls = [];
  if (process.env.PLATFORM_API_URL_LOCALHOST) urls.push(process.env.PLATFORM_API_URL_LOCALHOST);
  if (process.env.PLATFORM_API_URL) urls.push(process.env.PLATFORM_API_URL);
  if (!urls.length) urls.push('http://localhost:5000');
  return urls;
}

// Local DB cache functions
async function getLocalPlanPrices() {
  try {
    const { rows } = await pool.query(`
      SELECT plan_key, billing_cycle, price_inr, buyer_fee_percent, seller_fee_percent, updated_at, updated_by
      FROM plan_pricing
      WHERE is_active = true
    `);
    return rows.map(r => ({
      plan_key: r.plan_key,
      billing_cycle: r.billing_cycle,
      price_inr: Number(r.price_inr),
      buyer_fee_percent: Number(r.buyer_fee_percent),
      seller_fee_percent: Number(r.seller_fee_percent),
      updated_at: r.updated_at,
      updated_by: r.updated_by
    }));
  } catch (e) {
    console.warn('[platformClient] Failed to read local plan prices:', e.message);
    return [];
  }
}

async function updateLocalPlanPrice(plan, cycle, priceInr, buyerFeePercent, sellerFeePercent, updatedBy) {
  try {
    await pool.query(`
      INSERT INTO plan_pricing (plan_key, plan_name, billing_cycle, price_inr, buyer_fee_percent, seller_fee_percent, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (plan_key, billing_cycle) DO UPDATE SET
        price_inr = EXCLUDED.price_inr,
        buyer_fee_percent = EXCLUDED.buyer_fee_percent,
        seller_fee_percent = EXCLUDED.seller_fee_percent,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `, [plan, plan, cycle, priceInr, buyerFeePercent, sellerFeePercent, updatedBy]);
    console.log(`[platformClient] Updated local cache for ${plan}/${cycle}`);
  } catch (e) {
    console.error('[platformClient] Failed to update local cache:', e.message);
  }
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  await rateLimit();
  circuitBreakerCheck();

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let resp;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (err.name === 'AbortError') lastError = new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`);
      if (attempt === retries) { circuitBreakerRecordFailure(); throw lastError; }
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
      continue;
    }

    if (resp.ok) { circuitBreakerRecordSuccess(); return resp; }

    if (resp.status === 429) {
      const retryAfter = resp.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[platformClient] Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);
      if (attempt === retries) { const body = await resp.text().catch(() => ''); circuitBreakerRecordFailure(); throw new Error(`Platform API returned 429 after ${retries + 1} attempts: ${body.slice(0, 300)}`); }
      await sleep(delay); continue;
    }

    if (resp.status >= 500) {
      const body = await resp.text().catch(() => '');
      lastError = new Error(`Platform API returned ${resp.status}: ${body.slice(0, 300)}`);
      if (attempt === retries) { circuitBreakerRecordFailure(); throw lastError; }
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt)); continue;
    }

    const body = await resp.text().catch(() => '');
    circuitBreakerRecordFailure();
    throw new Error(`Platform API returned ${resp.status}: ${body.slice(0, 300)}`);
  }
  circuitBreakerRecordFailure();
  throw lastError;
}

async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
}

function circuitBreakerCheck() {
  const now = Date.now();
  if (cbOpenAt && now < cbOpenAt) throw new Error('Circuit breaker OPEN — platform API unavailable');
  if (cbOpenAt && now >= cbOpenAt) cbOpenAt = 0;
}

function circuitBreakerRecordSuccess() { cbFailures = 0; cbOpenAt = 0; }
function circuitBreakerRecordFailure() { cbFailures++; if (cbFailures >= CB_FAILURE_THRESHOLD) { cbOpenAt = Date.now() + CB_RESET_TIMEOUT_MS; console.error(`[platformClient] Circuit breaker OPEN for ${CB_RESET_TIMEOUT_MS}ms`); } }

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchWithFallback(path, options, tokenEnvVar = 'PLATFORM_SYNC_SERVICE_TOKEN') {
  const urls = getPlatformUrls();
  const token = process.env[tokenEnvVar];
  if (!token) throw new Error(`${tokenEnvVar} not configured — see .env.example`);

  const headers = { ...options.headers, 'x-service-token': token };
  const fetchOptions = { ...options, headers };

  let lastError;
  let localhostTried = false;
  let productionTried = false;
  const maxRounds = 2;

  for (let round = 0; round < maxRounds; round++) {
    for (const base of urls) {
      const isLocalhost = base.includes('localhost') || base.includes('127.0.0.1');
      if (round > 0 && isLocalhost && localhostTried) continue;
      if (round === 0 && !isLocalhost && urls.some(u => u.includes('localhost') || u.includes('127.0.0.1'))) { productionTried = true; continue; }

      const url = `${base.replace(/\/$/, '')}${path}`;
      try {
        const resp = await fetchWithRetry(url, { ...options, headers: { ...options.headers, 'x-service-token': process.env[tokenEnvVar] } });
        return resp;
      } catch (err) {
        lastError = err;
        console.warn(`[platformClient] Failed to reach ${base}: ${err.message}`);
        if (isLocalhost) localhostTried = true; else productionTried = true;
        if (round === 1 && localhostTried && productionTried) throw new Error(`All platform API URLs failed. Last error: ${lastError?.message}`);
        await sleep(500);
      }
    }
  }
  throw new Error(`All platform API URLs failed after ${maxRounds} rounds. Last error: ${lastError?.message}`);
}

function getPlatformUrls() {
  const urls = [];
  if (process.env.PLATFORM_API_URL_LOCALHOST) urls.push(process.env.PLATFORM_API_URL_LOCALHOST);
  if (process.env.PLATFORM_API_URL) urls.push(process.env.PLATFORM_API_URL);
  if (!urls.length) urls.push('http://localhost:5000');
  return urls;
}

async function platformScopedCall(namespace, tokenEnvVar, path, method, body) {
  const urls = getPlatformUrls();
  const token = process.env[tokenEnvVar];
  if (!token) throw new Error(`${tokenEnvVar} not configured — see .env.example`);

  let lastError;
  for (const base of getPlatformUrls()) {
    const url = `${base.replace(/\/$/, '')}/api/${namespace}${path}`;
    try {
      const resp = await fetchWithRetry(url, { method, headers: { 'x-service-token': process.env[tokenEnvVar], 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const text = await resp.text().catch(() => '');
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      if (!resp.ok) {
        const hint = resp.status === 404 ? ' — routes/opsIntegrationCorporate.js may not be deployed/mounted yet on the platform side' : '';
        throw Object.assign(new Error(`Platform API returned ${resp.status}${hint}: ${text.slice(0, 300)}`), { status: resp.status, body: data });
      }
      return data;
    } catch (err) {
      console.warn(`[platformClient] Failed to reach ${base}: ${err.message}, trying next URL...`);
      lastError = err;
    }
  }
  throw new Error(`All platform API URLs failed. Last error: ${lastError?.message}`);
}

async function fetchWithRetry(url, options, retries = 8) {
  await rateLimit();
  circuitBreakerCheck();

  let lastError;
  for (let attempt = 0; attempt <= 8; attempt++) {
    let resp;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (err.name === 'AbortError') lastError = new Error('Request timeout after 15000ms');
      if (attempt === 8) { circuitBreakerRecordFailure(); throw lastError; }
      await sleep(2000 * Math.pow(2, attempt));
      continue;
    }

    if (resp.ok) { circuitBreakerRecordSuccess(); return resp; }
    if (resp.status === 429) {
      const retryAfter = resp.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * Math.pow(2, attempt);
      console.warn(`[platformClient] Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/9)`);
      if (attempt === 8) { const body = await resp.text().catch(() => ''); circuitBreakerRecordFailure(); throw new Error(`Platform API returned 429 after 9 attempts: ${body.slice(0, 300)}`); }
      await sleep(delay); continue;
    }
    if (resp.status >= 500) {
      const body = await resp.text().catch(() => '');
      lastError = new Error(`Platform API returned ${resp.status}: ${body.slice(0, 300)}`);
      if (attempt === 8) { circuitBreakerRecordFailure(); throw lastError; }
      await sleep(2000 * Math.pow(2, attempt)); continue;
    }
    const body = await resp.text().catch(() => '');
    circuitBreakerRecordFailure();
    throw new Error(`Platform API returned ${resp.status}: ${body.slice(0, 300)}`);
  }
  circuitBreakerRecordFailure();
  throw lastError;
}

async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 100) await sleep(100 - timeSinceLastRequest);
  lastRequestTime = Date.now();
}

function circuitBreakerCheck() {
  const now = Date.now();
  if (cbOpenAt && now < cbOpenAt) throw new Error('Circuit breaker OPEN — platform API unavailable');
  if (cbOpenAt && now >= cbOpenAt) cbOpenAt = 0;
}

function circuitBreakerRecordSuccess() { cbFailures = 0; cbOpenAt = 0; }
function circuitBreakerRecordFailure() { cbFailures++; if (cbFailures >= 5) { cbOpenAt = Date.now() + 30000; console.error(`[platformClient] Circuit breaker OPEN for 30000ms`); } }

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 100;
const CB_FAILURE_THRESHOLD = 5;
const CB_RESET_TIMEOUT_MS = 30000;
let cbFailures = 0;
let cbOpenAt = 0;

function getPlatformUrls() {
  const urls = [];
  if (process.env.PLATFORM_API_URL_LOCALHOST) urls.push(process.env.PLATFORM_API_URL_LOCALHOST);
  if (process.env.PLATFORM_API_URL) urls.push(process.env.PLATFORM_API_URL);
  if (!urls.length) urls.push('http://localhost:5000');
  return urls;
}

function getCircuitBreakerState() {
  return {
    failures: cbFailures,
    threshold: CB_FAILURE_THRESHOLD,
    open: cbOpenAt > Date.now(),
    openUntil: cbOpenAt ? new Date(cbOpenAt).toISOString() : null,
  };
}

module.exports = {
  fetchPlanPrices,
  updatePlanPrice,
  getLocalPlanPrices,
  updateLocalPlanPrice,
  getCircuitBreakerState,
};

// Local DB cache functions
async function getLocalPlanPrices() {
  try {
    const { rows } = await pool.query(`
      SELECT plan_key, billing_cycle, price_inr, buyer_fee_percent, seller_fee_percent, updated_at, updated_by
      FROM plan_pricing
      WHERE is_active = true
    `);
    return rows.map(r => ({
      plan: r.plan_key,
      plan_key: r.plan_key,
      billing_cycle: r.billing_cycle,
      price_inr: Number(r.price_inr),
      buyer_fee_percent: Number(r.buyer_fee_percent),
      seller_fee_percent: Number(r.seller_fee_percent),
      updated_at: r.updated_at,
      updated_by: r.updated_by
    }));
  } catch (e) {
    console.warn('[platformClient] Failed to read local plan prices:', e.message);
    return [];
  }
}

async function updateLocalPlanPrice(plan, cycle, priceInr, buyerFeePercent, sellerFeePercent, updatedBy) {
  try {
    await pool.query(`
      INSERT INTO plan_pricing (plan_key, plan_name, billing_cycle, price_inr, buyer_fee_percent, seller_fee_percent, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (plan_key, billing_cycle) DO UPDATE SET
        price_inr = EXCLUDED.price_inr,
        buyer_fee_percent = EXCLUDED.buyer_fee_percent,
        seller_fee_percent = EXCLUDED.seller_fee_percent,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `, [plan, plan, cycle, priceInr, buyerFeePercent, sellerFeePercent, updatedBy]);
    console.log(`[platformClient] Updated local cache for ${plan}/${cycle}`);
  } catch (e) {
    console.error('[platformClient] Failed to update local cache:', e.message);
  }
}

// fetchPlanPrices with local cache fallback
async function fetchPlanPrices() {
  // Try local cache first
  const local = await getLocalPlanPrices();
  if (local.length > 0) {
    console.log('[platformClient] Serving plan prices from local cache');
    return local;
  }

  // Fallback to platform API
  try {
    const data = await platformScopedCall('ops-integration-pricing', 'PLATFORM_SYNC_SERVICE_TOKEN', '/', 'GET', null);
    const prices = data?.prices || [];
    
    // Cache successful platform response locally
    for (const p of prices) {
      await updateLocalPlanPrice(
        p.plan, p.cycle, 
        Math.round(p.price_inr * 100), // convert INR to paise
        p.buyer_fee_percent || 0,
        p.seller_fee_percent || 0,
        p.updated_by || 'platform'
      );
    }
    console.log('[platformClient] Cached plan prices from platform API');
    return prices;
  } catch (e) {
    console.warn('[platformClient] Platform API unavailable, returning empty:', e.message);
    return [];
  }
}

// updatePlanPrice with local cache write-through
async function updatePlanPrice(plan, cycle, priceINR, buyerFeePercent = 0, sellerFeePercent = 0, updatedBy = null) {
  // Write to local DB first
  await updateLocalPlanPrice(plan, cycle, priceINR, buyerFeePercent || 0, sellerFeePercent || 0, updatedBy || 'erp');
  
  // Then sync to platform
  const data = await platformScopedCall(
    'ops-integration-pricing', 'PLATFORM_SYNC_PRICING_WRITE_TOKEN',
    `/${plan}/${cycle}`, 'PATCH', { priceINR, buyerFeePercent, sellerFeePercent, updatedBy }
  );
  return data;
}