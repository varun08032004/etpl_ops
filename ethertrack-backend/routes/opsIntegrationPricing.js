'use strict';
// routes/opsIntegrationPricing.js
//
// WRITE surface for the ERP (etpl_ops) Product/Sales section to push
// all tier prices & platform fees — see services/pricing.js for how these override
// the hardcoded PLAN_CONFIG defaults in routes/subscription.js. Same
// isolation pattern as the other ops-integration-* write surfaces: its own
// token (PLATFORM_SYNC_PRICING_WRITE_TOKEN).
//
// NEW STRUCTURE (2026-10-13):
// - ALL 4 TIERS: Annual ONLY (no monthly)
// - Each tier has: annual_price_paise (base), buyer_fee_percent, seller_fee_percent
// - Free: ₹0 base, buyer: 2.00000% (2%), seller: 0.00000% (0%)
// - Starter: base price + buyer: 1.00000% (1%), seller: 1.00000% (1%)
// - Growth: base price + buyer: 0.75000% (0.75%), seller: 0.75000% (0.75%)
// - Corporate: base price + buyer: 0.50000% (0.5%), seller: 0.50000% (0.5%)

const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { requireServiceTokenFor } = require('../middleware/serviceAuth');
const { setPrice, listPrices } = require('../services/pricing');

const pricingOpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down' },
});

router.use(pricingOpsLimiter);
router.use(requireServiceTokenFor('PLATFORM_SYNC_PRICING_WRITE_TOKEN'));

router.use((req, res, next) => {
  console.log(`[ops-integration-pricing] ${req.method} ${req.originalUrl} — service call authorized`);
  next();
});

const VALID_PLANS  = ['free', 'starter', 'growth', 'corporate'];
const VALID_CYCLES = ['annual']; // ALL tiers annual only

// PATCH /api/ops-integration-pricing/:plan/:cycle
// body: { priceINR, buyerFeePercent, sellerFeePercent, updatedBy }
router.patch('/:plan/:cycle', async (req, res) => {
  const { plan, cycle } = req.params;
  const { priceINR, buyerFeePercent, sellerFeePercent, updatedBy } = req.body;

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
    const pricePaise = Math.round(Number(priceINR) * 100);
    await setPrice(plan, cycle, pricePaise, { 
      buyerFeePercent: buyerFeePercent != null ? Number(buyerFeePercent) : null, 
      sellerFeePercent: sellerFeePercent != null ? Number(sellerFeePercent) : null, 
      updatedBy: updatedBy || null, 
      updatedFrom: 'erp' 
    });
    res.json({ 
      ok: true, 
      plan, 
      cycle, 
      priceINR: Number(priceINR), 
      buyerFeePercent: buyerFeePercent != null ? Number(buyerFeePercent) : undefined,
      sellerFeePercent: sellerFeePercent != null ? Number(sellerFeePercent) : undefined
    });
  } catch (e) {
    console.error('[ops-integration-pricing:patch]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/ops-integration-pricing — current overrides
router.get('/', async (req, res) => {
  try {
    const prices = await listPrices();
    res.json({ prices });
  } catch (e) {
    console.error('[ops-integration-pricing:list]', e.message);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

module.exports = router;