'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { approveRequest, rejectRequest, listRequests, listPendingForStaff } = require('../services/approvals');

router.use(authenticate);

// ?status=pending&forMe=true → only requests where I'm the eligible approver
// at the current stage (used to badge/list "needs your action").
// ?status=pending (no forMe) → everything pending, for visibility (e.g. Founder
// dashboard showing the whole pipeline even for stages not yet reached).
router.get('/', async (req, res) => {
  try {
    const { status, forMe } = req.query;
    if (forMe === 'true') {
      const rows = await listPendingForStaff(req.staff.id);
      return res.json({ requests: rows });
    }
    const rows = await listRequests({ status });
    res.json({ requests: rows });
  } catch (err) {
    console.error('[approvals:list]', err);
    res.status(500).json({ error: 'Failed to fetch approval requests' });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { request, result, finalized } = await approveRequest(req.params.id, req.staff.id);
    res.json({ request, result, finalized });
  } catch (err) {
    console.error('[approvals:approve]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to approve request' });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const request = await rejectRequest(req.params.id, req.staff.id, req.body?.reason);
    res.json({ request });
  } catch (err) {
    console.error('[approvals:reject]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to reject request' });
  }
});

module.exports = router;