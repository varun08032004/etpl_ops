'use strict';

const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const ALGO = 'aes-256-gcm';

/**
 * two_fa_secret is stored ENCRYPTED, not as plaintext base32. A raw TOTP
 * secret in the database is equivalent to a permanent, unrotatable
 * password for that account — anyone who reads the DB (backup leak,
 * compromised replica, malicious insider with read access) could
 * generate valid codes forever. Encrypting it means a DB leak alone
 * isn't enough; the attacker also needs TWO_FA_ENCRYPTION_KEY, which
 * lives only in server env, never in the database.
 *
 * Generate the key once with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * and set it as TWO_FA_ENCRYPTION_KEY in your .env. Losing this key means
 * every enrolled account's 2FA secret becomes undecryptable — keep it in
 * your password manager / secrets store, not just the .env file.
 */
function getKey() {
  const keyHex = process.env.TWO_FA_ENCRYPTION_KEY;
  if (!keyHex) throw new Error('TWO_FA_ENCRYPTION_KEY is not set');
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('TWO_FA_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  return key;
}

function encryptSecret(plainBase32) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainBase32, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), encrypted.toString('hex'), tag.toString('hex')].join(':');
}

function decryptSecret(stored) {
  const [ivHex, dataHex, tagHex] = stored.split(':');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

function generateSecret(email) {
  return speakeasy.generateSecret({ name: `EtherTrack ERP (${email})`, length: 20 });
}

async function generateQrCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

function verifyTotp(secretBase32, token) {
  if (!token) return false;
  // window: 1 allows the previous/next 30s step too, to tolerate normal
  // clock drift between the phone and server without weakening the code
  // length or step interval.
  return speakeasy.totp.verify({ secret: secretBase32, encoding: 'base32', token: String(token).trim(), window: 1 });
}

function generateBackupCodes(count = 8) {
  // 10-char hex codes, shown once at enrollment — each one is single-use
  // account recovery if the phone with the authenticator app is lost.
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex'));
}

function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}

module.exports = {
  encryptSecret, decryptSecret, generateSecret, generateQrCodeDataUrl,
  verifyTotp, generateBackupCodes, hashBackupCode,
};