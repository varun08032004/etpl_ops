'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL on every connection, dev included
  max: 10,
});

pool.on('error', (err) => {
  console.error('[internal-ops:db] unexpected error on idle client', err);
});

async function safeQuery(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.LOG_SQL === 'true') {
      console.log('[sql]', text.replace(/\s+/g, ' ').slice(0, 120), `${Date.now() - start}ms`);
    }
    return res;
  } catch (err) {
    console.error('[internal-ops:db] query failed:', err.message, '\n', text);
    throw err;
  }
}

// For multi-statement transactions (e.g. posting a journal entry + its lines atomically)
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, safeQuery, withTransaction };
