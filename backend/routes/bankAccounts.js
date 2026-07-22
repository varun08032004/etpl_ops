'use strict';
// routes/bankAccounts.js — bank accounts portfolio.
//
// Access: owner/admin (bypass via requireRole()) + finance role only.
// This is deliberately tighter than most finance-adjacent screens — an
// aggregate view of ALL company cash positions across every account is
// more sensitive than any single transaction, so it's gated at the route
// level, not just hidden in the UI.

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { syncBankAccount, autoMatch } = require('../services/bankFeeds/bankReconciliationEngine');

router.use(authenticate);
router.use(requireRole('finance')); // every route in this file — owner/admin bypass, plus 'finance' role

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests — please slow down and try again shortly.' },
});
router.use(generalLimiter);

const writeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many changes made too quickly — please slow down and try again shortly.' },
});
router.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) return writeLimiter(req, res, next);
  next();
});

const VALID_PROVIDERS = ['axis', 'manual']; // extend as you add real bank adapters

function isNonNegativeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

// ── portfolio list — every account, current balance, aggregate total ───────
router.get('/', async (req, res) => {
  try {
    const { rows: accounts } = await safeQuery(
      `SELECT id, account_name, bank_name, provider, current_balance, balance_as_of, balance_source,
              RIGHT(account_number, 4) AS account_number_last4
       FROM bank_accounts ORDER BY bank_name, account_name`
    );

    // Aggregate total assumes INR — if you ever hold a foreign-currency
    // account, this needs FX conversion the same way expenses.js does via
    // getCachedRate(). Flagging rather than silently mixing currencies.
    const hasNonInr = accounts.some((a) => a.currency && a.currency !== 'INR');
    const totalInr = accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);

    res.json({ accounts, totalBalanceInr: totalInr, currencyWarning: hasNonInr ? 'One or more accounts may not be INR — total may not be accurate until FX conversion is added here.' : null });
  } catch (err) {
    console.error('[bank-accounts:list]', err);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { account_name, bank_name, account_number, ifsc_code, provider, ledger_account_id } = req.body;
    if (!account_name || !bank_name || !account_number) {
      return res.status(400).json({ error: 'account_name, bank_name, and account_number are required' });
    }
    const resolvedProvider = (provider || 'manual').toLowerCase();
    if (!VALID_PROVIDERS.includes(resolvedProvider)) {
      return res.status(400).json({ error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` });
    }

    const { rows: [account] } = await safeQuery(
      `INSERT INTO bank_accounts (account_name, bank_name, account_number, ifsc_code, provider, ledger_account_id, balance_source)
       VALUES ($1,$2,$3,$4,$5,$6,'manual') RETURNING *`,
      [account_name, bank_name, account_number, ifsc_code || null, resolvedProvider, ledger_account_id || null]
    );
    res.status(201).json({ account });
  } catch (err) {
    console.error('[bank-accounts:create]', err);
    res.status(500).json({ error: 'Failed to create bank account' });
  }
});

// ── manual balance update — the FIN-03 fallback while API sync isn't live ──
router.put('/:id/balance', async (req, res) => {
  try {
    const { balance } = req.body;
    if (!isNonNegativeNumber(balance)) return res.status(400).json({ error: 'balance must be a number ≥ 0' });

    const { rows: [updated] } = await safeQuery(
      `UPDATE bank_accounts SET current_balance = $1, balance_as_of = NOW(), balance_source = 'manual' WHERE id = $2 RETURNING *`,
      [balance, req.params.id]
    );
    if (!updated) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ account: updated });
  } catch (err) {
    console.error('[bank-accounts:update-balance]', err);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// ── trigger a live sync via the account's configured adapter ────────────────
// Fails clearly (not silently) for 'manual' accounts or unconfigured adapters —
// same honesty pattern as axisBankAdapter.js itself.
router.post('/:id/sync', async (req, res) => {
  try {
    const result = await syncBankAccount(req.params.id);
    const matchResult = await autoMatch(req.params.id);
    res.json({ ...result, ...matchResult });
  } catch (err) {
    console.error('[bank-accounts:sync]', err);
    res.status(502).json({ error: err.message || 'Failed to sync bank account' });
  }
});

router.delete('/:id', requireRole(), async (req, res) => {
  // requireRole() with no args → owner/admin only, deliberately tighter than
  // the rest of this file — deleting a bank account is rare and high-stakes.
  try {
    const { rows } = await safeQuery(`DELETE FROM bank_accounts WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[bank-accounts:delete]', err);
    res.status(500).json({ error: 'Failed to delete bank account — it may have transactions or payroll/expense history referencing it' });
  }
});

module.exports = router;