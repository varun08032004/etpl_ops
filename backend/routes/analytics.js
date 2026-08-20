'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const analytics = require('../services/analyticsService');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'finance', 'sales_hod'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/analytics/mrr — MRR/ARR snapshot
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
// GET /api/analytics/churn-cohorts — Monthly churn cohorts
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
// GET /api/analytics/expansion — New/expansion/churn MRR breakdown
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
// GET /api/analytics/unit-economics — LTV, CAC, Payback
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
// GET /api/analytics/dashboard — All-in-one for dashboard page
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

module.exports = router;