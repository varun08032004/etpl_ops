'use strict';
/**
 * Accrual Service - Handles monthly revenue recognition and prepaid expense amortization
 * Run via cron job: 1st of each month, 2 AM
 */

const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('./ledger');

/**
 * Process monthly revenue recognition for subscription invoices
 * Dr Deferred Revenue (2700) / Cr Subscription Revenue (4100)
 */
async function processRevenueRecognition(periodStart, periodEnd, createdBy) {
  const { rows: schedules } = await safeQuery(
    `SELECT * FROM revenue_recognition_schedules 
     WHERE is_complete = false 
     AND next_recognition_date <= $1
     ORDER BY next_recognition_date`,
    [periodEnd]
  );

  if (schedules.length === 0) {
    return { processed: 0, totalAmount: 0, journalEntryIds: [] };
  }

  const { rows: [deferredRevAcct] } = await safeQuery(
    `SELECT id FROM chart_of_accounts WHERE code = '2700'`
  );
  const { rows: [incomeAcct] } = await safeQuery(
    `SELECT id FROM chart_of_accounts WHERE code = '4100'`
  );

  if (!deferredRevAcct || !incomeAcct) {
    throw new Error('Missing Deferred Revenue (2700) or Subscription Revenue (4100) accounts');
  }

  const journalEntryIds = [];
  let totalRecognized = 0;
  let processed = 0;

  for (const sched of schedules) {
    // Calculate exact months between start and end dates
    const startDate = new Date(sched.start_date);
    const endDate = new Date(sched.end_date);
    const totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth());
    const monthlyAmount = sched.total_amount / totalMonths;
    
    const remaining = Number(sched.total_amount) - Number(sched.recognized_amount);
    const recognizeAmount = Math.min(monthlyAmount, remaining);
    
    if (recognizeAmount <= 0) continue;

    try {
      const { rows: [invoice] } = await safeQuery(
        `SELECT invoice_number, party_id FROM invoices WHERE id = $1`, [sched.invoice_id]
      );

      const je = await ledger.postJournalEntry({
        entryDate: sched.next_recognition_date,
        source: 'adjustment',
        sourceType: 'revenue_recognition',
        sourceId: sched.id,
        narration: `Revenue recognition: ${invoice?.invoice_number || sched.invoice_id} (${sched.frequency})`,
        createdBy,
        lines: [
          { accountId: deferredRevAcct.id, debit: recognizeAmount, description: `Deferred revenue recognized for ${invoice?.invoice_number}` },
          { accountId: incomeAcct.id, credit: recognizeAmount, description: `Subscription revenue recognized` },
        ],
      });

      await safeQuery(
        `UPDATE revenue_recognition_schedules 
         SET recognized_amount = recognized_amount + $1,
             next_recognition_date = next_recognition_date + interval '1 month',
             is_complete = CASE WHEN recognized_amount + $1 >= total_amount THEN true ELSE false END,
             updated_at = NOW()
         WHERE id = $2`,
        [recognizeAmount, sched.id]
      );

      journalEntryIds.push(je.id);
      totalRecognized += recognizeAmount;
      processed++;
    } catch (err) {
      console.error(`[accrual] Revenue recognition failed for schedule ${sched.id}:`, err);
    }
  }

  // Log the job
  await safeQuery(
    `INSERT INTO accrual_job_log (job_type, period_start, period_end, schedules_processed, total_amount, journal_entry_ids, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    ['revenue_recognition', periodStart, periodEnd, processed, totalRecognized, journalEntryIds, createdBy]
  );

  return { processed, totalAmount: totalRecognized, journalEntryIds };
}

/**
 * Process monthly prepaid expense amortization
 * Dr Expense Account / Cr Prepaid Expenses (1500)
 */
async function processPrepaidExpenseAmortization(periodStart, periodEnd, createdBy) {
  const { rows: schedules } = await safeQuery(
    `SELECT * FROM prepaid_expense_schedules 
     WHERE is_complete = false 
     AND next_expense_date <= $1
     ORDER BY next_expense_date`,
    [periodEnd]
  );

  if (schedules.length === 0) {
    return { processed: 0, totalAmount: 0, journalEntryIds: [] };
  }

  const { rows: [prepaidAcct] } = await safeQuery(
    `SELECT id FROM chart_of_accounts WHERE code = '1500'`
  );

  if (!prepaidAcct) {
    throw new Error('Missing Prepaid Expenses (1500) account');
  }

  const journalEntryIds = [];
  let totalExpensed = 0;
  let processed = 0;

  for (const sched of schedules) {
    // Calculate exact months between start and end dates
    const startDate = new Date(sched.start_date);
    const endDate = new Date(sched.end_date);
    const totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth());
    const monthlyAmount = sched.total_amount / totalMonths;
    
    const remaining = Number(sched.total_amount) - Number(sched.expensed_amount);
    const expenseAmount = Math.min(monthlyAmount, remaining);
    
    if (expenseAmount <= 0) continue;

    try {
      const { rows: [bill] } = await safeQuery(
        `SELECT bill_number, vendor_id FROM bills WHERE id = $1`, [sched.bill_id]
      );

      const je = await ledger.postJournalEntry({
        entryDate: sched.next_expense_date,
        source: 'adjustment',
        sourceType: 'prepaid_expense',
        sourceId: sched.id,
        narration: `Prepaid expense amortization: ${bill?.bill_number || sched.bill_id}`,
        createdBy,
        lines: [
          { accountId: sched.expense_account_id, debit: expenseAmount, description: `Monthly expense for ${bill?.bill_number}` },
          { accountId: prepaidAcct.id, credit: expenseAmount, description: `Prepaid expense amortized` },
        ],
      });

      await safeQuery(
        `UPDATE prepaid_expense_schedules 
         SET expensed_amount = expensed_amount + $1,
             next_expense_date = next_expense_date + interval '1 month',
             is_complete = CASE WHEN expensed_amount + $1 >= total_amount THEN true ELSE false END,
             updated_at = NOW()
         WHERE id = $2`,
        [expenseAmount, sched.id]
      );

      journalEntryIds.push(je.id);
      totalExpensed += expenseAmount;
      processed++;
    } catch (err) {
      console.error(`[accrual] Prepaid expense amortization failed for schedule ${sched.id}:`, err);
    }
  }

  // Log the job
  await safeQuery(
    `INSERT INTO accrual_job_log (job_type, period_start, period_end, schedules_processed, total_amount, journal_entry_ids, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    ['prepaid_expense', periodStart, periodEnd, processed, totalExpensed, journalEntryIds, createdBy]
  );

  return { processed, totalAmount: totalExpensed, journalEntryIds };
}

/**
 * Create revenue recognition schedule when subscription invoice is finalized
 * Instead of posting to income directly, post to Deferred Revenue
 */
async function createRevenueRecognitionSchedule(invoiceId, createdBy) {
  const { rows: [invoice] } = await safeQuery(
    `SELECT * FROM invoices WHERE id = $1`, [invoiceId]
  );

  if (!invoice || invoice.invoice_type !== 'subscription') {
    return null; // Not a subscription, normal income posting applies
  }

  // Calculate months between invoice_date and due_date (or 12 months default)
  const startDate = invoice.invoice_date;
  const endDate = invoice.due_date || new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1));
  const months = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30)));

  const { rows: [deferredRevAcct] } = await safeQuery(
    `SELECT id FROM chart_of_accounts WHERE code = '2700'`
  );
  const { rows: [arAcct] } = await safeQuery(
    `SELECT id FROM chart_of_accounts WHERE code = '1200'`
  );

  if (!deferredRevAcct || !arAcct) {
    throw new Error('Missing Deferred Revenue (2700) or AR (1200) accounts');
  }

  // Post initial entry: Dr AR / Cr Deferred Revenue
  const je = await ledger.postJournalEntry({
    entryDate: startDate,
    source: 'invoice',
    sourceType: 'subscription_invoice',
    sourceId: invoiceId,
    narration: `Subscription invoice ${invoice.invoice_number} - deferred revenue`,
    createdBy,
    lines: [
      { accountId: arAcct.id, debit: invoice.total_amount, partyId: invoice.party_id, description: invoice.invoice_number },
      { accountId: deferredRevAcct.id, credit: invoice.total_amount, description: `Deferred revenue for ${invoice.invoice_number}` },
    ],
  });

  // Create schedule
  await safeQuery(
    `INSERT INTO revenue_recognition_schedules (invoice_id, total_amount, start_date, end_date, next_recognition_date)
     VALUES ($1,$2,$3,$4,$5)`,
    [invoiceId, invoice.total_amount, startDate, endDate, startDate]
  );

  // Update invoice to link journal entry
  await safeQuery(`UPDATE invoices SET journal_entry_id = $1 WHERE id = $2`, [je.id, invoiceId]);

  return { journalEntry: je, scheduleCreated: true };
}

/**
 * Create prepaid expense schedule when bill is marked as prepaid
 * Instead of posting to expense directly, post to Prepaid Expenses asset
 */
async function createPrepaidExpenseSchedule(billId, createdBy) {
  const { rows: [bill] } = await safeQuery(
    `SELECT * FROM bills WHERE id = $1`, [billId]
  );

  if (!bill || !bill.is_prepaid || !bill.prepaid_end_date) {
    return null; // Not a prepaid expense, normal expense posting applies
  }

  const { rows: [prepaidAcct] } = await safeQuery(
    `SELECT id FROM chart_of_accounts WHERE code = '1500'`
  );

  // Determine credit account based on payment method
  let creditAccountId, creditDescription;
  if (bill.payment_method === 'director_loan') {
    const { rows: [dirAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2150'`);
    creditAccountId = dirAcct?.id;
    creditDescription = `Due to Director - ${bill.bill_number}`;
  } else if (bill.payment_method === 'bank') {
    const { rows: [bank] } = await safeQuery(`SELECT ledger_account_id FROM bank_accounts WHERE id = $1`, [bill.bank_account_id]);
    creditAccountId = bank?.ledger_account_id;
    creditDescription = `Bank payment - ${bill.bill_number}`;
  } else {
    const { rows: [apAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2100'`);
    creditAccountId = apAcct?.id;
    creditDescription = `Accounts Payable - ${bill.bill_number}`;
  }

  if (!creditAccountId || !prepaidAcct) {
    throw new Error('Missing required accounts for prepaid expense');
  }

  // Post initial entry: Dr Prepaid Expenses / Cr Bank/Director/AP
  const je = await ledger.postJournalEntry({
    entryDate: bill.bill_date,
    source: 'bill',
    sourceType: 'prepaid_bill',
    sourceId: billId,
    narration: `Prepaid expense: ${bill.bill_number}`,
    createdBy,
    lines: [
      { accountId: prepaidAcct.id, debit: bill.total_amount, description: bill.description || bill.bill_number },
      { accountId: creditAccountId, credit: bill.total_amount, description: creditDescription },
    ],
  });

  // Get expense account from category or bill
  let expenseAccountId = bill.expense_account_id;
  if (!expenseAccountId && bill.category_id) {
    const { rows: [cat] } = await safeQuery(`SELECT expense_account_id FROM expense_categories WHERE id = $1`, [bill.category_id]);
    expenseAccountId = cat?.expense_account_id;
  }

  // Create schedule
  await safeQuery(
    `INSERT INTO prepaid_expense_schedules (bill_id, total_amount, expense_account_id, start_date, end_date, next_expense_date)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [billId, bill.total_amount, expenseAccountId, bill.bill_date, bill.prepaid_end_date, bill.bill_date]
  );

  // Update bill to link journal entry
  await safeQuery(`UPDATE bills SET journal_entry_id = $1 WHERE id = $2`, [je.id, billId]);

  return { journalEntry: je, scheduleCreated: true };
}

/**
 * Main monthly accrual job - call this from cron
 */
async function runMonthlyAccrual(createdBy) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  console.log(`[accrual] Running monthly accrual for ${periodStart} to ${periodEnd}`);

  const revenueResult = await processRevenueRecognition(periodStart, periodEnd, createdBy);
  const prepaidResult = await processPrepaidExpenseAmortization(periodStart, periodEnd, createdBy);

  return {
    period: { start: periodStart, end: periodEnd },
    revenueRecognition: revenueResult,
    prepaidExpense: prepaidResult,
  };
}

module.exports = {
  processRevenueRecognition,
  processPrepaidExpenseAmortization,
  createRevenueRecognitionSchedule,
  createPrepaidExpenseSchedule,
  runMonthlyAccrual,
};