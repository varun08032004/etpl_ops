'use strict';

const cron = require('node-cron');
const { pool, safeQuery } = require('../db/pool');
const { fetchPlatformCustomers } = require('./platformClient');

const PLAN_MONTHLY_INR = {
  starter: 2999,
  growth: 9999,
  corporate: 49999,
};

function monthlyValue(plan, seats = 1) {
  const base = PLAN_MONTHLY_INR[plan] || 0;
  return plan === 'corporate' ? base * seats : base;
}

async function computeAndStoreAnalytics() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const customers = await fetchPlatformCustomers(10000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

    // ─── 1. MRR Snapshot ───
    let mrr = 0, arr = 0, activeCount = 0, corporateSeats = 0;
    const byPlan = { starter: 0, growth: 0, corporate: 0 };
    const byCycle = { monthly: 0, yearly: 0 };

    for (const c of customers) {
      if (!c.subscription_plan || c.subscription_plan === 'free') continue;
      if (!c.subscription_activated_at) continue;
      if (c.subscription_renewal_date && new Date(c.subscription_renewal_date) < now) continue;

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

    const avgRevenuePerUser = activeCount ? mrr / activeCount : 0;

    await client.query(`
      INSERT INTO analytics_mrr_snapshots (snapshot_date, mrr, arr, active_subscriptions, corporate_seats, by_plan, by_cycle, avg_revenue_per_user)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (snapshot_date) DO UPDATE SET
        mrr = EXCLUDED.mrr,
        arr = EXCLUDED.arr,
        active_subscriptions = EXCLUDED.active_subscriptions,
        corporate_seats = EXCLUDED.corporate_seats,
        by_plan = EXCLUDED.by_plan,
        by_cycle = EXCLUDED.by_cycle,
        avg_revenue_per_user = EXCLUDED.avg_revenue_per_user
    `, [today, mrr, arr, activeCount, corporateSeats, JSON.stringify(byPlan), JSON.stringify(byCycle), avgRevenuePerUser]);

    // ─── 2. Daily MRR Time Series ───
    let newSubs = 0, churnedSubs = 0;
    for (const c of customers) {
      if (!c.subscription_plan || c.subscription_plan === 'free') continue;
      if (!c.subscription_activated_at) continue;
      const activated = new Date(c.subscription_activated_at);
      const renewed = c.subscription_renewal_date ? new Date(c.subscription_renewal_date) : null;
      if (activated >= today && activated < new Date(today.getTime() + 86400000)) newSubs++;
      if (renewed && renewed >= today && renewed < new Date(today.getTime() + 86400000)) churnedSubs++;
    }

    await client.query(`
      INSERT INTO analytics_daily_mrr (record_date, mrr, arr, active_subscriptions, new_subscriptions, churned_subscriptions, net_new_subscriptions, by_plan)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (record_date) DO UPDATE SET
        mrr = EXCLUDED.mrr,
        arr = EXCLUDED.arr,
        active_subscriptions = EXCLUDED.active_subscriptions,
        new_subscriptions = EXCLUDED.new_subscriptions,
        churned_subscriptions = EXCLUDED.churned_subscriptions,
        net_new_subscriptions = EXCLUDED.net_new_subscriptions,
        by_plan = EXCLUDED.by_plan
    `, [today, mrr, arr, activeCount, newSubs, churnedSubs, newSubs - churnedSubs, JSON.stringify(byPlan)]);

    // ─── 3. Churn Cohorts ───
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

    for (const c of Object.values(cohorts)) {
      const retentionRate = c.started ? (c.active / c.started * 100) : 0;
      const netRevenueRetention = c.mrrStarted ? (c.mrrCurrent / c.mrrStarted * 100) : 0;

      await client.query(`
        INSERT INTO analytics_churn_cohorts (cohort_month, snapshot_date, started, active, churned, expanded, contracted, mrr_started, mrr_current, retention_rate, net_revenue_retention)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (cohort_month, snapshot_date) DO UPDATE SET
          started = EXCLUDED.started,
          active = EXCLUDED.active,
          churned = EXCLUDED.churned,
          expanded = EXCLUDED.expanded,
          contracted = EXCLUDED.contracted,
          mrr_started = EXCLUDED.mrr_started,
          mrr_current = EXCLUDED.mrr_current,
          retention_rate = EXCLUDED.retention_rate,
          net_revenue_retention = EXCLUDED.net_revenue_retention
      `, [c.cohortMonth, today, c.started, c.active, c.churned, c.expanded, c.contracted, c.mrrStarted, c.mrrCurrent, retentionRate, netRevenueRetention]);
    }

    // ─── 4. Expansion Metrics (30-day window) ───
    let newMrr = 0, expansionMrr = 0, contractionMrr = 0, churnedMrr = 0, reactivationMrr = 0;

    for (const c of customers) {
      if (!c.subscription_plan || c.subscription_plan === 'free') continue;
      if (!c.subscription_activated_at) continue;

      const plan = c.subscription_plan;
      const seats = c.seats || 1;
      const mv = monthlyValue(plan, seats);
      const activated = new Date(c.subscription_activated_at);
      const renewed = c.subscription_renewal_date ? new Date(c.subscription_renewal_date) : null;

      // New MRR (activated in last 30 days)
      if (activated >= thirtyDaysAgo && activated <= today) {
        newMrr += mv;
        continue;
      }

      // Churned (renewal date passed in last 30 days)
      if (renewed && renewed >= thirtyDaysAgo && renewed < now) {
        churnedMrr += mv;
        continue;
      }

      // Active - proxy for expansion/contraction (would need history table for true values)
      if (plan === 'corporate' && seats > 1) {
        expansionMrr += mv * 0.1;
      }
    }

    const netNewMrr = newMrr + expansionMrr - contractionMrr - churnedMrr + reactivationMrr;
    const grossMrrChurnRate = (newMrr + expansionMrr + contractionMrr + churnedMrr) > 0
      ? (churnedMrr / (newMrr + expansionMrr + contractionMrr + churnedMrr) * 100)
      : 0;

    await client.query(`
      INSERT INTO analytics_expansion_snapshots (snapshot_date, period_start, period_end, new_mrr, expansion_mrr, contraction_mrr, churned_mrr, reactivation_mrr, net_new_mrr, gross_mrr_churn_rate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (snapshot_date) DO UPDATE SET
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        new_mrr = EXCLUDED.new_mrr,
        expansion_mrr = EXCLUDED.expansion_mrr,
        contraction_mrr = EXCLUDED.contraction_mrr,
        churned_mrr = EXCLUDED.churned_mrr,
        reactivation_mrr = EXCLUDED.reactivation_mrr,
        net_new_mrr = EXCLUDED.net_new_mrr,
        gross_mrr_churn_rate = EXCLUDED.gross_mrr_churn_rate
    `, [today, thirtyDaysAgo, today, newMrr, expansionMrr, contractionMrr, churnedMrr, reactivationMrr, netNewMrr, grossMrrChurnRate]);

    // ─── 5. Unit Economics ───
    // Get average monthly churn from last 12 cohort snapshots
    const cohortRes = await client.query(`
      SELECT retention_rate FROM analytics_churn_cohorts
      WHERE snapshot_date = $1
      ORDER BY cohort_month DESC
      LIMIT 12
    `, [today]);

    const avgMonthlyChurn = cohortRes.rows.length
      ? cohortRes.rows.reduce((sum, row) => sum + (100 - parseFloat(row.retention_rate)), 0) / cohortRes.rows.length
      : 5;

    const ltv = avgRevenuePerUser && avgMonthlyChurn
      ? (avgRevenuePerUser / (avgMonthlyChurn / 100))
      : 0;

    // CAC from marketing spend (last 30 days)
    const marketingRes = await client.query(`
      SELECT COALESCE(SUM(amount_inr), 0) as total_spend, COALESCE(SUM(new_customers), 0) as total_customers
      FROM analytics_marketing_spend
      WHERE spend_date >= $1 AND spend_date <= $2
    `, [thirtyDaysAgo, today]);

    const totalMarketingSpend = parseFloat(marketingRes.rows[0]?.total_spend || 0);
    const totalNewCustomers = parseInt(marketingRes.rows[0]?.total_customers || 0);
    const cac = totalNewCustomers > 0 ? totalMarketingSpend / totalNewCustomers : 0;
    const paybackMonths = cac && avgRevenuePerUser ? cac / avgRevenuePerUser : 0;
    const ltvToCac = cac ? ltv / cac : null;

    await client.query(`
      INSERT INTO analytics_unit_economics_snapshots (snapshot_date, ltv, cac, payback_months, avg_monthly_churn, ltv_to_cac_ratio, marketing_spend, new_customers_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (snapshot_date) DO UPDATE SET
        ltv = EXCLUDED.ltv,
        cac = EXCLUDED.cac,
        payback_months = EXCLUDED.payback_months,
        avg_monthly_churn = EXCLUDED.avg_monthly_churn,
        ltv_to_cac_ratio = EXCLUDED.ltv_to_cac_ratio,
        marketing_spend = EXCLUDED.marketing_spend,
        new_customers_count = EXCLUDED.new_customers_count
    `, [today, ltv, cac, paybackMonths, avgMonthlyChurn, ltvToCac, totalMarketingSpend, totalNewCustomers]);

    await client.query('COMMIT');
    console.log(`[analyticsScheduler] Analytics computed and stored for ${today.toISOString().split('T')[0]}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[analyticsScheduler] Failed to compute analytics:', err);
  } finally {
    client.release();
  }
}

// Run daily at 05:30 (after healthScore at 05:00, before renewalWorkflow at 07:30)
cron.schedule('30 5 * * *', computeAndStoreAnalytics);

console.log('[analyticsScheduler] Scheduled: analytics computation will run at 05:30 every day.');

module.exports = { computeAndStoreAnalytics };