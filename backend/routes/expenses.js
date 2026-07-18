'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { fireEvent } = require('../services/automationEngine');
const ledger = require('../services/ledger');
const { convertToINR } = require('../services/fxConversion');
const { syncBankAccount, autoMatch } = require('../services/bankFeeds/bankReconciliationEngine');
const ExcelJS = require('exceljs'); // npm install exceljs — used only by the /export endpoint below
const rateLimit = require('express-rate-limit'); // npm install express-rate-limit

router.use(authenticate);

// General ceiling for this module: generous enough for normal use, low enough
// to blunt a runaway script or compromised token from hammering the DB/FX API.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 120 requests/minute per IP across all expense routes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to the expenses module — please slow down and try again shortly.' },
});
router.use(generalLimiter);

// Tighter limit specifically on the routes that create bills, post ledger
// entries, or move money — these should never be hit dozens of times a
// minute by legitimate use, so a lower ceiling here catches abuse faster
// without affecting normal browsing/reading.
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 write requests/minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many changes made too quickly — please slow down and try again shortly.' },
});

router.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  next();
});

// ── date math for advancing a recurring expense to its next occurrence ─────
function advanceDate(date, frequency, customDays) {
  const d = new Date(date);
  switch (frequency) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
    case 'custom_days': d.setDate(d.getDate() + (customDays || 30)); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

const ALLOWED_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly', 'custom_days'];
const ALLOWED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD'];

function validateFrequency(frequency) {
  return frequency == null || ALLOWED_FREQUENCIES.includes(frequency);
}
function validateCurrency(currency) {
  return currency == null || ALLOWED_CURRENCIES.includes((currency || '').toUpperCase().trim());
}
function validateAmount(value) {
  // Must be a finite, non-negative number. 0 is valid (free tiers), negative is not.
  const num = Number(value);
  return Number.isFinite(num) && num >= 0;
}

async function getEnvironment() {
  const { rows: [row] } = await safeQuery(`SELECT value FROM app_settings WHERE key = 'environment_mode'`);
  return row?.value || 'testnet';
}

// ── normalize any frequency into a monthly-equivalent multiplier ───────────
function monthlyMultiplier(frequency, customDays) {
  switch (frequency) {
    case 'weekly': return 52 / 12;       // ≈4.333 occurrences/month
    case 'monthly': return 1;
    case 'quarterly': return 1 / 3;
    case 'yearly': return 1 / 12;
    case 'custom_days': return 30 / (customDays || 30);
    default: return 1;
  }
}

// ── FX rate cache — one live lookup per currency per day, reused everywhere ─
async function getCachedRate(currency) {
  const cur = (currency || 'INR').toUpperCase();
  if (cur === 'INR') return 1;
  const today = new Date().toISOString().slice(0, 10);
  const { rows: [cached] } = await safeQuery(
    `SELECT rate_to_inr FROM fx_rate_cache WHERE currency = $1 AND rate_date = $2`,
    [cur, today]
  );
  if (cached) return Number(cached.rate_to_inr);

  const converted = await convertToINR(1, cur); // may throw — caller should catch
  const rate = converted.rate;
  await safeQuery(
    `INSERT INTO fx_rate_cache (currency, rate_date, rate_to_inr) VALUES ($1,$2,$3)
     ON CONFLICT (currency, rate_date) DO UPDATE SET rate_to_inr = $3, fetched_at = NOW()`,
    [cur, today, rate]
  );
  return rate;
}

// ── audit log — best-effort, never blocks the actual operation ─────────────
async function logAudit(recurringExpenseId, action, changedBy, beforeState, afterState) {
  try {
    await safeQuery(
      `INSERT INTO recurring_expense_audit_log (recurring_expense_id, action, changed_by, before_state, after_state)
       VALUES ($1,$2,$3,$4,$5)`,
      [recurringExpenseId, action, changedBy || null,
       beforeState ? JSON.stringify(beforeState) : null,
       afterState ? JSON.stringify(afterState) : null]
    );
  } catch (err) {
    console.error('[expenses:audit] Failed to write audit log entry:', err.message);
  }
}

// ── approval workflow — auto-flag anything above the configured threshold ──
async function getApprovalThreshold() {
  const { rows: [row] } = await safeQuery(`SELECT value FROM app_settings_numeric WHERE key = 'recurring_expense_approval_threshold_inr'`);
  return row ? Number(row.value) : 15000;
}

async function computeApprovalStatus({ testnet_amount, prod_amount, frequency, custom_interval_days, currency }, env, overrideThreshold) {
  const effectiveAmount = env === 'production' ? Number(prod_amount) : Number(testnet_amount);
  const monthlyOwnCurrency = effectiveAmount * monthlyMultiplier(frequency, custom_interval_days);
  let monthlyInr = monthlyOwnCurrency;
  if ((currency || 'INR').toUpperCase() !== 'INR') {
    try {
      const rate = await getCachedRate(currency);
      monthlyInr = monthlyOwnCurrency * rate;
    } catch (fxErr) {
      console.error('[expenses:approval] FX lookup failed while computing approval status, using raw amount:', fxErr.message);
    }
  }
  const threshold = overrideThreshold != null ? Number(overrideThreshold) : await getApprovalThreshold();
  return monthlyInr >= threshold ? 'pending_approval' : 'approved';
}

// ── environment toggle (testnet / production) ───────────────────────────────
router.get('/settings/environment', async (req, res) => {
  try {
    res.json({ environment: await getEnvironment() });
  } catch (err) {
    console.error('[expenses:settings:get]', err);
    res.status(500).json({ error: 'Failed to fetch environment setting' });
  }
});

router.put('/settings/environment', requireRole('finance'), async (req, res) => {
  try {
    const { environment } = req.body;
    if (!['testnet', 'production'].includes(environment)) {
      return res.status(400).json({ error: 'environment must be "testnet" or "production"' });
    }
    await safeQuery(
      `INSERT INTO app_settings (key, value) VALUES ('environment_mode', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [environment]
    );
    res.json({ environment });
  } catch (err) {
    console.error('[expenses:settings:put]', err);
    res.status(500).json({ error: 'Failed to update environment setting' });
  }
});

router.get('/settings/approval-threshold', requireRole('finance'), async (req, res) => {
  try {
    res.json({ thresholdInr: await getApprovalThreshold() });
  } catch (err) {
    console.error('[expenses:settings:approval-threshold:get]', err);
    res.status(500).json({ error: 'Failed to fetch approval threshold' });
  }
});

router.put('/settings/approval-threshold', requireRole(), async (req, res) => {
  // requireRole() with no args → only owner/admin pass. Threshold changes are owner/admin-only.
  try {
    const { thresholdInr } = req.body;
    if (!validateAmount(thresholdInr)) return res.status(400).json({ error: 'thresholdInr must be a number ≥ 0' });
    await safeQuery(
      `INSERT INTO app_settings_numeric (key, value) VALUES ('recurring_expense_approval_threshold_inr', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [thresholdInr]
    );
    res.json({ thresholdInr: Number(thresholdInr) });
  } catch (err) {
    console.error('[expenses:settings:approval-threshold:put]', err);
    res.status(500).json({ error: 'Failed to update approval threshold' });
  }
});

// ── recurring expense definitions ───────────────────────────────────────────
router.get('/recurring', async (req, res) => {
  try {
    const env = await getEnvironment();
    const { category_id } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const params = [env];
    let categoryClause = '';
    if (category_id) {
      params.push(category_id);
      categoryClause = `WHERE re.category_id = $${params.length}`;
    }

    const { rows: [{ count }] } = await safeQuery(
      `SELECT COUNT(*) AS count FROM recurring_expenses re ${categoryClause}`,
      category_id ? [category_id] : []
    );

    params.push(limit, offset);
    const { rows } = await safeQuery(
      `SELECT re.*, p.name AS vendor_name, ec.name AS category_name,
              CASE WHEN $1 = 'production' THEN re.prod_amount ELSE re.testnet_amount END AS effective_amount
       FROM recurring_expenses re
       LEFT JOIN parties p ON p.id = re.vendor_id
       LEFT JOIN expense_categories ec ON ec.id = re.category_id
       ${categoryClause}
       ORDER BY re.next_due_date ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ recurringExpenses: rows, environment: env, pagination: { total: Number(count), limit, offset } });
  } catch (err) {
    console.error('[expenses:recurring:list]', err);
    res.status(500).json({ error: 'Failed to fetch recurring expenses' });
  }
});

router.get('/recurring/:id/audit-log', requireRole('finance'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const { rows: [{ count }] } = await safeQuery(
      `SELECT COUNT(*) AS count FROM recurring_expense_audit_log WHERE recurring_expense_id = $1`,
      [req.params.id]
    );
    const { rows } = await safeQuery(
      `SELECT al.*, sa.email AS changed_by_email
       FROM recurring_expense_audit_log al
       LEFT JOIN staff_accounts sa ON sa.id = al.changed_by
       WHERE al.recurring_expense_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    res.json({ auditLog: rows, pagination: { total: Number(count), limit, offset } });
  } catch (err) {
    console.error('[expenses:recurring:audit-log]', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ── combined monthly/yearly totals across all active recurring expenses ────
router.get('/recurring/totals', async (req, res) => {
  try {
    const env = await getEnvironment();
    const { rows: items } = await safeQuery(`SELECT * FROM recurring_expenses WHERE is_active = true`);

    let usdToInrRate = 1;
    try {
      usdToInrRate = await getCachedRate('USD');
    } catch (fxErr) {
      console.error('[expenses:recurring:totals] Could not fetch USD rate, defaulting to 1:', fxErr.message);
    }

    let monthlyInr = 0;
    for (const rec of items) {
      const effectiveAmount = env === 'production' ? Number(rec.prod_amount) : Number(rec.testnet_amount);
      const monthlyInOwnCurrency = effectiveAmount * monthlyMultiplier(rec.frequency, rec.custom_interval_days);
      let monthlyInInr = monthlyInOwnCurrency;
      if (rec.currency !== 'INR') {
        try {
          const rate = await getCachedRate(rec.currency);
          monthlyInInr = monthlyInOwnCurrency * rate;
        } catch (fxErr) {
          console.error(`[expenses:recurring:totals] FX conversion failed for "${rec.name}", using raw amount:`, fxErr.message);
        }
      }
      monthlyInr += monthlyInInr;
    }

    const yearlyInr = monthlyInr * 12;
    const monthlyUsd = usdToInrRate ? monthlyInr / usdToInrRate : 0;
    const yearlyUsd = usdToInrRate ? yearlyInr / usdToInrRate : 0;

    res.json({
      environment: env,
      monthly: { inr: monthlyInr, usd: monthlyUsd },
      yearly: { inr: yearlyInr, usd: yearlyUsd },
    });
  } catch (err) {
    console.error('[expenses:recurring:totals]', err);
    res.status(500).json({ error: 'Failed to compute recurring expense totals' });
  }
});

// ── FX exposure report — how much of the monthly spend sits in foreign currency ─
router.get('/recurring/fx-exposure', requireRole('finance'), async (req, res) => {
  try {
    const env = await getEnvironment();
    const { rows: items } = await safeQuery(`SELECT * FROM recurring_expenses WHERE is_active = true`);

    const byCurrency = {};
    for (const rec of items) {
      const effectiveAmount = env === 'production' ? Number(rec.prod_amount) : Number(rec.testnet_amount);
      const monthly = effectiveAmount * monthlyMultiplier(rec.frequency, rec.custom_interval_days);
      byCurrency[rec.currency] = (byCurrency[rec.currency] || 0) + monthly;
    }

    const exposure = [];
    let totalInr = 0, nonInrInr = 0;
    for (const [currency, monthlyAmount] of Object.entries(byCurrency)) {
      let rate = 1;
      if (currency !== 'INR') {
        try { rate = await getCachedRate(currency); } catch (fxErr) {
          console.error(`[expenses:fx-exposure] rate fetch failed for ${currency}:`, fxErr.message);
        }
      }
      const monthlyInr = monthlyAmount * rate;
      totalInr += monthlyInr;
      if (currency !== 'INR') nonInrInr += monthlyInr;
      exposure.push({
        currency,
        monthlyAmountOwnCurrency: monthlyAmount,
        rateToInr: rate,
        monthlyInr,
        sensitivityPlus5Pct: monthlyAmount * rate * 1.05,
        sensitivityMinus5Pct: monthlyAmount * rate * 0.95,
      });
    }

    res.json({
      environment: env,
      byCurrency: exposure,
      totalMonthlyInr: totalInr,
      nonInrExposureInr: nonInrInr,
      nonInrSharePct: totalInr ? (nonInrInr / totalInr) * 100 : 0,
    });
  } catch (err) {
    console.error('[expenses:fx-exposure]', err);
    res.status(500).json({ error: 'Failed to compute FX exposure' });
  }
});

// ── budget vs actual, per category, current calendar month ─────────────────
router.get('/budget-vs-actual', requireRole('finance'), async (req, res) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const { rows } = await safeQuery(
      `SELECT ec.id AS category_id, ec.name AS category_name, cb.monthly_budget_inr,
              COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'paid' AND o.due_date >= $1), 0) AS actual_paid_this_month
       FROM expense_categories ec
       LEFT JOIN category_budgets cb ON cb.category_id = ec.id
       LEFT JOIN recurring_expenses re ON re.category_id = ec.id
       LEFT JOIN recurring_expense_occurrences o ON o.recurring_expense_id = re.id
       GROUP BY ec.id, ec.name, cb.monthly_budget_inr
       ORDER BY ec.name`,
      [monthStart]
    );
    const categories = rows.map((r) => ({
      ...r,
      variance: r.monthly_budget_inr != null ? Number(r.monthly_budget_inr) - Number(r.actual_paid_this_month) : null,
      overBudget: r.monthly_budget_inr != null ? Number(r.actual_paid_this_month) > Number(r.monthly_budget_inr) : false,
    }));
    res.json({ month: monthStart.slice(0, 7), categories });
  } catch (err) {
    console.error('[expenses:budget-vs-actual]', err);
    res.status(500).json({ error: 'Failed to compute budget vs actual' });
  }
});

router.put('/category-budgets/:categoryId', requireRole('finance'), async (req, res) => {
  try {
    const { monthly_budget_inr } = req.body;
    if (!validateAmount(monthly_budget_inr)) return res.status(400).json({ error: 'monthly_budget_inr must be a number ≥ 0' });
    const { rows: [budget] } = await safeQuery(
      `INSERT INTO category_budgets (category_id, monthly_budget_inr) VALUES ($1,$2)
       ON CONFLICT (category_id) DO UPDATE SET monthly_budget_inr = $2, updated_at = NOW() RETURNING *`,
      [req.params.categoryId, monthly_budget_inr]
    );
    res.json({ budget });
  } catch (err) {
    console.error('[expenses:category-budgets:put]', err);
    res.status(500).json({ error: 'Failed to update category budget' });
  }
});

// ── unreconciled paid occurrences — bank reconciliation queue ───────────────
router.get('/occurrences/unreconciled', requireRole('finance'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT o.*, re.name FROM recurring_expense_occurrences o
       JOIN recurring_expenses re ON re.id = o.recurring_expense_id
       WHERE o.status = 'paid' AND o.reconciled = false
       ORDER BY o.paid_date DESC`
    );
    res.json({ occurrences: rows });
  } catch (err) {
    console.error('[expenses:occurrences:unreconciled]', err);
    res.status(500).json({ error: 'Failed to fetch unreconciled occurrences' });
  }
});

// ── bank feed sync + auto-match (Axis Bank adapter under the hood) ─────────
// Until Axis API credentials are configured, sync will fail with a clear
// "not configured" error rather than silently doing nothing.
router.post('/bank-accounts/:bankAccountId/sync', requireRole('finance'), async (req, res) => {
  try {
    const result = await syncBankAccount(req.params.bankAccountId);
    res.json(result);
  } catch (err) {
    console.error('[expenses:bank-sync]', err);
    res.status(502).json({ error: err.message || 'Failed to sync bank transactions' });
  }
});

router.post('/bank-accounts/:bankAccountId/auto-match', requireRole('finance'), async (req, res) => {
  try {
    const result = await autoMatch(req.params.bankAccountId);
    res.json(result);
  } catch (err) {
    console.error('[expenses:auto-match]', err);
    res.status(500).json({ error: 'Failed to run auto-match' });
  }
});

router.get('/bank-accounts/:bankAccountId/transactions', requireRole('finance'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const { rows: [{ count }] } = await safeQuery(
      `SELECT COUNT(*) AS count FROM expense_bank_transactions WHERE bank_account_id = $1`,
      [req.params.bankAccountId]
    );
    const { rows } = await safeQuery(
      `SELECT * FROM expense_bank_transactions WHERE bank_account_id = $1 ORDER BY transaction_date DESC LIMIT $2 OFFSET $3`,
      [req.params.bankAccountId, limit, offset]
    );
    res.json({ transactions: rows, pagination: { total: Number(count), limit, offset } });
  } catch (err) {
    console.error('[expenses:bank-transactions:list]', err);
    res.status(500).json({ error: 'Failed to fetch bank transactions' });
  }
});

// Manual match: link a specific bank transaction to a specific paid occurrence
// (for anything the auto-matcher couldn't confidently pair — different amount
// due to bank fees, date far outside the window, partial payments, etc.)
router.post('/bank-transactions/:id/match', requireRole('finance'), async (req, res) => {
  try {
    const { occurrence_id } = req.body;
    if (!occurrence_id) return res.status(400).json({ error: 'occurrence_id is required' });

    const { rows: [occ] } = await safeQuery(`SELECT * FROM recurring_expense_occurrences WHERE id = $1`, [occurrence_id]);
    if (!occ) return res.status(404).json({ error: 'Occurrence not found' });
    if (occ.status !== 'paid') return res.status(400).json({ error: 'Only paid occurrences can be reconciled' });

    const { rows: [txn] } = await safeQuery(`SELECT * FROM expense_bank_transactions WHERE id = $1`, [req.params.id]);
    if (!txn) return res.status(404).json({ error: 'Bank transaction not found' });

    await safeQuery(
      `UPDATE recurring_expense_occurrences SET reconciled = true, reconciled_at = NOW(), reconciled_by = $1, bank_statement_reference = $2 WHERE id = $3`,
      [req.staff.id, txn.external_transaction_id, occurrence_id]
    );
    await safeQuery(
      `UPDATE expense_bank_transactions SET matched_occurrence_id = $1, match_confidence = 1.0, match_method = 'manual' WHERE id = $2`,
      [occurrence_id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[expenses:bank-transactions:match]', err);
    res.status(500).json({ error: 'Failed to record manual match' });
  }
});

router.post('/occurrences/:id/reconcile', requireRole('finance'), async (req, res) => {
  try {
    const { bank_statement_reference } = req.body;
    const { rows: [occ] } = await safeQuery(`SELECT * FROM recurring_expense_occurrences WHERE id = $1`, [req.params.id]);
    if (!occ) return res.status(404).json({ error: 'Occurrence not found' });
    if (occ.status !== 'paid') return res.status(400).json({ error: 'Only paid occurrences can be reconciled' });

    const { rows: [updated] } = await safeQuery(
      `UPDATE recurring_expense_occurrences
       SET reconciled = true, reconciled_at = NOW(), reconciled_by = $1, bank_statement_reference = $2
       WHERE id = $3 RETURNING *`,
      [req.staff.id, bank_statement_reference || null, req.params.id]
    );
    res.json({ occurrence: updated });
  } catch (err) {
    console.error('[expenses:occurrences:reconcile]', err);
    res.status(500).json({ error: 'Failed to reconcile occurrence' });
  }
});

router.post('/occurrences/:id/unreconcile', requireRole('finance'), async (req, res) => {
  try {
    const { rows: [updated] } = await safeQuery(
      `UPDATE recurring_expense_occurrences
       SET reconciled = false, reconciled_at = NULL, reconciled_by = NULL, bank_statement_reference = NULL
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!updated) return res.status(404).json({ error: 'Occurrence not found' });
    res.json({ occurrence: updated });
  } catch (err) {
    console.error('[expenses:occurrences:unreconcile]', err);
    res.status(500).json({ error: 'Failed to unreconcile occurrence' });
  }
});

// ── CSV / Excel export — for your CA, auditor, or your own records ─────────
// One row per occurrence (not per recurring definition), since that's what an
// accountant actually wants: every individual payment, when it was due, when
// it was paid, in what currency, converted to INR, and its category —
// exactly the shape a P&L or audit trail needs.
function escapeCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get('/export', requireRole('finance'), async (req, res) => {
  try {
    const { format = 'csv', from, to, category_id, status } = req.query;
    if (!['csv', 'xlsx'].includes(format)) {
      return res.status(400).json({ error: 'format must be "csv" or "xlsx"' });
    }

    const conditions = [];
    const params = [];
    if (from) { params.push(from); conditions.push(`o.due_date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`o.due_date <= $${params.length}`); }
    if (category_id) { params.push(category_id); conditions.push(`re.category_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`o.status = $${params.length}`); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT o.due_date, o.paid_date, re.name AS expense_name, ec.name AS category_name,
              re.frequency, o.original_currency, o.original_amount, o.amount AS amount_inr,
              o.exchange_rate, o.status, o.reconciled, o.bank_statement_reference,
              o.failure_reason, re.auto_create_bill, o.bill_id
       FROM recurring_expense_occurrences o
       JOIN recurring_expenses re ON re.id = o.recurring_expense_id
       LEFT JOIN expense_categories ec ON ec.id = re.category_id
       ${whereClause}
       ORDER BY o.due_date ASC`,
      params
    );

    const columns = [
      { header: 'Due Date', key: 'due_date', width: 14 },
      { header: 'Paid Date', key: 'paid_date', width: 14 },
      { header: 'Expense', key: 'expense_name', width: 28 },
      { header: 'Category', key: 'category_name', width: 22 },
      { header: 'Frequency', key: 'frequency', width: 12 },
      { header: 'Original Currency', key: 'original_currency', width: 10 },
      { header: 'Original Amount', key: 'original_amount', width: 16 },
      { header: 'Amount (INR)', key: 'amount_inr', width: 16 },
      { header: 'Exchange Rate', key: 'exchange_rate', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Reconciled', key: 'reconciled', width: 10 },
      { header: 'Bank Reference', key: 'bank_statement_reference', width: 20 },
      { header: 'Failure Reason', key: 'failure_reason', width: 24 },
    ];

    if (format === 'csv') {
      const headerLine = columns.map((c) => escapeCsvField(c.header)).join(',');
      const dataLines = rows.map((r) => columns.map((c) => escapeCsvField(
        c.key === 'due_date' || c.key === 'paid_date' ? (r[c.key] ? String(r[c.key]).slice(0, 10) : '') :
        c.key === 'reconciled' ? (r.reconciled ? 'Yes' : 'No') :
        r[c.key]
      )).join(','));
      const csv = [headerLine, ...dataLines].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ethertrack-expenses-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csv);
    }

    // xlsx
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EtherTrack ERP';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Recurring Expenses');
    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };

    rows.forEach((r) => {
      sheet.addRow({
        due_date: r.due_date ? String(r.due_date).slice(0, 10) : '',
        paid_date: r.paid_date ? String(r.paid_date).slice(0, 10) : '',
        expense_name: r.expense_name,
        category_name: r.category_name || '',
        frequency: r.frequency,
        original_currency: r.original_currency,
        original_amount: Number(r.original_amount),
        amount_inr: Number(r.amount_inr),
        exchange_rate: Number(r.exchange_rate),
        status: r.status,
        reconciled: r.reconciled ? 'Yes' : 'No',
        bank_statement_reference: r.bank_statement_reference || '',
        failure_reason: r.failure_reason || '',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ethertrack-expenses-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[expenses:export]', err);
    res.status(500).json({ error: 'Failed to export expenses' });
  }
});

router.post('/recurring', requireRole('finance'), async (req, res) => {
  try {
    const { name, vendor_id, category_id, expense_account_id, testnet_amount, prod_amount, currency, frequency,
      custom_interval_days, start_date, end_date, reminder_days_before, auto_create_bill, account_url, notes,
      approval_threshold_inr } = req.body;
    if (!name || testnet_amount == null || prod_amount == null || !start_date) {
      return res.status(400).json({ error: 'name, testnet_amount, prod_amount, and start_date are required' });
    }
    if (!category_id) {
      return res.status(400).json({ error: 'category_id is required' });
    }
    if (!validateFrequency(frequency)) {
      return res.status(400).json({ error: `frequency must be one of: ${ALLOWED_FREQUENCIES.join(', ')}` });
    }
    if (!validateCurrency(currency)) {
      return res.status(400).json({ error: `currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}` });
    }
    if (!validateAmount(testnet_amount) || !validateAmount(prod_amount)) {
      return res.status(400).json({ error: 'testnet_amount and prod_amount must be numbers ≥ 0' });
    }

    const expenseCurrency = (currency || 'USD').toUpperCase();
    const env = await getEnvironment();
    const resolvedFrequency = frequency || 'monthly';

    const approvalStatus = await computeApprovalStatus(
      { testnet_amount, prod_amount, frequency: resolvedFrequency, custom_interval_days, currency: expenseCurrency },
      env, approval_threshold_inr
    );

    const { rows: [rec] } = await safeQuery(
      `INSERT INTO recurring_expenses (name, vendor_id, category_id, expense_account_id, testnet_amount, prod_amount,
         currency, frequency, custom_interval_days, start_date, end_date, next_due_date, reminder_days_before,
         auto_create_bill, account_url, notes, created_by, approval_status, approval_threshold_inr)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$10,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [name, vendor_id || null, category_id, expense_account_id || null, testnet_amount, prod_amount,
       expenseCurrency, resolvedFrequency, custom_interval_days || null, start_date, end_date || null,
       reminder_days_before ?? 3, auto_create_bill || false, account_url || null, notes || null, req.staff.id,
       approvalStatus, approval_threshold_inr || null]
    );

    const effectiveAmount = env === 'production' ? prod_amount : testnet_amount;
    let occAmountInr = effectiveAmount;
    let occRate = 1;
    try {
      occRate = await getCachedRate(expenseCurrency);
      occAmountInr = effectiveAmount * occRate;
    } catch (fxErr) {
      console.error('[expenses:recurring:create] FX conversion failed, falling back to raw amount:', fxErr.message);
    }

    await safeQuery(
      `INSERT INTO recurring_expense_occurrences (recurring_expense_id, due_date, amount, original_currency, original_amount, exchange_rate, status)
       VALUES ($1,$2,$3,$4,$5,$6,'upcoming') ON CONFLICT DO NOTHING`,
      [rec.id, start_date, occAmountInr, expenseCurrency, effectiveAmount, occRate]
    );

    await logAudit(rec.id, 'create', req.staff.id, null, rec);

    if (approvalStatus === 'pending_approval') {
      await fireEvent('recurring_expense.pending_approval', { name: rec.name, link: '/expenses' });
    }

    res.status(201).json({ recurringExpense: rec });
  } catch (err) {
    console.error('[expenses:recurring:create]', err);
    res.status(500).json({ error: 'Failed to create recurring expense' });
  }
});

router.put('/recurring/:id', requireRole('finance'), async (req, res) => {
  try {
    if ('category_id' in req.body && !req.body.category_id) {
      return res.status(400).json({ error: 'category_id is required and cannot be cleared' });
    }
    if ('frequency' in req.body && !validateFrequency(req.body.frequency)) {
      return res.status(400).json({ error: `frequency must be one of: ${ALLOWED_FREQUENCIES.join(', ')}` });
    }
    if ('currency' in req.body && !validateCurrency(req.body.currency)) {
      return res.status(400).json({ error: `currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}` });
    }
    if ('testnet_amount' in req.body && !validateAmount(req.body.testnet_amount)) {
      return res.status(400).json({ error: 'testnet_amount must be a number ≥ 0' });
    }
    if ('prod_amount' in req.body && !validateAmount(req.body.prod_amount)) {
      return res.status(400).json({ error: 'prod_amount must be a number ≥ 0' });
    }

    const { rows: [before] } = await safeQuery(`SELECT * FROM recurring_expenses WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Recurring expense not found' });

    const allowed = ['name', 'vendor_id', 'category_id', 'expense_account_id', 'testnet_amount', 'prod_amount',
      'currency', 'frequency', 'custom_interval_days', 'end_date', 'reminder_days_before', 'auto_create_bill',
      'account_url', 'notes', 'approval_threshold_inr'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    const amountFieldsChanged = ['testnet_amount', 'prod_amount', 'frequency', 'custom_interval_days', 'currency'].some((f) => f in req.body);
    if (amountFieldsChanged) {
      const env = await getEnvironment();
      const merged = {
        testnet_amount: req.body.testnet_amount ?? before.testnet_amount,
        prod_amount: req.body.prod_amount ?? before.prod_amount,
        frequency: req.body.frequency ?? before.frequency,
        custom_interval_days: req.body.custom_interval_days ?? before.custom_interval_days,
        currency: req.body.currency ?? before.currency,
      };
      const newApprovalStatus = await computeApprovalStatus(merged, env, req.body.approval_threshold_inr ?? before.approval_threshold_inr);
      params.push(newApprovalStatus);
      sets.push(`approval_status = $${params.length}`);
      if (newApprovalStatus === 'pending_approval') {
        sets.push(`approved_by = NULL`);
        sets.push(`approved_at = NULL`);
      }
    }

    sets.push('updated_at = NOW()');
    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE recurring_expenses SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Recurring expense not found' });

    await logAudit(req.params.id, 'update', req.staff.id, before, rows[0]);
    if (rows[0].approval_status === 'pending_approval' && before.approval_status !== 'pending_approval') {
      await fireEvent('recurring_expense.pending_approval', { name: rows[0].name, link: '/expenses' });
    }

    res.json({ recurringExpense: rows[0] });
  } catch (err) {
    console.error('[expenses:recurring:update]', err);
    res.status(500).json({ error: 'Failed to update recurring expense' });
  }
});

router.post('/recurring/:id/toggle', requireRole('finance'), async (req, res) => {
  try {
    const { rows: [before] } = await safeQuery(`SELECT * FROM recurring_expenses WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Recurring expense not found' });
    const { rows: [updated] } = await safeQuery(`UPDATE recurring_expenses SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    await logAudit(req.params.id, 'toggle', req.staff.id, before, updated);
    res.json({ recurringExpense: updated });
  } catch (err) {
    console.error('[expenses:recurring:toggle]', err);
    res.status(500).json({ error: 'Failed to toggle recurring expense' });
  }
});

router.post('/recurring/:id/approve', requireRole(), async (req, res) => {
  try {
    const { rows: [before] } = await safeQuery(`SELECT * FROM recurring_expenses WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Recurring expense not found' });
    const { rows: [updated] } = await safeQuery(
      `UPDATE recurring_expenses SET approval_status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [req.staff.id, req.params.id]
    );
    await logAudit(req.params.id, 'approve', req.staff.id, before, updated);
    res.json({ recurringExpense: updated });
  } catch (err) {
    console.error('[expenses:recurring:approve]', err);
    res.status(500).json({ error: 'Failed to approve recurring expense' });
  }
});

router.post('/recurring/:id/reject', requireRole(), async (req, res) => {
  try {
    const { rows: [before] } = await safeQuery(`SELECT * FROM recurring_expenses WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Recurring expense not found' });
    const { rows: [updated] } = await safeQuery(
      `UPDATE recurring_expenses SET approval_status = 'rejected', is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await logAudit(req.params.id, 'reject', req.staff.id, before, updated);
    res.json({ recurringExpense: updated });
  } catch (err) {
    console.error('[expenses:recurring:reject]', err);
    res.status(500).json({ error: 'Failed to reject recurring expense' });
  }
});

router.delete('/recurring/:id', requireRole('finance'), async (req, res) => {
  try {
    const { rows: [before] } = await safeQuery(`SELECT * FROM recurring_expenses WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Recurring expense not found' });

    const { rows: [paidCheck] } = await safeQuery(
      `SELECT COUNT(*) AS cnt FROM recurring_expense_occurrences WHERE recurring_expense_id = $1 AND status = 'paid'`,
      [req.params.id]
    );
    if (Number(paidCheck.cnt) > 0) {
      return res.status(400).json({
        error: 'This recurring expense has paid occurrences linked to bills/ledger entries. Deactivate it instead of deleting, to keep your accounting trail intact.',
      });
    }
    await safeQuery(`DELETE FROM recurring_expense_occurrences WHERE recurring_expense_id = $1`, [req.params.id]);
    const { rows } = await safeQuery(`DELETE FROM recurring_expenses WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Recurring expense not found' });

    await logAudit(req.params.id, 'delete', req.staff.id, before, null);
    res.json({ success: true });
  } catch (err) {
    console.error('[expenses:recurring:delete]', err);
    res.status(500).json({ error: 'Failed to delete recurring expense' });
  }
});

router.post('/run-daily-check', requireRole('finance'), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const env = await getEnvironment();
    let occurrencesCreated = 0, remindersFired = 0, overdueFlagged = 0;

    const { rows: dueForGeneration } = await safeQuery(
      `SELECT * FROM recurring_expenses WHERE is_active = true AND next_due_date <= $1 AND (end_date IS NULL OR next_due_date <= end_date)`,
      [today]
    );
    for (const rec of dueForGeneration) {
      const effectiveAmount = env === 'production' ? rec.prod_amount : rec.testnet_amount;
      let occAmountInr = effectiveAmount;
      let occRate = 1;
      try {
        occRate = await getCachedRate(rec.currency);
        occAmountInr = effectiveAmount * occRate;
      } catch (fxErr) {
        console.error(`[expenses:run-daily-check] FX conversion failed for "${rec.name}", falling back to raw amount:`, fxErr.message);
      }

      await safeQuery(
        `INSERT INTO recurring_expense_occurrences (recurring_expense_id, due_date, amount, original_currency, original_amount, exchange_rate, status)
         VALUES ($1,$2,$3,$4,$5,$6,'due') ON CONFLICT (recurring_expense_id, due_date) DO NOTHING`,
        [rec.id, rec.next_due_date, occAmountInr, rec.currency, effectiveAmount, occRate]
      );
      occurrencesCreated++;
      const nextDate = advanceDate(rec.next_due_date, rec.frequency, rec.custom_interval_days);
      await safeQuery(`UPDATE recurring_expenses SET next_due_date = $1 WHERE id = $2`, [nextDate, rec.id]);
    }

    const { rows: dueSoon } = await safeQuery(
      `SELECT o.*, re.name, re.reminder_days_before FROM recurring_expense_occurrences o
       JOIN recurring_expenses re ON re.id = o.recurring_expense_id
       WHERE o.status IN ('upcoming','due') AND o.reminder_sent_at IS NULL
         AND o.due_date <= (CURRENT_DATE + (re.reminder_days_before || ' days')::interval)`
    );
    for (const occ of dueSoon) {
      await fireEvent('recurring_expense.due_soon', { name: occ.name, amount: occ.amount, due_date: occ.due_date, link: '/expenses' });
      await safeQuery(`UPDATE recurring_expense_occurrences SET reminder_sent_at = NOW() WHERE id = $1`, [occ.id]);
      remindersFired++;
    }

    const { rows: overdue } = await safeQuery(
      `SELECT o.*, re.name FROM recurring_expense_occurrences o
       JOIN recurring_expenses re ON re.id = o.recurring_expense_id
       WHERE o.status IN ('upcoming','due') AND o.due_date < $1`,
      [today]
    );
    for (const occ of overdue) {
      await safeQuery(`UPDATE recurring_expense_occurrences SET status = 'overdue' WHERE id = $1`, [occ.id]);
      await fireEvent('recurring_expense.overdue', { name: occ.name, amount: occ.amount, due_date: occ.due_date, link: '/expenses' });
      overdueFlagged++;
    }

    res.json({ occurrencesCreated, remindersFired, overdueFlagged, environment: env });
  } catch (err) {
    console.error('[expenses:run-daily-check]', err);
    res.status(500).json({ error: 'Failed to run daily check' });
  }
});

router.post('/occurrences/:id/mark-paid', requireRole('finance'), async (req, res) => {
  try {
    const { bank_account_id } = req.body;

    // Idempotency guard: atomically claim this occurrence by flipping it to a
    // transient 'processing' marker only if it's still in a payable state.
    // If two requests race (double-click, network retry), only one wins this
    // UPDATE and the other gets a clean "already being processed" response
    // instead of creating two bills for the same payment.
    const { rows: [claimed] } = await safeQuery(
      `UPDATE recurring_expense_occurrences
       SET status = 'processing_payment'
       WHERE id = $1 AND status IN ('upcoming', 'due', 'overdue', 'failed')
       RETURNING *`,
      [req.params.id]
    );
    if (!claimed) {
      const { rows: [existing] } = await safeQuery(`SELECT status FROM recurring_expense_occurrences WHERE id = $1`, [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Occurrence not found' });
      if (existing.status === 'processing_payment') return res.status(409).json({ error: 'This payment is already being processed — please wait.' });
      if (existing.status === 'paid') return res.status(409).json({ error: 'This occurrence is already marked paid.' });
      return res.status(400).json({ error: `Cannot mark paid from status "${existing.status}".` });
    }

    const { rows: [occ] } = await safeQuery(
      `SELECT o.*, re.name, re.auto_create_bill, re.expense_account_id, re.category_id, re.vendor_id, re.approval_status
       FROM recurring_expense_occurrences o JOIN recurring_expenses re ON re.id = o.recurring_expense_id
       WHERE o.id = $1`,
      [req.params.id]
    );

    let billId = null;
    try {
      if (occ.auto_create_bill) {
        if (occ.approval_status !== 'approved') {
          throw Object.assign(new Error(`This recurring expense is "${occ.approval_status}" and needs owner/admin approval before it can auto-create a bill. Approve it first.`), { httpStatus: 403 });
        }
        if (!bank_account_id) throw Object.assign(new Error('bank_account_id is required when this recurring expense auto-creates bills'), { httpStatus: 400 });

        let expenseAccountId = occ.expense_account_id;
        if (!expenseAccountId && occ.category_id) {
          const { rows: [cat] } = await safeQuery(`SELECT expense_account_id FROM expense_categories WHERE id = $1`, [occ.category_id]);
          expenseAccountId = cat?.expense_account_id;
        }
        if (!expenseAccountId) throw Object.assign(new Error('No expense account configured for this recurring expense — set one on the category or the recurring expense itself'), { httpStatus: 400 });

        const { rows: [bank] } = await safeQuery(`SELECT ledger_account_id FROM bank_accounts WHERE id = $1`, [bank_account_id]);
        if (!bank) throw Object.assign(new Error('Bank account not found'), { httpStatus: 404 });

        const { rows: [{ next_num }] } = await safeQuery(
          `SELECT 'BILL-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
                  LPAD((COALESCE(MAX(SUBSTRING(bill_number FROM '\\d+$')::int), 0) + 1)::text, 6, '0') AS next_num
           FROM bills WHERE bill_number LIKE 'BILL-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'`
        );

        const bill = await withTransaction(async (client) => {
          const { rows: [b] } = await client.query(
            `INSERT INTO bills (bill_number, vendor_id, bill_date, due_date, status, category_id, subtotal, total_amount, amount_paid, notes, created_by)
             VALUES ($1,$2,$3,$3,'paid',$4,$5,$5,$5,$6,$7) RETURNING *`,
            [next_num, occ.vendor_id, occ.due_date, occ.category_id, occ.amount, `Auto-generated from recurring expense: ${occ.name}`, req.staff.id]
          );
          return b;
        });
        billId = bill.id;

        await ledger.postJournalEntry({
          entryDate: occ.due_date, source: 'bill', sourceType: 'recurring_expense', sourceId: occ.id,
          narration: `${occ.name} (recurring)`, createdBy: req.staff.id,
          lines: [
            { accountId: expenseAccountId, debit: occ.amount, description: occ.name },
            { accountId: bank.ledger_account_id, credit: occ.amount, description: `Payment for ${occ.name}` },
          ],
        });
        await safeQuery(`UPDATE bills SET journal_entry_id = (SELECT id FROM journal_entries WHERE source_id = $1 ORDER BY created_at DESC LIMIT 1) WHERE id = $2`, [occ.id, billId]);
      }

      const { rows: [updated] } = await safeQuery(
        `UPDATE recurring_expense_occurrences SET status = 'paid', paid_date = CURRENT_DATE, bill_id = $1, failure_reason = NULL, failed_at = NULL WHERE id = $2 RETURNING *`,
        [billId, req.params.id]
      );
      res.json({ occurrence: updated });
    } catch (innerErr) {
      // Release the lock back to a sane state so this can be retried, instead of getting stuck in "processing_payment" forever.
      await safeQuery(`UPDATE recurring_expense_occurrences SET status = $1 WHERE id = $2`, [occ.status === 'failed' ? 'failed' : 'due', req.params.id]);
      throw innerErr;
    }
  } catch (err) {
    console.error('[expenses:occurrences:mark-paid]', err);
    res.status(err.httpStatus || 500).json({ error: err.message || 'Failed to mark occurrence paid' });
  }
});

router.post('/occurrences/:id/mark-failed', requireRole('finance'), async (req, res) => {
  try {
    const { reason } = req.body;
    const { rows: [occ] } = await safeQuery(
      `SELECT o.*, re.name FROM recurring_expense_occurrences o JOIN recurring_expenses re ON re.id = o.recurring_expense_id WHERE o.id = $1`,
      [req.params.id]
    );
    if (!occ) return res.status(404).json({ error: 'Occurrence not found' });

    const { rows: [updated] } = await safeQuery(
      `UPDATE recurring_expense_occurrences SET status = 'failed', failure_reason = $1, failed_at = NOW() WHERE id = $2 RETURNING *`,
      [reason || null, req.params.id]
    );
    await fireEvent('recurring_expense.payment_failed', { name: occ.name, amount: occ.amount, due_date: occ.due_date, reason, link: '/expenses' });
    res.json({ occurrence: updated });
  } catch (err) {
    console.error('[expenses:occurrences:mark-failed]', err);
    res.status(500).json({ error: 'Failed to mark occurrence as failed' });
  }
});

router.post('/occurrences/:id/skip', requireRole('finance'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`UPDATE recurring_expense_occurrences SET status = 'skipped' WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Occurrence not found' });
    res.json({ occurrence: rows[0] });
  } catch (err) {
    console.error('[expenses:occurrences:skip]', err);
    res.status(500).json({ error: 'Failed to skip occurrence' });
  }
});

router.get('/calendar', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to query params are required (YYYY-MM-DD)' });
    const { rows } = await safeQuery(
      `SELECT o.*, re.name, re.frequency FROM recurring_expense_occurrences o
       JOIN recurring_expenses re ON re.id = o.recurring_expense_id
       WHERE o.due_date BETWEEN $1 AND $2 ORDER BY o.due_date ASC`,
      [from, to]
    );
    res.json({ occurrences: rows });
  } catch (err) {
    console.error('[expenses:calendar]', err);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT o.*, re.name, re.frequency FROM recurring_expense_occurrences o
       JOIN recurring_expenses re ON re.id = o.recurring_expense_id
       WHERE o.due_date BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE + INTERVAL '90 days'
       ORDER BY o.due_date ASC`
    );
    res.json({ occurrences: rows });
  } catch (err) {
    console.error('[expenses:timeline]', err);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

router.get('/fy-summary', requireRole('finance'), async (req, res) => {
  try {
    const now = new Date();
    const fyStartYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    const from = req.query.from || `${fyStartYear}-04-01`;
    const to = req.query.to || `${fyStartYear + 1}-03-31`;

    const pnl = await ledger.getProfitAndLoss(from, to);

    const { rows: recurringTotal } = await safeQuery(
      `SELECT re.name, COUNT(o.id) AS occurrence_count, COALESCE(SUM(o.amount),0) AS total_paid
       FROM recurring_expense_occurrences o JOIN recurring_expenses re ON re.id = o.recurring_expense_id
       WHERE o.status = 'paid' AND o.due_date BETWEEN $1 AND $2
       GROUP BY re.name ORDER BY total_paid DESC`,
      [from, to]
    );

    res.json({
      period: { from, to, label: `FY${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}` },
      totalExpense: pnl.totalExpense,
      expenseByAccount: pnl.expenses,
      recurringExpenseBreakdown: recurringTotal,
    });
  } catch (err) {
    console.error('[expenses:fy-summary]', err);
    res.status(500).json({ error: 'Failed to compute FY summary' });
  }
});

module.exports = router;