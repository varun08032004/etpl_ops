'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const renewal = require('../services/renewalWorkflow');
const { logAction } = require('../services/auditLog');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'sales_hod', 'finance', 'product_hod'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/renewals — List all upcoming renewals with stage info
// ──────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days) || 180;
    const renewals = await renewal.getUpcomingRenewals(daysAhead);
    res.json({ renewals });
  } catch (err) {
    console.error('[renewals:list]', err);
    res.status(500).json({ error: 'Failed to fetch renewals' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/renewals/dashboard — Summary stats for dashboard
// ──────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const renewals = await renewal.getUpcomingRenewals(180);
    const now = new Date();

    const stats = {
      total: renewals.length,
      overdue: renewals.filter(r => r.isOverdue).length,
      urgent: renewals.filter(r => r.isUrgent).length,
      thisWeek: renewals.filter(r => r.daysUntilRenewal > 0 && r.daysUntilRenewal <= 7).length,
      thisMonth: renewals.filter(r => r.daysUntilRenewal > 7 && r.daysUntilRenewal <= 30).length,
      byStage: {},
      totalValueAtRisk: 0,
    };

    for (const r of renewals) {
      const stage = r.currentStage?.label || 'No Stage';
      stats.byStage[stage] = (stats.byStage[stage] || 0) + 1;
      if (r.isUrgent || r.isOverdue) {
        stats.totalValueAtRisk += (r.net_value_paise || r.totalValuePaise || 0) / 100;
      }
    }

    res.json(stats);
  } catch (err) {
    console.error('[renewals:dashboard]', err);
    res.status(500).json({ error: 'Failed to fetch renewal dashboard' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/renewals/:id — Get single renewal with tasks/proposals
// ──────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const renewals = await renewal.getUpcomingRenewals(365);
    const r = renewals.find(x => x.id === req.params.id || x.platform_user_id === req.params.id);
    if (!r) return res.status(404).json({ error: 'Renewal not found' });

    // Fetch tasks
    const { safeQuery: query } = require('../db/pool');
    const { rows: tasks } = await query(
      `SELECT * FROM tasks WHERE related_entity = 'corporate_deal' AND related_entity_id = $1 ORDER BY due_date`,
      [r.id]
    );

    // Fetch proposals
    const { rows: proposals } = await query(
      `SELECT * FROM renewal_proposals WHERE deal_id = $1 ORDER BY created_at DESC`,
      [r.id]
    );

    res.json({ renewal: r, tasks, proposals });
  } catch (err) {
    console.error('[renewals:get]', err);
    res.status(500).json({ error: 'Failed to fetch renewal' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/renewals/:id/tasks — Create renewal tasks for a deal
// ──────────────────────────────────────────────────────────────────────────
router.post('/:id/tasks', async (req, res) => {
  try {
    const { assignedTo } = req.body;
    if (!assignedTo) return res.status(400).json({ error: 'assignedTo is required' });

    const tasks = await renewal.createRenewalTasks(req.params.id, assignedTo);
    await logAction({
      staffId: req.staff.id,
      action: 'renewal.tasks_created',
      entity: 'corporate_deal',
      entityId: req.params.id,
      newValue: { taskCount: tasks.length },
    }).catch(() => {});

    res.status(201).json({ tasks });
  } catch (err) {
    console.error('[renewals:create-tasks]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create tasks' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/renewals/:id/proposals — Create renewal proposal
// ──────────────────────────────────────────────────────────────────────────
router.post('/:id/proposals', async (req, res) => {
  try {
    const proposal = await renewal.createRenewalProposal(req.params.id, req.body, req.staff.id);
    await logAction({
      staffId: req.staff.id,
      action: 'renewal_proposal.created',
      entity: 'renewal_proposal',
      entityId: proposal.id,
      newValue: req.body,
    }).catch(() => {});
    res.status(201).json({ proposal });
  } catch (err) {
    console.error('[renewals:create-proposal]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create proposal' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PATCH /api/renewals/proposals/:proposalId/approve — Approve/reject proposal
// ──────────────────────────────────────────────────────────────────────────
router.patch('/proposals/:proposalId/approve', async (req, res) => {
  try {
    const { approved, notes } = req.body;
    if (typeof approved !== 'boolean') return res.status(400).json({ error: 'approved (boolean) is required' });

    const proposal = await renewal.approveRenewalProposal(req.params.proposalId, req.staff.id, approved, notes);
    await logAction({
      staffId: req.staff.id,
      action: approved ? 'renewal_proposal.approved' : 'renewal_proposal.rejected',
      entity: 'renewal_proposal',
      entityId: req.params.proposalId,
      newValue: { approved, notes },
    }).catch(() => {});

    res.json({ proposal });
  } catch (err) {
    console.error('[renewals:approve-proposal]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to approve proposal' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/renewals/run-check — Manual trigger for daily renewal check
// ──────────────────────────────────────────────────────────────────────────
router.post('/run-check', async (req, res) => {
  try {
    const result = await renewal.runDailyRenewalCheck();
    res.json(result);
  } catch (err) {
    console.error('[renewals:run-check]', err);
    res.status(500).json({ error: 'Failed to run renewal check' });
  }
});

module.exports = router;