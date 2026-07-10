'use strict';

const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const ledger = require('../services/ledger');

router.use(authenticate);

// Instantiated lazily (only when a disbursal is actually attempted) so the server
// doesn't crash on startup just because RazorpayX keys aren't configured yet.
let _razorpay = null;
function getRazorpay() {
  if (!process.env.RAZORPAYX_KEY_ID || !process.env.RAZORPAYX_KEY_SECRET) {
    throw new Error('RazorpayX keys not configured — set RAZORPAYX_KEY_ID and RAZORPAYX_KEY_SECRET in .env');
  }
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAYX_KEY_ID,
      key_secret: process.env.RAZORPAYX_KEY_SECRET,
    });
  }
  return _razorpay;
}
const RAZORPAYX_ACCOUNT_NUMBER = process.env.RAZORPAYX_ACCOUNT_NUMBER; // your RazorpayX current account

// Simple India tax/deduction assumptions — replace with real slabs once you
// have >5-10 employees and this actually needs to be precise. At small scale
// most founders run payroll through a CA for TDS/PF compliance anyway; this
// automates the arithmetic + disbursal + bookkeeping, not tax law.
function computePayrollLine(employee, { lopDays = 0, workingDaysInMonth = 30 }) {
  const basic = Number(employee.basic_monthly || 0);
  const hra = Number(employee.hra_monthly || 0);
  const other = Number(employee.other_allowances_monthly || 0);
  const grossFull = basic + hra + other;

  const payableFraction = Math.max(0, (workingDaysInMonth - lopDays) / workingDaysInMonth);
  const grossPay = Math.round(grossFull * payableFraction * 100) / 100;

  // Employee PF: 12% of basic (statutory, capped at wage ceiling in real law — simplified here)
  const pfDeduction = Math.round(Math.min(basic, 15000) * 0.12 * payableFraction * 100) / 100;
  // Professional tax: flat slab example for Maharashtra — adjust per state
  const professionalTax = grossPay > 7500 ? 200 : 0;

  const netPay = Math.round((grossPay - pfDeduction - professionalTax) * 100) / 100;

  return {
    basic: Math.round(basic * payableFraction * 100) / 100,
    hra: Math.round(hra * payableFraction * 100) / 100,
    other_allowances: Math.round(other * payableFraction * 100) / 100,
    gross_pay: grossPay,
    pf_deduction: pfDeduction,
    professional_tax: professionalTax,
    loss_of_pay_days: lopDays,
    net_pay: netPay,
  };
}

// ── create a draft payroll run for a month, computed from attendance ───────
router.post('/runs', requireRole('finance'), async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ error: 'month and year are required' });

    const { rows: employees } = await safeQuery(
      `SELECT * FROM employees WHERE status IN ('active','on_leave','notice_period') AND employment_type != 'contract'`
    );
    if (!employees.length) return res.status(400).json({ error: 'No active employees to run payroll for' });

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

    const run = await withTransaction(async (client) => {
      const { rows: [payrollRun] } = await client.query(
        `INSERT INTO payroll_runs (period_month, period_year, status, created_by) VALUES ($1,$2,'draft',$3) RETURNING *`,
        [month, year, req.staff.id]
      );

      let totalGross = 0, totalDeductions = 0, totalNet = 0;

      for (const emp of employees) {
        // Loss-of-pay days = unpaid-leave days + unexplained absences this month, from attendance sync
        const { rows: [absStats] } = await client.query(
          `SELECT COUNT(*) FILTER (WHERE status = 'absent') AS absent_days
           FROM attendance_records WHERE employee_id = $1 AND work_date BETWEEN $2 AND $3`,
          [emp.id, monthStart, monthEnd]
        );
        const lopDays = Number(absStats?.absent_days || 0);

        const line = computePayrollLine(emp, { lopDays, workingDaysInMonth: daysInMonth });
        totalGross += line.gross_pay;
        totalDeductions += line.pf_deduction + line.professional_tax;
        totalNet += line.net_pay;

        await client.query(
          `INSERT INTO payroll_items (payroll_run_id, employee_id, basic, hra, other_allowances, gross_pay,
             pf_deduction, professional_tax, loss_of_pay_days, net_pay, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')`,
          [payrollRun.id, emp.id, line.basic, line.hra, line.other_allowances, line.gross_pay,
           line.pf_deduction, line.professional_tax, line.loss_of_pay_days, line.net_pay]
        );
      }

      await client.query(
        `UPDATE payroll_runs SET total_gross=$1, total_deductions=$2, total_net=$3 WHERE id=$4`,
        [totalGross, totalDeductions, totalNet, payrollRun.id]
      );
      return { ...payrollRun, total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet };
    });

    res.status(201).json({ payrollRun: run });
  } catch (err) {
    console.error('[payroll:create-run]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Payroll run already exists for this month' });
    res.status(500).json({ error: 'Failed to create payroll run' });
  }
});

router.get('/runs', async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM payroll_runs ORDER BY period_year DESC, period_month DESC`);
    res.json({ payrollRuns: rows });
  } catch (err) {
    console.error('[payroll:list-runs]', err);
    res.status(500).json({ error: 'Failed to fetch payroll runs' });
  }
});

router.get('/runs/:id', async (req, res) => {
  try {
    const { rows: [run] } = await safeQuery(`SELECT * FROM payroll_runs WHERE id = $1`, [req.params.id]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    const { rows: items } = await safeQuery(
      `SELECT pi.*, e.full_name, e.employee_code FROM payroll_items pi JOIN employees e ON e.id = pi.employee_id WHERE pi.payroll_run_id = $1`,
      [req.params.id]
    );
    res.json({ run, items });
  } catch (err) {
    console.error('[payroll:get-run]', err);
    res.status(500).json({ error: 'Failed to fetch payroll run' });
  }
});

// ── disburse via RazorpayX Payouts + post the accounting entry ─────────────
// Requires each employee to already have razorpay_contact_id + razorpay_fund_account_id
// set up (one-time, via RazorpayX Contacts API when the employee's bank details are entered).
router.post('/runs/:id/disburse', requireRole('finance'), async (req, res) => {
  try {
    if (!RAZORPAYX_ACCOUNT_NUMBER) {
      return res.status(500).json({ error: 'RAZORPAYX_ACCOUNT_NUMBER not configured' });
    }
    const { rows: [run] } = await safeQuery(`SELECT * FROM payroll_runs WHERE id = $1`, [req.params.id]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status !== 'draft') return res.status(400).json({ error: `Run is already ${run.status}` });

    const { rows: items } = await safeQuery(
      `SELECT pi.*, e.razorpay_fund_account_id, e.full_name FROM payroll_items pi
       JOIN employees e ON e.id = pi.employee_id WHERE pi.payroll_run_id = $1`,
      [req.params.id]
    );

    await safeQuery(`UPDATE payroll_runs SET status = 'processing' WHERE id = $1`, [run.id]);

    const results = [];
    for (const item of items) {
      if (!item.razorpay_fund_account_id) {
        await safeQuery(`UPDATE payroll_items SET status='failed', failure_reason=$1 WHERE id=$2`,
          ['No Razorpay fund account on file for employee', item.id]);
        results.push({ employee: item.full_name, status: 'failed', reason: 'missing fund account' });
        continue;
      }
      try {
        const payout = await getRazorpay().payouts.create({
          account_number: RAZORPAYX_ACCOUNT_NUMBER,
          fund_account_id: item.razorpay_fund_account_id,
          amount: Math.round(Number(item.net_pay) * 100), // paise
          currency: 'INR',
          mode: 'IMPS',
          purpose: 'salary',
          queue_if_low_balance: true,
          reference_id: `payroll-${run.id}-${item.employee_id}`,
          narration: `Salary ${run.period_month}/${run.period_year}`,
        });
        await safeQuery(
          `UPDATE payroll_items SET status='processing', razorpay_payout_id=$1 WHERE id=$2`,
          [payout.id, item.id]
        );
        results.push({ employee: item.full_name, status: 'processing', payoutId: payout.id });
      } catch (payoutErr) {
        console.error('[payroll:payout-failed]', item.employee_id, payoutErr.message);
        await safeQuery(`UPDATE payroll_items SET status='failed', failure_reason=$1 WHERE id=$2`,
          [payoutErr.message, item.id]);
        results.push({ employee: item.full_name, status: 'failed', reason: payoutErr.message });
      }
    }

    // Post the payroll expense to the ledger regardless of individual payout status —
    // the liability was incurred; reconcile failed payouts separately via /webhooks/razorpay-payout.
    const { rows: [salaryExpAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '5100'`);
    const { rows: [pfExpAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '5110'`);
    const { rows: [salariesPayable] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2500'`);
    const { rows: [pfPayable] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2400'`);
    const { rows: [ptPayable] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2410'`);

    const totalPT = items.reduce((s, i) => s + Number(i.professional_tax), 0);
    const totalPF = items.reduce((s, i) => s + Number(i.pf_deduction), 0);

    const je = await ledger.postJournalEntry({
      entryDate: new Date().toISOString().slice(0, 10),
      source: 'payroll', sourceType: 'payroll_run', sourceId: run.id,
      narration: `Payroll ${run.period_month}/${run.period_year}`, createdBy: req.staff.id,
      lines: [
        { accountId: salaryExpAcct.id, debit: run.total_gross, description: 'Gross salary expense' },
        { accountId: salariesPayable.id, credit: run.total_net, description: 'Net pay to employees' },
        ...(totalPF > 0 ? [{ accountId: pfPayable.id, credit: totalPF, description: 'PF withheld' }] : []),
        ...(totalPT > 0 ? [{ accountId: ptPayable.id, credit: totalPT, description: 'Professional tax withheld' }] : []),
      ],
    });

    await safeQuery(`UPDATE payroll_runs SET status='paid', processed_at=NOW(), journal_entry_id=$1 WHERE id=$2`, [je.id, run.id]);

    res.json({ run: { ...run, status: 'paid' }, results, journalEntry: je });
  } catch (err) {
    console.error('[payroll:disburse]', err);
    res.status(500).json({ error: 'Failed to disburse payroll' });
  }
});

// ── RazorpayX webhook — updates payout status (processed/reversed/failed) ──
// Register this URL in RazorpayX dashboard > Webhooks, event: payout.processed / payout.failed / payout.reversed
router.post('/webhooks/razorpay-payout', express.raw({ type: 'application/json' }), async (req, res) => {
  // TODO: verify X-Razorpay-Signature header against RAZORPAYX_WEBHOOK_SECRET before trusting payload,
  // same HMAC pattern as your existing /api/subscription/webhook/razorpay handler.
  try {
    const payload = JSON.parse(req.body.toString());
    const payout = payload?.payload?.payout?.entity;
    if (!payout) return res.status(200).json({ received: true });

    const newStatus = payout.status === 'processed' ? 'paid' : payout.status === 'failed' || payout.status === 'reversed' ? 'failed' : 'processing';
    await safeQuery(
      `UPDATE payroll_items SET status = $1, paid_at = CASE WHEN $1='paid' THEN NOW() ELSE paid_at END WHERE razorpay_payout_id = $2`,
      [newStatus, payout.id]
    );
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[payroll:webhook]', err);
    res.status(200).json({ received: true }); // ack anyway per Razorpay's retry policy
  }
});

module.exports = router;
