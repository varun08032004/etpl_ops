'use strict';

// ============================================================================
// AXIS BANK PAYOUT ADAPTER — PLACEHOLDER
// ============================================================================
// This is the ONLY file that needs to change once you have Axis Bank's
// payout/transfer API credentials. Everything else (payroll.js, the UI)
// talks to this adapter through initiatePayout() / getPayoutStatus() below
// and doesn't know or care which bank/rail is behind it.
//
// This is a SEPARATE credential set from axisBankAdapter.js (which reads
// statements for reconciliation) — payout APIs are usually a different
// product/scope even within the same bank's developer portal. Check Axis's
// docs for whether these can share one OAuth client or need two.
//
// TODO once you have Axis payout API access:
//   1. Set env vars: AXIS_PAYOUT_CLIENT_ID, AXIS_PAYOUT_CLIENT_SECRET,
//      AXIS_PAYOUT_API_BASE_URL, AXIS_PAYOUT_ACCOUNT_NUMBER (names are guesses —
//      match whatever Axis's actual payout/transfer API docs specify).
//   2. Implement authenticate() — likely OAuth2 client-credentials, but corporate
//      banking APIs sometimes use mutual TLS + API keys instead; check their docs.
//   3. Implement the real HTTP call inside initiatePayout() — replace the
//      "NOT CONFIGURED" throw with the actual NEFT/RTGS/IMPS transfer API call.
//   4. Implement getPayoutStatus() for polling (used as a fallback until/instead
//      of a webhook — Axis corporate APIs don't always offer webhooks; check).
//   5. If Axis DOES provide a payout-status webhook, verify its signature using
//      whatever scheme their docs specify before trusting it — do not skip this,
//      see the note in routes/payroll.js's webhook handler.
// ============================================================================

const AXIS_PAYOUT_CONFIG = {
  clientId: process.env.AXIS_PAYOUT_CLIENT_ID || null,
  clientSecret: process.env.AXIS_PAYOUT_CLIENT_SECRET || null,
  apiBaseUrl: process.env.AXIS_PAYOUT_API_BASE_URL || null,
  accountNumber: process.env.AXIS_PAYOUT_ACCOUNT_NUMBER || null,
};

function isConfigured() {
  return !!(AXIS_PAYOUT_CONFIG.clientId && AXIS_PAYOUT_CONFIG.clientSecret && AXIS_PAYOUT_CONFIG.apiBaseUrl && AXIS_PAYOUT_CONFIG.accountNumber);
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function authenticate() {
  // TODO: replace with Axis's real payout-API auth flow once you have their docs.
  //
  //   const response = await fetch(`${AXIS_PAYOUT_CONFIG.apiBaseUrl}/oauth/token`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //     body: new URLSearchParams({
  //       grant_type: 'client_credentials',
  //       client_id: AXIS_PAYOUT_CONFIG.clientId,
  //       client_secret: AXIS_PAYOUT_CONFIG.clientSecret,
  //     }),
  //   });
  //   const data = await response.json();
  //   cachedToken = data.access_token;
  //   tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 30000;
  //   return cachedToken;

  throw new Error('[axisPayoutAdapter] Axis payout API not configured yet — set AXIS_PAYOUT_* environment variables once your payout API access is ready.');
}

async function getValidToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  return authenticate();
}

/**
 * Initiates a single bank transfer (salary payout) to an employee's account.
 *
 * Input (normalized — this is what routes/payroll.js calls with):
 *   {
 *     beneficiaryAccountNumber: string,
 *     beneficiaryIFSC: string,
 *     beneficiaryName: string,
 *     amount: number,          // in INR, NOT paise — this adapter handles unit conversion internally if Axis needs paise
 *     mode: 'NEFT' | 'RTGS' | 'IMPS',
 *     referenceId: string,     // your own idempotency reference, e.g. `payroll-${runId}-${employeeId}`
 *     narration: string,
 *   }
 *
 * Returns (normalized — this is what routes/payroll.js expects back):
 *   {
 *     providerPayoutId: string,          // Axis's own transfer/UTR reference
 *     status: 'initiated' | 'processing' | 'failed',
 *     rawResponse: object,                // kept for audit/debugging
 *   }
 *
 * MUST use referenceId for idempotency on Axis's side if their API supports an
 * idempotency-key parameter — that's a second layer of protection on top of the
 * draft→processing lock in routes/payroll.js, in case this function itself gets
 * retried (network timeout, etc.) after Axis already received the first request.
 */
async function initiatePayout({ beneficiaryAccountNumber, beneficiaryIFSC, beneficiaryName, amount, mode, referenceId, narration }) {
  if (!isConfigured()) {
    throw new Error(
      '[axisPayoutAdapter] Not configured. Set AXIS_PAYOUT_CLIENT_ID, AXIS_PAYOUT_CLIENT_SECRET, ' +
      'AXIS_PAYOUT_API_BASE_URL, and AXIS_PAYOUT_ACCOUNT_NUMBER once you have Axis Bank payout API access. ' +
      'Until then, disbursal will fail gracefully with this error — it will not silently pretend a payout was sent.'
    );
  }

  const token = await getValidToken();

  // TODO: replace with the real Axis transfer-initiation API call. Example shape
  // (adjust endpoint, params, and response parsing to Axis's actual docs):
  //
  //   const response = await fetch(`${AXIS_PAYOUT_CONFIG.apiBaseUrl}/payouts`, {
  //     method: 'POST',
  //     headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       from_account_number: AXIS_PAYOUT_CONFIG.accountNumber,
  //       to_account_number: beneficiaryAccountNumber,
  //       to_ifsc: beneficiaryIFSC,
  //       beneficiary_name: beneficiaryName,
  //       amount: amount,
  //       mode: mode,
  //       reference_id: referenceId,   // idempotency key, if Axis supports it
  //       narration: narration,
  //     }),
  //   });
  //   const data = await response.json();
  //   return {
  //     providerPayoutId: data.transaction_id,
  //     status: data.status === 'SUCCESS' ? 'processing' : data.status === 'FAILED' ? 'failed' : 'initiated',
  //     rawResponse: data,
  //   };

  throw new Error('[axisPayoutAdapter] initiatePayout() body is still a placeholder — implement the real Axis payout API call here.');
}

/**
 * Polls the current status of a previously-initiated payout. Use this as a
 * fallback (or the only mechanism, if Axis has no webhook for this API) to
 * keep payroll_items statuses in sync with what actually happened at the bank.
 *
 * Returns: { status: 'processing' | 'paid' | 'failed', rawResponse: object }
 */
async function getPayoutStatus(providerPayoutId) {
  if (!isConfigured()) {
    throw new Error('[axisPayoutAdapter] Not configured — cannot check payout status yet.');
  }
  const token = await getValidToken();

  // TODO: replace with the real Axis payout-status API call.
  //
  //   const response = await fetch(`${AXIS_PAYOUT_CONFIG.apiBaseUrl}/payouts/${providerPayoutId}`, {
  //     headers: { Authorization: `Bearer ${token}` },
  //   });
  //   const data = await response.json();
  //   return {
  //     status: data.status === 'SUCCESS' ? 'paid' : data.status === 'FAILED' ? 'failed' : 'processing',
  //     rawResponse: data,
  //   };

  throw new Error('[axisPayoutAdapter] getPayoutStatus() body is still a placeholder — implement the real Axis status-check call here.');
}

module.exports = { initiatePayout, getPayoutStatus, isConfigured };