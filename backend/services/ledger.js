// ─────────────────────────────────────────────────────────────────────────
// services/ledger.js — the accounting core.
//
// EVERY financial event in the system (invoice raised, payment received,
// bill entered, payroll run, manual adjustment) goes through
// postJournalEntry(). Nothing writes to account balances directly — balances
// are always *derived* by summing journal_lines. This is what makes the
// books auditable: you can always trace a number on the P&L back to the
// exact entries that produced it.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const { withTransaction, safeQuery } = require('../db/pool');

/**
 * Generates the next sequential document number for a given prefix + year.
 * e.g. nextNumber('JE', 2026) -> 'JE-2026-000001'
 */
async function nextNumber(client, prefix, table, column) {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const { rows } = await client.query(
    `SELECT ${column} FROM ${table} WHERE ${column} LIKE $1 ORDER BY ${column} DESC LIMIT 1`,
    [like]
  );
  let next = 1;
  if (rows.length) {
    const last = rows[0][column];
    const n = parseInt(last.split('-').pop(), 10);
    if (!isNaN(n)) next = n + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(6, '0')}`;
}

/**
 * Posts a balanced journal entry.
 *
 * @param {object} entry
 * @param {string} entry.entryDate   'YYYY-MM-DD'
 * @param {string} entry.source      one of journal_source enum
 * @param {string} [entry.sourceType]
 * @param {string} [entry.sourceId]
 * @param {string} [entry.narration]
 * @param {string} [entry.createdBy] staff_accounts.id
 * @param {Array<{accountId:string, debit?:number, credit?:number, partyId?:string, description?:string}>} entry.lines
 * @returns {Promise<{id:string, entryNumber:string}>}
 */
async function postJournalEntry(entry) {
  const { entryDate, source, sourceType, sourceId, narration, createdBy, lines, allowClosedPeriod } = entry;

  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error('A journal entry needs at least 2 lines');
  }

  // A closed fiscal period is a hard stop for every caller (invoices, payroll,
  // manual entries, everything) — the ONLY exception is the closing entry
  // itself, which is necessarily dated inside the period it's closing.
  // closeFiscalPeriod() below is the only caller that sets allowClosedPeriod.
  if (!allowClosedPeriod) {
    const { rows: [closed] } = await safeQuery(
      `SELECT label FROM fiscal_periods WHERE is_closed = true AND $1::date BETWEEN start_date AND end_date`,
      [entryDate]
    );
    if (closed) {
      throw new Error(`${entryDate} falls inside "${closed.label}", which is closed. Reopen the period or use a current date.`);
    }
  }

  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of lines) {
    const d = Number(l.debit || 0);
    const c = Number(l.credit || 0);
    if (d > 0 && c > 0) throw new Error('A single journal line cannot have both a debit and a credit');
    if (d === 0 && c === 0) throw new Error('Every journal line needs a nonzero debit or credit');
    totalDebit += d;
    totalCredit += c;
  }
  // Round to paise to avoid floating point drift causing false imbalance
  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;
  if (totalDebit !== totalCredit) {
    throw new Error(`Journal entry does not balance: debit=${totalDebit} credit=${totalCredit}`);
  }

  return withTransaction(async (client) => {
    const entryNumber = await nextNumber(client, 'JE', 'journal_entries', 'entry_number');

    const { rows: [je] } = await client.query(
      `INSERT INTO journal_entries (entry_number, entry_date, source, source_type, source_id, narration, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, entry_number`,
      [entryNumber, entryDate, source, sourceType || null, sourceId || null, narration || null, createdBy || null]
    );

    for (const l of lines) {
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, party_id, description)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [je.id, l.accountId, l.debit || 0, l.credit || 0, l.partyId || null, l.description || null]
      );
    }

    return { id: je.id, entryNumber: je.entry_number };
  });
}

async function listFiscalPeriods() {
  const { rows } = await safeQuery(`SELECT * FROM fiscal_periods ORDER BY start_date DESC`);
  return rows;
}

async function createFiscalPeriod({ label, startDate, endDate }) {
  const { rows: [period] } = await safeQuery(
    `INSERT INTO fiscal_periods (label, start_date, end_date) VALUES ($1,$2,$3) RETURNING *`,
    [label, startDate, endDate]
  );
  return period;
}

/**
 * Closes a fiscal period: posts ONE balanced journal entry that zeroes every
 * income/expense account's net-for-the-period (by debiting income / crediting
 * expense back to nil) and rolls the resulting net profit (or loss) into the
 * Retained Earnings equity account (chart_of_accounts code '3200').
 *
 * Why this works without any special-casing in the report queries: P&L and
 * Balance Sheet are always computed by summing journal_lines filtered by
 * entry_date. A closing entry dated at the period's own end_date falls
 * INSIDE the range just reported on, so it exactly cancels what was just
 * summed — that account's net-for-this-period becomes zero. Next period's
 * report has a date range that starts after this entry, so it never sees it
 * — the account effectively "resets" for the new period, with zero extra
 * logic needed anywhere else in the codebase.
 */
async function closeFiscalPeriod(fiscalPeriodId, { closedBy }) {
  const { rows: [period] } = await safeQuery(`SELECT * FROM fiscal_periods WHERE id = $1`, [fiscalPeriodId]);
  if (!period) throw Object.assign(new Error('Fiscal period not found'), { status: 404 });
  if (period.is_closed) throw Object.assign(new Error(`"${period.label}" is already closed`), { status: 400 });

  // Idempotency: if a closing entry was already posted for this period (e.g.
  // a previous attempt posted the entry but failed before marking is_closed),
  // don't post a second one — just finish marking it closed.
  const { rows: [existingClose] } = await safeQuery(
    `SELECT id FROM journal_entries WHERE source_type = 'fiscal_period_close' AND source_id = $1`,
    [fiscalPeriodId]
  );

  let journalEntry = null;
  if (!existingClose) {
    const pnl = await getProfitAndLoss(period.start_date, period.end_date);

    const { rows: [retainedEarnings] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '3200'`);
    if (!retainedEarnings) throw new Error('Retained Earnings account (code 3200) not found in chart of accounts');

    const lines = [
      ...pnl.income.map((a) => ({ accountId: a.id, debit: a.amount, description: `Close ${period.label}: zero ${a.name}` })),
      ...pnl.expenses.map((a) => ({ accountId: a.id, credit: a.amount, description: `Close ${period.label}: zero ${a.name}` })),
    ];

    if (pnl.netProfit >= 0 && pnl.netProfit > 0) {
      lines.push({ accountId: retainedEarnings.id, credit: pnl.netProfit, description: `Net profit for ${period.label}` });
    } else if (pnl.netProfit < 0) {
      lines.push({ accountId: retainedEarnings.id, debit: -pnl.netProfit, description: `Net loss for ${period.label}` });
    }

    if (lines.length >= 2) {
      journalEntry = await postJournalEntry({
        entryDate: period.end_date,
        source: 'adjustment',
        sourceType: 'fiscal_period_close',
        sourceId: period.id,
        narration: `Year-end close: ${period.label}`,
        createdBy: closedBy,
        lines,
        allowClosedPeriod: true, // this IS the closing entry — dated inside the period it closes, by design
      });
    }
    // If there was no P&L activity at all in the period (lines.length < 2,
    // i.e. nothing to zero out and no profit/loss), there's nothing to post —
    // still fine to mark the period closed below.
  }

  const { rows: [updated] } = await safeQuery(
    `UPDATE fiscal_periods SET is_closed = true, closed_at = NOW(), closed_by = $1 WHERE id = $2 RETURNING *`,
    [closedBy, fiscalPeriodId]
  );

  return { period: updated, journalEntry };
}

/** Owner/Founder-only escape hatch — reopens a closed period (e.g. an error was found after close). Does NOT reverse the closing entry automatically; use reverseJournalEntry for that if needed. */
async function reopenFiscalPeriod(fiscalPeriodId) {
  const { rows: [updated] } = await safeQuery(
    `UPDATE fiscal_periods SET is_closed = false, closed_at = NULL, closed_by = NULL WHERE id = $1 RETURNING *`,
    [fiscalPeriodId]
  );
  if (!updated) throw Object.assign(new Error('Fiscal period not found'), { status: 404 });
  return updated;
}

/**
 * Reverses a journal entry by posting an equal-and-opposite entry
 * (never deletes history — audit trail stays intact).
 */
async function reverseJournalEntry(journalEntryId, { reason, createdBy } = {}) {
  const { rows: original } = await safeQuery(
    `SELECT * FROM journal_lines WHERE journal_entry_id = $1`,
    [journalEntryId]
  );
  if (!original.length) throw new Error('Journal entry not found or has no lines');

  const { rows: [je] } = await safeQuery(`SELECT * FROM journal_entries WHERE id = $1`, [journalEntryId]);

  const reversedLines = original.map((l) => ({
    accountId: l.account_id,
    debit: Number(l.credit),   // swap debit/credit
    credit: Number(l.debit),
    partyId: l.party_id,
    description: l.description,
  }));

  const result = await postJournalEntry({
    entryDate: new Date().toISOString().slice(0, 10),
    source: 'adjustment',
    sourceType: 'reversal',
    sourceId: journalEntryId,
    narration: `Reversal of ${je.entry_number}${reason ? `: ${reason}` : ''}`,
    createdBy,
    lines: reversedLines,
  });

  await safeQuery(`UPDATE journal_entries SET reversed_by = $1 WHERE id = $2`, [result.id, journalEntryId]);
  return result;
}

/** Account balance as of a date (or all-time if omitted). Sign convention: natural balance for the account type. */
async function getAccountBalance(accountId, asOfDate = null) {
  const { rows: [acct] } = await safeQuery(`SELECT account_type FROM chart_of_accounts WHERE id = $1`, [accountId]);
  if (!acct) throw new Error('Account not found');

  const params = [accountId];
  let dateFilter = '';
  if (asOfDate) {
    params.push(asOfDate);
    dateFilter = `AND je.entry_date <= $2`;
  }

  const { rows: [sum] } = await safeQuery(
    `SELECT COALESCE(SUM(jl.debit),0) AS total_debit, COALESCE(SUM(jl.credit),0) AS total_credit
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE jl.account_id = $1 ${dateFilter}`,
    params
  );

  const debit = Number(sum.total_debit);
  const credit = Number(sum.total_credit);
  const debitNormal = ['asset', 'expense'].includes(acct.account_type);
  const balance = debitNormal ? debit - credit : credit - debit;
  return Math.round(balance * 100) / 100;
}

/** Trial balance: every account with its debit-normal balance, split into debit/credit columns. */
async function getTrialBalance(asOfDate = null) {
  // Single grouped query instead of one getAccountBalance() call per account
  // (which was itself 2 queries) — was 1+2N sequential round trips, now 1.
  // asOfDate filter lives in the JOIN condition, not WHERE, so accounts with
  // zero activity in range still appear with a correct zero balance rather
  // than being silently dropped by an inner-join-like WHERE filter.
  const { rows } = await safeQuery(
    `SELECT coa.id, coa.code, coa.name, coa.account_type,
            COALESCE(SUM(jl.debit),0) AS total_debit,
            COALESCE(SUM(jl.credit),0) AS total_credit
     FROM chart_of_accounts coa
     LEFT JOIN journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
       AND ($1::date IS NULL OR je.entry_date <= $1::date)
     WHERE coa.is_group = false AND coa.is_active = true
     GROUP BY coa.id, coa.code, coa.name, coa.account_type
     ORDER BY coa.code`,
    [asOfDate]
  );

  const lines = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const a of rows) {
    const debit = Number(a.total_debit);
    const credit = Number(a.total_credit);
    const debitNormal = ['asset', 'expense'].includes(a.account_type);
    const bal = debitNormal ? debit - credit : credit - debit;
    if (bal === 0) continue;
    const lineDebit = debitNormal && bal > 0 ? bal : (!debitNormal && bal < 0 ? -bal : 0);
    const lineCredit = !debitNormal && bal > 0 ? bal : (debitNormal && bal < 0 ? -bal : 0);
    totalDebit += lineDebit;
    totalCredit += lineCredit;
    lines.push({ code: a.code, name: a.name, type: a.account_type, debit: lineDebit, credit: lineCredit });
  }
  return { lines, totalDebit: Math.round(totalDebit * 100) / 100, totalCredit: Math.round(totalCredit * 100) / 100 };
}

/** P&L for a date range: income - expenses = net profit. */
async function getProfitAndLoss(startDate, endDate) {
  // Was 1+N sequential queries (one per income/expense account); now 1.
  // This function is called directly by the Dashboard AND once per month
  // by cashflow-runway (6x by default) — with ~15-20 accounts that was
  // 100+ sequential DB round trips on a single Dashboard load.
  const { rows } = await safeQuery(
    `SELECT coa.id, coa.code, coa.name, coa.account_type,
            COALESCE(SUM(jl.debit),0) AS total_debit,
            COALESCE(SUM(jl.credit),0) AS total_credit
     FROM chart_of_accounts coa
     LEFT JOIN journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
       AND je.entry_date BETWEEN $1 AND $2
     WHERE coa.account_type IN ('income','expense') AND coa.is_group = false AND coa.is_active = true
     GROUP BY coa.id, coa.code, coa.name, coa.account_type
     ORDER BY coa.code`,
    [startDate, endDate]
  );

  const income = [];
  const expenses = [];
  let totalIncome = 0;
  let totalExpense = 0;

  for (const a of rows) {
    const d = Number(a.total_debit);
    const c = Number(a.total_credit);
    const net = a.account_type === 'income' ? c - d : d - c;
    if (net === 0) continue;
    const { total_debit, total_credit, ...acct } = a;
    if (a.account_type === 'income') { income.push({ ...acct, amount: net }); totalIncome += net; }
    else { expenses.push({ ...acct, amount: net }); totalExpense += net; }
  }

  return {
    period: { startDate, endDate },
    income, expenses,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    netProfit: Math.round((totalIncome - totalExpense) * 100) / 100,
  };
}

/** Balance sheet as of a date: assets = liabilities + equity (should always hold). */
async function getBalanceSheet(asOfDate) {
  const { rows } = await safeQuery(
    `SELECT coa.id, coa.code, coa.name, coa.account_type,
            COALESCE(SUM(jl.debit),0) AS total_debit,
            COALESCE(SUM(jl.credit),0) AS total_credit
     FROM chart_of_accounts coa
     LEFT JOIN journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
       AND je.entry_date <= $1::date
     WHERE coa.account_type IN ('asset','liability','equity') AND coa.is_group = false AND coa.is_active = true
     GROUP BY coa.id, coa.code, coa.name, coa.account_type
     ORDER BY coa.code`,
    [asOfDate]
  );

  const buckets = { asset: [], liability: [], equity: [] };
  const totals = { asset: 0, liability: 0, equity: 0 };

  for (const a of rows) {
    const debit = Number(a.total_debit);
    const credit = Number(a.total_credit);
    const debitNormal = ['asset', 'expense'].includes(a.account_type); // expense never appears here, kept for consistency with the sign convention used elsewhere
    const bal = debitNormal ? debit - credit : credit - debit;
    if (bal === 0) continue;
    const { total_debit, total_credit, ...acct } = a;
    buckets[a.account_type].push({ ...acct, amount: bal });
    totals[a.account_type] += bal;
  }

  // Retained earnings for the current period is implicit — a real close-the-books
  // process would post net P&L into equity at period end. Flagging this rather
  // than silently guessing:
  const netProfitYTD = totals.asset - totals.liability; // implied by balance-sheet equation
  return {
    asOfDate,
    assets: buckets.asset, liabilities: buckets.liability, equity: buckets.equity,
    totalAssets: Math.round(totals.asset * 100) / 100,
    totalLiabilities: Math.round(totals.liability * 100) / 100,
    totalEquity: Math.round(totals.equity * 100) / 100,
    impliedRetainedEarnings: Math.round((netProfitYTD - totals.equity) * 100) / 100,
  };
}

module.exports = {
  postJournalEntry,
  reverseJournalEntry,
  getAccountBalance,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  nextNumber,
  listFiscalPeriods,
  createFiscalPeriod,
  closeFiscalPeriod,
  reopenFiscalPeriod,
};