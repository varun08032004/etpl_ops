// ─────────────────────────────────────────────────────────────────────────
// services/fxConversion.js
//
// Converts foreign-currency amounts to INR using Frankfurter (ECB reference
// rates, free, no API key). ECB rates are daily reference rates, not live
// trading rates — fine for booking a recurring bill, not fine if you need
// intraday accuracy. Cached per (currency, day) so repeated occurrence
// generation in a single run doesn't hit the API once per record.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const cache = new Map(); // key: `${currency}:${YYYY-MM-DD}` -> rate

async function getRateToINR(currency) {
  if (currency === 'INR') return 1;

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `${currency}:${today}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `https://api.frankfurter.dev/v1/latest?base=${currency}&symbols=INR`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`Could not reach FX rate service: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`FX rate service returned ${res.status} for ${currency}->INR`);
  }
  const data = await res.json();
  const rate = data.rates?.INR;
  if (!rate) throw new Error(`No INR rate returned for ${currency} — check the currency code is valid (ISO 4217)`);

  cache.set(cacheKey, rate);
  return rate;
}

/**
 * @param {number} amount - amount in `currency`
 * @param {string} currency - ISO 4217 code, e.g. 'USD'
 * @returns {Promise<{amountInr: number, rate: number}>}
 */
async function convertToINR(amount, currency) {
  const rate = await getRateToINR(currency);
  const amountInr = Math.round(Number(amount) * rate * 100) / 100;
  return { amountInr, rate };
}

module.exports = { convertToINR };