'use strict';

const fieldEncryption = require('./crypto/fieldEncryption');
const { safeQuery } = require('../db/pool');
const { logAction } = require('./auditLog');

/**
 * Bank Credentials Service
 * 
 * ONLY authorized service for decrypting bank API credentials.
 * Decryption only occurs for authorized internal operations.
 */

class BankCredentialsService {
  constructor(encryption = fieldEncryption) {
    this.enc = encryption;
  }

  /**
   * Decrypt bank credentials for authorized internal use
   * Only for: payroll disbursement, vendor payments, approved admin operations
   * 
   * @param {string} bankAccountId - UUID of bank account
   * @param {string} staffId - Staff ID requesting access
   * @param {string} reason - Reason for decryption (audit trail)
   * @returns {Promise<Object>} Decrypted credentials
   */
  async getDecryptedCredentials(bankAccountId, staffId, reason) {
    // Authorization check - only finance/admin/owner can decrypt
    const { rows: [staff] } = await safeQuery(
      `SELECT role FROM staff_accounts WHERE id = $1`,
      [staffId]
    );
    
    if (!staff || !['owner', 'admin', 'finance'].includes(staff.role)) {
      throw new Error('Unauthorized: insufficient role for credential decryption');
    }

    const { rows } = await safeQuery(
      `SELECT api_client_id_enc, api_client_secret_enc, api_base_url_enc
       FROM bank_accounts WHERE id = $1`,
      [bankAccountId]
    );

    if (!rows[0]) {
      throw new Error('Bank account not found');
    }

    const row = rows[0];
    const context = { table: 'bank_accounts', recordId: bankAccountId };

    // Check if credentials exist
    if (!row.api_client_id_enc || !row.api_client_secret_enc || !row.api_base_url_enc) {
      throw new Error('Bank credentials not fully encrypted - run backfill first');
    }

    const contextBase = { table: 'bank_accounts', recordId: bankAccountId };

    const credentials = {
      clientId: this.enc.decrypt(row.api_client_id_enc, { ...context, column: 'api_client_id' }),
      clientSecret: this.enc.decrypt(row.api_client_secret_enc, { ...context, column: 'api_client_secret' }),
      baseUrl: this.enc.decrypt(row.api_base_url_enc, { ...context, column: 'api_base_url' })
    };

    // Audit log
    await logAction({
      staffId,
      action: 'bank_credentials.decrypted',
      entity: 'bank_accounts',
      entityId: bankAccountId,
      newValue: { reason, keyId: row.credential_key_id }
    });

    return credentials;
  }

  /**
   * Get masked credentials for UI display
   * Never returns decrypted secrets
   */
  async getMaskedCredentials(bankAccountId) {
    const { rows } = await safeQuery(
      `SELECT 
         RIGHT(api_client_id, 4) AS client_id_last4,
         RIGHT(api_base_url, 20) AS base_url_preview,
         api_client_id_enc IS NOT NULL AS client_id_encrypted,
         api_client_secret_enc IS NOT NULL AS secret_encrypted,
         api_base_url_enc IS NOT NULL AS base_url_encrypted
       FROM bank_accounts WHERE id = $1`,
      [bankAccountId]
    );

    if (!rows[0]) {
      throw new Error('Bank account not found');
    }

    return {
      clientIdLast4: rows[0].client_id_last4 || null,
      baseUrlPreview: rows[0].base_url_preview || null,
      fullyEncrypted: rows[0].client_id_encrypted && rows[0].secret_encrypted && rows[0].base_url_encrypted
    };
  }

  /**
   * Verify all credentials are encrypted (post-backfill validation)
   */
  async verifyAllEncrypted() {
    const { rows } = await safeQuery(`
      SELECT 
        COUNT(*) as total_accounts,
        COUNT(api_client_id_enc) as encrypted_client_id,
        COUNT(api_client_secret_enc) as encrypted_secret,
        COUNT(api_base_url_enc) as encrypted_base_url
      FROM bank_accounts
      WHERE api_client_id IS NOT NULL 
         OR api_client_secret IS NOT NULL 
         OR api_base_url IS NOT NULL
    `);

    const row = rows[0];
    return {
      totalAccounts: parseInt(row.total_accounts),
      encryptedClientId: parseInt(row.encrypted_client_id),
      encryptedSecret: parseInt(row.encrypted_secret),
      encryptedBaseUrl: parseInt(row.encrypted_base_url),
      fullyEncrypted: parseInt(row.total_accounts) === parseInt(row.encrypted_client_id) &&
                       parseInt(row.total_accounts) === parseInt(row.encrypted_secret) &&
                       parseInt(row.total_accounts) === parseInt(row.encrypted_base_url)
    };
  }
}

module.exports = { BankCredentialsService };