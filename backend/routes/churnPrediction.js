'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const churn = require('../services/churnPrediction');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'sales_hod', 'finance', 'product_hod'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/churn-prediction — List all churn scores
// ──────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.riskLevel) filters.riskLevel = req.query.riskLevel;
    if (req.query.minScore) filters.minScore = parseInt(req.query.minScore);

    const scores = await churn.getChurnScores(filters);
    res.json({ scores });
  } catch (err) {
    console.error('[churn-prediction:list]', err);
    res.status(500).json({ error: 'Failed to fetch churn scores' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/churn-prediction/dashboard — Summary stats
// ──────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const scores = await churn.getChurnScores();
    const stats = {
      total: scores.length,
      critical: scores.filter(s => s.risk_level === 'critical').length,
      high: scores.filter(s => s.risk_level === 'high').length,
      medium: scores.filter(s => s.risk_level === 'medium').length,
      low: scores.filter(s => s.risk_level === 'low').length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length) : 0,
    };
    res.json(stats);
  } catch (err) {
    console.error('[churn-prediction:dashboard]', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/churn-prediction/:customerId — Get single customer score
// ──────────────────────────────────────────────────────────────────────────
router.get('/:customerId', async (req, res) => {
  try {
    const scores = await churn.getChurnScores();
    const score = scores.find(s => s.customer_id === req.params.customerId);
    if (!score) return res.status(404).json({ error: 'Score not found' });
    res.json(score);
  } catch (err) {
    console.error('[churn-prediction:get]', err);
    res.status(500).json({ error: 'Failed to fetch score' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/churn-prediction/run — Manual trigger for weekly scoring
// ──────────────────────────────────────────────────────────────────────────
router.post('/run', async (req, res) => {
  try {
    const result = await churn.runWeeklyChurnScoring();
    res.json(result);
  } catch (err) {
    console.error('[churn-prediction:run]', err);
    res.status(500).json({ error: 'Failed to run churn scoring' });
  }
});

module.exports = router;