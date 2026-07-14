'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { fireEvent } = require('../services/automationEngine');
const ledger = require('../services/ledger');
const { convertToINR } = require('../services/fxConversion');

router.use(authenticate);

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

// ── recurring expense definitions ───────────────────────────────────────────
router.get('/recurring', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT re.*, p.name AS vendor_name, ec.name AS category_name
       FROM recurring_expenses re
       LEFT JOIN parties p ON p.id = re.vendor_id
       LEFT JOIN expense_categories ec ON ec.id = re.category_id
       ORDER BY re.next_due_date ASC`
    );
    res.json({ recurringExpenses: rows });
  } catch (err) {
    console.error('[expenses:recurring:list]', err);
    res.status(500).json({ error: 'Failed to fetch recurring expenses' });
  }
});

router.post('/recurring', requireRole('finance'), async (req, res) => {
  try {
    const { name, vendor_id, category_id, expense_account_id, amount, currency, frequency, custom_interval_days,
      start_date, end_date, reminder_days_before, auto_create_bill, notes } = req.body;
    if (!name || !amount || !start_date) return res.status(400).json({ error: 'name, amount, and start_date are required' });

    const expenseCurrency = (currency || 'INR').toUpperCase();

    const { rows: [rec] } = await safeQuery(
      `INSERT INTO recurring_expenses (name, vendor_id, category_id, expense_account_id, amount, currency, frequency,
         custom_interval_days, start_date, end_date, next_due_date, reminder_days_before, auto_create_bill, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$9,$11,$12,$13,$14) RETURNING *`,
      [name, vendor_id || null, category_id || null, expense_account_id || null, amount, expenseCurrency,
       frequency || 'monthly', custom_interval_days || null, start_date, end_date || null,
       reminder_days_before ?? 3, auto_create_bill || false, notes || null, req.staff.id]
    );

    // Create the first occurrence right away so it shows up on the calendar immediately.
    // Converted to INR now, even for a same-day expense — conversion happens at generation
    // time everywhere in this module, for consistency, not just on the recurring ones.
    let occAmountInr = amount;
    let occRate = 1;
    try {
      const converted = await convertToINR(amount, expenseCurrency);
      occAmountInr = converted.amountInr;
      occRate = converted.rate;
    } catch (fxErr) {
      console.error('[expenses:recurring:create] FX conversion failed, falling back to raw amount:', fxErr.message);
    }

    await safeQuery(
      `INSERT INTO recurring_expense_occurrences (recurring_expense_id, due_date, amount, original_currency, original_amount, exchange_rate, status)
       VALUES ($1,$2,$3,$4,$5,$6,'upcoming') ON CONFLICT DO NOTHING`,
      [rec.id, start_date, occAmountInr, expenseCurrency, amount, occRate]
    );

    res.status(201).json({ recurringExpense: rec });
  } catch (err) {
    console.error('[expenses:recurring:create]', err);
    res.status(500).json({ error: 'Failed to create recurring expense' });
  }
});

router.put('/recurring/:id', requireRole('finance'), async (req, res) => {
  try {
    const allowed = ['name', 'vendor_id', 'category_id', 'expense_account_id', 'amount', 'currency', 'frequency',
      'custom_interval_days', 'end_date', 'reminder_days_before', 'auto_create_bill', 'notes'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    sets.push('updated_at = NOW()');
    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE recurring_expenses SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Recurring expense not found' });
    res.json({ recurringExpense: rows[0] });
  } catch (err) {
    console.error('[expenses:recurring:update]', err);
    res.status(500).json({ error: 'Failed to update recurring expense' });
  }
});

router.post('/recurring/:id/toggle', requireRole('finance'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`UPDATE recurring_expenses SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Recurring expense not found' });
    res.json({ recurringExpense: rows[0] });
  } catch (err) {
    console.error('[expenses:recurring:toggle]', err);
    res.status(500).json({ error: 'Failed to toggle recurring expense' });
  }
});

// ── occurrence generation + reminder/overdue sweep ──────────────────────────
// Time-based, so needs something to run it — same honest pattern as the
// invoice overdue check: a manual button for now, or wire this endpoint into
// a scheduled job (node-cron / external cron) to run daily.
router.post('/run-daily-check', requireRole('finance'), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let occurrencesCreated = 0, remindersFired = 0, overdueFlagged = 0;

    // 1. Generate the next occurrence for any recurring expense whose next_due_date has arrived
    const { rows: dueForGeneration } = await safeQuery(
      `SELECT * FROM recurring_expenses WHERE is_active = true AND next_due_date <= $1 AND (end_date IS NULL OR next_due_date <= end_date)`,
      [today]
    );
    for (const rec of dueForGeneration) {
      let occAmountInr = rec.amount;
      let occRate = 1;
      try {
        const converted = await convertToINR(rec.amount, rec.currency);
        occAmountInr = converted.amountInr;
        occRate = converted.rate;
      } catch (fxErr) {
        console.error(`[expenses:run-daily-check] FX conversion failed for "${rec.name}", falling back to raw amount:`, fxErr.message);
      }

      await safeQuery(
        `INSERT INTO recurring_expense_occurrences (recurring_expense_id, due_date, amount, original_currency, original_amount, exchange_rate, status)
         VALUES ($1,$2,$3,$4,$5,$6,'due') ON CONFLICT (recurring_expense_id, due_date) DO NOTHING`,
        [rec.id, rec.next_due_date, occAmountInr, rec.currency, rec.amount, occRate]
      );
      occurrencesCreated++;
      const nextDate = advanceDate(rec.next_due_date, rec.frequency, rec.custom_interval_days);
      await safeQuery(`UPDATE recurring_expenses SET next_due_date = $1 WHERE id = $2`, [nextDate, rec.id]);
    }

    // 2. Fire "due soon" reminders
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

    // 3. Flag overdue (due date passed, still not paid)
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

    res.json({ occurrencesCreated, remindersFired, overdueFlagged });
  } catch (err) {
    console.error('[expenses:run-daily-check]', err);
    res.status(500).json({ error: 'Failed to run daily check' });
  }
});

// ── mark an occurrence paid (optionally auto-creates a bill + ledger entry) ──
router.post('/occurrences/:id/mark-paid', requireRole('finance'), async (req, res) => {
  try {
    const { bank_account_id } = req.body;
    const { rows: [occ] } = await safeQuery(
      `SELECT o.*, re.name, re.auto_create_bill, re.expense_account_id, re.category_id, re.vendor_id
       FROM recurring_expense_occurrences o JOIN recurring_expenses re ON re.id = o.recurring_expense_id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (!occ) return res.status(404).json({ error: 'Occurrence not found' });

    let billId = null;
    if (occ.auto_create_bill) {
      if (!bank_account_id) return res.status(400).json({ error: 'bank_account_id is required when this recurring expense auto-creates bills' });

      let expenseAccountId = occ.expense_account_id;
      if (!expenseAccountId && occ.category_id) {
        const { rows: [cat] } = await safeQuery(`SELECT expense_account_id FROM expense_categories WHERE id = $1`, [occ.category_id]);
        expenseAccountId = cat?.expense_account_id;
      }
      if (!expenseAccountId) return res.status(400).json({ error: 'No expense account configured for this recurring expense — set one on the category or the recurring expense itself' });

      const { rows: [bank] } = await safeQuery(`SELECT ledger_account_id FROM bank_accounts WHERE id = $1`, [bank_account_id]);
      if (!bank) return res.status(404).json({ error: 'Bank account not found' });

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
      `UPDATE recurring_expense_occurrences SET status = 'paid', paid_date = CURRENT_DATE, bill_id = $1 WHERE id = $2 RETURNING *`,
      [billId, req.params.id]
    );
    res.json({ occurrence: updated });
  } catch (err) {
    console.error('[expenses:occurrences:mark-paid]', err);
    res.status(500).json({ error: err.message || 'Failed to mark occurrence paid' });
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

// ── calendar view — occurrences within a date range ─────────────────────────
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

// ── timeline — chronological, recent history + upcoming ─────────────────────
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

// ── fiscal-year expenditure summary (recurring + all other expenses) ───────
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