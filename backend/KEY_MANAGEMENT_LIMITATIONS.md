# Key Management Implementation - Current Limitations

## Current Implementation

The encryption service (`services/crypto/fieldEncryption.js`) uses a **versioned AES-256-GCM keyring** loaded from environment variables:

### Key Loading (`createFromEnv()`)
- Reads `FIELD_ENC_KEY_ACTIVE` for active key ID
- Reads `FIELD_ENC_KEY_<KEYID>` for each key (64-char hex = 32 bytes = 256 bits)
- No external key management system integration
- Keys stored as plaintext in process environment

### Keyring Structure
```javascript
{
  keyring: Map<keyId, { key: Buffer, metadata: Object }>,
  activeKeyId: string,
  allowedVersions: string[]
}
```

### Operations Supported
- `encrypt(plaintext, context)` - returns envelope `v1:<keyId>:<nonce>:<ciphertext+tag>`
- `decrypt(envelope, context)` - validates AAD, returns plaintext
- `rotateKey(newKeyId, newKeyHex)` - adds key, sets as active
- `revokeKey(keyId)` - marks key as revoked (cannot decrypt)
- `reencrypt(envelope, newKeyId)` - decrypts with old key, encrypts with new
- `getStatus()` - returns keyring info for inspection

## Real Limitations (Not Production-Ready)

### 1. No Hardware Security Module (HSM) / KMS Integration
- Keys exist in process memory as `Buffer` objects
- No integration with AWS KMS, Azure Key Vault, HashiCorp Vault, Google Cloud KMS
- No hardware-backed key generation or storage
- Keys vulnerable to memory dumps, core dumps, swap files

### 2. No Key Rotation Automation
- Manual `rotateKey()` call required
- No scheduled rotation policy enforcement
- No automatic re-encryption of existing data
- No integration with certificate management systems

### 3. No Audit Trail for Key Operations
- Key creation, rotation, revocation not logged to immutable audit store
- No tamper-evident key operation log
- No separation of duties (same process manages and uses keys)

### 4. No Key Backup / Recovery Procedure
- No key export mechanism for secure backup
- No key import from backup
- No disaster recovery plan for key loss
- Loss of active key = loss of all encrypted data

### 5. Environment Variable Security Risks
- Keys visible in process list (`ps auxe`)
- Keys in container inspect (`docker inspect`)
- Keys in CI/CD logs if not masked
- No secret rotation without process restart
- No secret versioning in environment

### 6. Single-Process Architecture
- Keyring not shared across processes/instances
- No distributed key synchronization
- Horizontal scaling requires identical env vars on all instances

### 7. No Key Hierarchy / Envelope Encryption
- Uses master keys directly for data encryption (not KEK/DEK)
- No per-field data encryption keys wrapped by key encryption keys
- Cannot rotate master key without re-encrypting all data
- Large blast radius if master key compromised

## Required for Production

### Minimum Viable Production Key Management
1. **External KMS Provider** (choose one based on deployment):
   - AWS KMS (if on AWS)
   - Azure Key Vault (if on Azure)
   - HashiCorp Vault (self-hosted, cloud-agnostic)
   - Google Cloud KMS (if on GCP)

2. **Key Hierarchy**:
   - Master Key (KEK) in KMS - never leaves HSM
   - Data Encryption Keys (DEK) generated per-field or per-batch, wrapped by KEK
   - DEKs stored encrypted alongside ciphertext

3. **Key Operations API**:
   ```javascript
   interface KeyProvider {
     generateDEK(): Promise<{ plaintext: Buffer, wrapped: Buffer }>;
     unwrapDEK(wrapped: Buffer): Promise<Buffer>;
     rotateKEK(): Promise<void>;
     getKeyStatus(keyId: string): Promise<KeyStatus>;
   }
   ```

4. **Audit Logging**:
   - All key operations to append-only audit log
   - Key access logged with principal, purpose, timestamp
   - Immutable storage (WORM)

5. **Backup/Recovery**:
   - Automated KEK backup to secure offline storage
   - Tested restore procedure
   - Key escrow for compliance

### Integration Points
The `FieldEncryption` class is designed for provider abstraction:
```javascript
// Current: direct AES-GCM with master keys
// Future: 
class FieldEncryption {
  constructor(keyProvider) {
    this.keyProvider = keyProvider; // KMS client
  }
  async encrypt(plaintext, context) {
    const { plaintext: dek, wrapped } = await this.keyProvider.generateDEK();
    const envelope = aesGcmEncrypt(plaintext, dek, context);
    return { ...envelope, wrappedDek: wrapped };
  }
  async decrypt(envelope, context) {
    const dek = await this.keyProvider.unwrapDEK(envelope.wrappedDek);
    return aesGcmDecrypt(envelope, dek, context);
  }
}
```

## What NOT to Do

❌ **Do not** create a fake Vault/KMS wrapper that just reads from environment variables and calls it "secure key management"

❌ **Do not** revoke old keys or delete plaintext source fields without:
- Tested recovery procedure
- Verified encrypted reads work with new keys
- Complete backup of all encrypted data
- Explicit Finance and Security lead approval

❌ **Do not** implement key rotation without:
- Re-encryption job that can resume from failure
- Verification that all data decrypts correctly post-rotation
- Rollback plan

## Migration Path (When Provider Selected)

1. Add provider abstraction interface to `FieldEncryption`
2. Implement chosen provider (Vault/KMS client)
3. Run dual-write period (encrypt with both old and new)
4. Backfill re-encryption using existing `encryptionBackfill.js` pattern
5. Verify all reads work with new provider
6. Switch active provider
7. Decommission environment variable keys
8. Document and test disaster recovery

## Current Status: DEVELOPMENT ONLY

The current implementation is suitable for:
- Local development
- CI/CD test environments
- Non-production staging with test data

**NOT suitable for:**
- Production data
- Regulated environments
- Any environment requiring compliance (PCI, SOC2, etc.)