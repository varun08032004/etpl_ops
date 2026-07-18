'use strict';

// Activates automatic daily execution of the recurring-expense sweep
// (occurrence generation, due-soon reminders, overdue flagging) that's
// otherwise only triggered manually via the "Run daily check" button.
//
// SETUP:
// 1. npm install node-cron
// 2. In your main server file (e.g. index.js / app.js / server.js), add near the top,
//    after your express app + routes are set up:
//
//      require('./services/expenseScheduler');
//
//    That's it — this file self-starts the cron job the moment it's required.
//
// Runs every day at 06:00 server time. Change the cron expression below if you
// want a different time (cron format: minute hour day month weekday).
//
// FAILURE ALERTING: if the daily check throws, this fires a
// 'system.recurring_expense_check_failed' event through your existing
// automationEngine (so it reaches whatever channel that's wired to — email/Slack/etc.)
// AND logs via console.error with a distinct tag your Sentry integration will pick up
// automatically if Sentry's Node SDK is initialized elsewhere in your app (it captures
// unhandled errors and console.error calls depending on your Sentry config — check your
// Sentry init to confirm console breadcrumbs/capture is enabled).

const cron = require('node-cron');
const { safeQuery } = require('../db/pool');
const { fireEvent } = require('./automationEngine');
const { convertToINR } = require('./fxConversion');

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

async function getEnvironment() {
  const { rows: [row] } = await safeQuery(`SELECT value FROM app_settings WHERE key = 'environment_mode'`);
  return row?.value || 'testnet';
}

async function getCachedRate(currency) {
  const cur = (currency || 'INR').toUpperCase();
  if (cur === 'INR') return 1;
  const today = new Date().toISOString().slice(0, 10);
  const { rows: [cached] } = await safeQuery(
    `SELECT rate_to_inr FROM fx_rate_cache WHERE currency = $1 AND rate_date = $2`,
    [cur, today]
  );
  if (cached) return Number(cached.rate_to_inr);
  const converted = await convertToINR(1, cur);
  const rate = converted.rate;
  await safeQuery(
    `INSERT INTO fx_rate_cache (currency, rate_date, rate_to_inr) VALUES ($1,$2,$3)
     ON CONFLICT (currency, rate_date) DO UPDATE SET rate_to_inr = $3, fetched_at = NOW()`,
    [cur, today, rate]
  );
  return rate;
}

async function runDailyExpenseCheck() {
  const today = new Date().toISOString().slice(0, 10);
  let occurrencesCreated = 0, remindersFired = 0, overdueFlagged = 0;

  try {
    const env = await getEnvironment();

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
        console.error(`[expenseScheduler] FX conversion failed for "${rec.name}", falling back to raw amount:`, fxErr.message);
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

    console.log(`[expenseScheduler] Daily check complete: ${occurrencesCreated} occurrence(s) created, ${remindersFired} reminder(s) sent, ${overdueFlagged} flagged overdue.`);
  } catch (err) {
    console.error('[expenseScheduler] DAILY CHECK FAILED:', err);
    try {
      await fireEvent('system.recurring_expense_check_failed', {
        error: err.message,
        stack: err.stack,
        occurred_at: new Date().toISOString(),
        link: '/expenses',
      });
    } catch (alertErr) {
      console.error('[expenseScheduler] ALSO FAILED TO FIRE FAILURE ALERT:', alertErr);
    }
  }
}

cron.schedule('0 6 * * *', runDailyExpenseCheck);

console.log('[expenseScheduler] Scheduled: recurring expense daily check will run at 06:00 every day.');

module.exports = { runDailyExpenseCheck };