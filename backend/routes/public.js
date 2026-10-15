'use strict';
// routes/public.js — Public endpoints for landing page / external consumers
// No authentication required — these are intentionally open read-only surfaces.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { fetchPlanPrices } = require('../services/platformClient');
const { getPublicJobs, getPublicJob, applyPublic } = require('./recruitment');

// Multer config for file uploads (resume, cover letter PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files allowed'), false);
    }
    cb(null, true);
  },
});

// GET /api/public/pricing
// Returns current live pricing for all 4 tiers (Free, Starter, Growth, Corporate) — annual only.
// All fees in percent with up to 5 decimals.
router.get('/pricing', async (req, res) => {
  try {
    const overrides = await fetchPlanPrices(); // only rows that HAVE been pushed from ERP
    // Shape: [{ plan, cycle, price_inr, buyer_fee_percent, seller_fee_percent, updated_at, updated_by }]
    const pricing = { free: {}, starter: {}, growth: {}, corporate: {} };
    for (const p of overrides) {
      if (pricing[p.plan] && p.billing_cycle === 'annual') {
        pricing[p.plan].annual = {
          price_inr: Number(p.price_inr),
          buyer_fee_percent: Number(p.buyer_fee_percent),
          seller_fee_percent: Number(p.seller_fee_percent),
        };
      }
    }
    // Fallback to platform defaults if no override pushed yet
    // Prices stored in paise (INR * 100)
    const defaults = {
      free: { annual: { price_inr: 0, buyer_fee_percent: 2.00000, seller_fee_percent: 0.00000 } },
      starter: { annual: { price_inr: 1199900, buyer_fee_percent: 1.00000, seller_fee_percent: 1.00000 } },
      growth: { annual: { price_inr: 15600000, buyer_fee_percent: 0.75000, seller_fee_percent: 0.75000 } },
      corporate: { annual: { price_inr: 30000000, buyer_fee_percent: 0.50000, seller_fee_percent: 0.50000 } },
    };
    for (const plan of Object.keys(pricing)) {
      if (pricing[plan].annual == null) {
        pricing[plan].annual = defaults[plan].annual;
      }
    }
    res.json({ pricing, source: 'etpl-ops', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[public:pricing]', err);
    // Return defaults on failure so landing page never breaks
    res.json({
      pricing: {
        free: { annual: { price_inr: 0, buyer_fee_percent: 2.00000, seller_fee_percent: 0.00000 } },
        starter: { annual: { price_inr: 1199900, buyer_fee_percent: 1.00000, seller_fee_percent: 1.00000 } },
        growth: { annual: { price_inr: 15600000, buyer_fee_percent: 0.75000, seller_fee_percent: 0.75000 } },
        corporate: { annual: { price_inr: 30000000, buyer_fee_percent: 0.50000, seller_fee_percent: 0.50000 } },
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

// POST /api/public/jobs/:id/apply — submit application with file uploads
router.post('/jobs/:id/apply', upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'cover_letter', maxCount: 1 },
]), applyPublic);

module.exports = router;