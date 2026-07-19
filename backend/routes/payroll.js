'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const ledger = require('../services/ledger');
const axisPayoutAdapter = require('../services/bankFeeds/axisPayoutAdapter');

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

const compliance = require('./../services/payrollCompliance');

// ── validation helpers ───────────────────────────────────────────────────────
function isValidMonth(month) {
  const n = Number(month);
  return Number.isInteger(n) && n >= 1 && n <= 12;
}
function isValidYear(year) {
  const n = Number(year);
  return Number.isInteger(n) && n >= 2000 && n <= 2100;
}
function isNonNegativeNumber(value) {
  const n = Number(value);
  return value == null || (Number.isFinite(n) && n >= 0);
}
const VALID_PAYOUT_MODES = ['NEFT', 'RTGS', 'IMPS'];

// Required chart-of-accounts codes for posting a payroll disbursal journal entry.
// Checked BEFORE any bank transfer is initiated, so a missing account never
// results in money already sent with no way to record it in the ledger.
const REQUIRED_PAYROLL_ACCOUNT_CODES = {
  salaryExpAcct: '5100',
  salariesPayable: '2500',
  pfExpAcct: '5110',
  esicExpAcct: '5120',
  pfPayable: '2400',
  esicPayable: '2420',
  ptPayable: '2410',
  tdsPayable: '2300',
};

async function resolveRequiredAccounts() {
  const resolved = {};
  const missing = [];
  for (const [key, code] of Object.entries(REQUIRED_PAYROLL_ACCOUNT_CODES)) {
    const { rows: [acct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = $1`, [code]);
    resolved[key] = acct || null;
    if (!acct) missing.push(code);
  }
  return { resolved, missing };
}

// ── create a draft payroll run for a month, computed from attendance + full statutory compliance ──
router.post('/runs', requireRole('finance'), async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!isValidMonth(month)) return res.status(400).json({ error: 'month must be an integer between 1 and 12' });
    if (!isValidYear(year)) return res.status(400).json({ error: 'year must be a valid 4-digit year' });

    const { rows: employees } = await safeQuery(
      `SELECT * FROM employees WHERE status IN ('active','on_leave','notice_period') AND employment_type != 'contract'`
    );
    if (!employees.length) return res.status(400).json({ error: 'No active employees to run payroll for' });

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;
    const fiscalYear = compliance.currentFiscalYearLabel(month, year);

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

        const wageCap = compliance.apply50PercentWageCapRule({
          basic: Number(emp.basic_monthly || 0) * payableFraction,
          da: Number(emp.da_monthly || 0) * payableFraction,
          otherAllowances: Number(emp.other_allowances_monthly || 0) * payableFraction,
        });
        const grossPay = Math.round((wageCap.adjustedBasic + wageCap.adjustedDA + wageCap.adjustedOtherAllowances) * 100) / 100;
        const basicPlusDA = wageCap.adjustedBasic + wageCap.adjustedDA;

        const epf = await compliance.calculateEPF({ basicPlusDA, pfApplicable: emp.pf_applicable !== false });
        const esicApplicable = await compliance.isESICApplicable({ grossMonthly: grossPay, employeeOverride: emp.esic_applicable });
        const esic = compliance.calculateESIC({ grossMonthly: grossPay, applicable: esicApplicable });
        const pt = await compliance.calculatePT({ grossMonthly: grossPay, state: emp.state || process.env.COMPANY_STATE, month });

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

    for (const [field, value] of Object.entries({ pending_salary_amount, leave_encashment_amount, other_dues, recoveries })) {
      if (!isNonNegativeNumber(value)) {
        return res.status(400).json({ error: `${field} must be a non-negative number` });
      }
    }

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
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const { rows: [{ count }] } = await safeQuery(`SELECT COUNT(*) AS count FROM payroll_runs`);
    const { rows } = await safeQuery(
      `SELECT * FROM payroll_runs ORDER BY period_year DESC, period_month DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ payrollRuns: rows, pagination: { total: Number(count), limit, offset } });
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

// ── disburse via direct Axis Bank payouts + post the accounting entry ──────
// Requires each employee to have bank_account_number + bank_ifsc_code on file.
router.post('/runs/:id/disburse', requireRole('finance'), async (req, res) => {
  try {
    const payoutMode = (req.body?.mode || 'IMPS').toUpperCase();
    if (!VALID_PAYOUT_MODES.includes(payoutMode)) {
      return res.status(400).json({ error: `mode must be one of: ${VALID_PAYOUT_MODES.join(', ')}` });
    }

    // ── Idempotency guard FIRST, before touching the bank API at all ──
    // Atomically claim this run by flipping draft → processing only if it's
    // still in 'draft'. A double-click or retry that loses this race gets a
    // clean 409 instead of firing a second batch of real bank transfers.
    const { rows: [claimed] } = await safeQuery(
      `UPDATE payroll_runs SET status = 'processing' WHERE id = $1 AND status = 'draft' RETURNING *`,
      [req.params.id]
    );
    if (!claimed) {
      const { rows: [existing] } = await safeQuery(`SELECT status FROM payroll_runs WHERE id = $1`, [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Payroll run not found' });
      if (existing.status === 'processing') return res.status(409).json({ error: 'This run is already being disbursed — please wait.' });
      return res.status(400).json({ error: `Run is already ${existing.status}` });
    }
    const run = claimed;

    // ── Resolve ALL required ledger accounts BEFORE any payout is sent ──
    const { resolved: accts, missing } = await resolveRequiredAccounts();
    if (missing.length) {
      await safeQuery(`UPDATE payroll_runs SET status = 'draft' WHERE id = $1`, [run.id]); // release the claim, nothing was sent yet
      return res.status(500).json({
        error: `Missing chart-of-accounts entries for code(s): ${missing.join(', ')}. Set these up before disbursing — no payouts have been sent.`,
      });
    }

    let items;
    try {
      const { rows } = await safeQuery(
        `SELECT pi.*, e.bank_account_number, e.bank_ifsc_code, e.bank_account_holder_name, e.full_name
         FROM payroll_items pi JOIN employees e ON e.id = pi.employee_id WHERE pi.payroll_run_id = $1`,
        [req.params.id]
      );
      items = rows;

      const results = [];
      for (const item of items) {
        if (!item.bank_account_number || !item.bank_ifsc_code) {
          await safeQuery(`UPDATE payroll_items SET status='failed', failure_reason=$1 WHERE id=$2`,
            ['No bank account/IFSC on file for employee', item.id]);
          results.push({ employee: item.full_name, status: 'failed', reason: 'missing bank details' });
          continue;
        }
        try {
          const payout = await axisPayoutAdapter.initiatePayout({
            beneficiaryAccountNumber: item.bank_account_number,
            beneficiaryIFSC: item.bank_ifsc_code,
            beneficiaryName: item.bank_account_holder_name || item.full_name,
            amount: Number(item.net_pay),
            mode: payoutMode,
            referenceId: `payroll-${run.id}-${item.employee_id}`,
            narration: `Salary ${run.period_month}/${run.period_year}`,
          });
          await safeQuery(
            `UPDATE payroll_items SET status=$1, axis_payout_id=$2, payout_mode=$3 WHERE id=$4`,
            [payout.status === 'failed' ? 'failed' : 'processing', payout.providerPayoutId, payoutMode, item.id]
          );
          results.push({ employee: item.full_name, status: payout.status, payoutId: payout.providerPayoutId });
        } catch (payoutErr) {
          console.error('[payroll:payout-failed]', item.employee_id, payoutErr.message);
          await safeQuery(`UPDATE payroll_items SET status='failed', failure_reason=$1 WHERE id=$2`,
            [payoutErr.message, item.id]);
          results.push({ employee: item.full_name, status: 'failed', reason: payoutErr.message });
        }
      }

      // Post the payroll expense to the ledger regardless of individual payout status —
      // the liability was incurred; reconcile failed payouts by re-running disbursal
      // for just the failed items (see /runs/:id/retry-failed below) once fixed.
      const totalPT = items.reduce((s, i) => s + Number(i.professional_tax), 0);
      const totalPF = items.reduce((s, i) => s + Number(i.pf_deduction), 0);
      const totalEPFEmployer = items.reduce((s, i) => s + Number(i.epf_employer_contribution || 0), 0);
      const totalESICEmployee = items.reduce((s, i) => s + Number(i.esic_employee_deduction || 0), 0);
      const totalESICEmployer = items.reduce((s, i) => s + Number(i.esic_employer_contribution || 0), 0);
      const totalTDS = items.reduce((s, i) => s + Number(i.tds_deduction || 0), 0);

      const je = await ledger.postJournalEntry({
        entryDate: new Date().toISOString().slice(0, 10),
        source: 'payroll', sourceType: 'payroll_run', sourceId: run.id,
        narration: `Payroll ${run.period_month}/${run.period_year}`, createdBy: req.staff.id,
        lines: [
          { accountId: accts.salaryExpAcct.id, debit: run.total_gross, description: 'Gross salary expense' },
          ...(totalEPFEmployer > 0 ? [{ accountId: accts.pfExpAcct.id, debit: totalEPFEmployer, description: 'Employer EPF contribution' }] : []),
          ...(totalESICEmployer > 0 ? [{ accountId: accts.esicExpAcct.id, debit: totalESICEmployer, description: 'Employer ESIC contribution' }] : []),
          { accountId: accts.salariesPayable.id, credit: run.total_net, description: 'Net pay to employees' },
          ...(totalPF > 0 ? [{ accountId: accts.pfPayable.id, credit: totalPF + totalEPFEmployer, description: 'EPF payable (employee + employer)' }] : []),
          ...(totalESICEmployee > 0 || totalESICEmployer > 0 ? [{ accountId: accts.esicPayable.id, credit: totalESICEmployee + totalESICEmployer, description: 'ESIC payable (employee + employer)' }] : []),
          ...(totalPT > 0 ? [{ accountId: accts.ptPayable.id, credit: totalPT, description: 'Professional tax withheld' }] : []),
          ...(totalTDS > 0 ? [{ accountId: accts.tdsPayable.id, credit: totalTDS, description: 'TDS withheld under Section 192' }] : []),
        ],
      });

      await safeQuery(`UPDATE payroll_runs SET status='paid', processed_at=NOW(), journal_entry_id=$1 WHERE id=$2`, [je.id, run.id]);

      res.json({ run: { ...run, status: 'paid' }, results, journalEntry: je });
    } catch (innerErr) {
      // Payouts may have already been sent by the time something here fails (e.g. ledger
      // posting). Do NOT silently revert to 'draft' — that would let someone re-run
      // disbursement and pay everyone twice. Move to a distinct failure state instead.
      await safeQuery(`UPDATE payroll_runs SET status = 'disbursal_error' WHERE id = $1`, [run.id]);
      throw innerErr;
    }
  } catch (err) {
    console.error('[payroll:disburse]', err);
    res.status(500).json({
      error: err.message || 'Failed to disburse payroll',
      note: 'If payouts were already initiated before this error, check payroll_items statuses and the Axis dashboard directly — do not re-run disburse on this run.',
    });
  }
});

// ── poll payout status for a run's still-processing items ──────────────────
// Use until/instead of a webhook — call this periodically (or a button in the
// UI) to pull the latest status for each processing payout from Axis directly.
router.post('/runs/:id/sync-payout-status', requireRole('finance'), async (req, res) => {
  try {
    const { rows: items } = await safeQuery(
      `SELECT * FROM payroll_items WHERE payroll_run_id = $1 AND status = 'processing' AND axis_payout_id IS NOT NULL`,
      [req.params.id]
    );
    let updated = 0;
    for (const item of items) {
      try {
        const result = await axisPayoutAdapter.getPayoutStatus(item.axis_payout_id);
        if (result.status !== 'processing') {
          await safeQuery(
            `UPDATE payroll_items SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END WHERE id = $2`,
            [result.status, item.id]
          );
          updated++;
        }
      } catch (statusErr) {
        console.error(`[payroll:sync-payout-status] Failed to check status for item ${item.id}:`, statusErr.message);
      }
    }
    res.json({ checked: items.length, updated });
  } catch (err) {
    console.error('[payroll:sync-payout-status]', err);
    res.status(500).json({ error: 'Failed to sync payout status' });
  }
});

// ── Axis payout status webhook (if/once Axis offers one for this API) ──────
// TODO: Axis's actual signature scheme for this webhook is unknown until you
// have their payout API docs — the HMAC pattern below is a placeholder in the
// same shape as most bank webhook signing schemes, but VERIFY against Axis's
// real documentation before trusting this in production. Do not remove the
// signature check — an unverified webhook here could let anyone mark payroll
// items as paid/failed by guessing this URL.
router.post('/webhooks/axis-payout', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-axis-signature']; // TODO: confirm actual header name from Axis docs
    const secret = process.env.AXIS_PAYOUT_WEBHOOK_SECRET;

    if (!secret) {
      console.error('[payroll:axis-webhook] AXIS_PAYOUT_WEBHOOK_SECRET not set — rejecting webhook, cannot verify authenticity.');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (!signature) {
      return res.status(400).json({ error: 'Missing signature header' });
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const isValid = signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      console.error('[payroll:axis-webhook] Signature verification failed — rejecting payload.');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // TODO: parse Axis's actual webhook payload shape once known — this is a guess.
    const payload = JSON.parse(req.body.toString());
    const providerPayoutId = payload.transaction_id;
    const rawStatus = payload.status;
    if (!providerPayoutId) return res.status(200).json({ received: true });

    const newStatus = rawStatus === 'SUCCESS' ? 'paid' : rawStatus === 'FAILED' ? 'failed' : 'processing';
    await safeQuery(
      `UPDATE payroll_items SET status = $1, paid_at = CASE WHEN $1='paid' THEN NOW() ELSE paid_at END WHERE axis_payout_id = $2`,
      [newStatus, providerPayoutId]
    );
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[payroll:axis-webhook]', err);
    res.status(200).json({ received: true });
  }
});

module.exports = router;