'use strict';
// routes/supportTicketsView.js — Sales/CS module: platform account health.
//
// Read-only mirror of three platform signals Sales/CS previously had zero
// visibility into without a separate platform admin login:
//   - support tickets    (GET /api/ops-integration/support-tickets)
//   - trade/credit disputes (GET /api/ops-integration/disputes)
//   - KYC submissions/rejections (GET /api/ops-integration/kyc-status)
// All three still get handled/resolved on the platform itself — this is
// visibility only, no write-back. Kept as one combined endpoint (rather
// than three separate pages) since they're all the same underlying need:
// "does Sales/CS need to know something's up with this account."

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { fetchSupportTickets, fetchDisputes, fetchKycStatus } = require('../services/platformClient');

router.use(authenticate);
router.use(requireRole('sales_hod', 'product_hod', 'marketing_hod'));

// GET /api/support-tickets-view?status=open&days=90
router.get('/', async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 90, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const status = ['open', 'in_progress', 'resolved', 'closed'].includes(req.query.status)
    ? req.query.status
    : null;

  try {
    const [tickets, disputes, kycSubmissions] = await Promise.all([
      fetchSupportTickets({ since, status }),
      fetchDisputes({ since }),
      fetchKycStatus(since),
    ]);

    const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
    const corporateOpenCount = tickets.filter((t) => t.corporate_managed && (t.status === 'open' || t.status === 'in_progress')).length;
    const openDisputesCount = disputes.filter((d) => d.status === 'open').length;
    const kycRejectedCount = kycSubmissions.filter((k) => k.status === 'rejected').length;
    const kycPendingCount = kycSubmissions.filter((k) => k.status === 'pending').length;

    res.json({
      tickets, openCount, corporateOpenCount,
      disputes, openDisputesCount,
      kycSubmissions, kycRejectedCount, kycPendingCount,
    });
  } catch (err) {
    console.error('[support-tickets-view]', err.message);
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;