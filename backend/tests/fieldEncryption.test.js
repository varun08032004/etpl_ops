'use strict';

const { FieldEncryption, EncryptionError, createFromEnv } = require('../services/crypto/fieldEncryption');
const crypto = require('crypto');

describe('FieldEncryption Service', () => {
  let encryption;
  let testKeyId = 'test-key-1';
  let testKeyHex;
  let context = {
    table: 'employees',
    column: 'bank_account_number',
    recordId: 'emp-123-uuid'
  };

  beforeAll(() => {
    // Generate a test key (32 bytes = 64 hex chars)
    testKeyHex = crypto.randomBytes(32).toString('hex');
    
    encryption = new FieldEncryption({
      activeKeyId: testKeyId,
      keys: { [testKeyId]: testKeyHex }
    });
  });

  describe('1. Basic encrypt/decrypt round-trip', () => {
    test('encrypts and decrypts synthetic string', () => {
      const plaintext = 'EMP-BANK-ACC-9876543210';
      const envelope = encryption.encrypt(plaintext, context);
      const decrypted = encryption.decrypt(envelope, context);
      expect(decrypted).toBe(plaintext);
    });

    test('encrypts and decrypts empty string', () => {
      const plaintext = '';
      const envelope = encryption.encrypt(plaintext, context);
      const decrypted = encryption.decrypt(envelope, context);
      expect(decrypted).toBe('');
    });

    test('encrypts and decrypts Unicode strings', () => {
      const testCases = [
        'Hello 世界',
        'Bengali: বাংলা',
        'Hindi: हिन्दी',
        'Tamil: தமிழ்',
        'Emoji: 🏦💰🔐',
        'Mixed: Account-123_账户',
        'Special chars: \'";<>\\'
      ];
      
      for (const plaintext of testCases) {
        const envelope = encryption.encrypt(plaintext, context);
        const decrypted = encryption.decrypt(envelope, context);
        expect(decrypted).toBe(plaintext);
      }
    });

    test('encrypts and decrypts long strings', () => {
      const plaintext = 'A'.repeat(10000); // 10KB string
      const envelope = encryption.encrypt(plaintext, context);
      const decrypted = encryption.decrypt(envelope, context);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('2. Nonce uniqueness — same plaintext produces different ciphertexts', () => {
    test('multiple encryptions of same plaintext produce different envelopes', () => {
      const plaintext = 'SAME-PLAINTEXT-VALUE';
      const envelopes = new Set();
      
      for (let i = 0; i < 100; i++) {
        const envelope = encryption.encrypt(plaintext, context);
        envelopes.add(envelope);
      }
      
      // All 100 should be unique (extremely high probability with 96-bit nonce)
      expect(envelopes.size).toBe(100);
    });

    test('all envelopes decrypt to same plaintext', () => {
      const plaintext = 'CONSISTENT-PLAINTEXT';
      const envelopes = [];
      
      for (let i = 0; i < 10; i++) {
        envelopes.push(encryption.encrypt(plaintext, context));
      }
      
      for (const envelope of envelopes) {
        const decrypted = encryption.decrypt(envelope, context);
        expect(decrypted).toBe(plaintext);
      }
    });
  });

  describe('3. Tamper detection — modified ciphertext rejected', () => {
    test('flipping ciphertext byte causes decryption failure', () => {
      const plaintext = 'TAMPER-TEST-VALUE';
      const envelope = encryption.encrypt(plaintext, context);
      
      // Parse envelope and tamper with ciphertext
      const parts = envelope.split(':');
      const ciphertextWithTag = Buffer.from(parts[3], 'base64');
      const tampered = Buffer.from(ciphertextWithTag);
      tampered[0] ^= 0xFF; // Flip first byte
      parts[3] = tampered.toString('base64');
      const tamperedEnvelope = parts.join(':');
      
      expect(() => encryption.decrypt(tamperedEnvelope, context))
        .toThrowError();
    });

    test('truncating ciphertext causes failure', () => {
      const plaintext = 'TRUNCATE-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      const parts = envelope.split(':');
      const ciphertextWithTag = Buffer.from(parts[3], 'base64');
      const truncated = ciphertextWithTag.subarray(0, -1);
      parts[3] = truncated.toString('base64');
      const truncatedEnvelope = parts.join(':');
      
      expect(() => encryption.decrypt(truncatedEnvelope, context))
        .toThrowError();
    });

    test('modifying authentication tag causes failure', () => {
      const plaintext = 'TAG-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      const parts = envelope.split(':');
      const ciphertextWithTag = Buffer.from(parts[3], 'base64');
      const tampered = Buffer.from(ciphertextWithTag);
      tampered[tampered.length - 1] ^= 0xFF; // Flip last byte (part of tag)
      parts[3] = tampered.toString('base64');
      const tamperedEnvelope = parts.join(':');
      
      expect(() => encryption.decrypt(tamperedEnvelope, context))
        .toThrowError();
    });

    test('modifying nonce causes failure', () => {
      const plaintext = 'NONCE-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      const parts = envelope.split(':');
      const nonce = Buffer.from(parts[2], 'base64');
      const tamperedNonce = Buffer.from(nonce);
      tamperedNonce[0] ^= 0xFF;
      parts[2] = tamperedNonce.toString('base64');
      const tamperedEnvelope = parts.join(':');
      
      expect(() => encryption.decrypt(tamperedEnvelope, context))
        .toThrowError();
    });

    test('modifying envelope version causes failure', () => {
      const plaintext = 'VERSION-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      const tamperedEnvelope = 'v2:' + envelope.slice(2); // Change v1 to v2
      
      expect(() => encryption.decrypt(tamperedEnvelope, context))
        .toThrowError();
    });

    test('modifying key ID in envelope causes failure', () => {
      const plaintext = 'KEYID-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      const parts = envelope.split(':');
      parts[1] = 'different-key-id';
      const tamperedEnvelope = parts.join(':');
      
      expect(() => encryption.decrypt(tamperedEnvelope, context))
        .toThrowError();
    });
  });

  describe('4. AAD binding — ciphertext cannot be decrypted under different context', () => {
    test('different table rejects decryption', () => {
      const plaintext = 'AAD-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      
      const wrongContext = { ...context, table: 'wrong_table' };
      expect(() => encryption.decrypt(envelope, wrongContext))
        .toThrowError();
    });

    test('different column rejects decryption', () => {
      const plaintext = 'AAD-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      
      const wrongContext = { ...context, column: 'wrong_column' };
      expect(() => encryption.decrypt(envelope, wrongContext))
        .toThrowError();
    });

    test('different recordId rejects decryption', () => {
      const plaintext = 'AAD-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      
      const wrongContext = { ...context, recordId: 'different-record-id' };
      expect(() => encryption.decrypt(envelope, wrongContext))
        .toThrowError();
    });

    test('same context allows decryption', () => {
      const plaintext = 'AAD-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      const decrypted = encryption.decrypt(envelope, context);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('5. Wrong key rejection', () => {
    test('decryption with wrong key fails', () => {
      const wrongKeyHex = crypto.randomBytes(32).toString('hex');
      
      const encryption2 = new FieldEncryption({
        activeKeyId: 'wrong-key',
        keys: { 'wrong-key': wrongKeyHex }
      });
      
      const plaintext = 'WRONG-KEY-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      
      expect(() => encryption2.decrypt(envelope, context))
        .toThrowError();
    });

    test('decryption with unknown key ID fails', () => {
      const plaintext = 'UNKNOWN-KEY-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      const parts = envelope.split(':');
      parts[1] = 'unknown-key-id';
      const tamperedEnvelope = parts.join(':');
      
      expect(() => encryption.decrypt(tamperedEnvelope, context))
        .toThrowError();
    });
  });

  describe('6. Configuration validation — fail closed on missing/malformed keys', () => {
    test('constructor throws with no active key', () => {
      expect(() => new FieldEncryption({}))
        .toThrowError();
    });

    test('constructor throws with invalid key length', () => {
      expect(() => new FieldEncryption({
        activeKeyId: 'bad-key',
        keys: { 'bad-key': 'short' }
      })).toThrowError();
    });

    test('constructor throws with non-hex key', () => {
      expect(() => new FieldEncryption({
        activeKeyId: 'bad-key',
        keys: { 'bad-key': 'not-hex-characters!!!' }
      })).toThrowError();
    });

    test('constructor throws with unknown active key ID', () => {
      expect(() => new FieldEncryption({
        activeKeyId: 'unknown',
        keys: { 'known': 'a'.repeat(64) }
      })).toThrowError();
    });

    test('encrypt throws when no active key', () => {
      const enc = new FieldEncryption({
        activeKeyId: 'key1',
        keys: { 'key1': 'a'.repeat(64) }
      });
      enc.activeKeyId = null;
      expect(() => enc.encrypt('test', context))
        .toThrowError();
    });

    test('addKey validates key format', () => {
      const enc = new FieldEncryption({
        activeKeyId: 'key1',
        keys: { 'key1': 'a'.repeat(64) }
      });
      expect(() => enc.addKey('bad', 'short')).toThrowError();
      expect(() => enc.addKey('bad', 'not-hex!!!')).toThrowError();
    });
  });

  describe('7. Unsupported envelope versions rejected', () => {
    test('v2 envelope rejected', () => {
      const plaintext = 'VERSION-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      const tampered = 'v2:' + envelope.slice(2);
      
      expect(() => encryption.decrypt(tampered, context))
        .toThrowError();
    });

    test('v0 envelope rejected', () => {
      const plaintext = 'VERSION-TEST';
      const envelope = encryption.encrypt(plaintext, context);
      const tampered = 'v0:' + envelope.slice(2);
      
      expect(() => encryption.decrypt(tampered, context))
        .toThrowError();
    });

    test('malformed envelope format rejected', () => {
      expect(() => encryption.decrypt('not-an-envelope', context))
        .toThrowError();
      
      expect(() => encryption.decrypt('v1:keyid:only-three-parts', context))
        .toThrowError();
    });
  });

  // ============================================================
  // KEY ROTATION TESTS
  // ============================================================
  describe('8. Key rotation — old-key decryption and new-key re-encryption', () => {
    let rotationEncryption;
    let rotationContext;
    let rotationTestKeyId;
    let rotationTestKeyHex;

    beforeEach(() => {
      rotationTestKeyId = 'rotation-key-1';
      rotationTestKeyHex = crypto.randomBytes(32).toString('hex');
      rotationContext = {
        table: 'employees',
        column: 'bank_account_number',
        recordId: 'emp-123-uuid'
      };
      rotationEncryption = new FieldEncryption({
        activeKeyId: rotationTestKeyId,
        keys: { [rotationTestKeyId]: rotationTestKeyHex }
      });
    });

    test('rotateKey adds new key and sets as active', () => {
      const newKeyHex = crypto.randomBytes(32).toString('hex');
      
      const result = rotationEncryption.rotateKey('rotation-key-2', newKeyHex, { reason: 'scheduled rotation' });
      
      expect(result.newKeyId).toBe('rotation-key-2');
      expect(result.previousActiveKeyId).toBe(rotationTestKeyId);
      expect(rotationEncryption.activeKeyId).toBe('rotation-key-2');
      expect(rotationEncryption.keyring.size).toBe(2);
      expect(rotationEncryption.keyring.has(rotationTestKeyId)).toBe(true);
    });

    test('old key still decrypts data encrypted before rotation', () => {
      const rotationKeyHex = crypto.randomBytes(32).toString('hex');
      
      const plaintext = 'ROTATION-TEST';
      const envelope = rotationEncryption.encrypt(plaintext, rotationContext); // encrypted with key-1
      
      rotationEncryption.rotateKey('rotation-key-2', rotationKeyHex);
      
      // Old envelope should still decrypt with old key
      const decrypted = rotationEncryption.decrypt(envelope, rotationContext);
      expect(decrypted).toBe(plaintext);
    });

    test('reencrypt migrates envelope to new key', () => {
      const plaintext = 'REENCRYPT-TEST';
      const envelope = rotationEncryption.encrypt(plaintext, rotationContext); // encrypted with key-1
      
      const rotationKeyHex = crypto.randomBytes(32).toString('hex');
      rotationEncryption.rotateKey('rotation-key-2', rotationKeyHex);
      
      // Re-encrypt with new active key
      const newEnvelope = rotationEncryption.reencrypt(envelope, rotationContext);
      
      // New envelope should decrypt with new active key
      const decrypted = rotationEncryption.decrypt(newEnvelope, rotationContext);
      expect(decrypted).toBe(plaintext);
      
      // New envelope should use new key ID
      expect(newEnvelope.startsWith('v1:rotation-key-2:')).toBe(true);
    });

    test('old key still works after rotation for decryption', () => {
      const plaintext = 'OLD-KEY-STILL-WORKS';
      const envelope = rotationEncryption.encrypt(plaintext, rotationContext);
      
      const rotationKeyHex = crypto.randomBytes(32).toString('hex');
      rotationEncryption.rotateKey('rotation-key-2', rotationKeyHex);
      
      // Force decryption with old key by using the old envelope
      const decrypted = rotationEncryption.decrypt(envelope, rotationContext);
      expect(decrypted).toBe(plaintext);
    });

    test('cannot rotate to existing key ID', () => {
      expect(() => rotationEncryption.rotateKey(rotationTestKeyId, 'a'.repeat(64)))
        .toThrowError();
    });
  });

  describe('8. Unknown/retired key IDs fail safely', () => {
    let rotationEncryption;
    let rotationContext;
    let rotationTestKeyId;
    let rotationTestKeyHex;

    beforeEach(() => {
      rotationTestKeyId = 'rotation-key-1';
      rotationTestKeyHex = crypto.randomBytes(32).toString('hex');
      rotationContext = {
        table: 'employees',
        column: 'bank_account_number',
        recordId: 'emp-123-uuid'
      };
      rotationEncryption = new FieldEncryption({
        activeKeyId: rotationTestKeyId,
        keys: { [rotationTestKeyId]: rotationTestKeyHex }
      });
    });

    test('revoked key cannot decrypt', () => {
      const envelope = rotationEncryption.encrypt('REVOKE-TEST', rotationContext);
      
      // Revoke the active key
      rotationEncryption.revokeKey(rotationTestKeyId);
      
      expect(() => rotationEncryption.decrypt(envelope, rotationContext))
        .toThrowError();
    });

    test('key ID not in keyring fails', () => {
      const envelope = rotationEncryption.encrypt('UNKNOWN-KEY', rotationContext);
      const parts = envelope.split(':');
      parts[1] = 'definitely-not-a-key-id';
      const tampered = parts.join(':');
      
      expect(() => rotationEncryption.decrypt(tampered, rotationContext))
        .toThrowError();
    });
  });

  describe('9. Malformed envelopes do not crash or leak', () => {
    let rotationEncryption;
    let rotationContext;
    let rotationTestKeyId;
    let rotationTestKeyHex;

    beforeEach(() => {
      rotationTestKeyId = 'rotation-key-1';
      rotationTestKeyHex = crypto.randomBytes(32).toString('hex');
      rotationContext = {
        table: 'employees',
        column: 'bank_account_number',
        recordId: 'emp-123-uuid'
      };
      rotationEncryption = new FieldEncryption({
        activeKeyId: rotationTestKeyId,
        keys: { [rotationTestKeyId]: rotationTestKeyHex }
      });
    });

    test('null input throws clear error', () => {
      expect(() => rotationEncryption.decrypt(null, rotationContext))
        .toThrowError();
    });

    test('undefined input throws clear error', () => {
      expect(() => rotationEncryption.decrypt(undefined, rotationContext))
        .toThrowError();
    });

    test('empty string throws clear error', () => {
      expect(() => rotationEncryption.decrypt('', rotationContext))
        .toThrowError();
    });

    test('invalid base64 in nonce throws clear error', () => {
      const envelope = 'v1:keyid:not-base64!:ciphertext';
      expect(() => rotationEncryption.decrypt(envelope, rotationContext))
        .toThrowError();
    });

    test('invalid base64 in ciphertext throws clear error', () => {
      const envelope = 'v1:keyid:nonce-base64:not-base64!';
      expect(() => rotationEncryption.decrypt(envelope, rotationContext))
        .toThrowError();
    });

    test('ciphertext too short throws clear error', () => {
      const envelope = 'v1:keyid:' + Buffer.from('a').toString('base64') + ':' + Buffer.from('x').toString('base64');
      expect(() => rotationEncryption.decrypt(envelope, rotationContext))
        .toThrowError();
    });

    test('error messages do not contain plaintext or key material', () => {
      const plaintext = 'SENSITIVE-DATA-NEVER-IN-ERRORS';
      const envelope = rotationEncryption.encrypt(plaintext, rotationContext);
      const parts = envelope.split(':');
      const tampered = Buffer.from(parts[3], 'base64');
      tampered[0] ^= 0xFF;
      parts[3] = tampered.toString('base64');
      const tamperedEnvelope = parts.join(':');
      
      try {
        rotationEncryption.decrypt(tamperedEnvelope, rotationContext);
      } catch (e) {
        expect(e.message).not.toContain(plaintext);
        expect(e.message).not.toContain('SENSITIVE');
      }
    });
  });

  describe('10. Unsupported envelope versions', () => {
    test('constructor rejects unsupported version config', () => {
      expect(() => new FieldEncryption({
        activeKeyId: 'k',
        keys: { k: 'a'.repeat(64) },
        allowedVersions: ['v999']
      })).toThrowError();
    });
  });

  describe('11. Empty string handling', () => {
    let rotationEncryption;
    let rotationContext;
    let rotationTestKeyId;
    let rotationTestKeyHex;

    beforeEach(() => {
      rotationTestKeyId = 'rotation-key-1';
      rotationTestKeyHex = crypto.randomBytes(32).toString('hex');
      rotationContext = {
        table: 'employees',
        column: 'bank_account_number',
        recordId: 'emp-123-uuid'
      };
      rotationEncryption = new FieldEncryption({
        activeKeyId: rotationTestKeyId,
        keys: { [rotationTestKeyId]: rotationTestKeyHex }
      });
    });

    test('empty string encrypts and decrypts correctly', () => {
      const envelope = rotationEncryption.encrypt('', rotationContext);
      const decrypted = rotationEncryption.decrypt(envelope, rotationContext);
      expect(decrypted).toBe('');
    });

    test('isEmptyEnvelope detects empty', () => {
      const envelope = rotationEncryption.encrypt('', rotationContext);
      expect(rotationEncryption.isEmptyEnvelope(envelope, rotationContext)).toBe(true);
    });

    test('non-empty string is not detected as empty', () => {
      const envelope = rotationEncryption.encrypt('not-empty', rotationContext);
      expect(rotationEncryption.isEmptyEnvelope(envelope, rotationContext)).toBe(false);
    });
  });

  describe('12. Error messages do not leak sensitive data', () => {
    let rotationEncryption;
    let rotationContext;
    let rotationTestKeyId;
    let rotationTestKeyHex;

    beforeEach(() => {
      rotationTestKeyId = 'rotation-key-1';
      rotationTestKeyHex = crypto.randomBytes(32).toString('hex');
      rotationContext = {
        table: 'employees',
        column: 'bank_account_number',
        recordId: 'emp-123-uuid'
      };
      rotationEncryption = new FieldEncryption({
        activeKeyId: rotationTestKeyId,
        keys: { [rotationTestKeyId]: rotationTestKeyHex }
      });
    });

    test('decryption errors do not contain plaintext', () => {
      const plaintext = 'SECRET-PLAINTEXT-VALUE';
      const envelope = rotationEncryption.encrypt(plaintext, rotationContext);
      const parts = envelope.split(':');
      const tampered = Buffer.from(parts[3], 'base64');
      tampered[0] ^= 0xFF;
      parts[3] = tampered.toString('base64');
      const tamperedEnvelope = parts.join(':');
      
      try {
        rotationEncryption.decrypt(tamperedEnvelope, rotationContext);
      } catch (e) {
        expect(e.message).not.toContain(plaintext);
        expect(e.message).not.toContain('SENSITIVE');
      }
    });

    test('key material not in errors', () => {
      try {
        rotationEncryption.decrypt('v1:key:nonce:ciphertext', rotationContext);
      } catch (e) {
        expect(e.message).not.toContain(rotationTestKeyHex);
      }
    });
  });

  describe('13. Status and keyring inspection', () => {
    let rotationEncryption;
    let rotationContext;
    let rotationTestKeyId;
    let rotationTestKeyHex;

    beforeEach(() => {
      rotationTestKeyId = 'rotation-key-1';
      rotationTestKeyHex = crypto.randomBytes(32).toString('hex');
      rotationContext = {
        table: 'employees',
        column: 'bank_account_number',
        recordId: 'emp-123-uuid'
      };
      rotationEncryption = new FieldEncryption({
        activeKeyId: rotationTestKeyId,
        keys: { [rotationTestKeyId]: rotationTestKeyHex }
      });
    });

    test('getStatus returns keyring info', () => {
      const status = rotationEncryption.getStatus();
      
      expect(status.activeKeyId).toBe(rotationTestKeyId);
      expect(status.keyCount).toBe(1);
      expect(status.keys).toHaveLength(1);
      expect(status.keys[0].keyId).toBe(rotationTestKeyId);
      expect(status.keys[0].active).toBe(true);
    });

    test('multiple keys tracked correctly', () => {
      rotationEncryption.rotateKey('key-2', crypto.randomBytes(32).toString('hex'));
      rotationEncryption.rotateKey('key-3', crypto.randomBytes(32).toString('hex'));
      
      const status = rotationEncryption.getStatus();
      expect(status.keyCount).toBe(3);
      expect(status.keys.filter(k => k.active).length).toBe(1);
    });
  });

  describe('14. Envelope format validation', () => {
    let rotationEncryption;
    let rotationContext;
    let rotationTestKeyId;
    let rotationTestKeyHex;

    beforeEach(() => {
      rotationTestKeyId = 'rotation-key-1';
      rotationTestKeyHex = crypto.randomBytes(32).toString('hex');
      rotationContext = {
        table: 'employees',
        column: 'bank_account_number',
        recordId: 'emp-123-uuid'
      };
      rotationEncryption = new FieldEncryption({
        activeKeyId: rotationTestKeyId,
        keys: { [rotationTestKeyId]: rotationTestKeyHex }
      });
    });

    test('envelope has correct structure', () => {
      const envelope = rotationEncryption.encrypt('FORMAT-TEST', rotationContext);
      const parts = envelope.split(':');
      
      expect(parts.length).toBe(4);
      expect(parts[0]).toBe('v1');
      expect(parts[1]).toBe(rotationTestKeyId);
      expect(parts[2].length).toBeGreaterThan(0); // nonce base64
      expect(parts[3].length).toBeGreaterThan(0); // ciphertext base64
    });

    test('nonce is 12 bytes (base64 = 16 chars)', () => {
      const envelope = rotationEncryption.encrypt('NONCE-LENGTH', rotationContext);
      const nonceB64 = envelope.split(':')[2];
      const nonce = Buffer.from(nonceB64, 'base64');
      expect(nonce.length).toBe(12);
    });

    test('tag is 16 bytes', () => {
      const envelope = rotationEncryption.encrypt('TAG-LENGTH', rotationContext);
      const ciphertextB64 = envelope.split(':')[3];
      const ciphertextWithTag = Buffer.from(ciphertextB64, 'base64');
      expect(ciphertextWithTag.length).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Integration with createFromEnv', () => {
    test('createFromEnv reads keys from environment', () => {
      const testKey1 = crypto.randomBytes(32).toString('hex');
      const testKey2 = crypto.randomBytes(32).toString('hex');
      
      process.env.FIELD_ENC_KEY_ACTIVE = 'env-key-1';
      process.env['FIELD_ENC_KEY_env-key-1'] = 'a'.repeat(64);
      process.env['FIELD_ENC_KEY_env-key-2'] = 'b'.repeat(64);
      
      const enc = createFromEnv();
      expect(enc.activeKeyId).toBe('env-key-1');
      expect(enc.keyring.size).toBe(2);
      
      // Cleanup
      delete process.env.FIELD_ENC_KEY_ACTIVE;
      delete process.env['FIELD_ENC_KEY_env-key-1'];
      delete process.env['FIELD_ENC_KEY_env-key-2'];
    });

    test('createFromEnv fails gracefully without config', () => {
      delete process.env.FIELD_ENC_KEY_ACTIVE;
      delete process.env.FIELD_ENC_KEY_test;
      
      expect(() => createFromEnv()).toThrowError(EncryptionError);
    });
  });
});

/**
 * Run tests and output summary
 */
if (require.main === module) {
  const { run } = require('jest');
  
  run(['--testPathPattern=fieldEncryption', '--verbose', '--no-coverage'])
    .then(result => {
      console.log('\n=== TEST RUN COMPLETE ===');
      console.log(`Tests: ${result.numTotalTests}`);
      console.log(`Passed: ${result.numPassedTests}`);
      console.log(`Failed: ${result.numFailedTests}`);
      process.exit(result.numFailedTests > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}