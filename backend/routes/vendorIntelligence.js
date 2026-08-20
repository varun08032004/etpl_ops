'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const vendorIntel = require('../services/vendorIntelligence');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'finance', 'procurement'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/vendor-intelligence — Vendor spend analysis
// ──────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const vendors = await vendorIntel.getVendorSpendAnalysis(months);
    res.json({ vendors });
  } catch (err) {
    console.error('[vendor-intel:list]', err);
    res.status(500).json({ error: 'Failed to fetch vendor analysis' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/vendor-intelligence/dashboard — Summary stats
// ──────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const savings = await vendorIntel.getSavingsOpportunities();
    const duplicates = await vendorIntel.detectDuplicateVendors();
    const renewals = await vendorIntel.getRenewalCalendar(3);

    res.json({
      savings: savings.total_potential_annual_savings,
      benchmark_savings: savings.benchmark_savings,
      consolidation_savings: savings.consolidation_savings,
      renewal_risk: savings.renewal_risk_mitigation,
      duplicate_count: savings.duplicate_vendors.length,
      upcoming_renewals: savings.upcoming_renewals.length,
      top_opportunities: savings.top_opportunities,
      duplicate_vendors: savings.duplicate_vendors,
      upcoming_renewals_detail: savings.upcoming_renewals,
    });
  } catch (err) {
    console.error('[vendor-intel:dashboard]', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/vendor-intelligence/duplicates — Duplicate vendors
// ──────────────────────────────────────────────────────────────────────────
router.get('/duplicates', async (req, res) => {
  try {
    const duplicates = await vendorIntel.detectDuplicateVendors();
    res.json({ duplicates });
  } catch (err) {
    console.error('[vendor-intel:duplicates]', err);
    res.status(500).json({ error: 'Failed to detect duplicates' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/vendor-intelligence/renewals — Renewal calendar
// ──────────────────────────────────────────────────────────────────────────
router.get('/renewals', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const renewals = await vendorIntel.getRenewalCalendar(months);
    res.json({ renewals });
  } catch (err) {
    console.error('[vendor-intel:renewals]', err);
    res.status(500).json({ error: 'Failed to fetch renewals' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/vendor-intelligence/benchmarks — Benchmark comparison
// ──────────────────────────────────────────────────────────────────────────
router.get('/benchmarks', async (req, res) => {
  try {
    const comparisons = await vendorIntel.getBenchmarkComparison();
    res.json({ comparisons });
  } catch (err) {
    console.error('[vendor-intel:benchmarks]', err);
    res.status(500).json({ error: 'Failed to fetch benchmarks' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/vendor-intelligence/negotiation/:vendorName — Negotiation pack
// ──────────────────────────────────────────────────────────────────────────
router.get('/negotiation/:vendorName', async (req, res) => {
  try {
    const pack = await vendorIntel.prepareNegotiationPack(req.params.vendorName);
    res.json(pack);
  } catch (err) {
    console.error('[vendor-intel:negotiation]', err);
    res.status(err.message === 'Vendor not found' ? 404 : 500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/vendor-intelligence/savings — Savings opportunities
// ──────────────────────────────────────────────────────────────────────────
router.get('/savings', async (req, res) => {
  try {
    const savings = await vendorIntel.getSavingsOpportunities();
    res.json(savings);
  } catch (err) {
    console.error('[vendor-intel:savings]', err);
    res.status(500).json({ error: 'Failed to fetch savings' });
  }
});

module.exports = router;