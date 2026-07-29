'use strict';
// routes/productSubscriptions.js — Product module: Subscriptions page.
//
// Surfaces every ethertrack.in subscription (all plans — free/starter/
// growth/corporate) with start and renewal dates, pulled from the
// platform's existing read-only customer roster (services/platformClient.js
// → GET /api/ops-integration/customers, already live, no platform-side
// change needed for the list view).
//
// Renewal is a WRITE and only applies to Corporate accounts — self-serve
// plans renew automatically via the platform's own billing, so there's
// nothing for the ERP to trigger there. Corporate is "Contact Sales" only,
// so it's the one plan whose renewal date is genuinely managed by a human
// here — see services/platformClient.js's updateCorporateRenewal(), which
// goes through the separately-scoped /api/ops-integration-corporate write
// surface (routes/opsIntegrationCorporate.js on the platform side).

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { fetchPlatformCustomers, updateCorporateRenewal } = require('../services/platformClient');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

// Same idiom as every other *_hod-gated route in this codebase (see
// routes/accounting.js's requireRole('finance', 'accounting_hod')).
// requireRole() already passes for: owner/admin (blanket bypass), anyone
// literally logged in as 'product_hod', AND — via req.staff.effectiveRoles,
// resolved in middleware/auth.js from the Product department's
// granted_roles — every regular employee in the Product department, if the
// founder has configured that department to grant 'product_hod' to its
// members (Team → Product → Grant Roles). That one config toggle is what
// distinguishes "just the head" from "the whole product team", without any
// extra code here — exactly matching what was asked: founder, admin, and
// Product employees, always including the HOD themselves.
router.use(requireRole('product_hod'));

// GET /api/product/subscriptions?plan=corporate&search=acme
// Every platform subscription, shaped around start/renewal dates. `plan`
// filters to one tier; `search` matches email/name/company (case-insensitive,
// substring). Both optional.
router.get('/', async (req, res) => {
  try {
    const { plan, search } = req.query;
    const customers = await fetchPlatformCustomers(5000);

    let subs = customers
      .filter(c => c.subscription_plan && c.subscription_plan !== 'free')
      .map(c => ({
        platformUserId: c.id,
        email: c.email,
        fullName: c.full_name,
        companyName: c.company_name || null,
        plan: c.subscription_plan,
        cycle: c.subscription_cycle || null,
        startedAt: c.subscription_activated_at || null,
        renewsAt: c.subscription_renewal_date || null,
        corporateManaged: !!c.corporate_managed,
        latestPaymentINR: c.latest_subscription_payment_inr != null ? Number(c.latest_subscription_payment_inr) : null,
        kycStatus: c.kyc_status,
      }));

    if (plan) subs = subs.filter(s => s.plan === plan);
    if (search) {
      const q = search.toLowerCase();
      subs = subs.filter(s =>
        (s.email || '').toLowerCase().includes(q) ||
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.companyName || '').toLowerCase().includes(q)
      );
    }

    // Soonest renewal first — the whole point of this view is "what needs
    // attention next", so an unset renewal date (self-serve plans between
    // billing cycles, or a not-yet-scheduled corporate account) sorts last
    // rather than confusingly at the top.
    subs.sort((a, b) => {
      if (!a.renewsAt) return 1;
      if (!b.renewsAt) return -1;
      return new Date(a.renewsAt) - new Date(b.renewsAt);
    });

    res.json({
      subscriptions: subs,
      counts: {
        total: subs.length,
        corporate: subs.filter(s => s.plan === 'corporate').length,
        renewingWithin30Days: subs.filter(s => s.renewsAt && (new Date(s.renewsAt) - Date.now()) < 30 * 86400000 && (new Date(s.renewsAt) - Date.now()) > 0).length,
      },
    });
  } catch (err) {
    console.error('[product-subscriptions:list]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch subscriptions' });
  }
});

// PATCH /api/product/subscriptions/:platformUserId/renew
// body: { renewalDate, seats?, notes? }
// Corporate-only — the platform side (services/corporateActivation.js)
// rejects this for any other plan with a clear error, which is surfaced
// as-is here rather than re-validated twice.
router.patch('/:platformUserId/renew', async (req, res) => {
  const { platformUserId } = req.params;
  const { renewalDate, seats, notes } = req.body;
  if (!renewalDate) return res.status(400).json({ error: 'renewalDate is required' });

  try {
    const result = await updateCorporateRenewal(platformUserId, { renewalDate, seats: seats || null, notes: notes || null });
    await logAction({
      staffId: req.staff.id,
      action: 'product_subscription.renewed',
      entity: 'platform_subscription',
      entityId: platformUserId,
      newValue: { renewalDate, seats: seats || null, notes: notes || null },
    }).catch(() => {});
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[product-subscriptions:renew]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to renew subscription' });
  }
});

module.exports = router;