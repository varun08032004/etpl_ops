'use strict';

const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const ledger = require('../services/ledger');

router.use(authenticate);

// ── self-service: own payslip history — any logged-in employee can see their own ──
router.get('/me/payslips', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'This login is not linked to an employee record' });
    const { rows } = await safeQuery(
      `SELECT pi.*, pr.period_month, pr.period_year, pr.status AS run_status
       FROM payroll_items pi JOIN payroll_runs pr ON pr.id = pi.payroll_run_id
       WHERE pi.employee_id = $1 ORDER BY pr.period_year DESC, pr.period_month DESC`,
      [req.staff.employee_id]
    );
    res.json({ payslips: rows });
  } catch (err) {
    console.error('[payroll:me:payslips]', err);
    res.status(500).json({ error: 'Failed to fetch your payslips' });
  }
});

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

const compliance = require('./../services/payrollCompliance');

// ── create a draft payroll run for a month, computed from attendance + full statutory compliance ──
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
    const fiscalYear = compliance.currentFiscalYearLabel(month, year);
    const fyStartMonth = month >= 4 ? 4 : 4; // FY starts April; used to bound YTD lookups below

    const run = await withTransaction(async (client) => {
      const { rows: [payrollRun] } = await client.query(
        `INSERT INTO payroll_runs (period_month, period_year, status, created_by) VALUES ($1,$2,'draft',$3) RETURNING *`,
        [month, year, req.staff.id]
      );

      let totalGross = 0, totalDeductions = 0, totalNet = 0;

      for (const emp of employees) {
        const { rows: [absStats] } = await client.query(
          `SELECT COUNT(*) FILTER (WHERE status = 'absent') AS absent_days
           FROM attendance_records WHERE employee_id = $1 AND work_date BETWEEN $2 AND $3`,
          [emp.id, monthStart, monthEnd]
        );
        const lopDays = Number(absStats?.absent_days || 0);
        const payableFraction = Math.max(0, (daysInMonth - lopDays) / daysInMonth);

        // 1. Apply the 50% wage cap rule to this month's pay components
        const wageCap = compliance.apply50PercentWageCapRule({
          basic: Number(emp.basic_monthly || 0) * payableFraction,
          da: Number(emp.da_monthly || 0) * payableFraction,
          otherAllowances: Number(emp.other_allowances_monthly || 0) * payableFraction,
        });
        const grossPay = Math.round((wageCap.adjustedBasic + wageCap.adjustedDA + wageCap.adjustedOtherAllowances) * 100) / 100;
        const basicPlusDA = wageCap.adjustedBasic + wageCap.adjustedDA;

        // 2. EPF
        const epf = await compliance.calculateEPF({ basicPlusDA, pfApplicable: emp.pf_applicable !== false });

        // 3. ESIC
        const esicApplicable = await compliance.isESICApplicable({ grossMonthly: grossPay, employeeOverride: emp.esic_applicable });
        const esic = compliance.calculateESIC({ grossMonthly: grossPay, applicable: esicApplicable });

        // 4. Professional Tax
        const pt = await compliance.calculatePT({ grossMonthly: grossPay, state: emp.state || process.env.COMPANY_STATE, month });

        // 5. TDS — needs YTD figures from earlier payroll_items this FY for this employee
        const { rows: ytdRows } = await client.query(
          `SELECT COALESCE(SUM(pi.gross_pay),0) AS ytd_gross, COALESCE(SUM(pi.tds_deduction),0) AS ytd_tds
           FROM payroll_items pi JOIN payroll_runs pr ON pr.id = pi.payroll_run_id
           WHERE pi.employee_id = $1 AND pr.period_year = $2
             AND ((pr.period_year = $2 AND pr.period_month >= 4) OR (pr.period_year = $2 + 1 AND pr.period_month < 4))
             AND NOT (pr.period_month = $3 AND pr.period_year = $2)`,
          [emp.id, month >= 4 ? year : year - 1, month]
        );
        const tdsResult = await compliance.projectMonthlyTDS({
          employee: emp,
          currentMonthGross: grossPay,
          ytdGrossThisFY: Number(ytdRows[0]?.ytd_gross || 0),
          ytdTDSThisFY: Number(ytdRows[0]?.ytd_tds || 0),
          calendarMonth: month,
          calendarYear: year,
        });

        const totalDeductionsForEmployee = epf.employeeContribution + esic.employeeDeduction + pt.amount + tdsResult.monthlyTDS;
        const netPay = Math.round((grossPay - totalDeductionsForEmployee) * 100) / 100;

        totalGross += grossPay;
        totalDeductions += totalDeductionsForEmployee;
        totalNet += netPay;

        await client.query(
          `INSERT INTO payroll_items (payroll_run_id, employee_id, basic, hra, other_allowances, da_amount, gross_pay,
             pf_deduction, epf_employer_contribution, esic_employee_deduction, esic_employer_contribution,
             professional_tax, tds_deduction, loss_of_pay_days, net_pay, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending')`,
          [payrollRun.id, emp.id, wageCap.adjustedBasic, 0, wageCap.adjustedOtherAllowances, wageCap.adjustedDA, grossPay,
           epf.employeeContribution, epf.employerContribution, esic.employeeDeduction, esic.employerContribution,
           pt.amount, tdsResult.monthlyTDS, lopDays, netPay]
        );
      }

      await client.query(
        `UPDATE payroll_runs SET total_gross=$1, total_deductions=$2, total_net=$3, disbursal_due_date=$4 WHERE id=$5`,
        [totalGross, totalDeductions, totalNet, `${year}-${String(month % 12 + 1).padStart(2, '0')}-07`, payrollRun.id]
      );
      return { ...payrollRun, total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet };
    });

    res.status(201).json({ payrollRun: run });
  } catch (err) {
    console.error('[payroll:create-run]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Payroll run already exists for this month' });
    res.status(500).json({ error: err.message || 'Failed to create payroll run' });
  }
});

// ── Full & Final settlement for an exiting employee ─────────────────────────
router.post('/final-settlement', requireRole('finance'), async (req, res) => {
  try {
    const { employee_id, exit_date, pending_salary_days, pending_salary_amount, leave_days_encashed,
            leave_encashment_amount, other_dues, other_dues_note, recoveries, recoveries_note } = req.body;
    if (!employee_id || !exit_date) return res.status(400).json({ error: 'employee_id and exit_date are required' });

    const deadline = await compliance.computeFinalSettlementDeadline(exit_date);
    const netAmount = Math.round(
      ((pending_salary_amount || 0) + (leave_encashment_amount || 0) + (other_dues || 0) - (recoveries || 0)) * 100
    ) / 100;

    const { rows: [settlement] } = await safeQuery(
      `INSERT INTO final_settlements (employee_id, exit_date, pending_salary_days, pending_salary_amount,
         leave_days_encashed, leave_encashment_amount, other_dues, other_dues_note, recoveries, recoveries_note,
         net_settlement_amount, deadline_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [employee_id, exit_date, pending_salary_days || 0, pending_salary_amount || 0,
       leave_days_encashed || 0, leave_encashment_amount || 0, other_dues || 0, other_dues_note || null,
       recoveries || 0, recoveries_note || null, netAmount, deadline.toISOString().slice(0, 10)]
    );

    res.status(201).json({ settlement, deadlineNote: `Must be settled by ${deadline.toISOString().slice(0, 10)} per F&F policy (2 working days from exit)` });
  } catch (err) {
    console.error('[payroll:final-settlement]', err);
    res.status(500).json({ error: 'Failed to create final settlement' });
  }
});

router.get('/final-settlements', requireRole('finance'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT fs.*, e.full_name, e.employee_code FROM final_settlements fs
       JOIN employees e ON e.id = fs.employee_id ORDER BY fs.deadline_date ASC`
    );
    res.json({ settlements: rows });
  } catch (err) {
    console.error('[payroll:final-settlements:list]', err);
    res.status(500).json({ error: 'Failed to fetch final settlements' });
  }
});

router.post('/final-settlements/:id/mark-settled', requireRole('finance'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE final_settlements SET settled_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Settlement not found' });
    res.json({ settlement: rows[0] });
  } catch (err) {
    console.error('[payroll:final-settlements:settle]', err);
    res.status(500).json({ error: 'Failed to mark settled' });
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
    const { rows: [esicExpAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '5120'`);
    const { rows: [salariesPayable] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2500'`);
    const { rows: [pfPayable] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2400'`);
    const { rows: [esicPayable] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2420'`);
    const { rows: [ptPayable] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2410'`);
    const { rows: [tdsPayable] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2300'`);

    const totalPT = items.reduce((s, i) => s + Number(i.professional_tax), 0);
    const totalPF = items.reduce((s, i) => s + Number(i.pf_deduction), 0);
    const totalEPFEmployer = items.reduce((s, i) => s + Number(i.epf_employer_contribution || 0), 0);
    const totalESICEmployee = items.reduce((s, i) => s + Number(i.esic_employee_deduction || 0), 0);
    const totalESICEmployer = items.reduce((s, i) => s + Number(i.esic_employer_contribution || 0), 0);
    const totalTDS = items.reduce((s, i) => s + Number(i.tds_deduction || 0), 0);

    // Employer-side EPF/ESIC contributions are an ADDITIONAL cost to the company —
    // they don't come out of the employee's gross, so they're separate expense lines,
    // not part of run.total_gross.
    const je = await ledger.postJournalEntry({
      entryDate: new Date().toISOString().slice(0, 10),
      source: 'payroll', sourceType: 'payroll_run', sourceId: run.id,
      narration: `Payroll ${run.period_month}/${run.period_year}`, createdBy: req.staff.id,
      lines: [
        { accountId: salaryExpAcct.id, debit: run.total_gross, description: 'Gross salary expense' },
        ...(totalEPFEmployer > 0 ? [{ accountId: pfExpAcct.id, debit: totalEPFEmployer, description: 'Employer EPF contribution' }] : []),
        ...(totalESICEmployer > 0 ? [{ accountId: esicExpAcct.id, debit: totalESICEmployer, description: 'Employer ESIC contribution' }] : []),
        { accountId: salariesPayable.id, credit: run.total_net, description: 'Net pay to employees' },
        ...(totalPF > 0 ? [{ accountId: pfPayable.id, credit: totalPF + totalEPFEmployer, description: 'EPF payable (employee + employer)' }] : []),
        ...(totalESICEmployee > 0 || totalESICEmployer > 0 ? [{ accountId: esicPayable.id, credit: totalESICEmployee + totalESICEmployer, description: 'ESIC payable (employee + employer)' }] : []),
        ...(totalPT > 0 ? [{ accountId: ptPayable.id, credit: totalPT, description: 'Professional tax withheld' }] : []),
        ...(totalTDS > 0 ? [{ accountId: tdsPayable.id, credit: totalTDS, description: 'TDS withheld under Section 192' }] : []),
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