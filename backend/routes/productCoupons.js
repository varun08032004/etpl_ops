'use strict';
// routes/productCoupons.js — Product/Sales module: coupon codes.
//
// Lets Product or Sales create and manage discount codes (e.g. EARLYBIRD50)
// straight on the platform — see services/platformClient.js's
// createCoupon()/listCoupons()/setCouponActive(), which go through the
// platform's /api/ops-integration-coupons write surface
// (routes/opsIntegrationCoupons.js on the platform side).
//
// Coupons only ever target Starter/Growth self-serve checkout — Corporate
// discounts are handled deal-by-deal in routes/corporateDeals.js instead.

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { createCoupon, listCoupons, setCouponActive } = require('../services/platformClient');
const { logAction } = require('../services/auditLog');

router.use(authenticate);
router.use(requireRole('product_hod', 'sales_hod'));

// GET /api/product/coupons
router.get('/', async (req, res) => {
  try {
    const coupons = await listCoupons();
    res.json({ coupons });
  } catch (e) {
    console.error('[GET /product/coupons]', e.message);
    res.status(502).json({ error: e.message });
  }
});

// POST /api/product/coupons
// body: { code, discountType, discountValue, applicablePlans, applicableCycles,
//         firstTimeOnly, perUserLimit, maxRedemptions, validFrom, validUntil }
router.post('/', async (req, res) => {
  const {
    code, discountType, discountValue, applicablePlans, applicableCycles,
    firstTimeOnly, perUserLimit, maxRedemptions, validFrom, validUntil,
  } = req.body;
  if (!code || !String(code).trim()) return res.status(400).json({ error: 'code is required' });
  if (discountValue == null || isNaN(discountValue)) return res.status(400).json({ error: 'discountValue is required' });

  try {
    const coupon = await createCoupon({
      code, discountType, discountValue, applicablePlans, applicableCycles,
      firstTimeOnly, perUserLimit, maxRedemptions, validFrom, validUntil,
      createdBy: req.staff.email,
    });
    await logAction({
      staffId: req.staff.id,
      action: 'product_coupon.created',
      entity: 'coupon',
      entityId: coupon?.code || code,
      newValue: { discountType, discountValue, applicablePlans, applicableCycles },
    }).catch(() => {});
    res.status(201).json({ ok: true, coupon });
  } catch (e) {
    console.error('[POST /product/coupons]', e.message);
    res.status(e.status || 502).json({ error: e.body?.error || e.message });
  }
});

// PATCH /api/product/coupons/:code
// body: { active, validUntil?, maxRedemptions? }
router.patch('/:code', async (req, res) => {
  const { code } = req.params;
  const { active, validUntil, maxRedemptions } = req.body;
  try {
    const coupon = await setCouponActive(code, active, { validUntil, maxRedemptions });
    await logAction({
      staffId: req.staff.id,
      action: active ? 'product_coupon.activated' : 'product_coupon.deactivated',
      entity: 'coupon',
      entityId: code,
    }).catch(() => {});
    res.json({ ok: true, coupon });
  } catch (e) {
    console.error('[PATCH /product/coupons]', e.message);
    res.status(e.status || 502).json({ error: e.body?.error || e.message });
  }
});

module.exports = router;