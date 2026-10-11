'use strict';

const { parse } = require('csv-parse/sync');
const { safeQuery, withTransaction } = require('../db/pool');

const REQUIRED_COLUMNS = ['date', 'description', 'amount'];
const OPTIONAL_COLUMNS = ['reference', 'balance', 'type'];

const SUPPORTED_CREDIT_TYPES = new Set(['credit', 'cr', 'income']);
const SUPPORTED_DEBIT_TYPES = new Set(['debit', 'dr', 'expense', 'withdrawal']);
const ALL_SUPPORTED_TYPES = new Set([...SUPPORTED_CREDIT_TYPES, ...SUPPORTED_DEBIT_TYPES]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 10000;
const MAX_DECIMAL_PLACES = 2;

/**
 * Parse amount string to integer paise (smallest currency unit).
 * Rejects malformed values, non-finite values, unsupported formats,
 * and precision beyond MAX_DECIMAL_PLACES.
 * 
 * @param {string|number|null|undefined} value
 * @returns {number|null} Amount in paise (integer), or null if invalid
 */
function parseAmountToPaise(value) {
  if (value === null || value === undefined || value === '') return null;
  
  const str = String(value).trim();
  if (!str) return null;
  
  // Remove currency symbols and separators
  const cleaned = str.replace(/[₹,\s]/g, '');
  
  // Check for valid numeric format with optional decimal
  // Must match: optional sign, digits, optional decimal with up to MAX_DECIMAL_PLACES
  const decimalRegex = new RegExp(`^([+-]?\\d+)(\\.(\\d{1,${MAX_DECIMAL_PLACES}}))?$`);
  const match = cleaned.match(decimalRegex);
  
  if (!match) return null;
  
  const integerPart = match[1];
  const decimalPart = match[3] || '';
  
  // Convert to paise (integer)
  const paise = parseInt(integerPart, 10) * 100;
  if (isNaN(paise) || !isFinite(paise)) return null;
  
  if (decimalPart.length > 0) {
    const decimalPaise = parseInt(decimalPart.padEnd(2, '0').slice(0, 2), 10);
    if (isNaN(decimalPaise)) return null;
    // Handle sign correctly for negative amounts
    const sign = paise < 0 ? -1 : 1;
    return paise + (sign * decimalPaise);
  }
  
  return paise;
}

/**
 * Convert paise integer to NUMERIC(14,2) string for PostgreSQL.
 * @param {number} paise 
 * @returns {string}
 */
function paiseToNumericString(paise) {
  const sign = paise < 0 ? '-' : '';
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const paiseRemainder = (absPaise % 100).toString().padStart(2, '0');
  return `${sign}${rupees}.${paiseRemainder}`;
}

/**
 * Parse date string strictly - only accept explicitly supported formats.
 * Rejects ambiguous or unsupported formats.
 * 
 * @param {string} value 
 * @returns {string|null} ISO date string (YYYY-MM-DD) or null if invalid
 */
function parseDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  
  // Explicitly supported formats only
  const formats = [
    { regex: /^\d{4}-\d{2}-\d{2}$/, parse: (s) => s }, // YYYY-MM-DD (unambiguous)
    { regex: /^\d{2}-\d{2}-\d{4}$/, parse: (s) => { // DD-MM-YYYY (unambiguous with dash)
      const [d, m, y] = s.split('-');
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }},
    { regex: /^\d{2}\.\d{2}\.\d{4}$/, parse: (s) => { // DD.MM.YYYY (unambiguous with dot)
      const [d, m, y] = s.split('.');
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }},
    // DD/MM/YYYY is AMBIGUOUS (could be MM/DD/YYYY) - only accept when day > 12
    { regex: /^\d{2}\/\d{2}\/\d{4}$/, parse: (s) => {
      const [d, m, y] = s.split('/');
      const day = parseInt(d, 10);
      const month = parseInt(m, 10);
      // Only accept if day > 12 (unambiguously DD/MM) or month > 12 (unambiguously MM/DD)
      // For Indian context, we assume DD/MM/YYYY, so only accept when day > 12
      if (day > 12 && month <= 12) {
        return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      }
      // If month > 12, it's invalid anyway
      return null;
    }},
  ];
  
  for (const fmt of formats) {
    if (fmt.regex.test(str)) {
      const iso = fmt.parse(str);
      if (!iso) return null; // Rejected by format-specific logic (e.g., ambiguous DD/MM)
      // Validate it's a real calendar date
      const [y, m, d] = iso.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      if (date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d) {
        return iso;
      }
      return null; // Invalid calendar date (e.g., 31/02/2024)
    }
  }
  
  // Reject other formats (no guessing)
  return null;
}

/**
 * Normalize transaction type - only accept explicitly supported values.
 * Rejects unknown types instead of defaulting.
 * 
 * @param {string} value 
 * @returns {{valid: boolean, direction: 'credit'|'debit', error?: string}}
 */
function normalizeType(value) {
  if (!value || !String(value).trim()) {
    return { valid: false, direction: null, error: 'Transaction type is required' };
  }
  const v = String(value).toLowerCase().trim();
  if (SUPPORTED_CREDIT_TYPES.has(v)) return { valid: true, direction: 'credit', error: null };
  if (SUPPORTED_DEBIT_TYPES.has(v)) return { valid: true, direction: 'debit', error: null };
  return { valid: false, direction: null, error: `Unsupported transaction type: "${value}". Supported: ${[...ALL_SUPPORTED_TYPES].join(', ')}` };
}

/**
 * Generate stable fingerprint for duplicate detection when no external ID is provided.
 * Based on account, date, amount, type, and normalized reference/description.
 * 
 * @param {string} bankAccountId 
 * @param {string} transaction_date 
 * @param {number} amountPaise 
 * @param {string} direction 
 * @param {string} reference 
 * @param {string} description 
 * @returns {string}
 */
function generateFingerprint(bankAccountId, transaction_date, amountPaise, direction, reference, description) {
  const crypto = require('crypto');
  const descHash = crypto.createHash('sha256')
    .update(String(description || '').trim().toLowerCase().slice(0, 100))
    .digest('hex')
    .slice(0, 16);
  const refNorm = String(reference || '').trim().toLowerCase().slice(0, 50);
  return `fp_${bankAccountId}_${transaction_date}_${amountPaise}_${direction}_${refNorm}_${descHash}`;
}

/**
 * Validate a single CSV row.
 * Returns { valid: boolean, errors: string[], parsed: {...} | null }
 */
function validateRow(row, rowNum) {
  const errors = [];
  
  // Check required columns
  for (const col of REQUIRED_COLUMNS) {
    if (!row[col] && row[col] !== 0) {
      errors.push(`Missing required column: ${col}`);
    }
  }
  
  // Parse amount to paise
  const amountPaise = parseAmountToPaise(row.amount);
  if (amountPaise === null) {
    errors.push('Invalid amount format (must be numeric with up to 2 decimal places)');
  } else if (amountPaise === 0) {
    errors.push('Amount must be non-zero');
  }
  
  // Parse date
  const date = parseDate(row.date);
  if (!date) {
    errors.push('Invalid date format. Supported: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY');
  }
  
  // Normalize type - reject unknown
  const typeResult = normalizeType(row.type);
  if (!typeResult.valid) {
    errors.push(typeResult.error);
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, parsed: null };
  }
  
  const direction = typeResult.direction;
  const absAmountPaise = Math.abs(amountPaise);
  // For credit type, amount should be positive; for debit, negative in our convention
  // But we store absolute value and use direction column
  const signedAmountPaise = direction === 'credit' ? absAmountPaise : -absAmountPaise;
  
  return {
    valid: true,
    errors: [],
    parsed: {
      transaction_date: date,
      description: String(row.description || '').trim().slice(0, 500),
      amount_paise: signedAmountPaise, // signed: positive for credit, negative for debit
      direction: direction,
      external_transaction_id: row.reference ? String(row.reference).trim().slice(0, 200) : null,
      raw_payload: row,
    },
  };
}

/**
 * Import bank statement CSV.
 * Policy: ALL-OR-NOTHING for validation failures. Only fully valid imports proceed.
 * Returns { total, imported, duplicates, failed, errors[], import_id }
 * 
 * @param {string} bankAccountId 
 * @param {Buffer} csvBuffer 
 * @param {string} staffId 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function importBankStatement(bankAccountId, csvBuffer, staffId, options = {}) {
  const { skipDuplicates = true } = options;
  
  // File size check
  if (csvBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024} MB`);
  }
  
  let rows;
  try {
    rows = parse(csvBuffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: false, // Strict quoting
      relax_column_count: false, // Strict column count
      max_records: MAX_ROWS,
    });
  } catch (err) {
    throw new Error(`CSV parse error: ${err.message}`);
  }
  
  if (!rows.length) {
    throw new Error('CSV has no data rows');
  }
  
  if (rows.length > MAX_ROWS) {
    throw new Error(`CSV exceeds maximum row limit of ${MAX_ROWS}`);
  }
  
  const results = {
    total: rows.length,
    imported: 0,
    duplicates: 0,
    failed: 0,
    errors: [],
    import_id: require('crypto').randomUUID(),
  };
  
  // Validate all rows first - collect errors
  const validRows = [];
  for (let i = 0; i < rows.length; i++) {
    const validation = validateRow(rows[i], i + 2); // +2 for header + 1-index
    if (!validation.valid) {
      results.failed++;
      results.errors.push({ row: i + 2, errors: validation.errors });
    } else {
      validRows.push(validation.parsed);
    }
  }
  
  // ALL-OR-NOTHING: If any validation errors, reject entire import
  if (results.failed > 0) {
    results.imported = 0;
    results.duplicates = 0;
    return results;
  }
  
  // All rows valid - proceed with transaction
  await withTransaction(async (client) => {
    for (const parsed of validRows) {
      try {
        let externalId = parsed.external_transaction_id;
        let isFingerprint = false;
        
        if (!externalId) {
          externalId = generateFingerprint(
            bankAccountId,
            parsed.transaction_date,
            Math.abs(parsed.amount_paise),
            parsed.direction,
            parsed.raw_payload.reference || '',
            parsed.description
          );
          isFingerprint = true;
        }
        
        // Use database constraint for duplicate detection
        // The unique index on (bank_account_id, external_transaction_id) handles concurrency
        const query = `
          INSERT INTO expense_bank_transactions
            (bank_account_id, transaction_date, description, amount, direction, external_transaction_id, raw_payload)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (bank_account_id, external_transaction_id) DO NOTHING
          RETURNING id
        `;
        
        // Convert paise to NUMERIC(14,2) string for PostgreSQL
        const amountNumeric = paiseToNumericString(parsed.amount_paise);
        
        const params = [
          bankAccountId,
          parsed.transaction_date,
          parsed.description,
          amountNumeric,
          parsed.direction,
          externalId,
          JSON.stringify(parsed.raw_payload || {}),
        ];
        
        const { rowCount } = await client.query(query, params);
        
        if (rowCount > 0) {
          results.imported++;
        } else {
          // Duplicate detected via constraint
          results.duplicates++;
        }
      } catch (err) {
        // Constraint violation other than our unique index - rethrow
        // This ensures we don't silently suppress unrelated errors
        throw err;
      }
    }
  });
  
  return results;
}

/**
 * Get import preview without persisting.
 * Validates and returns first N rows with errors.
 */
async function getImportPreview(csvBuffer) {
  if (csvBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024} MB`);
  }
  
  let rows;
  try {
    rows = parse(csvBuffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: false,
      relax_column_count: false,
      max_records: MAX_ROWS,
    });
  } catch (err) {
    throw new Error(`CSV parse error: ${err.message}`);
  }
  
  if (!rows.length) {
    throw new Error('CSV has no data rows');
  }
  
  const preview = [];
  const errors = [];
  
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const validation = validateRow(rows[i], i + 2);
    if (validation.valid) {
      preview.push({
        ...validation.parsed,
        amount_display: paiseToNumericString(Math.abs(validation.parsed.amount_paise)),
      });
    } else {
      errors.push({ row: i + 2, errors: validation.errors });
    }
  }
  
  return {
    totalRows: rows.length,
    validRows: rows.filter((_, i) => validateRow(rows[i], i + 2).valid).length,
    preview,
    errors: errors.slice(0, 10),
    detectedColumns: rows.length > 0 ? Object.keys(rows[0]) : [],
    limits: { maxFileSize: MAX_FILE_SIZE, maxRows: MAX_ROWS, maxDecimalPlaces: MAX_DECIMAL_PLACES },
  };
}

module.exports = {
  importBankStatement,
  getImportPreview,
  validateRow,
  parseAmountToPaise,
  parseDate,
  normalizeType,
  generateFingerprint,
  paiseToNumericString,
  MAX_FILE_SIZE,
  MAX_ROWS,
  MAX_DECIMAL_PLACES,
  SUPPORTED_CREDIT_TYPES,
  SUPPORTED_DEBIT_TYPES,
};