'use strict';

// ============================================================================
// AXIS BANK ADAPTER — PLACEHOLDER, now MULTI-ACCOUNT capable
// ============================================================================
// Previously read ONE global set of credentials from env vars — meaning
// every bank_accounts row set to provider='axis' would try to sync using
// the SAME account number, which is wrong the moment you have more than one
// Axis account. Now takes credentials as a parameter, sourced per-account
// from bank_accounts.api_client_id / api_client_secret / api_base_url /
// account_number (see services/bankFeeds/bankReconciliationEngine.js, which
// resolves these from the DB row and passes them in here).
//
// Falls back to env vars (AXIS_BANK_CLIENT_ID etc.) ONLY if a given account's
// row has no credentials set — this keeps your original single-account setup
// working without forcing an immediate migration of existing data.
//
// TODO once you have Axis API access, same as before:
//   1. Implement authenticate() for real (OAuth2 client-credentials, or
//      whatever Axis's actual docs specify).
//   2. Implement the real HTTP call inside fetchTransactions().
//   3. Map Axis's response shape into the normalized shape documented below.
// ============================================================================

function resolveCredentials(credentials) {
  return {
    clientId: credentials?.clientId || process.env.AXIS_BANK_CLIENT_ID || null,
    clientSecret: credentials?.clientSecret || process.env.AXIS_BANK_CLIENT_SECRET || null,
    apiBaseUrl: credentials?.apiBaseUrl || process.env.AXIS_BANK_API_BASE_URL || null,
    accountNumber: credentials?.accountNumber || process.env.AXIS_BANK_ACCOUNT_NUMBER || null,
  };
}

function isConfigured(credentials) {
  const c = resolveCredentials(credentials);
  return !!(c.clientId && c.clientSecret && c.apiBaseUrl && c.accountNumber);
}

// Token cache is now keyed by account number, since different accounts have
// different credentials and therefore different tokens — a single module-level
// token variable would leak one account's token into another account's calls.
const tokenCache = new Map(); // accountNumber -> { token, expiresAt }

async function authenticate(config) {
  // TODO: replace with Axis's real auth flow once you have their API docs.
  //
  //   const response = await fetch(`${config.apiBaseUrl}/oauth/token`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //     body: new URLSearchParams({
  //       grant_type: 'client_credentials',
  //       client_id: config.clientId,
  //       client_secret: config.clientSecret,
  //     }),
  //   });
  //   const data = await response.json();
  //   const token = data.access_token;
  //   tokenCache.set(config.accountNumber, { token, expiresAt: Date.now() + (data.expires_in * 1000) - 30000 });
  //   return token;

  throw new Error(`[axisBankAdapter] Axis Bank API not configured for account "${config.accountNumber}" — set credentials on this bank account (or the AXIS_BANK_* env vars) once your API access is ready.`);
}

async function getValidToken(config) {
  const cached = tokenCache.get(config.accountNumber);
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  return authenticate(config);
}

/**
 * Fetches transactions for a given account within a date range.
 *
 * @param {string} fromDate
 * @param {string} toDate
 * @param {object} [credentials] - per-account credentials, resolved by the
 *   caller from bank_accounts.api_client_id / api_client_secret / api_base_url
 *   / account_number. Falls back to env vars if omitted (single-account setups).
 *
 * Returns an array of NORMALIZED transaction objects, same shape as before:
 *   { externalTransactionId, transactionDate, amount, direction, description, rawPayload }
 */
async function fetchTransactions(fromDate, toDate, credentials) {
  const config = resolveCredentials(credentials);
  if (!isConfigured(credentials)) {
    throw new Error(
      `[axisBankAdapter] Not configured for account "${config.accountNumber || 'unknown'}". Set api_client_id/api_client_secret/api_base_url ` +
      'on this bank account row, or the AXIS_BANK_* environment variables as a fallback, once you have your Axis Bank API credentials. ' +
      'Until then, bank sync will fail gracefully with this error — it will not silently pretend to succeed.'
    );
  }

  const token = await getValidToken(config);

  // TODO: replace with the real Axis statement/transaction-history API call,
  // using config.apiBaseUrl / config.accountNumber / token. Example shape:
  //
  //   const response = await fetch(
  //     `${config.apiBaseUrl}/accounts/${config.accountNumber}/transactions?from=${fromDate}&to=${toDate}`,
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