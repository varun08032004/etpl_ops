'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const ledger = require('../services/ledger');

router.use(authenticate);

// ── chart of accounts ───────────────────────────────────────────────────────
router.get('/accounts', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT id, code, name, account_type, parent_id, is_group, is_active FROM chart_of_accounts ORDER BY code`
    );
    res.json({ accounts: rows });
  } catch (err) {
    console.error('[accounting:accounts]', err);
    res.status(500).json({ error: 'Failed to fetch chart of accounts' });
  }
});

router.post('/accounts', requireRole('finance'), async (req, res) => {
  try {
    const { code, name, account_type, parent_id, is_group, description } = req.body;
    if (!code || !name || !account_type) {
      return res.status(400).json({ error: 'code, name, account_type are required' });
    }
    const { rows: [account] } = await safeQuery(
      `INSERT INTO chart_of_accounts (code, name, account_type, parent_id, is_group, description)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [code, name, account_type, parent_id || null, !!is_group, description || null]
    );
    res.status(201).json({ account });
  } catch (err) {
    console.error('[accounting:accounts:create]', err);
    res.status(500).json({ error: 'Failed to create account (code may already exist)' });
  }
});

// ── manual journal entry ────────────────────────────────────────────────────
router.post('/journal-entries', requireRole('finance'), async (req, res) => {
  try {
    const { entry_date, narration, lines } = req.body;
    if (!entry_date || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'entry_date and at least 2 lines are required' });
    }
    const result = await ledger.postJournalEntry({
      entryDate: entry_date,
      source: 'manual',
      narration,
      createdBy: req.staff.id,
      lines: lines.map((l) => ({
        accountId: l.account_id, debit: l.debit, credit: l.credit,
        partyId: l.party_id, description: l.description,
      })),
    });
    res.status(201).json({ journalEntry: result });
  } catch (err) {
    console.error('[accounting:journal:create]', err);
    res.status(400).json({ error: err.message || 'Failed to post journal entry' });
  }
});

router.get('/journal-entries', async (req, res) => {
  try {
    const { from, to, account_id } = req.query;
    const conditions = [];
    const params = [];
    if (from) { params.push(from); conditions.push(`je.entry_date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`je.entry_date <= $${params.length}`); }
    if (account_id) { params.push(account_id); conditions.push(`jl.account_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT je.id, je.entry_number, je.entry_date, je.source, je.narration,
              json_agg(json_build_object('account_id', jl.account_id, 'coa_code', coa.code,
                        'coa_name', coa.name, 'debit', jl.debit, 'credit', jl.credit)) AS lines
       FROM journal_entries je
       JOIN journal_lines jl ON jl.journal_entry_id = je.id
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       ${where}
       GROUP BY je.id ORDER BY je.entry_date DESC, je.entry_number DESC LIMIT 200`,
      params
    );
    res.json({ journalEntries: rows });
  } catch (err) {
    console.error('[accounting:journal:list]', err);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

// ── reports ──────────────────────────────────────────────────────────────────
router.get('/reports/trial-balance', requireRole('finance'), async (req, res) => {
  try {
    const report = await ledger.getTrialBalance(req.query.as_of || null);
    res.json(report);
  } catch (err) {
    console.error('[accounting:trial-balance]', err);
    res.status(500).json({ error: 'Failed to generate trial balance' });
  }
});

router.get('/reports/profit-and-loss', requireRole('finance'), async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to query params are required (YYYY-MM-DD)' });
    const report = await ledger.getProfitAndLoss(from, to);
    res.json(report);
  } catch (err) {
    console.error('[accounting:pnl]', err);
    res.status(500).json({ error: 'Failed to generate P&L' });
  }
});

router.get('/reports/balance-sheet', requireRole('finance'), async (req, res) => {
  try {
    const asOf = req.query.as_of || new Date().toISOString().slice(0, 10);
    const report = await ledger.getBalanceSheet(asOf);
    res.json(report);
  } catch (err) {
    console.error('[accounting:balance-sheet]', err);
    res.status(500).json({ error: 'Failed to generate balance sheet' });
  }
});

// Simple cash-flow / runway view — useful at <100 employee startup scale
router.get('/reports/cashflow-runway', requireRole('finance'), async (req, res) => {
  try {
    const months = parseInt(req.query.months || '6', 10);
    const results = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const from = d.toISOString().slice(0, 10);
      const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const pnl = await ledger.getProfitAndLoss(from, to);
      results.push({ month: from.slice(0, 7), income: pnl.totalIncome, expense: pnl.totalExpense, net: pnl.netProfit });
    }
    const avgBurn = results.slice(-3).reduce((s, r) => s + (r.net < 0 ? -r.net : 0), 0) / 3;
    const bank = await safeQuery(`SELECT COALESCE(SUM(opening_balance),0) AS bal FROM bank_accounts WHERE is_active = true`);
    // NOTE: this is opening_balance only as a placeholder — swap for a live getAccountBalance()
    // sum across all bank ledger_account_ids once bank_transactions are flowing in.
    res.json({
      months: results,
      avgMonthlyBurnLast3Mo: Math.round(avgBurn * 100) / 100,
      note: 'Runway calc needs live bank ledger balances wired in — see TODO in accounting.js',
    });
  } catch (err) {
    console.error('[accounting:runway]', err);
    res.status(500).json({ error: 'Failed to compute runway' });
  }
});

module.exports = router;
