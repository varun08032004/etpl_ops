'use strict';

// ============================================================================
// AXIS BANK ADAPTER — PLACEHOLDER
// ============================================================================
// This is the ONLY file that needs to change once you have your Axis Bank
// API credentials. Everything else (matching engine, routes, UI) talks to
// this adapter through fetchTransactions() below and doesn't care which bank
// is behind it — so swapping banks later, or adding a second one, means
// writing one new adapter file, not touching the reconciliation logic.
//
// TODO once you have Axis API access:
//   1. Set these env vars: AXIS_BANK_CLIENT_ID, AXIS_BANK_CLIENT_SECRET,
//      AXIS_BANK_API_BASE_URL, AXIS_BANK_ACCOUNT_NUMBER (or however their
//      docs name these — check Axis's actual API/developer portal for exact
//      auth flow, likely OAuth2 client-credentials or a signed-request scheme).
//   2. Implement authenticate() to get/refresh an access token.
//   3. Implement the real HTTP call inside fetchTransactions() — replace the
//      "NOT CONFIGURED" throw with an actual axios/fetch call to Axis's
//      statement or transaction-history endpoint.
//   4. Map Axis's response shape into the normalized shape documented below
//      so nothing downstream needs to change.
// ============================================================================

const AXIS_CONFIG = {
  clientId: process.env.AXIS_BANK_CLIENT_ID || null,
  clientSecret: process.env.AXIS_BANK_CLIENT_SECRET || null,
  apiBaseUrl: process.env.AXIS_BANK_API_BASE_URL || null,
  accountNumber: process.env.AXIS_BANK_ACCOUNT_NUMBER || null,
};

function isConfigured() {
  return !!(AXIS_CONFIG.clientId && AXIS_CONFIG.clientSecret && AXIS_CONFIG.apiBaseUrl && AXIS_CONFIG.accountNumber);
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function authenticate() {
  // TODO: replace with Axis's real auth flow once you have their API docs.
  // Typical pattern for corporate banking APIs (adjust to what Axis actually specifies):
  //
  //   const response = await fetch(`${AXIS_CONFIG.apiBaseUrl}/oauth/token`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //     body: new URLSearchParams({
  //       grant_type: 'client_credentials',
  //       client_id: AXIS_CONFIG.clientId,
  //       client_secret: AXIS_CONFIG.clientSecret,
  //     }),
  //   });
  //   const data = await response.json();
  //   cachedToken = data.access_token;
  //   tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 30000; // refresh 30s early
  //   return cachedToken;

  throw new Error('[axisBankAdapter] Axis Bank API not configured yet — set AXIS_BANK_* environment variables once your account/API access is ready.');
}

async function getValidToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  return authenticate();
}

/**
 * Fetches transactions for the configured Axis account within a date range.
 *
 * Returns an array of NORMALIZED transaction objects, regardless of bank:
 *   {
 *     externalTransactionId: string,   // Axis's own unique transaction/reference ID
 *     transactionDate: 'YYYY-MM-DD',
 *     amount: number,                  // always positive
 *     direction: 'debit' | 'credit',
 *     description: string,             // narration/particulars from the statement
 *     rawPayload: object,              // the original API response line, kept as-is
 *   }
 *
 * This normalized shape is what the matching engine and routes consume —
 * so the ONLY thing that changes when Axis's actual API is wired in is the
 * body of this function; nothing downstream needs to change.
 */
async function fetchTransactions(fromDate, toDate) {
  if (!isConfigured()) {
    throw new Error(
      '[axisBankAdapter] Not configured. Set AXIS_BANK_CLIENT_ID, AXIS_BANK_CLIENT_SECRET, ' +
      'AXIS_BANK_API_BASE_URL, and AXIS_BANK_ACCOUNT_NUMBER once you have your Axis Bank ' +
      'API account and credentials. Until then, bank sync will fail gracefully with this error ' +
      '— it will not silently pretend to succeed.'
    );
  }

  const token = await getValidToken();

  // TODO: replace with the real Axis statement/transaction-history API call.
  // Example shape (adjust endpoint path, params, and response parsing to match
  // Axis's actual API docs once you have them):
  //
  //   const response = await fetch(
  //     `${AXIS_CONFIG.apiBaseUrl}/accounts/${AXIS_CONFIG.accountNumber}/transactions?from=${fromDate}&to=${toDate}`,
  //     { headers: { Authorization: `Bearer ${token}` } }
  //   );
  //   const data = await response.json();
  //   return data.transactions.map(t => ({
  //     externalTransactionId: t.txnId,
  //     transactionDate: t.valueDate,
  //     amount: Math.abs(Number(t.amount)),
  //     direction: Number(t.amount) < 0 ? 'debit' : 'credit',
  //     description: t.narration,
  //     rawPayload: t,
  //   }));

  throw new Error('[axisBankAdapter] fetchTransactions() body is still a placeholder — implement the real Axis API call here.');
}

module.exports = { fetchTransactions, isConfigured };