'use strict';
// services/churnPrediction.js
//
// AI Churn Prediction Model
// Scores every customer weekly based on behavioral signals
// Auto-alerts CSM for high-risk accounts

const { safeQuery: query } = require('../db/pool');
const { fetchPlatformCustomers } = require('./platformClient');
const { sendEmail } = require('./email');
const { createTask } = require('./tasks');
const { logAction } = require('./auditLog');

// ──────────────────────────────────────────────────────────────────────────
// Scoring Weights (tunable)
// ──────────────────────────────────────────────────────────────────────────
const WEIGHTS = {
  // Usage signals (40%)
  lastLoginDays: 15,           // days since last login
  loginFrequency30d: 10,       // logins per 30 days
  featureAdoption: 10,         // % of key features used
  apiCalls30d: 5,              // API activity

  // Support signals (25%)
  openTickets: 10,             // # open support tickets
  ticketSentiment: 8,          // negative sentiment score
  timeToFirstResponse: 7,      // avg response time

  // Billing signals (20%)
  paymentFailures: 12,         // failed payments in 90 days
  invoiceOverdue: 8,           // overdue invoices

  // Contract signals (15%)
  daysToRenewal: 10,           // days until renewal
  seatUtilization: 5,          // seats used / seats purchased
};

// Risk thresholds
const RISK_THRESHOLDS = {
  low: 30,
  medium: 50,
  high: 70,
  critical: 85,
};

// ──────────────────────────────────────────────────────────────────────────
// Compute churn score for a single customer
// ──────────────────────────────────────────────────────────────────────────
async function computeChurnScore(customer) {
  const signals = {};
  let score = 0;
  const maxScore = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

  // 1. Last login (from platform or agent tracking)
  if (customer.last_login_at) {
    const daysSinceLogin = (Date.now() - new Date(customer.last_login_at).getTime()) / 86400000;
    signals.lastLoginDays = Math.min(daysSinceLogin, 90);
    // Score increases with days since login
    score += WEIGHTS.lastLoginDays * Math.min(daysSinceLogin / 90, 1);
  } else {
    signals.lastLoginDays = 90;
    score += WEIGHTS.lastLoginDays;
  }

  // 2. Login frequency (would need platform data - placeholder)
  signals.loginFrequency30d = customer.login_count_30d || 0;
  const freqScore = Math.max(0, 1 - (signals.loginFrequency30d / 20)); // 20+ logins = good
  score += WEIGHTS.loginFrequency30d * freqScore;

  // 3. Feature adoption (placeholder - would need event tracking)
  signals.featureAdoption = customer.feature_adoption_pct || 0.3;
  score += WEIGHTS.featureAdoption * (1 - signals.featureAdoption);

  // 4. API calls
  signals.apiCalls30d = customer.api_calls_30d || 0;
  const apiScore = Math.max(0, 1 - (signals.apiCalls30d / 1000));
  score += WEIGHTS.apiCalls30d * apiScore;

  // 5. Open support tickets
  const { rows: tickets } = await query(
    `SELECT COUNT(*) as count FROM support_tickets WHERE customer_id = $1 AND status IN ('open', 'in_progress')`,
    [customer.id]
  );
  signals.openTickets = parseInt(tickets[0]?.count || 0);
  score += WEIGHTS.openTickets * Math.min(signals.openTickets / 5, 1);

  // 6. Payment failures
  const { rows: payments } = await query(
    `SELECT COUNT(*) as count FROM payment_attempts WHERE customer_id = $1 AND status = 'failed' AND created_at > NOW() - INTERVAL '90 days'`,
    [customer.id]
  );
  signals.paymentFailures = parseInt(payments[0]?.count || 0);
  score += WEIGHTS.paymentFailures * Math.min(signals.paymentFailures / 3, 1);

  // 7. Overdue invoices
  const { rows: invoices } = await query(
    `SELECT COUNT(*) as count FROM invoices WHERE party_id = (SELECT id FROM parties WHERE platform_user_id = $1) AND status IN ('sent', 'overdue') AND due_date < NOW()`,
    [customer.id]
  );
  signals.invoiceOverdue = parseInt(invoices[0]?.count || 0);
  score += WEIGHTS.invoiceOverdue * Math.min(signals.invoiceOverdue / 3, 1);

  // 8. Days to renewal
  if (customer.subscription_renewal_date) {
    const daysToRenewal = (new Date(customer.subscription_renewal_date) - Date.now()) / 86400000;
    signals.daysToRenewal = Math.max(0, daysToRenewal);
    // Higher risk as renewal approaches without engagement
    if (daysToRenewal < 30) score += WEIGHTS.daysToRenewal * (1 - daysToRenewal / 30);
  } else {
    signals.daysToRenewal = null;
  }

  // 9. Seat utilization
  if (customer.seats && customer.active_users) {
    signals.seatUtilization = customer.active_users / customer.seats;
    score += WEIGHTS.seatUtilization * (1 - signals.seatUtilization);
  } else {
    signals.seatUtilization = null;
  }

  // Normalize to 0-100
  const normalizedScore = Math.round((score / maxScore) * 100);

  // Determine risk level
  let riskLevel = 'low';
  if (normalizedScore >= RISK_THRESHOLDS.critical) riskLevel = 'critical';
  else if (normalizedScore >= RISK_THRESHOLDS.high) riskLevel = 'high';
  else if (normalizedScore >= RISK_THRESHOLDS.medium) riskLevel = 'medium';

  return {
    customerId: customer.id,
    score: normalizedScore,
    riskLevel,
    signals,
    computedAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Score all active corporate customers
// ──────────────────────────────────────────────────────────────────────────
async function scoreAllCustomers() {
  const customers = await fetchPlatformCustomers(10000);
  const corporate = customers.filter(c => c.subscription_plan === 'corporate' && c.subscription_activated_at);

  const results = [];
  for (const c of corporate) {
    try {
      const scored = await computeChurnScore(c);
      results.push(scored);
    } catch (err) {
      console.error(`[churnPrediction] Failed to score ${c.id}:`, err.message);
    }
  }

  return results;
}

// ──────────────────────────────────────────────────────────────────────────
// Save scores to database
// ──────────────────────────────────────────────────────────────────────────
async function saveScores(results) {
  for (const r of results) {
    await query(
      `INSERT INTO churn_scores (customer_id, score, risk_level, signals, computed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (customer_id) DO UPDATE SET
         score = EXCLUDED.score,
         risk_level = EXCLUDED.risk_level,
         signals = EXCLUDED.signals,
         computed_at = EXCLUDED.computed_at`,
      [r.customerId, r.score, r.riskLevel, JSON.stringify(r.signals), r.computedAt]
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Alert CSMs for high-risk accounts
// ──────────────────────────────────────────────────────────────────────────
async function alertHighRisk(results) {
  const highRisk = results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical');

  for (const r of highRisk) {
    // Get assigned CSM (from account owner or default)
    const { rows: [csm] } = await query(
      `SELECT s.id, s.email, s.full_name FROM staff_accounts s
       JOIN employees e ON e.id = s.employee_id
       WHERE e.id = (SELECT account_owner_id FROM customers WHERE id = $1)
         AND s.is_active = TRUE
       LIMIT 1`,
      [r.customerId]
    );

    const assignee = csm?.email || process.env.CSM_DEFAULT_EMAIL || 'founder@ethertrack.in';

    // Create task
    await createTask({
      title: `🚨 Churn Risk: ${r.riskLevel.toUpperCase()} - ${r.customerId}`,
      description: `Customer scored ${r.score}/100 churn risk. Key signals: ${formatSignals(r.signals)}`,
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), // 2 days
      assignedTo: assignee,
      relatedEntity: 'customer',
      relatedEntityId: r.customerId,
      priority: r.riskLevel === 'critical' ? 'urgent' : 'high',
      tags: ['churn', r.riskLevel],
    });

    // Send email
    await sendEmail({
      to: assignee,
      subject: `🚨 Churn Alert: ${r.riskLevel.toUpperCase()} risk (${r.score}/100) - Customer ${r.customerId}`,
      html: `
        <h2>Churn Risk Alert</h2>
        <p><strong>Customer:</strong> ${r.customerId}</p>
        <p><strong>Risk Level:</strong> <span style="color: ${r.riskLevel === 'critical' ? '#e5484d' : '#e5a54b'}">${r.riskLevel.toUpperCase()}</span> (${r.score}/100)</p>
        <p><strong>Key Signals:</strong></p>
        <ul>${Object.entries(r.signals).map(([k, v]) => `<li>${k}: ${v}</li>`).join('')}</ul>
        <p><a href="${process.env.FRONTEND_URL}/customers/${r.customerId}">View in ERP</a></p>
      `,
    }).catch(e => console.error('[churnPrediction] Email failed:', e.message));
  }
}

function formatSignals(signals) {
  return Object.entries(signals)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(2) : v}`)
    .join(', ');
}

// ──────────────────────────────────────────────────────────────────────────
// Weekly cron job
// ──────────────────────────────────────────────────────────────────────────
async function runWeeklyChurnScoring() {
  console.log('[churnPrediction] Starting weekly churn scoring...');

  const results = await scoreAllCustomers();
  await saveScores(results);
  await alertHighRisk(results);

  console.log(`[churnPrediction] Scored ${results.length} customers. High risk: ${results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length}`);

  return { scored: results.length, highRisk: results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length };
}

// ──────────────────────────────────────────────────────────────────────────
// Get latest scores for dashboard
// ──────────────────────────────────────────────────────────────────────────
async function getChurnScores(filters = {}) {
  let sql = `
    SELECT cs.*, c.email, c.full_name, c.company_name, c.subscription_plan, c.subscription_renewal_date, c.seats
    FROM churn_scores cs
    JOIN customers c ON c.id = cs.customer_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.riskLevel) {
    params.push(filters.riskLevel);
    sql += ` AND cs.risk_level = $${params.length}`;
  }
  if (filters.minScore) {
    params.push(filters.minScore);
    sql += ` AND cs.score >= $${params.length}`;
  }

  sql += ` ORDER BY cs.score DESC LIMIT 200`;

  const { rows } = await query(sql, params);
  return rows;
}

module.exports = {
  computeChurnScore,
  scoreAllCustomers,
  saveScores,
  alertHighRisk,
  runWeeklyChurnScoring,
  getChurnScores,
  WEIGHTS,
  RISK_THRESHOLDS,
};