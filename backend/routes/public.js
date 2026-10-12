'use strict';
// routes/public.js — Public read-only endpoints (no auth)

const express = require('express');
const router = express.Router();
const { fetchPlanPrices } = require('../services/platformClient');

router.get('/pricing', async (req, res) => {
  try {
    const overrides = await fetchPlanPrices();
    const pricing = {};
    overrides.forEach(o => {
      if (o.plan !== 'free') {
        pricing[o.plan.toLowerCase()] = {
          annual: Math.round(o.annual_paise / 100),
        };
      }
    });
    ['starter', 'growth', 'corporate'].forEach(tier => {
      if (!pricing[tier]) pricing[tier] = { annual: 0 };
    });
    res.json({ pricing });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;