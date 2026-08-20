'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const referral = require('../services/referralTracking');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'sales_hod', 'finance'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/referrals — List referrals with filters
// ──────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filters = {
      referrerType: req.query.referrerType,
      stage: req.query.stage,
      referrerId: req.query.referrerId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      commissionStatus: req.query.commissionStatus,
    };
    const referrals = await referral.getReferrals(filters);
    res.json({ referrals });
  } catch (err) {
    console.error('[referrals:list]', err);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/referrals/dashboard — Dashboard stats
// ──────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await referral.getReferralDashboard();
    res.json(stats);
  } catch (err) {
    console.error('[referrals:dashboard]', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/referrals/:id — Get single referral
// ──────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { safeQuery: query } = require('../db/pool');
    const { rows: [ref] } = await query(
      `SELECT r.*, rc.total_amount as commission_amount, rc.status as commission_status
       FROM referrals r
       LEFT JOIN referral_commissions rc ON rc.referral_id = r.id
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (!ref) return res.status(404).json({ error: 'Referral not found' });
    res.json(ref);
  } catch (err) {
    console.error('[referrals:get]', err);
    res.status(500).json({ error: 'Failed to fetch referral' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/referrals — Create referral
// ──────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const data = { ...req.body, createdBy: req.staff.id };
    const referralRecord = await referral.createReferral(data);
    res.status(201).json({ referral: referralRecord });
  } catch (err) {
    console.error('[referrals:create]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create referral' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PATCH /api/referrals/:id/stage — Update referral stage
// ──────────────────────────────────────────────────────────────────────────
router.patch('/:id/stage', async (req, res) => {
  try {
    const { stage, metadata } = req.body;
    if (!stage) return res.status(400).json({ error: 'stage is required' });

    const referralRecord = await referral.updateReferralStage(req.params.id, stage, req.staff.id, metadata);
    res.json({ referral: referralRecord });
  } catch (err) {
    console.error('[referrals:update-stage]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update stage' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/referrals/commissions — List commissions
// ──────────────────────────────────────────────────────────────────────────
router.get('/commissions', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      referrerId: req.query.referrerId,
    };
    const commissions = await referral.getCommissions(filters);
    res.json({ commissions });
  } catch (err) {
    console.error('[referrals:commissions]', err);
    res.status(500).json({ error: 'Failed to fetch commissions' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PATCH /api/referrals/commissions/:id/approve — Approve commission
// ──────────────────────────────────────────────────────────────────────────
router.patch('/commissions/:id/approve', async (req, res) => {
  try {
    const commission = await referral.approveCommission(req.params.id, req.staff.id);
    res.json({ commission });
  } catch (err) {
    console.error('[referrals:approve-commission]', err);
    res.status(500).json({ error: 'Failed to approve commission' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PATCH /api/referrals/commissions/:id/pay — Mark commission as paid
// ──────────────────────────────────────────────────────────────────────────
router.patch('/commissions/:id/pay', async (req, res) => {
  try {
    const { paymentReference } = req.body;
    if (!paymentReference) return res.status(400).json({ error: 'paymentReference is required' });

    const commission = await referral.payCommission(req.params.id, req.staff.id, paymentReference);
    res.json({ commission });
  } catch (err) {
    console.error('[referrals:pay-commission]', err);
    res.status(500).json({ error: 'Failed to mark commission as paid' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/referrals/referrer/:referrerId — Referrer performance
// ──────────────────────────────────────────────────────────────────────────
router.get('/referrer/:referrerId', async (req, res) => {
  try {
    const performance = await referral.getReferrerPerformance(req.params.referrerId);
    res.json(performance);
  } catch (err) {
    console.error('[referrals:referrer-performance]', err);
    res.status(500).json({ error: 'Failed to fetch referrer performance' });
  }
});

module.exports = router;