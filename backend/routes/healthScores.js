'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const health = require('../services/healthScore');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'sales_hod', 'finance', 'product_hod'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/health-scores — List all health scores
// ──────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.tier) filters.tier = req.query.tier;
    if (req.query.minScore) filters.minScore = parseInt(req.query.minScore);

    const scores = await health.getHealthScores(filters);
    res.json({ scores });
  } catch (err) {
    console.error('[health-scores:list]', err);
    res.status(500).json({ error: 'Failed to fetch health scores' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/health-scores/dashboard — Summary stats
// ──────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const scores = await health.getHealthScores();
    const stats = {
      total: scores.length,
      healthy: scores.filter(s => s.tier === 'healthy').length,
      at_risk: scores.filter(s => s.tier === 'at_risk').length,
      critical: scores.filter(s => s.tier === 'critical').length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b.overall_score, 0) / scores.length) : 0,
      byCategory: {
        usage: scores.length ? Math.round(scores.reduce((a, b) => a + (b.category_scores?.usage || 0), 0) / scores.length) : 0,
        support: scores.length ? Math.round(scores.reduce((a, b) => a + (b.category_scores?.support || 0), 0) / scores.length) : 0,
        billing: scores.length ? Math.round(scores.reduce((a, b) => a + (b.category_scores?.billing || 0), 0) / scores.length) : 0,
        sentiment: scores.length ? Math.round(scores.reduce((a, b) => a + (b.category_scores?.sentiment || 0), 0) / scores.length) : 0,
      },
    };
    res.json(stats);
  } catch (err) {
    console.error('[health-scores:dashboard]', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/health-scores/:customerId — Get single customer health detail
// ──────────────────────────────────────────────────────────────────────────
router.get('/:customerId', async (req, res) => {
  try {
    const detail = await health.getHealthDetail(req.params.customerId);
    if (!detail) return res.status(404).json({ error: 'Health score not found' });
    res.json(detail);
  } catch (err) {
    console.error('[health-scores:get]', err);
    res.status(500).json({ error: 'Failed to fetch health detail' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/health-scores/run — Manual trigger for daily scoring
// ──────────────────────────────────────────────────────────────────────────
router.post('/run', async (req, res) => {
  try {
    const result = await health.runDailyHealthScoring();
    res.json(result);
  } catch (err) {
    console.error('[health-scores:run]', err);
    res.status(500).json({ error: 'Failed to run health scoring' });
  }
});

module.exports = router;