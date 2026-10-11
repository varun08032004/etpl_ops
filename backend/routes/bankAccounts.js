'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole, requireMFA } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');
const { BankCredentialsService } = require('../services/bankCredentialsService');

const bankCredentialsService = new BankCredentialsService();

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

const VALID_PROVIDERS = ['axis', 'manual'];

function isNonNegativeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

// ── portfolio list — every account, current balance, aggregate total ───────
// Never returns api_client_secret — that's write-only from the API's
// perspective; the list/detail views only need to know IF an account has
// credentials configured, not what they are.
router.get('/', async (req, res) => {
  try {
    const { rows: accounts } = await safeQuery(
      `SELECT id, account_name, bank_name, provider, current_balance, balance_as_of, balance_source,
              RIGHT(account_number, 4) AS account_number_last4,
              (api_client_id IS NOT NULL AND api_client_secret IS NOT NULL AND api_base_url IS NOT NULL) AS api_configured,
              (api_client_id_enc IS NOT NULL AND api_client_secret_enc IS NOT NULL AND api_base_url_enc IS NOT NULL) AS fully_encrypted
       FROM bank_accounts ORDER BY bank_name, account_name`
    );

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
    const { account_name, bank_name, account_number, ifsc_code, provider, ledger_account_id,
      api_client_id, api_client_secret, api_base_url } = req.body;
    if (!account_name || !bank_name || !account_number) {
      return res.status(400).json({ error: 'account_name, bank_name, and account_number are required' });
    }
    const resolvedProvider = (provider || 'manual').toLowerCase();
    if (!VALID_PROVIDERS.includes(resolvedProvider)) {
      return res.status(400).json({ error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` });
    }
    if (resolvedProvider !== 'manual' && (!api_client_id || !api_client_secret || !api_base_url)) {
      return res.status(400).json({ error: 'api_client_id, api_client_secret, and api_base_url are required for any non-manual provider — each account needs its own credentials' });
    }

    const { rows: [account] } = await safeQuery(
      `INSERT INTO bank_accounts (account_name, bank_name, account_number, ifsc_code, provider, ledger_account_id,
         balance_source, api_client_id, api_client_secret, api_base_url)
      VALUES ($1,$2,$3,$4,$5,$6,'manual',$7,$8,$9) RETURNING id, account_name, bank_name, provider`,
      [account_name, bank_name, account_number, ifsc_code || null, resolvedProvider, ledger_account_id || null,
       api_client_id || null, api_client_secret || null, api_base_url || null]
    );
    res.status(201).json({ account });
  } catch (err) {
    console.error('[bank-accounts:create]', err);
    res.status(500).json({ error: 'Failed to create bank account' });
  }
});

// ── update an account's own API credentials ─────────────────────────────────
// Requires MFA step-up for production
router.put('/:id/credentials', requireMFA, async (req, res) => {
  try {
    const { api_client_id, api_client_secret, api_base_url } = req.body;
    if (!api_client_id || !api_client_secret || !api_base_url) {
      return res.status(400).json({ error: 'api_client_id, api_client_secret, and api_base_url are all required' });
    }
    const { rows: [updated] } = await safeQuery(
      `UPDATE bank_accounts SET api_client_id = $1, api_client_secret = $2, api_base_url = $3 WHERE id = $4
       RETURNING id, account_name`,
      [api_client_id, api_client_secret, api_base_url, req.params.id]
    );
    if (!updated) return res.status(404).json({ error: 'Bank account not found' });
    
    // Encrypt credentials after saving
    const { BankCredentialsService } = require('../services/bankCredentialsService');
    const bankCredentialsService = new BankCredentialsService();
    await bankCredentialsService.encryptCredentials(req.params.id, api_client_id, api_client_secret);
    
    res.json({ account: updated, credentialsSet: true });
  } catch (err) {
    console.error('[bank-accounts:update-credentials]', err);
    res.status(500).json({ error: 'Failed to update credentials' });
  }
});

// ── manual balance update ──
router.put('/:id/balance', async (req, res) => {
  try {
    const { balance } = req.body;
    if (!isNonNegativeNumber(balance)) return res.status(400).json({ error: 'balance must be a number >= 0' });

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

// ── trigger a live sync via the account's configured adapter ──
router.post('/:id/sync', async (req, res) => {
  try {
    const { syncBankAccount, autoMatch } = require('../services/bankFeeds/bankReconciliationEngine');
    const result = await syncBankAccount(req.params.id);
    const matchResult = await autoMatch(req.params.id);
    res.json({ ...result, ...matchResult });
  } catch (err) {
    console.error('[bank-accounts:sync]', err);
    res.status(502).json({ error: err.message || 'Failed to sync bank account' });
  }
});

// Note: /decrypt endpoint removed — plaintext credentials must not be returned via HTTP.
// Internal operations (bank feed sync, payroll disbursement) should call
// BankCredentialsService.getDecryptedCredentials() directly with proper authorization.

// ── get masked credentials for UI ──
router.get('/:id/masked', async (req, res) => {
  try {
    const masked = await bankCredentialsService.getMaskedCredentials(req.params.id);
    res.json({ credentials: masked });
  } catch (err) {
    console.error('[bank-accounts:masked]', err);
    res.status(500).json({ error: 'Failed to fetch masked credentials' });
  }
});

// ── verify all credentials are encrypted ──
router.get('/verify-encrypted', async (req, res) => {
  try {
    const result = await bankCredentialsService.verifyAllEncrypted();
    res.json({ verification: result });
  } catch (err) {
    console.error('[bank-accounts:verify-encrypted]', err);
    res.status(500).json({ error: 'Failed to verify encryption status' });
  }
});

router.delete('/:id', requireRole(), async (req, res) => {
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