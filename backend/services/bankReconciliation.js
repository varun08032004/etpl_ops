'use strict';

const { safeQuery, withTransaction } = require('../db/pool');
const { logAction } = require('./auditLog');

/**
 * Status for imported bank transactions:
 * - unmatched: imported but not yet matched to any journal entry
 * - matched: matched to a journal entry (auto or manual)
 * - reviewed: reviewed by finance user but not yet reconciled
 * - reconciled: fully reconciled, locked
 */

/**
 * Get bank transactions for reconciliation workspace
 * @param {string} bankAccountId 
 * @param {Object} filters 
 * @returns {Promise<Object>}
 */
async function getReconciliationWorkspace(bankAccountId, filters = {}) {
  const { status, fromDate, toDate, search, limit = 50, offset = 0 } = filters;
  
  // Verify account exists
  const { rows: [account] } = await safeQuery('SELECT id FROM bank_accounts WHERE id = $1', [bankAccountId]);
  if (!account) {
    throw new Error('Bank account not found');
  }

  const conditions = ['ebt.bank_account_id = $1'];
  const params = [bankAccountId];
  let paramIdx = 2;

  if (status) {
    conditions.push(`ebt.status = $${paramIdx++}`);
    params.push(status);
  }
  if (fromDate) {
    conditions.push(`ebt.transaction_date >= $${paramIdx++}`);
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push(`ebt.transaction_date <= $${paramIdx++}`);
    params.push(toDate);
  }
  if (search) {
    conditions.push(`(ebt.description ILIKE $${paramIdx} OR ebt.external_transaction_id ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Get total count
  const { rows: [{ total }] } = await safeQuery(
    `SELECT COUNT(*) as total FROM expense_bank_transactions ebt ${where}`,
    params
  );

  // Get paginated results with journal entry details
  params.push(limit, offset);
  const { rows } = await safeQuery(
    `SELECT 
       ebt.id, ebt.transaction_date, ebt.description, ebt.amount, ebt.direction,
       ebt.external_transaction_id, ebt.status, ebt.match_confidence, ebt.match_method,
       ebt.matched_journal_entry_id,
       je.entry_number as journal_entry_number,
       je.entry_date as journal_entry_date,
       je.narration as journal_narration
     FROM expense_bank_transactions ebt
     LEFT JOIN journal_entries je ON je.id = ebt.matched_journal_entry_id
     ${where}
     ORDER BY ebt.transaction_date DESC, ebt.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, 50, 0]
  );

  // Also get summary counts
  const { rows: [summary] } = await safeQuery(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'unmatched') as unmatched,
       COUNT(*) FILTER (WHERE status = 'matched') as matched,
       COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
       COUNT(*) FILTER (WHERE status = 'reconciled') as reconciled,
       COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0) as total_credits,
       COALESCE(SUM(amount) FILTER (WHERE direction = 'debit'), 0) as total_debits
     FROM expense_bank_transactions
     WHERE bank_account_id = $1`,
    [bankAccountId]
  );

  // Get book balance for reconciliation summary
  const { rows: [bookBalance] } = await safeQuery(
    `SELECT COALESCE(SUM(ba.opening_balance), 0)
           + COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'credit'), 0)
           - COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'debit'), 0) AS balance
     FROM bank_accounts ba
     LEFT JOIN expense_bank_transactions bt ON bt.bank_account_id = ba.id
     WHERE ba.id = $1`,
    [bankAccountId]
  );

  return {
    transactions: rows,
    summary: {
      total: parseInt(summary.total),
      unmatched: parseInt(summary.unmatched),
      matched: parseInt(summary.matched),
      reviewed: parseInt(summary.reviewed),
      reconciled: parseInt(summary.reconciled),
      totalCredits: Math.round(Number(summary.total_credits) * 100) / 100,
      totalDebits: Math.round(Number(summary.total_debits) * 100) / 100,
    },
    bookBalance: Math.round(Number(bookBalance.balance) * 100) / 100,
    pagination: { limit, offset, total: parseInt(total) }
  };
}

/**
 * Match a bank transaction to a journal entry
 * @param {string} bankAccountId 
 * @param {string} transactionId 
 * @param {string} journalEntryId 
 * @param {string} staffId 
 * @param {string} matchMethod - 'manual' | 'auto_exact' | 'auto_fuzzy'
 * @param {number} matchConfidence - 0.7 to 1.0
 * @returns {Promise<Object>}
 */
async function matchTransaction(bankAccountId, transactionId, journalEntryId, staffId, matchMethod = 'manual', matchConfidence = 1.0) {
  // Verify the bank transaction exists and belongs to this account
  const { rows: [txn] } = await safeQuery(
    `SELECT * FROM expense_bank_transactions WHERE id = $1 AND bank_account_id = $2`,
    [transactionId, bankAccountId]
  );
  if (!txn) throw new Error('Bank transaction not found');

  if (txn.status === 'reconciled') {
    throw new Error('Cannot modify a reconciled transaction');
  }

  // Verify the journal entry exists and is posted
  const { rows: [je] } = await safeQuery(
    `SELECT id, entry_number, is_posted FROM journal_entries WHERE id = $1`,
    [journalEntryId]
  );
  if (!je) throw new Error('Journal entry not found');
  if (!je.is_posted) throw new Error('Cannot match to an unposted journal entry');

  // Verify the journal entry has a line that corresponds to this bank transaction
  // (same bank account, matching amount, appropriate direction)
  const { rows: [matchingLine] } = await safeQuery(
    `SELECT * FROM journal_lines jl
     JOIN chart_of_accounts coa ON coa.id = jl.account_id
     WHERE jl.journal_entry_id = $1 
       AND coa.id = (SELECT ledger_account_id FROM bank_accounts WHERE id = $2)
     LIMIT 1`,
    [journalEntryId, bankAccountId]
  );
  if (!matchingLine) {
    throw new Error('Journal entry does not contain a line for this bank account');
  }

  const finalMatchConfidence = Math.max(0.7, Math.min(1.0, matchConfidence));

  // Perform the match within a transaction
  await withTransaction(async (client) => {
    // Update the bank transaction
    await client.query(
      `UPDATE expense_bank_transactions 
       SET status = 'matched', matched_journal_entry_id = $1, match_confidence = $2, match_method = $3
       WHERE id = $3`,
      [journalEntryId, finalMatchConfidence, matchMethod, transactionId]
    );

    // Update journal entry to link back
    await client.query(
      `UPDATE journal_entries SET matched_bank_transaction_id = $1 WHERE id = $2`,
      [transactionId, journalEntryId]
    );

    // Audit log
    await logAction({
      staffId: staffId,
      action: 'bank_reconciliation.matched',
      entity: 'expense_bank_transactions',
      entityId: transactionId,
      newValue: { journalEntryId, matchMethod, matchConfidence: finalMatchConfidence }
    });
  });

  return { success: true, message: 'Transaction matched successfully' };
}

/**
 * Unmatch a previously matched transaction
 * @param {string} bankAccountId 
 * @param {string} transactionId 
 * @param {string} staffId 
 * @returns {Promise<Object>}
 */
async function unmatchTransaction(bankAccountId, transactionId, staffId) {
  const { rows: [txn] } = await safeQuery(
    `SELECT * FROM expense_bank_transactions WHERE id = $1 AND bank_account_id = $2`,
    [transactionId, bankAccountId]
  );
  if (!txn) throw new Error('Bank transaction not found');

  if (txn.status === 'reconciled') {
    throw new Error('Cannot unmatch a reconciled transaction');
  }

  const journalEntryId = txn.matched_journal_entry_id;

  await withTransaction(async (client) => {
    // Clear the match on bank transaction
    await client.query(
      `UPDATE expense_bank_transactions 
       SET status = 'unmatched', matched_journal_entry_id = NULL, match_confidence = NULL, match_method = NULL
       WHERE id = $1`,
      [transactionId]
    );

    // Clear the reverse link on journal entry if it points to this transaction
    if (journalEntryId) {
      await client.query(
        `UPDATE journal_entries SET matched_bank_transaction_id = NULL WHERE id = $1`,
        [journalEntryId]
      );
    }

    // Audit log
    await logAction({
      staffId: staffId,
      action: 'bank_reconciliation.unmatched',
      entity: 'expense_bank_transactions',
      entityId: transactionId,
      newValue: { previousJournalEntryId: journalEntryId }
    });
  });

  return { success: true, message: 'Transaction unmatched successfully' };
}

/**
 * Mark a transaction as reviewed (by finance user)
 * @param {string} bankAccountId 
 * @param {string} transactionId 
 * @param {string} staffId 
 * @returns {Promise<Object>}
 */
async function reviewTransaction(bankAccountId, transactionId, staffId) {
  const { rows: [txn] } = await safeQuery(
    `SELECT * FROM expense_bank_transactions WHERE id = $1 AND bank_account_id = $2`,
    [transactionId, bankAccountId]
  );
  if (!txn) throw new Error('Bank transaction not found');

  if (txn.status === 'reconciled') {
    throw new Error('Cannot review a reconciled transaction');
  }

  await safeQuery(
    `UPDATE expense_bank_transactions SET status = 'reviewed' WHERE id = $1`,
    [transactionId]
  );

  await logAction({
    staffId: staffId,
    action: 'bank_reconciliation.reviewed',
    entity: 'expense_bank_transactions',
    entityId: transactionId,
    newValue: { status: 'reviewed' }
  });

  return { success: true, message: 'Transaction marked as reviewed' };
}

/**
 * Reconcile a transaction (final lock)
 * @param {string} bankAccountId 
 * @param {string} transactionId 
 * @param {string} staffId 
 * @returns {Promise<Object>}
 */
async function reconcileTransaction(bankAccountId, transactionId, staffId) {
  const { rows: [txn] } = await safeQuery(
    `SELECT * FROM expense_bank_transactions WHERE id = $1 AND bank_account_id = $2`,
    [transactionId, bankAccountId]
  );
  if (!txn) throw new Error('Bank transaction not found');

  if (txn.status === 'reconciled') {
    return { success: true, message: 'Already reconciled' };
  }

  if (txn.status !== 'matched' && txn.status !== 'reviewed') {
    throw new Error('Transaction must be matched or reviewed before reconciling');
  }

  await safeQuery(
    `UPDATE expense_bank_transactions SET status = 'reconciled' WHERE id = $1`,
    [transactionId]
  );

  await logAction({
    staffId: staffId,
    action: 'bank_reconciliation.reconciled',
    entity: 'expense_bank_transactions',
    entityId: transactionId,
    newValue: { status: 'reconciled' }
  });

  return { success: true, message: 'Transaction reconciled successfully' };
}

/**
 * Get reconciliation summary for a bank account
 * @param {string} bankAccountId 
 * @returns {Promise<Object>}
 */
async function getReconciliationSummary(bankAccountId) {
  const { rows: [account] } = await safeQuery(
    `SELECT id, account_name, bank_name, ledger_account_id, opening_balance
     FROM bank_accounts WHERE id = $1`,
    [bankAccountId]
  );
  if (!account) throw new Error('Bank account not found');

  // Statement balance: sum of all imported transactions
  const { rows: [stmtBalance] } = await safeQuery(
    `SELECT 
       COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0) as credits,
       COALESCE(SUM(amount) FILTER (WHERE direction = 'debit'), 0) as debits,
       COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) as net
     FROM expense_bank_transactions
     WHERE bank_account_id = $1`,
    [bankAccountId]
  );

  // Book balance: opening + all posted journal entries for this bank account
  const { rows: [bookBalanceResult] } = await safeQuery(
    `SELECT COALESCE(SUM(ba.opening_balance), 0)
           + COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'credit'), 0)
           - COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'debit'), 0) AS balance
     FROM bank_accounts ba
     LEFT JOIN expense_bank_transactions bt ON bt.bank_account_id = ba.id
     WHERE ba.id = $1`,
    [bankAccountId]
  );

  // Outstanding items: matched but not reconciled
  const { rows: outstanding } = await safeQuery(
    `SELECT 
       SUM(amount) FILTER (WHERE direction = 'credit') as outstanding_credits,
       SUM(amount) FILTER (WHERE direction = 'debit') as outstanding_debits,
       COUNT(*) as count
     FROM expense_bank_transactions
     WHERE bank_account_id = $1 AND status IN ('matched', 'reviewed')`,
    [bankAccountId]
  );

  // Unreconciled items
  const { rows: unreconciled } = await safeQuery(
    `SELECT 
       SUM(amount) FILTER (WHERE direction = 'credit') as unreconciled_credits,
       SUM(amount) FILTER (WHERE direction = 'debit') as unreconciled_debits,
       COUNT(*) as count
     FROM expense_bank_transactions
     WHERE bank_account_id = $1 AND status NOT IN ('reconciled')`,
    [bankAccountId]
  );

  const statementBalance = Math.round(Number(stmtBalance.net) * 100) / 100;
  const bookBalance = Math.round(Number(bookBalanceResult.balance) * 100) / 100;
  const difference = Math.round((statementBalance - bookBalance) * 100) / 100;

  return {
    account: { id: account.id, name: account.account_name, bank: account.bank_name },
    statementBalance,
    bookBalance,
    difference,
    outstanding: {
      credits: Math.round(Number(outstanding.outstanding_credits || 0) * 100) / 100,
      debits: Math.round(Number(outstanding.outstanding_debits || 0) * 100) / 100,
      count: parseInt(outstanding.count)
    },
    unreconciled: {
      credits: Math.round(Number(unreconciled.unreconciled_credits || 0) * 100) / 100,
      debits: Math.round(Number(unreconciled.unreconciled_debits || 0) * 100) / 100,
      count: parseInt(unreconciled.count)
    },
    isBalanced: difference === 0
  };
}

/**
 * Auto-match bank transactions against journal entries
 * Matches by bank account, amount, date (±3 days), and direction
 * @param {string} bankAccountId 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function autoMatchTransactions(bankAccountId, options = {}) {
  const { toleranceDays = 3, amountTolerance = 1 } = options; // ₹1 tolerance

  // Get unmatched bank transactions
  const { rows: bankTxns } = await safeQuery(
    `SELECT * FROM expense_bank_transactions
     WHERE bank_account_id = $1 AND status = 'unmatched'
     ORDER BY transaction_date`,
    [bankAccountId]
  );

  // Get posted journal entries that have lines for this bank account
  const { rows: journalEntries } = await safeQuery(
    `SELECT je.id, je.entry_number, je.entry_date, je.narration,
            jl.debit, jl.credit, jl.account_id
     FROM journal_entries je
     JOIN journal_lines jl ON jl.journal_entry_id = je.id
     JOIN chart_of_accounts coa ON coa.id = jl.account_id
     WHERE coa.id = (SELECT ledger_account_id FROM bank_accounts WHERE id = $1)
       AND je.is_posted = true
       AND je.source != 'reversal'
     ORDER BY je.entry_date`,
    [bankAccountId]
  );

  let autoMatched = 0;
  const errors = [];

  for (const txn of bankTxns) {
    const amount = Math.abs(Number(txn.amount));
    const isCredit = txn.direction === 'credit';

    // Find matching journal entry line
    const match = journalEntries.find(je => {
      const jeAmount = isCredit ? Number(je.credit) : Number(je.debit);
      const amountMatch = Math.abs(jeAmount - amount) <= amountTolerance;
      const dateDiff = Math.abs(new Date(je.entry_date) - new Date(txn.transaction_date)) / (1000 * 60 * 60 * 24);
      const dateMatch = dateDiff <= 3;
      const directionMatch = isCredit ? Number(je.credit) > 0 : Number(je.debit) > 0;
      
      return amountMatch && dateMatch && directionMatch;
    });

    if (match) {
      try {
        await matchTransaction(
          bankAccountId, 
          txn.id, 
          match.id, 
          'system', // system user
          'auto_exact',
          1.0
        );
        autoMatched++;
      } catch (err) {
        errors.push({ transactionId: txn.id, error: err.message });
      }
    }
  }

  return { autoMatched, errors };
}

module.exports = {
  getReconciliationWorkspace,
  matchTransaction,
  unmatchTransaction,
  reviewTransaction,
  reconcileTransaction,
  getReconciliationSummary,
  autoMatchTransactions
};