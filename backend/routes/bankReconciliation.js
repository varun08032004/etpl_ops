'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { safeQuery } = require('../db/pool');
const {
  getReconciliationWorkspace,
  matchTransaction,
  unmatchTransaction,
  reviewTransaction,
  reconcileTransaction,
  getReconciliationSummary,
  autoMatchTransactions
} = require('../services/bankReconciliation');
const { logAction } = require('../services/auditLog');

router.use(authenticate);
router.use(requireRole('finance'));

/**
 * Get reconciliation workspace for a bank account
 * GET /api/bank-reconciliation/:bankAccountId/workspace
 * Query params: status, fromDate, toDate, search, limit, offset
 */
router.get('/:bankAccountId/workspace', async (req, res) => {
  try {
    const { bankAccountId } = req.params;
    const { status, fromDate, toDate, search, limit = 50, offset = 0 } = req.query;

    const result = await getReconciliationWorkspace(bankAccountId, {
      status: req.query.status,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      search: req.query.search,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    });

    res.json({ bankAccountId, ...result });
  } catch (err) {
    console.error('[bank-reconciliation:workspace]', err);
    if (err.message === 'Bank account not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get reconciliation summary for a bank account
 * GET /api/bank-reconciliation/:bankAccountId/summary
 */
router.get('/:bankAccountId/summary', async (req, res) => {
  try {
    const { bankAccountId } = req.params;
    const summary = await getReconciliationSummary(bankAccountId);
    res.json({ bankAccountId, ...summary });
  } catch (err) {
    console.error('[bank-reconciliation:summary]', err);
    if (err.message === 'Bank account not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Match a bank transaction to a journal entry
 * POST /api/bank-reconciliation/:bankAccountId/match
 * Body: { transactionId, journalEntryId, matchMethod, matchConfidence }
 */
router.post('/:bankAccountId/match', async (req, res) => {
  try {
    const { bankAccountId } = req.params;
    const { transactionId, journalEntryId, matchMethod = 'manual', matchConfidence = 1.0 } = req.body;

    if (!transactionId || !journalEntryId) {
      return res.status(400).json({ error: 'transactionId and journalEntryId are required' });
    }

    // Verify bank account exists
    const { rows: [account] } = await safeQuery('SELECT id FROM bank_accounts WHERE id = $1', [bankAccountId]);
    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const result = await matchTransaction(
      bankAccountId,
      transactionId,
      journalEntryId,
      req.staff.id,
      req.body.matchMethod || 'manual',
      req.body.matchConfidence || 1.0
    );

    res.json({ bankAccountId, ...result });
  } catch (err) {
    console.error('[bank-reconciliation:match]', err);
    if (err.message === 'Bank account not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * Unmatch a previously matched transaction
 * POST /api/bank-reconciliation/:bankAccountId/unmatch
 * Body: { transactionId }
 */
router.post('/:bankAccountId/unmatch', async (req, res) => {
  try {
    const { bankAccountId } = req.params;
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId is required' });
    }

    const result = await unmatchTransaction(bankAccountId, transactionId, req.staff.id);
    res.json({ bankAccountId, ...result });
  } catch (err) {
    console.error('[bank-reconciliation:unmatch]', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Review a transaction (mark as reviewed)
 * POST /api/bank-reconciliation/:bankAccountId/review
 * Body: { transactionId }
 */
router.post('/:bankAccountId/review', async (req, res) => {
  try {
    const { bankAccountId } = req.params;
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId is required' });
    }

    const result = await reviewTransaction(bankAccountId, transactionId, req.staff.id);
    res.json({ bankAccountId, ...result });
  } catch (err) {
    console.error('[bank-reconciliation:review]', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Reconcile a transaction (final lock)
 * POST /api/bank-reconciliation/:bankAccountId/reconcile
 * Body: { transactionId }
 */
router.post('/:bankAccountId/reconcile', async (req, res) => {
  try {
    const { bankAccountId } = req.params;
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId is required' });
    }

    const result = await reconcileTransaction(bankAccountId, transactionId, req.staff.id);
    res.json({ bankAccountId, ...result });
  } catch (err) {
    console.error('[bank-reconciliation:reconcile]', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Auto-match transactions against journal entries
 * POST /api/bank-reconciliation/:bankAccountId/auto-match
 * Body: { toleranceDays, amountTolerance }
 */
router.post('/:bankAccountId/auto-match', async (req, res) => {
  try {
    const { bankAccountId } = req.params;
    const { toleranceDays = 3, amountTolerance = 1 } = req.body;

    const result = await autoMatchTransactions(bankAccountId, {
      toleranceDays: req.body.toleranceDays,
      amountTolerance: req.body.amountTolerance
    });

    res.json({ bankAccountId, ...result });
  } catch (err) {
    console.error('[bank-reconciliation:auto-match]', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * Bulk reconcile multiple transactions
 * POST /api/bank-reconciliation/:bankAccountId/bulk-reconcile
 * Body: { transactionIds: string[] }
 */
router.post('/:bankAccountId/bulk-reconcile', async (req, res) => {
  try {
    const { bankAccountId } = req.params;
    const { transactionIds } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'transactionIds array is required' });
    }

    const results = [];
    for (const transactionId of transactionIds) {
      try {
        const result = await reconcileTransaction(bankAccountId, transactionId, req.staff.id);
        results.push({ transactionId, success: true, ...result });
      } catch (err) {
        results.push({ transactionId, success: false, error: err.message });
      }
    }

    res.json({ bankAccountId, results });
  } catch (err) {
    console.error('[bank-reconciliation:bulk-reconcile]', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;