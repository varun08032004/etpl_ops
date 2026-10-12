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
// - Each tier has: annual_price_paise (base), buyer_fee_bps, seller_fee_bps
// - Free: ₹0 base, buyer: 200bps (2%), seller: 0bps
// - Starter: base price + buyer: 100bps (1%), seller: 100bps (1%)
// - Growth: base price + buyer: 75bps (0.75%), seller: 75bps (0.75%)
// - Corporate: base price + buyer: 50bps (0.5%), seller: 50bps (0.5%)

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
// body: { priceINR, buyerFeeBps, sellerFeeBps }
router.patch('/:plan/:cycle', async (req, res) => {
  const { plan, cycle } = req.params;
  const { priceINR, buyerFeeBps, sellerFeeBps } = req.body;

  if (!VALID_PLANS.includes(plan))
    return res.status(400).json({ error: "plan must be 'free', 'starter', 'growth', or 'corporate'" });

  if (!VALID_CYCLES.includes(cycle))
    return res.status(400).json({ error: "cycle must be 'annual' — all tiers are annual only" });

  if (priceINR == null || isNaN(priceINR) || Number(priceINR) < 0)
    return res.status(400).json({ error: 'priceINR must be a non-negative number' });

  if (buyerFeeBps != null && (isNaN(buyerFeeBps) || Number(buyerFeeBps) < 0 || Number(buyerFeeBps) > 10000))
    return res.status(400).json({ error: 'buyerFeeBps must be between 0 and 10000 (0% to 100%)' });

  if (sellerFeeBps != null && (isNaN(sellerFeeBps) || Number(sellerFeeBps) < 0 || Number(sellerFeeBps) > 10000))
    return res.status(400).json({ error: 'sellerFeeBps must be between 0 and 10000 (0% to 100%)' });

  try {
    await updatePlanPrice(plan, cycle, Number(priceINR), Number(buyerFeeBps) || 0, Number(sellerFeeBps) || 0, req.staff.email);
    await logAction({
      staffId: req.staff.id,
      action: 'product_pricing.updated',
      entity: 'plan_price',
      entityId: `${plan}/${cycle}`,
      newValue: { 
        priceINR: Number(priceINR), 
        buyerFeeBps: buyerFeeBps != null ? Number(buyerFeeBps) : undefined,
        sellerFeeBps: sellerFeeBps != null ? Number(sellerFeeBps) : undefined 
      },
    }).catch(() => {});
    res.json({ 
      ok: true, 
      plan, 
      cycle, 
      priceINR: Number(priceINR), 
      buyerFeeBps: buyerFeeBps != null ? Number(buyerFeeBps) : undefined,
      sellerFeeBps: sellerFeeBps != null ? Number(sellerFeeBps) : undefined
    });
  } catch (e) {
    console.error('[PATCH /product/pricing]', e.message);
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;