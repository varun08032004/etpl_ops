/**
 * Key Management Module
 * Handles key generation, rotation, storage, and lifecycle management
 */

'use strict';

const crypto = require('crypto');

/**
 * Key types and their specifications
 */
const KEY_SPECS = {
  // JWT secrets
  jwt_signing: { 
    algorithm: 'HS256', 
    keySize: 32, 
    rotationDays: 90,
    description: 'JWT signing key (HS256)'
  },
  jwt_refresh: {
    algorithm: 'HS256',
    keySize: 32,
    rotationDays: 90,
    description: 'Refresh token signing'
  },
  
  // Encryption keys
  encryption_2fa: {
    algorithm: 'AES-256-GCM',
    keySize: 32,
    rotationDays: 365,
    description: '2FA encryption (AES-256-GCM)'
  },
  
  // Platform sync tokens
  platform_sync: {
    algorithm: 'HS256',
    keySize: 32,
    rotationDays: 180,
    description: 'Platform sync service token'
  },
  platform_corporate_write: {
    algorithm: 'HS256',
    keySize: 32,
    rotationDays: 180,
    description: 'Platform corporate write token'
  },
  platform_coupon_write: {
    algorithm: 'HS256',
    keySize: 32,
    rotationDays: 180,
    description: 'Platform coupon write token'
  },
  platform_pricing_write: {
    algorithm: 'HS256',
    keySize: 32,
    rotationDays: 180,
    description: 'Platform pricing write token'
  },
  
  // External service keys (managed externally)
  external_services: {
    resend_api_key: { external: true, description: 'Resend email API key' },
    resend_from_email: { external: true, description: 'Resend from email' },
    nvidia_api_key: { external: true, description: 'NVIDIA API key' },
    openai_api_key: { external: true, description: 'OpenAI or Ollama API key' },
    nvidia_api_key: { external: true, description: 'NVIDIA API key' },
    razorpay_key_id: { external: true, description: 'RazorpayX key ID' },
    razorpay_key_secret: { external: true, description: 'RazorpayX key secret' },
    razorpay_account_number: { external: true, description: 'RazorpayX account number' },
    razorpay_webhook_secret: { external: true, description: 'RazorpayX webhook secret' },
    trackpilot_api_key: { external: true, description: 'TrackPilot API key' },
    trackpilots_webhook_secret: { external: true, description: 'TrackPilots webhook secret' }
  }
};

/**
 * Generate a new key
 * @param {number} bytes - Number of bytes
 * @returns {string} Hex encoded key
 */
function generateKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a key pair for asymmetric encryption (if needed)
 * @returns {Object} { publicKey, privateKey }
 */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

/**
 * Key storage interface
 * In production, this would use a proper secret manager (Vault, AWS Secrets Manager, etc.)
 */
class KeyStore {
  constructor() {
    this.keys = new Map();
    this.metadata = new Map();
  }
  
  /**
   * Store a key
   * @param {string} keyId - Key identifier
   * @param {string} key - The key material
   * @param {Object} metadata - Key metadata
   */
  set(keyId, key, metadata = {}) {
    this.keys.set(keyId, key);
    this.metadata.set(keyId, {
      ...metadata,
      createdAt: new Date().toISOString(),
      version: (this.metadata.get(keyId)?.version || 0) + 1
    });
  }
  
  /**
   * Get a key
   * @param {string} keyId - Key identifier
   * @returns {string|null} The key material or null if not found
   */
  get(keyId) {
    return this.keys.get(keyId) || null;
  }
  
  /**
   * Get key metadata
   * @param {string} keyId - Key identifier
   * @returns {Object|null} Key metadata
   */
  getMetadata(keyId) {
    return this.metadata.get(keyId) || null;
  }
  
  /**
   * Rotate a key
   * @param {string} keyId - Key identifier
   * @param {Object} spec - Key specification
   * @returns {string} New key
   */
  rotate(keyId, spec) {
    const oldKey = this.keys.get(keyId);
    const oldMetadata = this.metadata.get(keyId);
    
    const newKey = crypto.randomBytes(spec.keySize).toString('hex');
    this.set(keyId, newKey, {
      ...oldMetadata,
      rotatedAt: new Date().toISOString(),
      previousKeyId: oldKey ? crypto.createHash('sha256').update(oldKey).digest('hex').substring(0, 16) : null
    });
    
    return newKey;
  }
  
  /**
   * Revoke a key
   * @param {string} keyId - Key identifier
   * @param {string} reason - Revocation reason
   */
  revoke(keyId, reason = 'Manual revocation') {
    const metadata = this.metadata.get(keyId);
    if (metadata) {
      metadata.revoked = true;
      metadata.revokedAt = new Date().toISOString();
      metadata.revocationReason = reason;
      this.metadata.set(keyId, metadata);
    }
    this.keys.delete(keyId);
  }
  
  /**
   * List all keys
   * @returns {Array} Array of key metadata
   */
  list() {
    const keys = [];
    for (const [keyId, metadata] of this.metadata.entries()) {
      keys.push({ keyId, ...metadata, hasKey: this.keys.has(keyId) });
    }
    return keys;
  }
  
  /**
   * Export keys for backup
   * @returns {Object} Exported keys and metadata
   */
  export() {
    const exportData = {};
    for (const [keyId, key] of this.keys.entries()) {
      const metadata = this.metadata.get(keyId) || {};
      exportData[keyId] = {
        key,
        metadata
      };
    }
    return exportData;
  }
}

// Singleton instance
const keyStore = new KeyStore();

/**
 * Initialize key store from environment
 */
function initializeKeyStore() {
  // Load from environment variables
  const envMappings = {
    INTERNAL_OPS_JWT_SECRET: 'jwt_signing',
    INTERNAL_OPS_REFRESH_SECRET: 'jwt_refresh',
    PLATFORM_SYNC_SERVICE_TOKEN: 'platform_sync',
    PLATFORM_SYNC_CORPORATE_WRITE_TOKEN: 'platform_corporate_write',
    PLATFORM_SYNC_COUPON_WRITE_TOKEN: 'platform_coupon_write',
    PLATFORM_SYNC_PRICING_WRITE_TOKEN: 'platform_pricing_write',
    TWO_FA_ENCRYPTION_KEY: 'encryption_2fa'
  };
  
  for (const [envVar, keyId] of Object.entries(envMappings)) {
    const value = process.env[envVar];
    if (value) {
      const spec = KEY_SPECS[keyId] || KEY_SPECS.external_services[envVar.toLowerCase()];
      if (spec && spec.external) return;
      keyStore.set(keyId, value, {
        source: 'environment',
        algorithm: spec.algorithm,
        rotationDays: spec.rotationDays
      });
    }
  }
  
  // Generate missing keys
  for (const [keyId, spec] of Object.entries(KEY_SPECS)) {
    if (!keyStore.get(keyId) && !spec.external) {
      const key = generateKey(spec.keySize);
      keyStore.set(keyId, key, {
        source: 'generated',
        algorithm: spec.algorithm,
        rotationDays: spec.rotationDays
      });
    }
  }
  
  return keyStore;
}

/**
 * Get key rotation schedule
 * @returns {Array} Array of keys with rotation info
 */
function getRotationSchedule() {
  const schedule = [];
  for (const [keyId, metadata] of keyStore.metadata.entries()) {
    if (!metadata.revoked) {
      const createdAt = new Date(metadata.createdAt);
      const rotationDays = metadata.rotationDays || 90;
      const nextRotation = new Date(createdAt.getTime() + rotationDays * 24 * 60 * 60 * 1000);
      const daysUntilRotation = Math.max(0, Math.ceil((nextRotation - Date.now()) / (24 * 60 * 60 * 1000)));
      
      schedule.push({
        keyId,
        algorithm: metadata.algorithm,
        createdAt: metadata.createdAt,
        rotatedAt: metadata.rotatedAt,
        nextRotation,
        daysUntilRotation,
        version: metadata.version,
        revoked: metadata.revoked
      });
    }
  }
  return schedule.sort((a, b) => a.daysUntilRotation - b.daysUntilRotation);
}

/**
 * Rotate a specific key
 * @param {string} keyId - Key identifier
 * @returns {Object} New key information
 */
async function rotateKey(keyId) {
  const spec = KEY_SPECS[keyId];
  if (!spec) {
    throw new Error(`Unknown key: ${keyId}`);
  }
  
  const newKey = keyStore.rotate(keyId, spec);
  return {
    keyId,
    key: keyStore.get(keyId),
    metadata: keyStore.getMetadata(keyId)
  };
}

/**
 * Emergency revoke all keys for a user
 * @param {string} staffId - Staff ID
 */
async function revokeUserKeys(staffId) {
  // This would revoke all refresh tokens for a user
  // Implementation depends on your token storage
}

module.exports = {
  KEY_SPECS,
  generateKey,
  generateKeyPair,
  KeyStore,
  keyStore,
  initializeKeyStore,
  getRotationSchedule,
  rotateKey,
  revokeUserKeys
};