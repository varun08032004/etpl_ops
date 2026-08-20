'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const feeEngine = require('../services/platformFeeEngine');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'finance'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/fee-rules — List fee rules
// ──────────────────────────────────────────────────────────────────────────
router.get('/rules', async (req, res) => {
  try {
    const filters = {};
    if (req.query.planId) filters.planId = req.query.planId;
    if (req.query.feeType) filters.feeType = req.query.feeType;

    const rules = await feeEngine.getFeeRules(filters);
    res.json({ rules });
  } catch (err) {
    console.error('[fee-rules:list]', err);
    res.status(500).json({ error: 'Failed to fetch fee rules' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/fee-rules/:id — Get single rule
// ──────────────────────────────────────────────────────────────────────────
router.get('/rules/:id', async (req, res) => {
  try {
    const rule = await feeEngine.getFeeRuleById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    console.error('[fee-rules:get]', err);
    res.status(500).json({ error: 'Failed to fetch rule' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/fee-rules — Create fee rule
// ──────────────────────────────────────────────────────────────────────────
router.post('/rules', async (req, res) => {
  try {
    const rule = await feeEngine.createFeeRule(req.body, req.staff.id);
    res.status(201).json({ rule });
  } catch (err) {
    console.error('[fee-rules:create]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create rule' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PATCH /api/fee-rules/:id — Update fee rule
// ──────────────────────────────────────────────────────────────────────────
router.patch('/rules/:id', async (req, res) => {
  try {
    const rule = await feeEngine.updateFeeRule(req.params.id, req.body, req.staff.id);
    res.json({ rule });
  } catch (err) {
    console.error('[fee-rules:update]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update rule' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// DELETE /api/fee-rules/:id — Delete fee rule (soft delete)
// ──────────────────────────────────────────────────────────────────────────
router.delete('/rules/:id', async (req, res) => {
  try {
    await feeEngine.deleteFeeRule(req.params.id, req.staff.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[fee-rules:delete]', err);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/fee-rules/calculate — Calculate fees for transaction
// ──────────────────────────────────────────────────────────────────────────
router.post('/calculate', async (req, res) => {
  try {
    const transaction = req.body;
    if (!transaction.amount) return res.status(400).json({ error: 'amount is required' });

    const result = await feeEngine.calculateFees(transaction);
    res.json(result);
  } catch (err) {
    console.error('[fee-rules:calculate]', err);
    res.status(500).json({ error: 'Failed to calculate fees' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Coupon Management
// ──────────────────────────────────────────────────────────────────────────

// GET /api/fee-rules/coupons — List coupons
router.get('/coupons', async (req, res) => {
  try {
    // Would need a getCoupons function - simplified
    res.json({ coupons: [] });
  } catch (err) {
    console.error('[coupons:list]', err);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

// POST /api/fee-rules/coupons — Create coupon
router.post('/coupons', async (req, res) => {
  try {
    const coupon = await feeEngine.createCoupon(req.body, req.staff.id);
    res.status(201).json({ coupon });
  } catch (err) {
    console.error('[coupons:create]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create coupon' });
  }
});

// POST /api/fee-rules/coupons/validate — Validate coupon
router.post('/coupons/validate', async (req, res) => {
  try {
    const { code, ...transaction } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required' });

    const result = await feeEngine.validateCoupon(code, transaction);
    res.json(result);
  } catch (err) {
    console.error('[coupons:validate]', err);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Fee Analytics
// ──────────────────────────────────────────────────────────────────────────

// GET /api/fee-rules/analytics — Fee analytics
router.get('/analytics', async (req, res) => {
  try {
    const fromDate = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = req.query.to || new Date().toISOString().slice(0, 10);

    const analytics = await feeEngine.getFeeAnalytics(fromDate, toDate);
    res.json(analytics);
  } catch (err) {
    console.error('[fee-rules:analytics]', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;