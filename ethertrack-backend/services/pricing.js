'use strict';
// services/pricing.js
//
// Prices used to be hardcoded paise values in routes/subscription.js's
// PLAN_CONFIG. That's now the FALLBACK only — the ERP (etpl_ops) Product/
// Sales section is the source of truth once it has pushed a real price via
// PATCH /api/ops-integration-pricing/:plan/:cycle (see routes/opsIntegrationPricing.js).
// Once pushed, services/pricing.js's plan_prices table wins.
//
// NEW STRUCTURE (2026-10-13):
// - ALL 4 TIERS: Annual ONLY (no monthly)
// - Each tier has: annual_paise (base price), buyer_fee_percent, seller_fee_percent
// - Free: ₹0 base, buyer: 2.00000% (2%), seller: 0.00000% (0%)
// - Starter: base price + buyer: 1.00000% (1%), seller: 1.00000% (1%)
// - Growth: base price + buyer: 0.75000% (0.75%), seller: 0.75000% (0.75%)
// - Corporate: base price + buyer: 0.50000% (0.5%), seller: 0.50000% (0.5%)

const { safeQuery: query } = require('../db/pool');

// Small in-process cache (60s) so a hot checkout path isn't doing a DB
// round-trip on every single price lookup — prices change rarely (an ERP
// push), so a short cache is a fine tradeoff. Cleared automatically on
// expiry; also bypassed entirely by clearPricingCache() right after an ERP
// push so the new price is visible immediately rather than up to 60s late.
let cache = null;       // Map<"plan:cycle", {annual_paise, buyer_fee_percent, seller_fee_percent}>
let cacheAt = 0;
const CACHE_MS = 60 * 1000;

async function loadPrices() {
  const { rows } = await query(`SELECT plan, cycle, annual_paise, buyer_fee_percent, seller_fee_percent FROM plan_prices`);
  const map = new Map();
  for (const r of rows) map.set(`${r.plan}:${r.cycle}`, { 
    annual_paise: Number(r.annual_paise), 
    buyer_fee_percent: Number(r.buyer_fee_percent), 
    seller_fee_percent: Number(r.seller_fee_percent) 
  });
  return map;
}

async function getOverridesMap() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  try {
    cache = await loadPrices();
    cacheAt = Date.now();
  } catch (e) {
    console.warn('[pricing] failed to load plan_prices, using hardcoded defaults:', e.message);
    if (!cache) cache = new Map(); // first-ever call failing — fall through to defaults below rather than throw
  }
  return cache;
}

function clearPricingCache() {
  cache = null;
  cacheAt = 0;
}

// getEffectivePricePaise(plan, cycle, PLAN_CONFIG) — PLAN_CONFIG is passed in
// (rather than required here) to avoid a circular require with
// routes/subscription.js, which already owns that object.
async function getEffectivePricePaise(plan, cycle, PLAN_CONFIG) {
  const cfg = PLAN_CONFIG[plan];
  if (!cfg) return null;

  // All tiers annual only; monthly returns null
  if (cycle === 'monthly') {
    return null;
  }

  const overrides = await getOverridesMap();
  const override = overrides.get(`${plan}:${cycle}`);
  if (override !== undefined) return override.annual_paise;

  // Annual fallback from PLAN_CONFIG
  return cfg.annual_paise;
}

// getEffectiveBuyerFeePercent(plan, cycle, PLAN_CONFIG) — returns buyer platform fee in percent
async function getEffectiveBuyerFeePercent(plan, cycle, PLAN_CONFIG) {
  const cfg = PLAN_CONFIG[plan];
  if (!cfg) return null;

  if (cycle === 'monthly') return null;

  const overrides = await getOverridesMap();
  const override = overrides.get(`${plan}:${cycle}`);
  if (override !== undefined) return override.buyer_fee_percent;

  return cfg.buyer_fee_percent;
}

// getEffectiveSellerFeePercent(plan, cycle, PLAN_CONFIG) — returns seller platform fee in percent
async function getEffectiveSellerFeePercent(plan, cycle, PLAN_CONFIG) {
  const cfg = PLAN_CONFIG[plan];
  if (!cfg) return null;

  if (cycle === 'monthly') return null;

  const overrides = await getOverridesMap();
  const override = overrides.get(`${plan}:${cycle}`);
  if (override !== undefined) return override.seller_fee_percent;

  return cfg.seller_fee_percent;
}

// getAllEffectivePrices(PLAN_CONFIG) — used by GET /api/subscription/prices
// Returns: { free: {annual: 0, buyer_fee_percent: 2.00000, seller_fee_percent: 0.00000}, ... }
async function getAllEffectivePrices(PLAN_CONFIG) {
  const overrides = await getOverridesMap();
  const out = {};
  for (const [key, cfg] of Object.entries(PLAN_CONFIG)) {
    const annualOverride = overrides.get(`${key}:annual`);
    out[key] = {
      annual: annualOverride !== undefined ? annualOverride.annual_paise / 100 : (cfg.annual_paise || 0) / 100,
      buyer_fee_percent: annualOverride !== undefined ? annualOverride.buyer_fee_percent : (cfg.buyer_fee_percent || 0),
      seller_fee_percent: annualOverride !== undefined ? annualOverride.seller_fee_percent : (cfg.seller_fee_percent || 0),
      isStartingFrom: key === 'corporate',
    };
  }
  return out;
}

// setPrice — called by routes/opsIntegrationPricing.js when the ERP pushes
// an update. Upserts and immediately busts the cache.
// Accepts both annual_paise and separate buyer/seller fee percent
async function setPrice(plan, cycle, annualPaise, { buyerFeePercent = null, sellerFeePercent = null, updatedBy = null, updatedFrom = 'erp' } = {}) {
  // Validate plan/cycle combination - ALL tiers annual only
  const validCombinations = {
    free: ['annual'],
    starter: ['annual'],
    growth: ['annual'],
    corporate: ['annual'],
  };
  
  if (!validCombinations[plan] || !validCombinations[plan].includes(cycle)) {
    throw new Error(`Invalid plan/cycle combination: ${plan}/${cycle}. Valid: annual only for all tiers.`);
  }

  const buyerFee = buyerFeePercent !== null ? buyerFeePercent : 0;
  const sellerFee = sellerFeePercent !== null ? sellerFeePercent : 0;

  await query(
    `INSERT INTO plan_prices (plan, cycle, annual_paise, buyer_fee_percent, seller_fee_percent, updated_by, updated_from, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (plan, cycle) DO UPDATE SET
       annual_paise = EXCLUDED.annual_paise,
       buyer_fee_percent = EXCLUDED.buyer_fee_percent,
       seller_fee_percent = EXCLUDED.seller_fee_percent,
       updated_by = EXCLUDED.updated_by,
       updated_from = EXCLUDED.updated_from,
       updated_at = NOW()`,
    [plan, cycle, annualPaise, buyerFee, sellerFee, updatedBy, updatedFrom]
  );
  clearPricingCache();
}

async function listPrices() {
  const { rows } = await query(`SELECT plan, cycle, annual_paise, buyer_fee_percent, seller_fee_percent, updated_by, updated_from, updated_at FROM plan_prices ORDER BY plan, cycle`);
  return rows;
}

module.exports = {
  getEffectivePricePaise, 
  getEffectiveBuyerFeePercent, 
  getEffectiveSellerFeePercent, 
  getAllEffectivePrices,
  setPrice, 
  listPrices, 
  clearPricingCache,
};