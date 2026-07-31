'use strict';
// routes/corporateDeals.js — Product/Sales module: Corporate deals.
//
// Where a Corporate deal actually gets set up once Sales marks it won
// (routes/sales.js already creates the `party` row at that point — see its
// header comment). This is the next step: pick the platform account, the
// term, and how it's billed (one lump sum, or monthly/annual installments),
// and this generates the invoice(s) via services/corporateDeals.js and
// flips the platform account on for the full term.

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { fetchPlatformCustomers } = require('../services/platformClient');
const { createCorporateDeal, listCorporateDeals, getCorporateDeal, sendInstallmentReminders } = require('../services/corporateDeals');
const { logAction } = require('../services/auditLog');

router.use(authenticate);
router.use(requireRole('product_hod', 'sales_hod'));

// GET /api/product/corporate-deals
router.get('/', async (req, res) => {
  try {
    const deals = await listCorporateDeals();
    res.json({ deals });
  } catch (err) {
    console.error('[corporate-deals:list]', err);
    res.status(500).json({ error: 'Failed to fetch corporate deals' });
  }
});

// GET /api/product/corporate-deals/:id
router.get('/:id', async (req, res) => {
  try {
    const deal = await getCorporateDeal(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json({ deal });
  } catch (err) {
    console.error('[corporate-deals:get]', err);
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

// POST /api/product/corporate-deals
// body: { partyId, platformUserId, platformEmail, termMonths, billingFrequency,
//         seats, totalValueINR, discountPercent, notes }
router.post('/', async (req, res) => {
  const {
    partyId, platformUserId, platformEmail,
    termMonths, billingFrequency, seats,
    totalValueINR, discountPercent, notes,
  } = req.body;
  try {
    const result = await createCorporateDeal({
      partyId, platformUserId, platformEmail,
      termMonths: parseInt(termMonths), billingFrequency,
      seats: seats != null && seats !== '' ? parseInt(seats) : null,
      totalValueINR: Number(totalValueINR), discountPercent: Number(discountPercent) || 0,
      notes, createdBy: req.staff.id,
    });
    await logAction({
      staffId: req.staff.id,
      action: 'corporate_deal.created',
      entity: 'corporate_deal',
      entityId: result.deal.id,
      newValue: { termMonths, billingFrequency, totalValueINR, discountPercent, seats },
    }).catch(() => {});
    res.status(201).json({
      ok: true, deal: result.deal, installments: result.installments,
      ...(result.platformActivationError
        ? { warning: `Invoices created, but platform activation failed: ${result.platformActivationError}. Retry activation from this deal's page.` }
        : {}),
    });
  } catch (err) {
    console.error('[corporate-deals:create]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create corporate deal' });
  }
});

// GET /api/product/corporate-deals/lookup/platform-customers?search=acme
// Helper for the "pick the platform account" step of the create-deal form
// — thin passthrough to the existing read-only customer roster.
router.get('/lookup/platform-customers', async (req, res) => {
  try {
    const customers = await fetchPlatformCustomers();
    const search = (req.query.search || '').toLowerCase();
    const filtered = search
      ? customers.filter(c => (c.email || '').toLowerCase().includes(search) || (c.company_name || c.full_name || '').toLowerCase().includes(search))
      : customers;
    res.json({ customers: filtered.slice(0, 50) });
  } catch (err) {
    console.error('[corporate-deals:lookup]', err);
    res.status(502).json({ error: err.message });
  }
});

// POST /api/product/corporate-deals/send-reminders — manual trigger,
// useful for testing; also called on a schedule (see cron wiring in index.js/app.js).
router.post('/send-reminders', async (req, res) => {
  try {
    const result = await sendInstallmentReminders();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[corporate-deals:send-reminders]', err);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

module.exports = router;