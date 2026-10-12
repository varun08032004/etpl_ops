'use strict';
// routes/productPricing.js — Product/Sales module: all tier pricing (annual only).
//
// Lets Product or Sales push a new self-serve price + platform fee for all tiers
// straight to the platform — see services/platformClient.js's updatePlanPrice()/fetchPlanPrices(),
// which go through the platform's own /api/ops-integration-pricing write surface
// (routes/opsIntegrationPricing.js on the platform side).
//
// NEW STRUCTURE (2026-10-12):
// - ALL 4 TIERS: Annual ONLY (no monthly)
// - Each tier has: annual_price_paise (base), platform_fee_bps (editable fee)
// - Free: ₹0 base, platform_fee_bps editable
// - Starter/Growth/Corporate: base price + platform_fee_bps from etpl_ops

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { updatePlanPrice, fetchPlanPrices } = require('../services/platformClient');
const { logAction } = require('../services/auditLog');

router.use(authenticate);
router.use(requireRole('product_hod', 'sales_hod'));

const VALID_PLANS  = ['free', 'starter', 'growth', 'corporate'];
const VALID_CYCLES = ['annual']; // ALL tiers annual only

// GET /api/product/pricing — current live prices on the platform
router.get('/', async (req, res) => {
  try {
    const overrides = await fetchPlanPrices();
    res.json({ overrides });
  } catch (e) {
    console.error('[GET /product/pricing]', e.message);
    res.status(502).json({ error: e.message });
  }
});

// PATCH /api/product/pricing/:plan/:cycle
// body: { priceINR, platformFeeBps }
router.patch('/:plan/:cycle', async (req, res) => {
  const { plan, cycle } = req.params;
  const { priceINR, platformFeeBps } = req.body;

  if (!VALID_PLANS.includes(plan))
    return res.status(400).json({ error: "plan must be 'free', 'starter', 'growth', or 'corporate'" });

  if (!VALID_CYCLES.includes(cycle))
    return res.status(400).json({ error: "cycle must be 'annual' — all tiers are annual only" });

  if (priceINR == null || isNaN(priceINR) || Number(priceINR) < 0)
    return res.status(400).json({ error: 'priceINR must be a non-negative number' });

  if (platformFeeBps != null && (isNaN(platformFeeBps) || Number(platformFeeBps) < 0 || Number(platformFeeBps) > 10000))
    return res.status(400).json({ error: 'platformFeeBps must be between 0 and 10000 (0% to 100%)' });

  try {
    await updatePlanPrice(plan, cycle, Number(priceINR), Number(platformFeeBps) || 0, req.staff.email);
    await logAction({
      staffId: req.staff.id,
      action: 'product_pricing.updated',
      entity: 'plan_price',
      entityId: `${plan}/${cycle}`,
      newValue: { priceINR: Number(priceINR), platformFeeBps: platformFeeBps != null ? Number(platformFeeBps) : undefined },
    }).catch(() => {});
    res.json({ ok: true, plan, cycle, priceINR: Number(priceINR), platformFeeBps: platformFeeBps != null ? Number(platformFeeBps) : undefined });
  } catch (e) {
    console.error('[PATCH /product/pricing]', e.message);
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;