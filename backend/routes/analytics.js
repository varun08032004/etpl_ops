'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { pool, safeQuery } = require('../db/pool');
const analytics = require('../services/analyticsService');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'finance', 'sales_hod'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/analytics/unified — Single call for all pre-computed analytics
// ──────────────────────────────────────────────────────────────────────────
router.get('/unified', async (req, res) => {
  try {
    const [
      mrrSnap,
      dailyMrr,
      churnCohorts,
      expansionSnap,
      unitEconSnap,
    ] = await Promise.all([
      // Latest MRR snapshot
      safeQuery(`
        SELECT mrr, arr, active_subscriptions, corporate_seats, by_plan, by_cycle, avg_revenue_per_user, snapshot_date
        FROM analytics_mrr_snapshots
        ORDER BY snapshot_date DESC
        LIMIT 1
      `),

      // Last 90 days of daily MRR for trend chart
      safeQuery(`
        SELECT record_date as date, mrr, arr, active_subscriptions, new_subscriptions, churned_subscriptions, net_new_subscriptions, by_plan
        FROM analytics_daily_mrr
        ORDER BY record_date DESC
        LIMIT 90
      `),

      // Latest churn cohorts (last 12 months)
      safeQuery(`
        SELECT cohort_month, started, active, churned, expanded, contracted, mrr_started, mrr_current, retention_rate, net_revenue_retention
        FROM analytics_churn_cohorts
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM analytics_churn_cohorts)
        ORDER BY cohort_month DESC
        LIMIT 12
      `),

      // Latest expansion snapshot
      safeQuery(`
        SELECT new_mrr, expansion_mrr, contraction_mrr, churned_mrr, reactivation_mrr, net_new_mrr, gross_mrr_churn_rate, period_start, period_end
        FROM analytics_expansion_snapshots
        ORDER BY snapshot_date DESC
        LIMIT 1
      `),

      // Latest unit economics snapshot
      safeQuery(`
        SELECT ltv, cac, payback_months, avg_monthly_churn, ltv_to_cac_ratio, marketing_spend, new_customers_count
        FROM analytics_unit_economics_snapshots
        ORDER BY snapshot_date DESC
        LIMIT 1
      `),
    ]);

    // Format response
    const mrr = mrrSnap.rows[0] || {};
    const expansion = expansionSnap.rows[0] || {};
    const unitEcon = unitEconSnap.rows[0] || {};

    res.json({
      mrr: {
        mrr: parseFloat(mrr.mrr || 0),
        arr: parseFloat(mrr.arr || 0),
        activeSubscriptions: parseInt(mrr.active_subscriptions || 0),
        corporateSeats: parseInt(mrr.corporate_seats || 0),
        byPlan: mrr.by_plan || { starter: 0, growth: 0, corporate: 0 },
        byCycle: mrr.by_cycle || { monthly: 0, yearly: 0 },
        avgRevenuePerUser: parseFloat(mrr.avg_revenue_per_user || 0),
        snapshotDate: mrr.snapshot_date,
      },
      mrrHistory: (dailyMrr.rows || []).reverse().map(r => ({
        date: r.date,
        mrr: parseFloat(r.mrr || 0),
        arr: parseFloat(r.arr || 0),
        activeSubscriptions: parseInt(r.active_subscriptions || 0),
        newSubscriptions: parseInt(r.new_subscriptions || 0),
        churnedSubscriptions: parseInt(r.churned_subscriptions || 0),
        netNewSubscriptions: parseInt(r.net_new_subscriptions || 0),
        byPlan: r.by_plan || { starter: 0, growth: 0, corporate: 0 },
      })),
      churnCohorts: (churnCohorts.rows || []).map(r => ({
        cohortMonth: r.cohort_month,
        started: parseInt(r.started || 0),
        active: parseInt(r.active || 0),
        churned: parseInt(r.churned || 0),
        expanded: parseInt(r.expanded || 0),
        contracted: parseInt(r.contracted || 0),
        mrrStarted: parseFloat(r.mrr_started || 0),
        mrrCurrent: parseFloat(r.mrr_current || 0),
        retentionRate: parseFloat(r.retention_rate || 0),
        netRevenueRetention: parseFloat(r.net_revenue_retention || 0),
      })),
      expansion: {
        newMrr: parseFloat(expansion.new_mrr || 0),
        expansionMrr: parseFloat(expansion.expansion_mrr || 0),
        contractionMrr: parseFloat(expansion.contraction_mrr || 0),
        churnedMrr: parseFloat(expansion.churned_mrr || 0),
        reactivationMrr: parseFloat(expansion.reactivation_mrr || 0),
        netNewMrr: parseFloat(expansion.net_new_mrr || 0),
        grossMrrChurnRate: parseFloat(expansion.gross_mrr_churn_rate || 0),
        periodStart: expansion.period_start,
        periodEnd: expansion.period_end,
      },
      unitEconomics: {
        ltv: parseFloat(unitEcon.ltv || 0),
        cac: parseFloat(unitEcon.cac || 0),
        paybackMonths: parseFloat(unitEcon.payback_months || 0),
        avgMonthlyChurn: parseFloat(unitEcon.avg_monthly_churn || 0),
        ltvToCac: unitEcon.ltv_to_cac_ratio ? parseFloat(unitEcon.ltv_to_cac_ratio) : null,
        marketingSpend: parseFloat(unitEcon.marketing_spend || 0),
        newCustomersCount: parseInt(unitEcon.new_customers_count || 0),
      },
    });
  } catch (err) {
    console.error('[analytics:unified]', err);
    res.status(500).json({ error: 'Failed to fetch unified analytics' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/analytics/mrr — MRR/ARR snapshot (live fallback)
// ──────────────────────────────────────────────────────────────────────────
router.get('/mrr', async (req, res) => {
  try {
    const data = await analytics.getMrrSnapshot();
    res.json(data);
  } catch (err) {
    console.error('[analytics:mrr]', err);
    res.status(500).json({ error: 'Failed to fetch MRR data' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/analytics/churn-cohorts — Monthly churn cohorts (live fallback)
// ──────────────────────────────────────────────────────────────────────────
router.get('/churn-cohorts', async (req, res) => {
  try {
    const monthsBack = parseInt(req.query.months) || 12;
    const data = await analytics.getChurnCohorts(monthsBack);
    res.json({ cohorts: data });
  } catch (err) {
    console.error('[analytics:churn-cohorts]', err);
    res.status(500).json({ error: 'Failed to fetch churn cohorts' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/analytics/expansion — New/expansion/churn MRR breakdown (live fallback)
// ──────────────────────────────────────────────────────────────────────────
router.get('/expansion', async (req, res) => {
  try {
    const data = await analytics.getExpansionMetrics();
    res.json(data);
  } catch (err) {
    console.error('[analytics:expansion]', err);
    res.status(500).json({ error: 'Failed to fetch expansion metrics' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/analytics/unit-economics — LTV, CAC, Payback (live fallback)
// ──────────────────────────────────────────────────────────────────────────
router.get('/unit-economics', async (req, res) => {
  try {
    const data = await analytics.getUnitEconomics();
    res.json(data);
  } catch (err) {
    console.error('[analytics:unit-economics]', err);
    res.status(500).json({ error: 'Failed to fetch unit economics' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/analytics/dashboard — All-in-one for dashboard page (live fallback)
// ──────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const data = await analytics.getDashboardStats();
    res.json(data);
  } catch (err) {
    console.error('[analytics:dashboard]', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/analytics/marketing-spend — Record marketing spend for CAC calc
// ──────────────────────────────────────────────────────────────────────────
router.post('/marketing-spend', async (req, res) => {
  try {
    const { spend_date, channel, campaign, amount_inr, new_customers, notes } = req.body;
    if (!spend_date || !channel || !amount_inr) {
      return res.status(400).json({ error: 'spend_date, channel, and amount_inr are required' });
    }
    const result = await safeQuery(`
      INSERT INTO analytics_marketing_spend (spend_date, channel, campaign, amount_inr, new_customers, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (spend_date, channel, campaign) DO UPDATE SET
        amount_inr = EXCLUDED.amount_inr,
        new_customers = EXCLUDED.new_customers,
        notes = EXCLUDED.notes
      RETURNING *
    `, [spend_date, channel, campaign || null, amount_inr, new_customers || 0, notes || null, req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[analytics:marketing-spend]', err);
    res.status(500).json({ error: 'Failed to record marketing spend' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/analytics/marketing-spend — List marketing spend entries
// ──────────────────────────────────────────────────────────────────────────
router.get('/marketing-spend', async (req, res) => {
  try {
    const { from, to, channel } = req.query;
    let query = `SELECT * FROM analytics_marketing_spend WHERE 1=1`;
    const params = [];
    let paramIdx = 1;

    if (from) {
      query += ` AND spend_date >= $${paramIdx++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND spend_date <= $${paramIdx++}`;
      params.push(to);
    }
    if (channel) {
      query += ` AND channel = $${paramIdx++}`;
      params.push(channel);
    }

    query += ` ORDER BY spend_date DESC LIMIT 100`;
    const result = await safeQuery(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[analytics:marketing-spend:list]', err);
    res.status(500).json({ error: 'Failed to fetch marketing spend' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PUT /api/analytics/marketing-spend/:id — Update marketing spend entry
// ──────────────────────────────────────────────────────────────────────────
router.put('/marketing-spend/:id', async (req, res) => {
  try {
    const { spend_date, channel, campaign, amount_inr, new_customers, notes } = req.body;
    const result = await safeQuery(`
      UPDATE analytics_marketing_spend
      SET spend_date = $1, channel = $2, campaign = $3, amount_inr = $4, new_customers = $5, notes = $6
      WHERE id = $7
      RETURNING *
    `, [spend_date, channel, campaign || null, amount_inr, new_customers || 0, notes || null, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[analytics:marketing-spend:update]', err);
    res.status(500).json({ error: 'Failed to update marketing spend' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// DELETE /api/analytics/marketing-spend/:id — Delete marketing spend entry
// ──────────────────────────────────────────────────────────────────────────
router.delete('/marketing-spend/:id', async (req, res) => {
  try {
    const result = await safeQuery(`DELETE FROM analytics_marketing_spend WHERE id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[analytics:marketing-spend:delete]', err);
    res.status(500).json({ error: 'Failed to delete marketing spend' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/analytics/recompute — Manually trigger analytics recomputation
// ──────────────────────────────────────────────────────────────────────────
router.post('/recompute', async (req, res) => {
  try {
    const { computeAndStoreAnalytics } = require('../services/analyticsScheduler');
    await computeAndStoreAnalytics();
    res.json({ success: true, message: 'Analytics recomputed successfully' });
  } catch (err) {
    console.error('[analytics:recompute]', err);
    res.status(500).json({ error: 'Failed to recompute analytics', detail: err.message });
  }
});

module.exports = router;