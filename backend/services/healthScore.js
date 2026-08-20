'use strict';
// services/healthScore.js
//
// Customer Health Score - Composite metric
// Combines: Usage (35%) + Support (25%) + Billing (25%) + NPS/Sentiment (15%)
// Runs daily, provides actionable insights for CSMs

const { safeQuery: query } = require('../db/pool');
const { fetchPlatformCustomers } = require('./platformClient');
const { sendEmail } = require('./email');
const { createTask } = require('./tasks');
const { logAction } = require('./auditLog');

// ──────────────────────────────────────────────────────────────────────────
// Weights (must sum to 100)
// ──────────────────────────────────────────────────────────────────────────
const WEIGHTS = {
  usage: 35,        // login freq, feature adoption, API usage, session duration
  support: 25,      // ticket volume, resolution time, sentiment, escalation rate
  billing: 25,      // payment history, overdue, plan utilization, expansion
  sentiment: 15,    // NPS, survey responses, email sentiment, CSM feedback
};

// Sub-weights within each category
const SUB_WEIGHTS = {
  usage: {
    loginFrequency: 0.25,
    featureAdoption: 0.25,
    apiUsage: 0.20,
    sessionDuration: 0.15,
    activeUsersRatio: 0.15,
  },
  support: {
    openTickets: 0.30,
    avgResolutionTime: 0.20,
    ticketSentiment: 0.25,
    escalationRate: 0.15,
    csatScore: 0.10,
  },
  billing: {
    paymentReliability: 0.35,
    overdueAmount: 0.20,
    planUtilization: 0.20,
    expansionHistory: 0.15,
    contractTenure: 0.10,
  },
  sentiment: {
    npsScore: 0.40,
    surveyResponse: 0.30,
    emailSentiment: 0.20,
    csmRating: 0.10,
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Compute health score for a single customer
// ──────────────────────────────────────────────────────────────────────────
async function computeHealthScore(customer) {
  const categories = { usage: 0, support: 0, billing: 0, sentiment: 0 };
  const signals = {};

  // ─── USAGE (35%) ───
  // Login frequency (normalized: 20+ logins/mo = 100)
  const loginFreq = Math.min((customer.login_count_30d || 0) / 20, 1) * 100;
  signals.loginFrequency = loginFreq;

  // Feature adoption (0-1 from platform)
  const featAdopt = (customer.feature_adoption_pct || 0) * 100;
  signals.featureAdoption = featAdopt;

  // API usage (normalized: 1000+ calls/mo = 100)
  const apiUsage = Math.min((customer.api_calls_30d || 0) / 1000, 1) * 100;
  signals.apiUsage = apiUsage;

  // Session duration (placeholder - would need tracking)
  signals.sessionDuration = 50; // default

  // Active users ratio
  if (customer.seats && customer.active_users) {
    signals.activeUsersRatio = (customer.active_users / customer.seats) * 100;
  } else {
    signals.activeUsersRatio = 50;
  }

  categories.usage = (
    signals.loginFrequency * SUB_WEIGHTS.usage.loginFrequency +
    signals.featureAdoption * SUB_WEIGHTS.usage.featureAdoption +
    signals.apiUsage * SUB_WEIGHTS.usage.apiUsage +
    signals.sessionDuration * SUB_WEIGHTS.usage.sessionDuration +
    signals.activeUsersRatio * SUB_WEIGHTS.usage.activeUsersRatio
  );

  // ─── SUPPORT (25%) ───
  const { rows: tickets } = await query(
    `SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as open,
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours,
      COUNT(*) FILTER (WHERE priority = 'critical') as critical_count,
      COUNT(*) FILTER (WHERE csat_score IS NOT NULL) as csat_count,
      AVG(csat_score) as avg_csat
     FROM support_tickets WHERE customer_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
    [customer.id]
  );

  const t = tickets[0];
  const openTickets = parseInt(t?.open || 0);
  const avgResolution = parseFloat(t?.avg_resolution_hours || 24);
  const criticalTickets = parseInt(t?.critical_count || 0);
  const avgCsat = parseFloat(t?.avg_csat || 4);

  signals.openTickets = openTickets;
  signals.avgResolutionHours = avgResolution;
  signals.avgCsat = avgCsat;

  // Score components (lower is better for tickets/resolution)
  const ticketScore = Math.max(0, 100 - openTickets * 10);
  const resolutionScore = Math.max(0, 100 - (avgResolution / 48) * 100); // 48h = 0
  const csatScore = (avgCsat / 5) * 100;

  categories.support = (
    ticketScore * SUB_WEIGHTS.support.openTickets +
    resolutionScore * SUB_WEIGHTS.support.avgResolutionTime +
    csatScore * SUB_WEIGHTS.support.csatScore
  );

  // ─── BILLING (25%) ───
  const { rows: payments } = await query(
    `SELECT 
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) as total,
      SUM(amount) FILTER (WHERE status = 'overdue') as overdue_amount
     FROM payment_attempts WHERE customer_id = $1 AND created_at > NOW() - INTERVAL '12 months'`,
    [customer.id]
  );

  const { rows: invoices } = await query(
    `SELECT 
      COUNT(*) FILTER (WHERE status IN ('sent', 'overdue') AND due_date < NOW()) as overdue_count,
      SUM(total_amount) FILTER (WHERE status IN ('sent', 'overdue') AND due_date < NOW()) as overdue_total
     FROM invoices i
     JOIN parties p ON p.id = i.party_id
     WHERE p.platform_user_id = $1`,
    [customer.id]
  );

  const p = payments[0];
  const inv = invoices[0];
  const failedPayments = parseInt(p?.failed || 0);
  const totalPayments = parseInt(p?.total || 1);
  const overdueAmount = parseFloat(inv?.overdue_amount || 0);
  const overdueCount = parseInt(inv?.overdue_count || 0);

  signals.paymentFailureRate = totalPayments ? (failedPayments / totalPayments) * 100 : 0;
  signals.overdueAmount = overdueAmount;
  signals.overdueCount = overdueCount;

  const paymentScore = Math.max(0, 100 - signals.paymentFailureRate * 5);
  const overdueScore = Math.max(0, 100 - overdueCount * 15);

  // Plan utilization (if corporate with seats)
  let planUtilScore = 50;
  if (customer.seats && customer.active_users) {
    planUtilScore = (customer.active_users / customer.seats) * 100;
  }
  signals.planUtilization = planUtilScore;

  categories.billing = (
    paymentScore * SUB_WEIGHTS.billing.paymentReliability +
    overdueScore * SUB_WEIGHTS.billing.overdueAmount +
    planUtilScore * SUB_WEIGHTS.billing.planUtilization
  );

  // ─── SENTIMENT (15%) ───
  // NPS (would need survey table - placeholder)
  const nps = customer.nps_score || 30; // -100 to 100
  signals.nps = nps;

  // CSM rating (1-5 from internal tracking)
  const csmRating = customer.csm_rating || 3;
  signals.csmRating = csmRating;

  const npsScore = Math.max(0, Math.min(100, (nps + 100) / 2)); // -100 to 100 -> 0 to 100
  const csmScore = (csmRating / 5) * 100;

  categories.sentiment = (
    npsScore * SUB_WEIGHTS.sentiment.npsScore +
    csmScore * SUB_WEIGHTS.sentiment.csmRating
  );

  // ─── FINAL SCORE ───
  const overallScore = Math.round(
    categories.usage * (WEIGHTS.usage / 100) +
    categories.support * (WEIGHTS.support / 100) +
    categories.billing * (WEIGHTS.billing / 100) +
    categories.sentiment * (WEIGHTS.sentiment / 100)
  );

  // Health tier
  let tier = 'critical';
  if (overallScore >= 80) tier = 'healthy';
  else if (overallScore >= 60) tier = 'at_risk';
  else if (overallScore >= 40) tier = 'critical';

  return {
    customerId: customer.id,
    overallScore,
    tier,
    categories: {
      usage: Math.round(categories.usage),
      support: Math.round(categories.support),
      billing: Math.round(categories.billing),
      sentiment: Math.round(categories.sentiment),
    },
    signals,
    computedAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Score all customers
// ──────────────────────────────────────────────────────────────────────────
async function scoreAllCustomers() {
  const customers = await fetchPlatformCustomers(10000);
  const active = customers.filter(c => c.subscription_activated_at && c.subscription_plan !== 'free');

  const results = [];
  for (const c of active) {
    try {
      const scored = await computeHealthScore(c);
      results.push(scored);
    } catch (err) {
      console.error(`[healthScore] Failed to score ${c.id}:`, err.message);
    }
  }
  return results;
}

// ──────────────────────────────────────────────────────────────────────────
// Save to database
// ──────────────────────────────────────────────────────────────────────────
async function saveScores(results) {
  for (const r of results) {
    await query(
      `INSERT INTO health_scores (customer_id, overall_score, tier, category_scores, signals, computed_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (customer_id) DO UPDATE SET
         overall_score = EXCLUDED.overall_score,
         tier = EXCLUDED.tier,
         category_scores = EXCLUDED.category_scores,
         signals = EXCLUDED.signals,
         computed_at = EXCLUDED.computed_at`,
      [r.customerId, r.overallScore, r.tier, JSON.stringify(r.categories), JSON.stringify(r.signals), r.computedAt]
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Get scores for dashboard
// ──────────────────────────────────────────────────────────────────────────
async function getHealthScores(filters = {}) {
  let sql = `
    SELECT hs.*, c.email, c.full_name, c.company_name, c.subscription_plan, c.subscription_renewal_date, c.seats
    FROM health_scores hs
    JOIN customers c ON c.id = hs.customer_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.tier) {
    params.push(filters.tier);
    sql += ` AND hs.tier = $${params.length}`;
  }
  if (filters.minScore) {
    params.push(filters.minScore);
    sql += ` AND hs.overall_score >= $${params.length}`;
  }

  sql += ` ORDER BY hs.overall_score ASC LIMIT 200`; // Worst first for CSM focus

  const { rows } = await query(sql, params);
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────
// Get single customer detail with recommendations
// ──────────────────────────────────────────────────────────────────────────
async function getHealthDetail(customerId) {
  const { rows: [score] } = await query(
    `SELECT hs.*, c.email, c.full_name, c.company_name, c.subscription_plan, c.subscription_renewal_date, c.seats
     FROM health_scores hs
     JOIN customers c ON c.id = hs.customer_id
     WHERE hs.customer_id = $1`,
    [customerId]
  );
  if (!score) return null;

  // Generate recommendations based on lowest categories
  const recommendations = generateRecommendations(score);
  return { ...score, recommendations };
}

function generateRecommendations(score) {
  const recs = [];
  const cats = score.category_scores || {};

  if ((cats.usage || 0) < 50) {
    recs.push({ area: 'Usage', priority: 'high', action: 'Schedule product training session', reason: 'Low feature adoption and login frequency' });
  }
  if ((cats.support || 0) < 50) {
    recs.push({ area: 'Support', priority: 'high', action: 'Review open tickets and improve response time', reason: 'High ticket volume or slow resolution' });
  }
  if ((cats.billing || 0) < 50) {
    recs.push({ area: 'Billing', priority: 'high', action: 'Contact finance to resolve overdue payments', reason: 'Payment failures or overdue invoices' });
  }
  if ((cats.sentiment || 0) < 50) {
    recs.push({ area: 'Sentiment', priority: 'medium', action: 'Send NPS survey and schedule CSM call', reason: 'Low NPS or CSM rating' });
  }

  return recs;
}

// ──────────────────────────────────────────────────────────────────────────
// Daily cron
// ──────────────────────────────────────────────────────────────────────────
async function runDailyHealthScoring() {
  console.log('[healthScore] Starting daily health scoring...');
  const results = await scoreAllCustomers();
  await saveScores(results);
  console.log(`[healthScore] Scored ${results.length} customers`);
  return { scored: results.length };
}

module.exports = {
  computeHealthScore,
  scoreAllCustomers,
  saveScores,
  getHealthScores,
  getHealthDetail,
  runDailyHealthScoring,
  WEIGHTS,
  SUB_WEIGHTS,
};