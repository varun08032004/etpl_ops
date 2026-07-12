'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const ledger = require('../services/ledger');

router.use(authenticate);
router.use(requireRole('finance')); // company-wide KPIs — same access floor as Dashboard/Accounting

// ── revenue vs expense trend, last N months ─────────────────────────────────
router.get('/revenue-expense-trend', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months || '12', 10), 24);
    const results = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const from = d.toISOString().slice(0, 10);
      const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const pnl = await ledger.getProfitAndLoss(from, to);
      results.push({ month: from.slice(0, 7), revenue: pnl.totalIncome, expense: pnl.totalExpense, profit: pnl.netProfit });
    }
    res.json({ trend: results });
  } catch (err) {
    console.error('[analytics:revenue-expense-trend]', err);
    res.status(500).json({ error: 'Failed to compute trend' });
  }
});

// ── expense breakdown by category, for a date range ─────────────────────────
router.get('/expense-breakdown', async (req, res) => {
  try {
    const { from, to } = req.query;
    const monthStart = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = to || new Date().toISOString().slice(0, 10);

    const { rows } = await safeQuery(
      `SELECT coa.name AS category, COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS amount
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       WHERE coa.account_type = 'expense' AND je.entry_date BETWEEN $1 AND $2
       GROUP BY coa.name HAVING COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) > 0
       ORDER BY amount DESC`,
      [monthStart, monthEnd]
    );
    res.json({ breakdown: rows, period: { from: monthStart, to: monthEnd } });
  } catch (err) {
    console.error('[analytics:expense-breakdown]', err);
    res.status(500).json({ error: 'Failed to compute expense breakdown' });
  }
});

// ── headcount trend — approximated from joining/exit dates, last N months ──
router.get('/headcount-trend', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months || '12', 10), 24);
    const results = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { rows: [{ count }] } = await safeQuery(
        `SELECT COUNT(*) FROM employees
         WHERE date_of_joining <= $1 AND (date_of_exit IS NULL OR date_of_exit > $1)`,
        [monthEnd]
      );
      results.push({ month: monthEnd.slice(0, 7), headcount: Number(count) });
    }
    res.json({ trend: results });
  } catch (err) {
    console.error('[analytics:headcount-trend]', err);
    res.status(500).json({ error: 'Failed to compute headcount trend' });
  }
});

// ── sales conversion rate + average cycle time ──────────────────────────────
router.get('/sales-conversion', async (req, res) => {
  try {
    const { rows: [counts] } = await safeQuery(
      `SELECT COUNT(*) FILTER (WHERE stage = 'won') AS won,
              COUNT(*) FILTER (WHERE stage = 'lost') AS lost,
              COUNT(*) FILTER (WHERE stage NOT IN ('won','lost')) AS open
       FROM deals`
    );
    const { rows: [cycle] } = await safeQuery(
      `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) AS avg_days
       FROM deals WHERE stage = 'won'`
    );
    const won = Number(counts.won);
    const lost = Number(counts.lost);
    const closedTotal = won + lost;
    const conversionRate = closedTotal > 0 ? Math.round((won / closedTotal) * 1000) / 10 : null;

    res.json({
      won, lost, open: Number(counts.open),
      conversionRatePercent: conversionRate,
      avgDealCycleDays: cycle.avg_days ? Math.round(Number(cycle.avg_days)) : null,
    });
  } catch (err) {
    console.error('[analytics:sales-conversion]', err);
    res.status(500).json({ error: 'Failed to compute sales conversion' });
  }
});

// ── accounts receivable aging ────────────────────────────────────────────────
router.get('/ar-aging', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT i.invoice_number, p.name AS customer, i.total_amount - i.amount_paid AS outstanding,
              CURRENT_DATE - i.due_date AS days_overdue
       FROM invoices i JOIN parties p ON p.id = i.party_id
       WHERE i.status IN ('sent','partially_paid','overdue') AND i.total_amount > i.amount_paid
       ORDER BY days_overdue DESC`
    );
    const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 };
    for (const r of rows) {
      const days = Number(r.days_overdue);
      const amt = Number(r.outstanding);
      if (days <= 0) buckets.current += amt;
      else if (days <= 30) buckets.days_1_30 += amt;
      else if (days <= 60) buckets.days_31_60 += amt;
      else if (days <= 90) buckets.days_61_90 += amt;
      else buckets.days_90_plus += amt;
    }
    res.json({ invoices: rows, buckets });
  } catch (err) {
    console.error('[analytics:ar-aging]', err);
    res.status(500).json({ error: 'Failed to compute AR aging' });
  }
});

module.exports = router;