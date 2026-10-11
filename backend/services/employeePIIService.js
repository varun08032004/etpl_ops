'use strict';

const fieldEncryption = require('./crypto/fieldEncryption');
const { safeQuery } = require('../db/pool');
const { logAction } = require('./auditLog');

/**
 * Employee PII Service
 * 
 * Handles encryption/decryption of employee sensitive data:
 * - bank_account_number
 * - pan_number
 * 
 * Decryption only for authorized operations (payroll, HR).
 */

class EmployeePIIService {
  constructor(encryption = fieldEncryption) {
    this.enc = encryption;
  }

  /**
   * Get masked PII for UI display
   * Never returns decrypted values
   */
  async getMaskedPII(employeeId, requesterId) {
    const { rows } = await safeQuery(`
      SELECT 
        RIGHT(bank_account_number, 4) AS account_last4,
        CASE WHEN pan_number IS NOT NULL 
             THEN CONCAT('XXXX', RIGHT(pan_number, 4)) 
             ELSE NULL END AS pan_masked,
        bank_ifsc,
        bank_account_number_enc IS NOT NULL AS account_encrypted,
        pan_number_enc IS NOT NULL AS pan_encrypted
      FROM employees WHERE id = $1`,
      [employeeId]
    );

    if (!rows[0]) {
      throw new Error('Employee not found');
    }

    return {
      accountLast4: rows[0].account_last4 || null,
      panMasked: rows[0].pan_masked || null,
      ifsc: rows[0].bank_ifsc || null,
      fullyEncrypted: rows[0].account_encrypted && rows[0].pan_encrypted
    };
  }

  /**
   * Get decrypted PII for authorized payroll/HR operations
   * Requires explicit authorization
   */
  async getDecryptedForPayroll(employeeId, requesterId, reason) {
    // Authorization check
    const { rows: [staff] } = await safeQuery(
      `SELECT role FROM staff_accounts WHERE id = $1`,
      [requesterId]
    );

    if (!staff || !['owner', 'admin', 'finance', 'hr', 'payroll'].includes(staff.role)) {
      throw new Error('Unauthorized: insufficient role for PII decryption');
    }

    const { rows } = await safeQuery(
      `SELECT bank_account_number_enc, pan_number_enc 
       FROM employees WHERE id = $1`,
      [employeeId]
    );

    if (!rows[0]) {
      throw new Error('Employee not found');
    }

    const row = rows[0];
    const context = { table: 'employees', recordId: employeeId };

    if (!row.bank_account_number_enc && !row.pan_number_enc) {
      throw new Error('PII not encrypted - run backfill first');
    }

    const pii = {};

    if (row.bank_account_number_enc) {
      pii.bankAccountNumber = this.enc.decrypt(row.bank_account_number_enc, {
        table: 'employees', column: 'bank_account_number', recordId: employeeId
      });
    }

    if (row.pan_number_enc) {
      pii.panNumber = this.enc.decrypt(row.pan_number_enc, {
        table: 'employees', column: 'pan_number', recordId: employeeId
      });
    }

    // Audit log
    const { safeQuery } = require('../db/pool');
    await safeQuery(
      `INSERT INTO audit_log (staff_id, action, entity, entity_id, new_value)
       VALUES ($1, 'employee_pii.decrypted', 'employees', $2, $3)`,
      [requesterId, employeeId, JSON.stringify({ reason })]
    );

    return pii;
  }

  /**
   * Get masked PII for UI display
   * Never returns decrypted values
   */
  async getMaskedPII(employeeId, requesterId) {
    const { rows } = await safeQuery(`
      SELECT 
        RIGHT(bank_account_number, 4) AS account_last4,
        CASE WHEN pan_number IS NOT NULL 
             THEN CONCAT('XXXX', RIGHT(pan_number, 4)) 
             ELSE NULL END AS pan_masked,
        bank_ifsc,
        bank_account_number_enc IS NOT NULL AS account_encrypted,
        pan_number_enc IS NOT NULL AS pan_encrypted
      FROM employees WHERE id = $1`,
      [employeeId]
    );

    if (!rows[0]) {
      throw new Error('Employee not found');
    }

    return {
      accountLast4: rows[0].account_last4 || null,
      panMasked: rows[0].pan_masked || null,
      ifsc: rows[0].bank_ifsc || null,
      fullyEncrypted: rows[0].account_encrypted && rows[0].pan_encrypted
    };
  }

  /**
   * Verify all PII is encrypted (post-backfill validation)
   */
  async verifyAllEncrypted() {
    const { rows } = await safeQuery(`
      SELECT 
        COUNT(*) as total_employees,
        COUNT(bank_account_number_enc) as encrypted_bank_account,
        COUNT(pan_number_enc) as encrypted_pan
      FROM employees
      WHERE bank_account_number IS NOT NULL 
         OR pan_number IS NOT NULL
    `);

    const row = rows[0];
    return {
      totalEmployees: parseInt(row.total_employees),
      encryptedBankAccount: parseInt(row.encrypted_bank_account),
      encryptedPan: parseInt(row.encrypted_pan),
      fullyEncrypted: parseInt(row.total_employees) === parseInt(row.encrypted_bank_account) &&
                       parseInt(row.total_employees) === parseInt(row.encrypted_pan)
    };
  }
}

module.exports = { EmployeePIIService };