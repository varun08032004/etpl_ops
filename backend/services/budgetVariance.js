'use strict';

// ============================================================================
// SHARED BUDGET VARIANCE + ALERT LOGIC
// ============================================================================
// Used by BOTH routes/finance.js's GET /budgets/variance (on-demand, when
// someone opens the page) AND services/financeScheduler.js (daily cron) —
// factored out so alerts actually fire proactively, not only when someone
// happens to look at the Budgets tab that day.
// ============================================================================

const { safeQuery } = require('../db/pool');
const { fireEvent } = require('./automationEngine');

async function computeVarianceAndAlert(fiscalYearLabel) {
  const { rows: budgets } = await safeQuery(`SELECT * FROM budgets WHERE fiscal_year_label = $1`, [fiscalYearLabel]);
  const results = [];

  for (const b of budgets) {
    let actual = 0;
    let source = 'unattributed';

    if (b.category) {
      const { rows: [row] } = await safeQuery(
        `SELECT COALESCE(SUM(o.amount),0) AS total FROM recurring_expense_occurrences o
         JOIN recurring_expenses re ON re.id = o.recurring_expense_id
         JOIN expense_categories ec ON ec.id = re.category_id
         WHERE ec.name = $1 AND o.status = 'paid'`,
        [b.category]
      );
      actual = Number(row.total);
      source = 'recurring_expenses';
    } else if (['salaries', 'payroll'].includes((b.department || '').toLowerCase())) {
      const { rows: [row] } = await safeQuery(`SELECT COALESCE(SUM(total_net),0) AS total FROM payroll_runs WHERE status = 'paid'`);
      actual = Number(row.total);
      source = 'payroll';
    }

    const overBudget = actual > Number(b.budgeted_amount_inr);

    if (overBudget) {
      const lastAlertActual = b.last_alert_actual_inr != null ? Number(b.last_alert_actual_inr) : null;
      const worsenedSignificantly = lastAlertActual == null || actual > lastAlertActual * 1.1;
      if (worsenedSignificantly) {
        await fireEvent('budget.over_budget', {
          department: b.department, category: b.category, fiscalYearLabel: b.fiscal_year_label,
          budgetedInr: Number(b.budgeted_amount_inr), actualInr: actual, link: '/finance',
        }).catch((err) => console.error('[budgetVariance:alert] fireEvent failed:', err));
        await safeQuery(`UPDATE budgets SET last_alert_at = NOW(), last_alert_actual_inr = $1 WHERE id = $2`, [actual, b.id])
          .catch((err) => console.error('[budgetVariance:alert] failed to record alert state:', err));
      }
    }

    results.push({ ...b, actual_spend_inr: actual, variance: Number(b.budgeted_amount_inr) - actual, overBudget, actualSource: source });
  }

  return results;
}

module.exports = { computeVarianceAndAlert };