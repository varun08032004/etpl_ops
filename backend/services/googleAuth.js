'use strict';
// services/googleAuth.js — exchanges a Google service-account key for a
// short-lived OAuth access token, using the standard JWT-bearer flow.
// Built on Node's native crypto + fetch — no `googleapis` dependency needed.
//
// SETUP (one-time, shared by Search Console + GA4 sync):
//   1. console.cloud.google.com → select/create a project → IAM & Admin →
//      Service Accounts → create one → "Keys" tab → Add Key → JSON. This
//      downloads a .json file with a private key.
//   2. Set GOOGLE_SERVICE_ACCOUNT_KEY to the ENTIRE contents of that JSON
//      file, as a single-line string (env vars can't hold newlines cleanly,
//      so either base64-encode the whole file and we'll detect that, or
//      most hosts let you paste raw JSON directly into an env var).
//   3. Grant that service account's email (looks like
//      xxx@yyy.iam.gserviceaccount.com) access to:
//        - Search Console: Settings → Users and permissions → Add user →
//          paste the service account email → Full access
//        - GA4: Admin → Property Access Management → Add user → same email
//          → Viewer role

let cachedKey = null;
function getServiceAccountKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    const err = new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured on the server — see services/googleAuth.js setup notes.');
    err.status = 501;
    throw err;
  }
  try {
    // Accept either raw JSON or base64-encoded JSON (base64 is often easier
    // to paste into a single-line env var without escaping issues).
    const looksLikeJson = raw.trim().startsWith('{');
    const jsonText = looksLikeJson ? raw : Buffer.from(raw, 'base64').toString('utf8');
    cachedKey = JSON.parse(jsonText);
  } catch (e) {
    const err = new Error('GOOGLE_SERVICE_ACCOUNT_KEY is set but not valid JSON (or valid base64-encoded JSON)');
    err.status = 501;
    throw err;
  }
  return cachedKey;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

// Tokens are cached per scope string for ~55 min (Google tokens last 60 min).
const tokenCache = new Map();

async function getGoogleAccessToken(scope) {
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const key = getServiceAccountKey();
  const crypto = require('crypto');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: key.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(key.private_key, 'base64url');
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();

  if (!res.ok || !data.access_token) {
    const err = new Error(`Google auth failed: ${data.error_description || data.error || res.status}`);
    err.status = 502;
    throw err;
  }

  tokenCache.set(scope, { token: data.access_token, expiresAt: Date.now() + 55 * 60 * 1000 });
  return data.access_token;
}

module.exports = { getGoogleAccessToken };