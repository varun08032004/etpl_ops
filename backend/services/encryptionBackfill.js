'use strict';

const { pool } = require('../db/pool');
const fieldEncryption = require('./crypto/fieldEncryption');
const crypto = require('crypto');

const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

/**
 * Execute a transaction using the provided pool.
 * @param {Object} pool - Database pool
 * @param {Function} fn - Async function receiving client
 * @returns {Promise<any>} Result of fn
 */
async function withTransaction(pool, fn) {
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

/**
 * Backfill bank credentials from plaintext to encrypted columns.
 * Uses FOR UPDATE SKIP LOCKED for safe concurrent execution.
 * 
 * @param {Object} options
 * @param {Object} options.pool - Database pool (injected for testing)
 * @param {number} options.batchSize - Rows per batch
 * @param {number} options.maxRetries - Max retries per row
 * @param {boolean} options.dryRun - If true, no mutations performed
 * @returns {Promise<Object>} Backfill result summary
 */
async function backfillBankCredentials({ pool: customPool, batchSize = BATCH_SIZE, maxRetries = MAX_RETRIES, dryRun = false } = {}) {
  const activePool = customPool || pool;
  const backfillId = crypto.randomUUID();
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalErrors = 0;
  const errors = [];

  console.log(`[${backfillId}] Starting bank credentials backfill...`);

  while (true) {
    let clientResult;
    try {
      clientResult = await withTransaction(activePool, async (client) => {
        // Lock and fetch in ONE transaction
        const { rows } = await client.query(`
          SELECT id, api_client_id, api_client_secret, api_base_url,
                 api_client_id_enc, api_client_secret_enc, api_base_url_enc
          FROM bank_accounts
          WHERE 
            (api_client_id IS NOT NULL AND api_client_id_enc IS NULL)
            OR (api_client_secret IS NOT NULL AND api_client_secret_enc IS NULL)
            OR (api_base_url IS NOT NULL AND api_base_url_enc IS NULL)
          ORDER BY id
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        `, [batchSize]);

        if (rows.length === 0) {
          return { rows: [], done: true };
        }

        const results = [];
        for (const row of rows) {
          let retries = 0;
          let success = false;
          let lastError;

          while (retries <= maxRetries && !success) {
            try {
              const keyId = process.env.FIELD_ENC_KEY_ACTIVE || 'default';
              const recordId = row.id;
              const updates = [];
              const params = [];

              const contextBase = { table: 'bank_accounts', recordId: row.id };

              if (row.api_client_id && !row.api_client_id_enc) {
                const envelope = fieldEncryption.encrypt(row.api_client_id, {
                  ...contextBase, column: 'api_client_id'
                });
                updates.push(`api_client_id_enc = $${params.length + 1}`);
                params.push(envelope);
              }
              if (row.api_client_secret && !row.api_client_secret_enc) {
                const envelope = fieldEncryption.encrypt(row.api_client_secret, {
                  ...contextBase, column: 'api_client_secret'
                });
                updates.push(`api_client_secret_enc = $${params.length + 1}`);
                params.push(envelope);
              }
              if (row.api_base_url && !row.api_base_url_enc) {
                const envelope = fieldEncryption.encrypt(row.api_base_url, {
                  ...contextBase, column: 'api_base_url'
                });
                updates.push(`api_base_url_enc = $${params.length + 1}`);
                params.push(envelope);
              }

              if (updates.length === 0) {
                success = true;
                continue;
              }

              updates.push(`credential_key_id = $${params.length + 1}`);
              params.push(keyId);
              updates.push(`credential_rotated_at = NOW()`);
              params.push(recordId);

              if (!dryRun) {
                // Execute update within the SAME transaction that holds the lock
                await client.query(`
                  UPDATE bank_accounts 
                  SET ${updates.join(', ')}
                  WHERE id = $${params.length}
                `, params);
              }

              success = true;
              break;
            } catch (err) {
              lastError = err;
              retries++;
              if (retries <= maxRetries) {
                // Release lock before sleeping - retry will re-acquire
                await new Promise(r => setTimeout(r, RETRY_BASE_MS * retries));
              }
            }
          }

          if (!success) {
            return { results: [], errors: [{ id: row.id, error: lastError?.message }] };
          }
          results.push({ id: row.id, encrypted: updates.length });
        }

        return { results, processed: results.length, errors: 0, done: false };
      });
    } catch (err) {
      throw err;
    }

    if (clientResult.done) break;
    totalProcessed += clientResult.processed;
    totalErrors += clientResult.errors.length;
    errors.push(...clientResult.errors);

    console.log(`[${backfillId}] Batch: ${clientResult.results.length} rows, total: ${totalProcessed}`);
  }

  return {
    backfillId,
    totalProcessed,
    totalErrors,
    errors,
    durationMs: Date.now() - startTime,
    dryRun
  };
}

async function backfillEmployeePII({ pool: customPool, batchSize = BATCH_SIZE, maxRetries = MAX_RETRIES, dryRun = false } = {}) {
  const activePool = customPool || pool;
  const backfillId = crypto.randomUUID();
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalErrors = 0;
  const errors = [];

  console.log(`[${backfillId}] Starting employee PII backfill...`);

  while (true) {
    let clientResult;
    try {
      clientResult = await withTransaction(activePool, async (client) => {
        const { rows } = await client.query(`
          SELECT id, bank_account_number, pan_number,
                 bank_account_number_enc, pan_number_enc
          FROM employees
          WHERE 
            (bank_account_number IS NOT NULL AND bank_account_number_enc IS NULL)
            OR (pan_number IS NOT NULL AND pan_number_enc IS NULL)
          ORDER BY id
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        `, [batchSize]);

        if (rows.length === 0) {
          return { rows: [], done: true };
        }

        const results = [];
        for (const row of rows) {
          let retries = 0;
          let success = false;
          let lastError;

          while (retries <= maxRetries && !success) {
            try {
              const keyId = process.env.FIELD_ENC_KEY_ACTIVE || 'default';
              const recordId = row.id;
              const updates = [];
              const params = [];

              const contextBase = { table: 'employees', recordId: row.id };

              if (row.bank_account_number && !row.bank_account_number_enc) {
                const envelope = fieldEncryption.encrypt(row.bank_account_number, {
                  ...contextBase, column: 'bank_account_number'
                });
                updates.push(`bank_account_number_enc = $${params.length + 1}`);
                params.push(envelope);
              }
              if (row.pan_number && !row.pan_number_enc) {
                const envelope = fieldEncryption.encrypt(row.pan_number, {
                  ...contextBase, column: 'pan_number'
                });
                updates.push(`pan_number_enc = $${params.length + 1}`);
                params.push(envelope);
              }

              if (updates.length === 0) {
                success = true;
                continue;
              }

              updates.push(`pii_key_id = $${params.length + 1}`);
              params.push(keyId);
              updates.push(`pii_rotated_at = NOW()`);
              params.push(recordId);

              if (!dryRun) {
                await client.query(`
                  UPDATE employees 
                  SET ${updates.join(', ')}
                  WHERE id = $${params.length}
                `, params);
              }

              success = true;
              break;
            } catch (err) {
              lastError = err;
              retries++;
              if (retries <= maxRetries) {
                await new Promise(r => setTimeout(r, RETRY_BASE_MS * retries));
              }
            }
          }

          if (!success) {
            return { results: [], errors: [{ id: row.id, error: lastError?.message }] };
          }
          results.push({ id: row.id, encrypted: updates.length });
        }

        return { results, processed: results.length, errors: 0, done: false };
      });
    } catch (err) {
      throw err;
    }

    if (clientResult.done) break;
    totalProcessed += clientResult.processed;
    totalErrors += clientResult.errors.length;
    errors.push(...clientResult.errors);

    console.log(`[${backfillId}] Batch: ${clientResult.results.length} rows, total: ${totalProcessed}`);
  }

  return {
    backfillId,
    totalProcessed,
    totalErrors,
    errors,
    durationMs: Date.now() - startTime,
    dryRun
  };
}

module.exports = { backfillBankCredentials, backfillEmployeePII };