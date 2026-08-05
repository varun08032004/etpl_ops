'use strict';
// routes/supportTicketsView.js — Sales/CS module: platform support tickets.
//
// Read-only mirror of platform support tickets (GET
// /api/ops-integration/support-tickets) so Sales/CS can see ticket volume
// and status — especially for Corporate accounts — without a separate
// platform admin login. Ticket handling itself still happens on the
// platform; this is visibility only, no write-back.

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { fetchSupportTickets } = require('../services/platformClient');

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
    const tickets = await fetchSupportTickets({ since, status });
    const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
    const corporateOpenCount = tickets.filter((t) => t.corporate_managed && (t.status === 'open' || t.status === 'in_progress')).length;
    res.json({ tickets, openCount, corporateOpenCount });
  } catch (err) {
    console.error('[support-tickets-view]', err.message);
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;