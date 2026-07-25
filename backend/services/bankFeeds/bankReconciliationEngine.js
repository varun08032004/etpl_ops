'use strict';

// ============================================================================
// BANK RECONCILIATION MATCHING ENGINE
// ============================================================================
// Bank-agnostic on purpose: this file only talks to the normalized shape
// returned by an adapter. If you add a second BANK (different provider),
// write a new adapter file with the same fetchTransactions() contract and
// add one line to ADAPTERS_BY_PROVIDER below — no other changes needed.
//
// MULTI-ACCOUNT: as of this version, credentials are resolved per bank_accounts
// row (api_client_id/api_client_secret/api_base_url/account_number) and passed
// into the adapter call — so 3 accounts on the same provider each sync with
// their own credentials instead of accidentally sharing one global config.
// ============================================================================

const { safeQuery } = require('../../db/pool');
const axisBankAdapter = require('./axisBankAdapter');

const ADAPTERS_BY_PROVIDER = {
  axis: axisBankAdapter,
  // hdfc: require('./hdfcBankAdapter'),  // example for when you add a second bank
};

async function getAccountWithAdapter(bankAccountId) {
  const { rows: [account] } = await safeQuery(
    `SELECT id, provider, account_number, api_client_id, api_client_secret, api_base_url
     FROM bank_accounts WHERE id = $1`,
    [bankAccountId]
  );
  if (!account) throw new Error(`Bank account ${bankAccountId} not found`);

  const adapter = ADAPTERS_BY_PROVIDER[account.provider];
  if (!adapter) {
    throw new Error(`No adapter configured for bank account provider "${account.provider}". This account is likely set to 'manual' — sync isn't available for manual accounts, only reconciliation against manually-entered transactions.`);
  }

  const credentials = {
    clientId: account.api_client_id,
    clientSecret: account.api_client_secret,
    apiBaseUrl: account.api_base_url,
    accountNumber: account.account_number,
  };

  return { adapter, credentials };
}

/**
 * Pulls new transactions for a bank account and stages them in expense_bank_transactions.
 * Safe to call repeatedly — de-duplicates on (bank_account_id, external_transaction_id).
 */
async function syncBankAccount(bankAccountId) {
  const { adapter, credentials } = await getAccountWithAdapter(bankAccountId);

  const { rows: [syncState] } = await safeQuery(
    `SELECT * FROM bank_sync_state WHERE bank_account_id = $1`,
    [bankAccountId]
  );
  const fromDate = syncState?.last_synced_transaction_date
    ? new Date(syncState.last_synced_transaction_date).toISOString().slice(0, 10)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // default: last 90 days
  const toDate = new Date().toISOString().slice(0, 10);

  try {
    const transactions = await adapter.fetchTransactions(fromDate, toDate, credentials);

    let inserted = 0;
    let latestDate = fromDate;
    for (const txn of transactions) {
      const { rowCount } = await safeQuery(
        `INSERT INTO expense_bank_transactions
           (bank_account_id, external_transaction_id, transaction_date, amount, direction, description, raw_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (bank_account_id, external_transaction_id) DO NOTHING`,
        [bankAccountId, txn.externalTransactionId, txn.transactionDate, txn.amount, txn.direction, txn.description, JSON.stringify(txn.rawPayload || {})]
      );
      if (rowCount > 0) inserted++;
      if (txn.transactionDate > latestDate) latestDate = txn.transactionDate;
    }

    await safeQuery(
      `INSERT INTO bank_sync_state (bank_account_id, last_synced_transaction_date, last_synced_at, last_sync_status, last_sync_error)
       VALUES ($1,$2,NOW(),'success',NULL)
       ON CONFLICT (bank_account_id) DO UPDATE SET
         last_synced_transaction_date = $2, last_synced_at = NOW(), last_sync_status = 'success', last_sync_error = NULL`,
      [bankAccountId, latestDate]
    );

    return { synced: true, transactionsFetched: transactions.length, transactionsInserted: inserted };
  } catch (err) {
    await safeQuery(
      `INSERT INTO bank_sync_state (bank_account_id, last_sync_status, last_sync_error, last_synced_at)
       VALUES ($1,'failed',$2,NOW())
       ON CONFLICT (bank_account_id) DO UPDATE SET last_sync_status = 'failed', last_sync_error = $2, last_synced_at = NOW()`,
      [bankAccountId, err.message]
    );
    throw err;
  }
}

/**
 * Attempts to auto-match unmatched expense_bank_transactions (debits only — expense
 * payments leave your account as debits) against paid-but-unreconciled
 * recurring_expense_occurrences.
 *
 * Matching rules, in order of confidence:
 *   1. EXACT: same amount (± ₹1 for rounding) AND transaction date within
 *      3 days of paid_date → auto-reconcile, confidence 1.0.
 *   2. FUZZY: same amount (± ₹1) AND transaction date within 10 days, but
 *      no exact-date match found → auto-reconcile, confidence 0.7.
 *   3. No match → left unmatched for manual reconciliation via the UI.
 */
async function autoMatch(bankAccountId) {
  const { rows: candidates } = await safeQuery(
    `SELECT * FROM expense_bank_transactions
     WHERE bank_account_id = $1 AND matched_occurrence_id IS NULL AND direction = 'debit'
     ORDER BY transaction_date ASC`,
    [bankAccountId]
  );

  const { rows: unreconciled } = await safeQuery(
    `SELECT * FROM recurring_expense_occurrences WHERE status = 'paid' AND reconciled = false`
  );

  let autoMatched = 0;
  const stillUnmatched = [];

  for (const txn of candidates) {
    const exact = unreconciled.find((occ) =>
      Math.abs(Number(occ.amount) - Number(txn.amount)) <= 1 &&
      Math.abs(daysBetween(occ.paid_date, txn.transaction_date)) <= 3 &&
      !occ.reconciled
    );
    const fuzzy = !exact && unreconciled.find((occ) =>
      Math.abs(Number(occ.amount) - Number(txn.amount)) <= 1 &&
      Math.abs(daysBetween(occ.paid_date, txn.transaction_date)) <= 10 &&
      !occ.reconciled
    );
    const match = exact || fuzzy;

    if (match) {
      await safeQuery(
        `UPDATE recurring_expense_occurrences
         SET reconciled = true, reconciled_at = NOW(), bank_statement_reference = $1
         WHERE id = $2`,
        [txn.external_transaction_id, match.id]
      );
      await safeQuery(
        `UPDATE expense_bank_transactions SET matched_occurrence_id = $1, match_confidence = $2, match_method = $3 WHERE id = $4`,
        [match.id, exact ? 1.0 : 0.7, exact ? 'auto_exact' : 'auto_fuzzy', txn.id]
      );
      match.reconciled = true;
      autoMatched++;
    } else {
      stillUnmatched.push(txn);
    }
  }

  return { autoMatched, stillUnmatched: stillUnmatched.length };
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

module.exports = { syncBankAccount, autoMatch };