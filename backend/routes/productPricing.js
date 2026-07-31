'use strict';
// routes/productPricing.js — Product/Sales module: Starter & Growth pricing.
//
// Lets Product or Sales push a new self-serve price for Starter/Growth
// (monthly or annual) straight to the platform — see
// services/platformClient.js's updatePlanPrice()/fetchPlanPrices(), which
// go through the platform's own /api/ops-integration-pricing write surface
// (routes/opsIntegrationPricing.js on the platform side).
//
// Corporate is out of scope here entirely — it's never a flat rate, always
// a per-deal negotiation, set up via routes/corporateDeals.js instead.

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { updatePlanPrice, fetchPlanPrices } = require('../services/platformClient');
const { logAction } = require('../services/auditLog');

router.use(authenticate);
// Both Product and Sales can update self-serve pricing — pricing decisions
// commonly originate from either team depending on the org.
router.use(requireRole('product_hod', 'sales_hod'));

const VALID_PLANS  = ['starter', 'growth'];
const VALID_CYCLES = ['monthly', 'annual'];

// GET /api/product/pricing — current live prices on the platform (any
// override pushed from here, plus which ones are still on the hardcoded
// platform default because nothing's been pushed yet).
router.get('/', async (req, res) => {
  try {
    const overrides = await fetchPlanPrices(); // only rows that HAVE been pushed
    res.json({ overrides });
  } catch (e) {
    console.error('[GET /product/pricing]', e.message);
    res.status(502).json({ error: e.message });
  }
});

// PATCH /api/product/pricing/:plan/:cycle
// body: { priceINR }
router.patch('/:plan/:cycle', async (req, res) => {
  const { plan, cycle } = req.params;
  const { priceINR } = req.body;
  if (!VALID_PLANS.includes(plan))
    return res.status(400).json({ error: "plan must be 'starter' or 'growth'" });
  if (!VALID_CYCLES.includes(cycle))
    return res.status(400).json({ error: "cycle must be 'monthly' or 'annual'" });
  if (priceINR == null || isNaN(priceINR) || Number(priceINR) < 0)
    return res.status(400).json({ error: 'priceINR must be a non-negative number' });

  try {
    await updatePlanPrice(plan, cycle, Number(priceINR), req.staff.email);
    await logAction({
      staffId: req.staff.id,
      action: 'product_pricing.updated',
      entity: 'plan_price',
      entityId: `${plan}/${cycle}`,
      newValue: { priceINR: Number(priceINR) },
    }).catch(() => {});
    res.json({ ok: true, plan, cycle, priceINR: Number(priceINR) });
  } catch (e) {
    console.error('[PATCH /product/pricing]', e.message);
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;