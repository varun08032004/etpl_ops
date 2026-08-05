'use strict';
// routes/marketingCouponPerformance.js — Marketing module: coupon ROI.
//
// Read-only view of coupon redemptions pulled from the platform (GET
// /api/ops-integration/coupon-redemptions), aggregated per code so
// Marketing can see actual revenue driven by a code — not just "used N
// times," which is all the Product/Sales Coupons page shows (it only has
// the write-side view via /api/ops-integration-coupons).

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { fetchCouponRedemptions } = require('../services/platformClient');

router.use(authenticate);
// Marketing owns campaign ROI; Product/Sales already see redemption counts
// on their own Coupons page, but get read access here too since they're
// the ones who created the codes.
router.use(requireRole('marketing_hod', 'product_hod', 'sales_hod'));

// GET /api/marketing/coupon-performance?days=365
router.get('/', async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 365, 730);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const redemptions = await fetchCouponRedemptions(since);

    const byCoupon = new Map();
    for (const r of redemptions) {
      if (!byCoupon.has(r.coupon_code)) {
        byCoupon.set(r.coupon_code, {
          couponCode: r.coupon_code,
          discountType: r.discount_type,
          discountValue: r.discount_value,
          redemptionCount: 0,
          totalDiscountINR: 0,
          totalRevenueINR: 0, // sum of what customers actually paid (post-discount)
          byPlan: {},
        });
      }
      const agg = byCoupon.get(r.coupon_code);
      agg.redemptionCount += 1;
      agg.totalDiscountINR += Number(r.discount_inr) || 0;
      agg.totalRevenueINR  += Number(r.total_paid_inr) || 0;
      const planKey = r.plan ? `${r.plan} (${r.cycle})` : 'unknown';
      agg.byPlan[planKey] = (agg.byPlan[planKey] || 0) + 1;
    }

    const coupons = Array.from(byCoupon.values()).map((c) => ({
      ...c,
      totalDiscountINR: Math.round(c.totalDiscountINR),
      totalRevenueINR: Math.round(c.totalRevenueINR),
      // What it would have cost with no discount at all, for a quick sense
      // of "how much did this code actually give away vs. bring in."
      grossValueINR: Math.round(c.totalDiscountINR + c.totalRevenueINR),
    })).sort((a, b) => b.totalRevenueINR - a.totalRevenueINR);

    res.json({
      coupons,
      redemptions, // raw list too, for a detail table if the frontend wants one
      totalRedemptions: redemptions.length,
      windowDays: days,
    });
  } catch (err) {
    console.error('[marketing/coupon-performance]', err.message);
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;