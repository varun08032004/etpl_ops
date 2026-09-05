'use strict';

const { pool, safeQuery } = require('../db/pool');
const { fetchPlatformCustomers } = require('./platformClient');

let _planPricingCache = null;
let _planPricingCacheTime = 0;
const PLAN_PRICING_CACHE_TTL_MS = 5 * 60 * 1000;

async function getPlanPricing() {
  const now = Date.now();
  if (_planPricingCache && (now - _planPricingCacheTime) < PLAN_PRICING_CACHE_TTL_MS) {
    return _planPricingCache;
  }
  const result = await safeQuery(`
    SELECT plan_key, billing_cycle, price_inr, seats_included, price_per_seat
    FROM plan_pricing
    WHERE is_active = TRUE
      AND effective_from <= CURRENT_DATE
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  `);
  _planPricingCache = result.rows;
  _planPricingCacheTime = now;
  return _planPricingCache;
}

function clearPlanPricingCache() {
  _planPricingCache = null;
  _planPricingCacheTime = 0;
}

function getMonthlyPrice(planKey, billingCycle, seats = 1) {
  const pricing = _planPricingCache || [];
  const match = pricing.find(p => p.plan_key === planKey && p.billing_cycle === billingCycle);
  if (!match) return 0;
  const baseSeats = match.seats_included || 1;
  const basePrice = parseFloat(match.price_inr);
  const perSeatPrice = parseFloat(match.price_per_seat);
  if (seats <= baseSeats) return basePrice;
  return basePrice + (seats - baseSeats) * perSeatPrice;
}

let _customersCache = null;
let _customersCacheTime = 0;
const CUSTOMERS_CACHE_TTL_MS = 5 * 60 * 1000;

async function getCustomers() {
  const now = Date.now();
  if (_customersCache && (now - _customersCacheTime) < CUSTOMERS_CACHE_TTL_MS) {
    return _customersCache;
  }
  _customersCache = await fetchPlatformCustomers(10000);
  _customersCacheTime = now;
  return _customersCache;
}

function clearCustomersCache() {
  _customersCache = null;
  _customersCacheTime = 0;
}

function computeMrrFromCustomers(customers) {
  const now = new Date();
  let mrr = 0, arr = 0, activeCount = 0, corporateSeats = 0;
  const byPlan = { starter: 0, growth: 0, corporate: 0 };
  const byCycle = { monthly: 0, yearly: 0 };

  for (const c of customers) {
    if (!c.subscription_plan || c.subscription_plan === 'free') continue;
    if (!c.subscription_activated_at) continue;
    if (c.subscription_renewal_date && new Date(c.subscription_renewal_date) < now) continue;

    const plan = c.subscription_plan;
    const seats = c.seats || 1;
    const cycle = c.subscription_cycle || 'monthly';
    const mv = getMonthlyPrice(plan, cycle, seats);

    mrr += mv;
    arr += mv * 12;
    byPlan[plan] = (byPlan[plan] || 0) + mv;
    byCycle[cycle] = (byCycle[cycle] || 0) + mv;
    activeCount++;
    if (plan === 'corporate') corporateSeats += seats;
  }

  return {
    mrr,
    arr,
    activeSubscriptions: activeCount,
    byPlan,
    byCycle,
    corporateSeats,
    avgRevenuePerUser: activeCount ? mrr / activeCount : 0,
  };
}

async function getMrrSnapshot() {
  const [customers] = await Promise.all([
    getCustomers(),
    getPlanPricing(),
  ]);
  return computeMrrFromCustomers(customers);
}

async function getChurnCohorts(monthsBack = 12) {
  const customers = await getCustomers();
  const now = new Date();
  const cohorts = {};

  for (const c of customers) {
    if (!c.subscription_plan || c.subscription_plan === 'free') continue;
    if (!c.subscription_activated_at) continue;

    const activated = new Date(c.subscription_activated_at);
    const cohortKey = `${activated.getFullYear()}-${String(activated.getMonth() + 1).padStart(2, '0')}`;

    if (!cohorts[cohortKey]) {
      cohorts[cohortKey] = {
        cohortMonth: cohortKey,
        started: 0, active: 0, churned: 0, expanded: 0, contracted: 0,
        mrrStarted: 0, mrrCurrent: 0,
      };
    }

    const plan = c.subscription_plan;
    const seats = c.seats || 1;
    const cycle = c.subscription_cycle || 'monthly';
    const mv = getMonthlyPrice(plan, cycle, seats);

    cohorts[cohortKey].started++;
    cohorts[cohortKey].mrrStarted += mv;

    const isActive = c.subscription_renewal_date && new Date(c.subscription_renewal_date) >= now;
    const isChurned = c.subscription_renewal_date && new Date(c.subscription_renewal_date) < now;

    if (isActive) {
      cohorts[cohortKey].active++;
      cohorts[cohortKey].mrrCurrent += mv;
    } else if (isChurned) {
      cohorts[cohortKey].churned++;
    }
  }

  return Object.values(cohorts)
    .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
    .slice(-monthsBack)
    .map(c => ({
      ...c,
      retentionRate: c.started ? (c.active / c.started * 100).toFixed(1) : 0,
      netRevenueRetention: c.mrrStarted ? (c.mrrCurrent / c.mrrStarted * 100).toFixed(1) : 0,
    }));
}

async function getExpansionMetrics() {
  const customers = await getCustomers();

  let newMrr = 0, expansionMrr = 0, contractionMrr = 0, churnedMrr = 0, reactivationMrr = 0;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  for (const c of customers) {
    if (!c.subscription_plan || c.subscription_plan === 'free') continue;
    if (!c.subscription_activated_at) continue;

    const plan = c.subscription_plan;
    const seats = c.seats || 1;
    const cycle = c.subscription_cycle || 'monthly';
    const mv = getMonthlyPrice(plan, cycle, seats);
    const activated = new Date(c.subscription_activated_at);
    const renewed = c.subscription_renewal_date ? new Date(c.subscription_renewal_date) : null;

    if (activated >= thirtyDaysAgo && activated <= now) {
      newMrr += mv;
      continue;
    }

    if (renewed && renewed >= thirtyDaysAgo && renewed < now) {
      churnedMrr += mv;
      continue;
    }

    if (plan === 'corporate' && seats > 1) {
      expansionMrr += mv * 0.1;
    }
  }

  const netNewMrr = newMrr + expansionMrr - contractionMrr - churnedMrr + reactivationMrr;
  const grossMrrChurnRate = (newMrr + expansionMrr + contractionMrr + churnedMrr) > 0
    ? (churnedMrr / (newMrr + expansionMrr + contractionMrr + churnedMrr) * 100)
    : 0;

  return {
    newMrr,
    expansionMrr,
    contractionMrr,
    churnedMrr,
    reactivationMrr,
    netNewMrr,
    grossMrrChurnRate,
  };
}

async function getMarketingSpendAndCustomers(sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86400000);
  const to = new Date();
  const result = await safeQuery(`
    SELECT COALESCE(SUM(amount_inr), 0) as total_spend, COALESCE(SUM(new_customers), 0) as total_customers
    FROM analytics_marketing_spend
    WHERE spend_date >= $1 AND spend_date <= $2
  `, [since.toISOString().split('T')[0], to.toISOString().split('T')[0]]);

  return {
    totalSpend: parseFloat(result.rows[0]?.total_spend || 0),
    totalCustomers: parseInt(result.rows[0]?.total_customers || 0),
  };
}

async function getUnitEconomics() {
  const [mrr, churn, marketing] = await Promise.all([
    getMrrSnapshot(),
    getChurnCohorts(12),
    getMarketingSpendAndCustomers(30),
  ]);

  const avgMonthlyChurn = churn.length
    ? churn.reduce((sum, c) => sum + (100 - parseFloat(c.retentionRate)), 0) / churn.length
    : 5;

  const ltv = mrr.avgRevenuePerUser && avgMonthlyChurn
    ? (mrr.avgRevenuePerUser / (avgMonthlyChurn / 100))
    : 0;

  const cac = marketing.totalCustomers > 0 ? marketing.totalSpend / marketing.totalCustomers : 0;
  const paybackMonths = cac && mrr.avgRevenuePerUser ? cac / mrr.avgRevenuePerUser : 0;

  return {
    ltv: Math.round(ltv),
    cac: Math.round(cac),
    paybackMonths: Math.round(paybackMonths * 10) / 10,
    avgMonthlyChurn: Math.round(avgMonthlyChurn * 10) / 10,
    ltvToCac: cac ? Math.round(ltv / cac * 10) / 10 : null,
    marketingSpend: marketing.totalSpend,
    newCustomersCount: marketing.totalCustomers,
  };
}

async function getDashboardStats() {
  const [mrr, expansion, unitEcon] = await Promise.all([
    getMrrSnapshot(),
    getExpansionMetrics(),
    getUnitEconomics(),
  ]);

  return {
    mrr: mrr.mrr,
    arr: mrr.arr,
    activeSubscriptions: mrr.activeSubscriptions,
    newMrr: expansion.newMrr,
    churnedMrr: expansion.churnedMrr,
    netNewMrr: expansion.netNewMrr,
    ltv: unitEcon.ltv,
    cac: unitEcon.cac,
    paybackMonths: unitEcon.paybackMonths,
    avgMonthlyChurn: unitEcon.avgMonthlyChurn,
  };
}

module.exports = {
  getMrrSnapshot,
  getChurnCohorts,
  getExpansionMetrics,
  getUnitEconomics,
  getDashboardStats,
  clearCustomersCache,
  clearPlanPricingCache,
  getCustomers,
  getPlanPricing,
  computeMrrFromCustomers,
};