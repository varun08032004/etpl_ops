'use strict';

// safeStorage on Windows encrypts with DPAPI, tied to the logged-in Windows
// user — the same mechanism Chrome/Edge use for saved passwords. This is
// what makes "auto-login on boot" safe: the encrypted blob on disk is
// useless to anyone without that Windows account's credentials.

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

function tokenFilePath() {
  return path.join(app.getPath('userData'), 'agent-token.bin');
}

function saveToken(token) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level encryption is unavailable on this machine — cannot store the login token securely.');
  }
  const encrypted = safeStorage.encryptString(token);
  fs.writeFileSync(tokenFilePath(), encrypted);
}

function loadToken() {
  try {
    const encrypted = fs.readFileSync(tokenFilePath());
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(encrypted);
  } catch {
    return null; // no token saved yet, or it's unreadable — either way, show the login screen
  }
}

function clearToken() {
  try {
    fs.unlinkSync(tokenFilePath());
  } catch {
    // already gone — fine
  }
}

module.exports = { saveToken, loadToken, clearToken };
