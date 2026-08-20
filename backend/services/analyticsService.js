'use strict';

const { pool, safeQuery } = require('../db/pool');

// ════════════════════════════════════════════════════════════════════════
// MRR / ARR / CHURN ANALYTICS SERVICE
// Single source of truth for all subscription metrics
// ════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────
// Helper: normalize plan names & get monthly value
// ──────────────────────────────────────────────────────────────────────────
const PLAN_MONTHLY_INR = {
  starter: 2999,
  growth: 9999,
  corporate: 49999, // base, seats multiplier applied separately
};

function monthlyValue(plan, seats = 1) {
  const base = PLAN_MONTHLY_INR[plan] || 0;
  return plan === 'corporate' ? base * seats : base;
}

// ──────────────────────────────────────────────────────────────────────────
// MRR SNAPSHOT — current active subscriptions
// ──────────────────────────────────────────────────────────────────────────
async function getMrrSnapshot() {
  // Uses platform customer data via existing service
  const { fetchPlatformCustomers } = require('../services/platformClient');
  const customers = await fetchPlatformCustomers(10000);

  let mrr = 0;
  let arr = 0;
  const byPlan = { starter: 0, growth: 0, corporate: 0 };
  const byCycle = { monthly: 0, yearly: 0 };
  let activeCount = 0;
  let corporateSeats = 0;

  for (const c of customers) {
    if (!c.subscription_plan || c.subscription_plan === 'free') continue;
    if (!c.subscription_activated_at) continue; // not yet active
    if (c.subscription_renewal_date && new Date(c.subscription_renewal_date) < new Date()) continue; // expired

    const plan = c.subscription_plan;
    const seats = c.seats || 1;
    const mv = monthlyValue(plan, seats);

    mrr += mv;
    arr += mv * 12;
    byPlan[plan] = (byPlan[plan] || 0) + mv;
    byCycle[c.subscription_cycle || 'monthly'] = (byCycle[c.subscription_cycle || 'monthly'] || 0) + mv;
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

// ──────────────────────────────────────────────────────────────────────────
// CHURN COHORTS — monthly cohorts with retention %
// ──────────────────────────────────────────────────────────────────────────
async function getChurnCohorts(monthsBack = 12) {
  const { fetchPlatformCustomers } = require('../services/platformClient');
  const customers = await fetchPlatformCustomers(10000);

  const cohorts = {};
  const now = new Date();

  for (const c of customers) {
    if (!c.subscription_plan || c.subscription_plan === 'free') continue;
    if (!c.subscription_activated_at) continue;

    const activated = new Date(c.subscription_activated_at);
    const cohortKey = `${activated.getFullYear()}-${String(activated.getMonth() + 1).padStart(2, '0')}`;

    if (!cohorts[cohortKey]) {
      cohorts[cohortKey] = {
        cohortMonth: cohortKey,
        started: 0,
        active: 0,
        churned: 0,
        expanded: 0,
        contracted: 0,
        mrrStarted: 0,
        mrrCurrent: 0,
      };
    }

    const plan = c.subscription_plan;
    const seats = c.seats || 1;
    const mv = monthlyValue(plan, seats);

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

  // Convert to array, sort by cohort month, calculate retention
  return Object.values(cohorts)
    .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
    .slice(-monthsBack)
    .map(c => ({
      ...c,
      retentionRate: c.started ? (c.active / c.started * 100).toFixed(1) : 0,
      netRevenueRetention: c.mrrStarted ? (c.mrrCurrent / c.mrrStarted * 100).toFixed(1) : 0,
    }));
}

// ──────────────────────────────────────────────────────────────────────────
// EXPANSION / CONTRACTION REVENUE
// ──────────────────────────────────────────────────────────────────────────
async function getExpansionMetrics() {
  const { fetchPlatformCustomers } = require('../services/platformClient');
  const customers = await fetchPlatformCustomers(10000);

  let newMrr = 0;
  let expansionMrr = 0;
  let contractionMrr = 0;
  let churnedMrr = 0;
  let reactivationMrr = 0;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  for (const c of customers) {
    if (!c.subscription_plan || c.subscription_plan === 'free') continue;
    if (!c.subscription_activated_at) continue;

    const plan = c.subscription_plan;
    const seats = c.seats || 1;
    const mv = monthlyValue(plan, seats);
    const activated = new Date(c.subscription_activated_at);
    const renewed = c.subscription_renewal_date ? new Date(c.subscription_renewal_date) : null;

    // New MRR (activated in last 30 days)
    if (activated >= thirtyDaysAgo) {
      newMrr += mv;
      continue;
    }

    // Churned (renewal date passed)
    if (renewed && renewed < now) {
      churnedMrr += mv;
      continue;
    }

    // Active - check for plan/seat changes (would need history table for true expansion/contraction)
    // For now, estimate based on corporate seats > 1
    if (plan === 'corporate' && seats > 1) {
      expansionMrr += mv * 0.1; // proxy
    }
  }

  const netNewMrr = newMrr + expansionMrr - contractionMrr - churnedMrr + reactivationMrr;

  return {
    newMrr,
    expansionMrr,
    contractionMrr,
    churnedMrr,
    reactivationMrr,
    netNewMrr,
    grossMrrChurnRate: (churnedMrr / (newMrr + expansionMrr + contractionMrr + churnedMrr) * 100) || 0,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// LTV / CAC / PAYBACK (estimates — need marketing spend data for true CAC)
// ──────────────────────────────────────────────────────────────────────────
async function getUnitEconomics() {
  const mrr = await getMrrSnapshot();
  const churn = await getChurnCohorts(12);

  // Average monthly churn rate from cohorts
  const avgMonthlyChurn = churn.length
    ? churn.reduce((sum, c) => sum + (100 - parseFloat(c.retentionRate)), 0) / churn.length
    : 5; // fallback 5%

  const ltv = mrr.avgRevenuePerUser && avgMonthlyChurn
    ? (mrr.avgRevenuePerUser / (avgMonthlyChurn / 100))
    : 0;

  // CAC placeholder - would need marketing spend / new customers
  const cac = 0; // TODO: connect to marketing spend
  const paybackMonths = cac && mrr.avgRevenuePerUser ? cac / mrr.avgRevenuePerUser : 0;

  return {
    ltv: Math.round(ltv),
    cac,
    paybackMonths: Math.round(paybackMonths * 10) / 10,
    avgMonthlyChurn: Math.round(avgMonthlyChurn * 10) / 10,
    ltvToCac: cac ? Math.round(ltv / cac * 10) / 10 : null,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// QUICK STATS FOR DASHBOARD CARDS
// ──────────────────────────────────────────────────────────────────────────
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
  PLAN_MONTHLY_INR,
  monthlyValue,
};