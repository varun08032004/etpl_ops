'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const pipeline = require('../services/pipelineAnalytics');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'sales_hod', 'finance'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/pipeline-analytics/velocity — Deal velocity by stage
// ──────────────────────────────────────────────────────────────────────────
router.get('/velocity', async (req, res) => {
  try {
    const filters = {
      repId: req.query.repId,
      source: req.query.source,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    };
    const data = await pipeline.getDealVelocity(filters);
    res.json({ velocity: data });
  } catch (err) {
    console.error('[pipeline:velocity]', err);
    res.status(500).json({ error: 'Failed to fetch deal velocity' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/pipeline-analytics/conversion — Conversion rates by stage
// ──────────────────────────────────────────────────────────────────────────
router.get('/conversion', async (req, res) => {
  try {
    const data = await pipeline.getConversionRates();
    res.json(data);
  } catch (err) {
    console.error('[pipeline:conversion]', err);
    res.status(500).json({ error: 'Failed to fetch conversion rates' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/pipeline-analytics/reps — Rep performance
// ──────────────────────────────────────────────────────────────────────────
router.get('/reps', async (req, res) => {
  try {
    const filters = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    };
    const data = await pipeline.getRepPerformance(filters);
    res.json({ reps: data });
  } catch (err) {
    console.error('[pipeline:reps]', err);
    res.status(500).json({ error: 'Failed to fetch rep performance' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/pipeline-analytics/sources — Source performance
// ──────────────────────────────────────────────────────────────────────────
router.get('/sources', async (req, res) => {
  try {
    const data = await pipeline.getSourcePerformance();
    res.json({ sources: data });
  } catch (err) {
    console.error('[pipeline:sources]', err);
    res.status(500).json({ error: 'Failed to fetch source performance' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/pipeline-analytics/forecast — Pipeline forecast
// ──────────────────────────────────────────────────────────────────────────
router.get('/forecast', async (req, res) => {
  try {
    const data = await pipeline.getPipelineForecast();
    res.json(data);
  } catch (err) {
    console.error('[pipeline:forecast]', err);
    res.status(500).json({ error: 'Failed to fetch pipeline forecast' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/pipeline-analytics/stalled — Stalled deals
// ──────────────────────────────────────────────────────────────────────────
router.get('/stalled', async (req, res) => {
  try {
    const thresholdDays = parseInt(req.query.days) || 30;
    const data = await pipeline.getStalledDeals(thresholdDays);
    res.json({ deals: data });
  } catch (err) {
    console.error('[pipeline:stalled]', err);
    res.status(500).json({ error: 'Failed to fetch stalled deals' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/pipeline-analytics/win-loss — Win/loss analysis
// ──────────────────────────────────────────────────────────────────────────
router.get('/win-loss', async (req, res) => {
  try {
    const data = await pipeline.getWinLossAnalysis();
    res.json(data);
  } catch (err) {
    console.error('[pipeline:win-loss]', err);
    res.status(500).json({ error: 'Failed to fetch win/loss analysis' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/pipeline-analytics/dashboard — All-in-one dashboard
// ──────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [velocity, conversion, reps, sources, forecast, stalled, winLoss] = await Promise.all([
      pipeline.getDealVelocity({}),
      pipeline.getConversionRates({}),
      pipeline.getRepPerformance({}),
      pipeline.getSourcePerformance({}),
      pipeline.getPipelineForecast({}),
      pipeline.getStalledDeals(30),
      pipeline.getWinLossAnalysis({}),
    ]);

    res.json({
      velocity,
      conversion,
      reps,
      sources,
      forecast,
      stalled,
      winLoss,
    });
  } catch (err) {
    console.error('[pipeline:dashboard]', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

module.exports = router;