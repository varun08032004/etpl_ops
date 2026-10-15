'use strict';
// routes/productPricing.js — Product/Sales module: all tier pricing (annual only).
//
// Lets Product or Sales push a new self-serve price + platform fee for all tiers
// straight to the platform — see services/platformClient.js's updatePlanPrice()/fetchPlanPrices(),
// which go through the platform's own /api/ops-integration-pricing write surface
// (routes/opsIntegrationPricing.js on the platform side).
//
// NEW STRUCTURE (2026-10-13):
// - ALL 4 TIERS: Annual ONLY (no monthly)
// - Each tier has: annual_price_paise (base), buyer_fee_percent, seller_fee_percent
// - Free: ₹0 base, buyer: 2.00000% (2%), seller: 0.00000% (0%)
// - Starter: base price + buyer: 1.00000% (1%), seller: 1.00000% (1%)
// - Growth: base price + buyer: 0.75000% (0.75%), seller: 0.75000% (0.75%)
// - Corporate: base price + buyer: 0.50000% (0.5%), seller: 0.50000% (0.5%)

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
// body: { priceINR, buyerFeePercent, sellerFeePercent }
router.patch('/:plan/:cycle', async (req, res) => {
  const { plan, cycle } = req.params;
  const { priceINR, buyerFeePercent, sellerFeePercent } = req.body;

  if (!VALID_PLANS.includes(plan))
    return res.status(400).json({ error: "plan must be 'free', 'starter', 'growth', or 'corporate'" });

  if (!VALID_CYCLES.includes(cycle))
    return res.status(400).json({ error: "cycle must be 'annual' — all tiers are annual only" });

  if (priceINR == null || isNaN(priceINR) || Number(priceINR) < 0)
    return res.status(400).json({ error: 'priceINR must be a non-negative number' });

  if (buyerFeePercent != null && (isNaN(buyerFeePercent) || Number(buyerFeePercent) < 0 || Number(buyerFeePercent) > 100))
    return res.status(400).json({ error: 'buyerFeePercent must be between 0 and 100 (0% to 100%)' });

  if (sellerFeePercent != null && (isNaN(sellerFeePercent) || Number(sellerFeePercent) < 0 || Number(sellerFeePercent) > 100))
    return res.status(400).json({ error: 'sellerFeePercent must be between 0 and 100 (0% to 100%)' });

  try {
    await updatePlanPrice(plan, cycle, Number(priceINR), Number(buyerFeePercent) || 0, Number(sellerFeePercent) || 0, req.staff.email);
    await logAction({
      staffId: req.staff.id,
      action: 'product_pricing.updated',
      entity: 'plan_price',
      entityId: `${plan}/${cycle}`,
      newValue: { 
        priceINR: Number(priceINR), 
        buyerFeePercent: buyerFeePercent != null ? Number(buyerFeePercent) : undefined,
        sellerFeePercent: sellerFeePercent != null ? Number(sellerFeePercent) : undefined 
      },
    }).catch(() => {});
    res.json({ 
      ok: true, 
      plan, 
      cycle, 
      priceINR: Number(priceINR), 
      buyerFeePercent: buyerFeePercent != null ? Number(buyerFeePercent) : undefined,
      sellerFeePercent: sellerFeePercent != null ? Number(sellerFeePercent) : undefined
    });
  } catch (e) {
    console.error('[PATCH /product/pricing]', e.message);
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;