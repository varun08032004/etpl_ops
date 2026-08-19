'use strict';

const { Pool, types } = require('pg');

// DATE (oid 1082) has no timezone component, but pg's default parser turns
// it into a JS Date at local midnight. Serializing that to JSON later calls
// .toISOString(), which converts to UTC and shifts the date back a day for
// any timezone ahead of UTC (e.g. IST) — a user picking 13 Jul 2026 in the
// UI would see 12 Jul come back from the API. Returning the raw
// 'YYYY-MM-DD' string sidesteps the conversion entirely.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  // Supabase's pooler closes idle connections more aggressively than pg's
  // own defaults assume — without this, pg-pool holds a connection past
  // when Supabase has already dropped it server-side, and the next query
  // on it fails with ECONNRESET instead of pg quietly opening a fresh one.
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[internal-ops:db] unexpected error on idle client', err);
});

async function safeQuery(text, params) {
  const start = Date.now();
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await pool.query(text, params);
      if (process.env.LOG_SQL === 'true') {
        console.log('[sql]', text.replace(/\s+/g, ' ').slice(0, 120), `${Date.now() - start}ms`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === '57P01' || err.code === '08006' || err.message?.includes('timeout') || err.message?.includes('Connection terminated');
      if (isTransient && attempt < 3) {
        console.warn(`[sql] Transient error (attempt ${attempt}/3), retrying:`, err.message);
        await new Promise(r => setTimeout(r, attempt * 200));
        continue;
      }
      console.error('[internal-ops:db] query failed:', err.message, '\n', text);
      throw err;
    }
  }
  throw lastErr;
}

// For multi-statement transactions (e.g. posting a journal entry + its lines atomically)
async function withTransaction(fn) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      lastErr = err;
      try { await client.query('ROLLBACK'); } catch (_) {}
      const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === '57P01' || err.code === '08006' || err.message?.includes('timeout') || err.message?.includes('Connection terminated');
      if (isTransient && attempt < 3) {
        console.warn(`[tx] Transient error (attempt ${attempt}/3), retrying:`, err.message);
        await new Promise(r => setTimeout(r, attempt * 300));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
  throw lastErr;
}

module.exports = { pool, safeQuery, withTransaction };