'use strict';

const ledger = require('../ledger');
const { safeQuery, withTransaction } = require('../../db/pool');

const financeTools = [
  {
    name: 'get_payroll_run',
    description: 'Get payroll run details with totals',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      payroll_run_id: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows: [run] } = await safeQuery(`SELECT * FROM payroll_runs WHERE id = $1`, [params.payroll_run_id]);
      if (!run) throw new Error('Payroll run not found');
      const { rows: items } = await safeQuery(
        `SELECT pi.*, e.full_name, e.employee_code FROM payroll_items pi JOIN employees e ON e.id = pi.employee_id WHERE pi.payroll_run_id = $1`,
        [params.payroll_run_id]
      );
      return { run, items };
    },
  },

  {
    name: 'get_payslip',
    description: 'Get payslip for an employee in a payroll run',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      payroll_run_id: { type: 'string', required: true },
      employee_id: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows: [run] } = await safeQuery(`SELECT * FROM payroll_runs WHERE id = $1`, [params.payroll_run_id]);
      if (!run) throw new Error('Payroll run not found');
      const { rows: [item] } = await safeQuery(
        `SELECT pi.*, e.full_name, e.employee_code, d.title AS designation, e.pan_number
         FROM payroll_items pi JOIN employees e ON e.id = pi.employee_id
         LEFT JOIN designations d ON d.id = e.designation_id
         WHERE pi.payroll_run_id = $1 AND pi.employee_id = $2`,
        [params.payroll_run_id, params.employee_id]
      );
      if (!item) throw new Error('Payslip not found for this run');
      return { run, payslip: item };
    },
  },

  {
    name: 'list_invoices',
    description: 'List invoices with optional filters',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      status: { type: 'string', required: false },
      party_id: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const conditions = [];
      const queryParams = [];
      if (params.status) { queryParams.push(params.status); conditions.push(`i.status = $${queryParams.length}`); }
      if (params.party_id) { queryParams.push(params.party_id); conditions.push(`i.party_id = $${queryParams.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await safeQuery(
        `SELECT i.*, p.name AS party_name FROM invoices i JOIN parties p ON p.id = i.party_id ${where} ORDER BY i.invoice_date DESC`,
        queryParams
      );
      return { invoices: rows };
    },
  },

  {
    name: 'get_invoice',
    description: 'Get invoice detail with items',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      invoice_id: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows: [invoice] } = await safeQuery(
        `SELECT i.*, p.name AS party_name, p.gstin, p.billing_address FROM invoices i JOIN parties p ON p.id = i.party_id WHERE i.id = $1`,
        [params.invoice_id]
      );
      if (!invoice) throw new Error('Invoice not found');
      const { rows: items } = await safeQuery(`SELECT * FROM invoice_items WHERE invoice_id = $1`, [params.invoice_id]);
      return { invoice, items };
    },
  },

  {
    name: 'list_bills',
    description: 'List vendor bills with optional filters',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      status: { type: 'string', required: false },
      vendor_id: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const conditions = [];
      const queryParams = [];
      if (params.status) { queryParams.push(params.status); conditions.push(`b.status = $${queryParams.length}`); }
      if (params.vendor_id) { queryParams.push(params.vendor_id); conditions.push(`b.vendor_id = $${queryParams.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await safeQuery(
        `SELECT b.*, p.name AS vendor_name, ec.name AS category_name
         FROM bills b
         LEFT JOIN parties p ON p.id = b.vendor_id
         LEFT JOIN expense_categories ec ON ec.id = b.category_id
         ${where}
         ORDER BY b.bill_date DESC`,
        queryParams
      );
      return { bills: rows };
    },
  },

  {
    name: 'list_expense_claims',
    description: 'List expense claims (scoped to user/approver)',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['*'],
    allowedDepartments: [],
    parameters: {
      status: { type: 'string', required: false },
      limit: { type: 'integer', required: false },
      offset: { type: 'integer', required: false },
    },
    execute: async (params, user) => {
      const isPrivileged = ['owner', 'admin', 'finance'].includes(user.role);
      let query, queryParams;

      if (isPrivileged) {
        const conditions = [];
        if (params.status) { queryParams.push(params.status); conditions.push(`ec.status = $${queryParams.length}`); }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        queryParams = queryParams || [];
        queryParams.push(params.limit || 50);
        queryParams.push(params.offset || 0);
        query = `SELECT ec.*, e.full_name AS employee_name FROM expense_claims ec JOIN employees e ON e.id = ec.employee_id ${where} ORDER BY ec.created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
      } else {
        if (!user.staff.employee_id) throw new Error('Not linked to employee record');
        queryParams = [user.staff.employee_id, params.limit || 50, params.offset || 0];
        query = `SELECT * FROM expense_claims WHERE employee_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
      }
      const { rows } = await safeQuery(query, queryParams);
      return { claims: rows };
    },
  },

  {
    name: 'get_cash_flow',
    description: 'Get cash flow summary with burn rate and runway',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {},
    execute: async (params, user) => {
      const { rows: [{ total }] } = await safeQuery(`SELECT COALESCE(SUM(current_balance),0) AS total FROM bank_accounts`);
      const totalCashInr = Number(total);

      const now = new Date();
      const trailingMonths = 3;
      const fromDate = new Date(now.getFullYear(), now.getMonth() - trailingMonths, 1).toISOString().slice(0, 10);
      const toDate = now.toISOString().slice(0, 10);

      const pnl = await ledger.getProfitAndLoss(fromDate, toDate);
      const monthlyBurnInr = Number(pnl.totalExpense) / trailingMonths;
      const runwayMonths = monthlyBurnInr > 0 ? totalCashInr / monthlyBurnInr : null;

      return {
        asOf: toDate,
        totalCashInr,
        trailingMonthlyBurnInr: monthlyBurnInr,
        runwayMonths,
      };
    },
  },

  {
    name: 'get_cash_flow_forecast',
    description: 'Get forward-looking cash flow forecast',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      months: { type: 'integer', required: false },
    },
    execute: async (params, user) => {
      const monthsAhead = Math.min(Math.max(parseInt(params.months || '6', 10), 1), 12);
      const { rows: [{ total }] } = await safeQuery(`SELECT COALESCE(SUM(current_balance),0) AS total FROM bank_accounts`);
      const startingCashInr = Number(total);

      const { rows: recurringItems } = await safeQuery(`SELECT * FROM recurring_expenses WHERE is_active = true`);
      let monthlyRecurringInr = 0;
      for (const rec of recurringItems) {
        const effectiveAmount = rec.prod_amount;
        const monthlyOwn = effectiveAmount * (rec.frequency === 'weekly' ? 52/12 : rec.frequency === 'monthly' ? 1 : rec.frequency === 'quarterly' ? 1/3 : rec.frequency === 'yearly' ? 1/12 : 30/(rec.custom_interval_days || 30));
        monthlyRecurringInr += monthlyOwn;
      }

      const { rows: recentRuns } = await safeQuery(
        `SELECT total_net FROM payroll_runs WHERE status = 'paid' ORDER BY period_year DESC, period_month DESC LIMIT 3`
      );
      const avgMonthlyPayrollInr = recentRuns.length
        ? recentRuns.reduce((sum, r) => sum + Number(r.total_net), 0) / recentRuns.length
        : 0;

      const { rows: pendingPRs } = await safeQuery(
        `SELECT estimated_amount, needed_by_date FROM purchase_requests WHERE status IN ('pending', 'approved')`
      );

      const { rows: unpaidBills } = await safeQuery(
        `SELECT (total_amount - amount_paid) AS remaining, due_date
         FROM bills WHERE status IN ('received', 'partially_paid', 'overdue')`
      );

      const forecast = [];
      let runningCash = startingCashInr;
      const now = new Date();

      for (let i = 0; i < monthsAhead; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthLabel = monthDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' });

        let purchaseRequestOutflow = 0;
        for (const pr of pendingPRs) {
          const prDate = pr.needed_by_date ? new Date(pr.needed_by_date) : null;
          const belongsHere = prDate
            ? (prDate.getFullYear() === monthDate.getFullYear() && prDate.getMonth() === monthDate.getMonth())
            : i === 0;
          const isPastDue = prDate && prDate < now && i === 0;
          if (belongsHere || isPastDue) purchaseRequestOutflow += Number(pr.estimated_amount);
        }

        let billsOutflow = 0;
        for (const b of unpaidBills) {
          const billDate = b.due_date ? new Date(b.due_date) : null;
          const belongsHere = billDate
            ? (billDate.getFullYear() === monthDate.getFullYear() && billDate.getMonth() === monthDate.getMonth())
            : i === 0;
          const isPastDue = billDate && billDate < now && i === 0;
          if (belongsHere || isPastDue) billsOutflow += Number(b.remaining);
        }

        const totalOutflow = monthlyRecurringInr + avgMonthlyPayrollInr + purchaseRequestOutflow + billsOutflow;
        runningCash -= totalOutflow;

        forecast.push({
          month: monthLabel,
          recurringExpensesInr: monthlyRecurringInr,
          payrollInr: avgMonthlyPayrollInr,
          purchaseRequestsInr: purchaseRequestOutflow,
          billsInr: billsOutflow,
          totalOutflowInr: totalOutflow,
          projectedCashInr: runningCash,
        });
      }

      const monthGoingNegative = forecast.findIndex((f) => f.projectedCashInr < 0);
      return {
        startingCashInr,
        monthlyRecurringExpensesInr: monthlyRecurringInr,
        avgMonthlyPayrollInr,
        pendingPurchaseRequestsCount: pendingPRs.length,
        unpaidBillsCount: unpaidBills.length,
        forecast,
        monthsUntilNegative: monthGoingNegative === -1 ? null : monthGoingNegative + 1,
      };
    },
  },

  {
    name: 'get_trial_balance',
    description: 'Get trial balance as of date',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      as_of_date: { type: 'string', required: false, description: 'YYYY-MM-DD' },
    },
    execute: async (params, user) => {
      const report = await ledger.getTrialBalance(params.as_of_date || null);
      return report;
    },
  },

  {
    name: 'get_pnl',
    description: 'Get profit and loss for date range',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      from: { type: 'string', required: true, description: 'YYYY-MM-DD' },
      to: { type: 'string', required: true, description: 'YYYY-MM-DD' },
    },
    execute: async (params, user) => {
      const report = await ledger.getProfitAndLoss(params.from, params.to);
      return report;
    },
  },

  {
    name: 'get_balance_sheet',
    description: 'Get balance sheet as of date',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      as_of_date: { type: 'string', required: false, description: 'YYYY-MM-DD, defaults to today' },
    },
    execute: async (params, user) => {
      const asOf = params.as_of_date || new Date().toISOString().slice(0, 10);
      const report = await ledger.getBalanceSheet(asOf);
      return report;
    },
  },

  {
    name: 'get_gst_summary',
    description: 'Get GST summary for date range',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      from: { type: 'string', required: true, description: 'YYYY-MM-DD' },
      to: { type: 'string', required: true, description: 'YYYY-MM-DD' },
    },
    execute: async (params, user) => {
      const { rows: accts } = await safeQuery(
        `SELECT code, id FROM chart_of_accounts WHERE code = ANY($1)`,
        [['2210', '2220', '2230']]
      );
      const acctMap = Object.fromEntries(accts.map((a) => [a.code, a.id]));

      const { rows: [sums] } = await safeQuery(
        `SELECT
           COALESCE(SUM(CASE WHEN jl.account_id = $1 THEN jl.credit - jl.debit ELSE 0 END), 0) AS cgst,
           COALESCE(SUM(CASE WHEN jl.account_id = $2 THEN jl.credit - jl.debit ELSE 0 END), 0) AS sgst,
           COALESCE(SUM(CASE WHEN jl.account_id = $3 THEN jl.credit - jl.debit ELSE 0 END), 0) AS igst
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.entry_date BETWEEN $4 AND $5`,
        [acctMap['2210'] || null, acctMap['2220'] || null, acctMap['2230'] || null, params.from, params.to]
      );

      return { from: params.from, to: params.to, cgst: sums.cgst, sgst: sums.sgst, igst: sums.igst, total: sums.cgst + sums.sgst + sums.igst };
    },
  },

  {
    name: 'get_budget_vs_actual',
    description: 'Get budget vs actual for current month',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {},
    execute: async (params, user) => {
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
      return { month: monthStart.slice(0, 7), categories };
    },
  },

  {
    name: 'get_recurring_totals',
    description: 'Get monthly/yearly recurring expense totals',
    category: 'finance',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {},
    execute: async (params, user) => {
      const { rows: items } = await safeQuery(`SELECT * FROM recurring_expenses WHERE is_active = true`);
      let monthlyInr = 0;
      for (const rec of items) {
        const effectiveAmount = rec.prod_amount;
        const monthlyInOwnCurrency = effectiveAmount * (rec.frequency === 'weekly' ? 52/12 : rec.frequency === 'monthly' ? 1 : rec.frequency === 'quarterly' ? 1/3 : rec.frequency === 'yearly' ? 1/12 : 30/(rec.custom_interval_days || 30));
        monthlyInr += monthlyInOwnCurrency;
      }
      const yearlyInr = monthlyInr * 12;
      return { monthly: { inr: monthlyInr }, yearly: { inr: yearlyInr } };
    },
  },
];

module.exports = financeTools;