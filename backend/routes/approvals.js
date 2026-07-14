'use strict';
// routes/approvals.js
//
// Endpoints for the generic approval-request workflow (services/approvals.js).
// Listing is visible to admin+owner (an admin should be able to see the
// status of their own pending requests). Approve/reject are deliberately
// NOT gated with requireRole('admin') — that helper lets both owner AND
// admin through, which would defeat the entire point of "admin requests,
// founder approves." These two routes check req.staff.role === 'owner'
// directly instead.

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const approvals = require('../services/approvals');

router.use(authenticate);

// GET /api/approvals?status=pending
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const rows = await approvals.listRequests({ status: req.query.status });
    res.json({ requests: rows });
  } catch (err) {
    console.error('[approvals:list]', err);
    res.status(500).json({ error: 'Failed to fetch approval requests' });
  }
});

// POST /api/approvals/:id/approve — Founder (owner) only.
router.post('/:id/approve', async (req, res) => {
  if (req.staff.role !== 'owner') {
    return res.status(403).json({ error: 'Only the Founder can approve requests' });
  }
  try {
    const { request, result } = await approvals.approveRequest(req.params.id, req.staff.id);
    res.json({ request, result });
  } catch (err) {
    console.error('[approvals:approve]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to approve request' });
  }
});

// POST /api/approvals/:id/reject — Founder (owner) only.
router.post('/:id/reject', async (req, res) => {
  if (req.staff.role !== 'owner') {
    return res.status(403).json({ error: 'Only the Founder can reject requests' });
  }
  try {
    const { reason } = req.body;
    const request = await approvals.rejectRequest(req.params.id, req.staff.id, reason);
    res.json({ request });
  } catch (err) {
    console.error('[approvals:reject]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to reject request' });
  }
});

module.exports = router;