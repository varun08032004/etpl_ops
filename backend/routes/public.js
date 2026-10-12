'use strict';
// routes/public.js — Public endpoints for landing page / external consumers
// No authentication required — these are intentionally open read-only surfaces.

const express = require('express');
const router = express.Router();
const { fetchPlanPrices } = require('../services/platformClient');
const { getPublicJobs, getPublicJob, applyPublic } = require('./recruitment');

// GET /api/public/pricing
// Returns current live Starter/Growth pricing (monthly + annual) for the landing page.
// Corporate is intentionally excluded — it's always "Contact Sales" per-deal.
router.get('/pricing', async (req, res) => {
  try {
    const overrides = await fetchPlanPrices(); // only rows that HAVE been pushed from ERP
    // Shape: [{ plan, cycle, price_inr, updated_at, updated_by }]
    // Convert to a simple keyed object for the frontend: { starter: { monthly: 14990, annual: 14990 }, growth: { ... } }
    const pricing = { starter: {}, growth: {} };
    for (const p of overrides) {
      if (pricing[p.plan_key] && p.billing_cycle) {
        pricing[p.plan_key][p.billing_cycle] = Number(p.price_inr);
      }
    }
    // Fallback to platform defaults if no override pushed yet
    const defaults = {
      starter: { monthly: 1499, annual: 14990 },
      growth: { monthly: 7999, annual: 79990 },
    };
    for (const plan of Object.keys(pricing)) {
      for (const cycle of Object.keys(defaults[plan])) {
        if (pricing[plan][cycle] == null) {
          pricing[plan][cycle] = defaults[plan][cycle];
        }
      }
    }
    res.json({ pricing, source: 'etpl-ops', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[public:pricing]', err);
    // Return defaults on failure so landing page never breaks
    res.json({
      pricing: {
        starter: { monthly: 1499, annual: 14990 },
        growth: { monthly: 7999, annual: 79990 },
      },
      source: 'fallback',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/public/jobs — list published jobs for careers page
router.get('/jobs', getPublicJobs);

// GET /api/public/jobs/:id — get single published job
router.get('/jobs/:id', getPublicJob);

// POST /api/public/jobs/:id/apply — submit application
router.post('/jobs/:id/apply', applyPublic);

module.exports = router;