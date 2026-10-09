'use strict';

// Tamper Detection for EtherTrack Agent
// Verifies integrity of critical files and reports anomalies

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');

const TAMPER_STATE_FILE = 'tamper-state.bin';
const CRITICAL_FILES = [
  'main.js',
  'preload.js',
  'api.js',
  'tracker.js',
  'store.js',
  'localServer.js',
  'incognitoLock.js',
  'package.json',
  'config.json',
];

let baselineHashes = null;
let lastVerification = 0;
const VERIFICATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Compute SHA256 hash of a file
function computeFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (e) {
    return null; // File missing or unreadable
  }
}

// Get all critical file paths
function getCriticalFilePaths() {
  // Use __dirname (this file's directory) or process.cwd() as fallback
  const baseDir = __dirname || path.dirname(require.main?.filename || '') || process.cwd();
  const resourcesDir = path.join(baseDir, '..'); // resources directory in packaged app
  
  // In development, files are in src/
  // In production (packaged), files are in resources/app/src/ or resources/app.asar
  const possibleDirs = [
    path.join(baseDir),           // src/ in dev
    path.join(resourcesDir),      // resources/app/ in packaged
    path.join(resourcesDir, 'src'), // resources/app/src/ in packaged
    path.join(baseDir, '..'),     // root in dev
  ];
  
  const results = [];
  for (const relPath of CRITICAL_FILES) {
    for (const dir of possibleDirs) {
      const fullPath = path.join(dir, relPath);
      if (fs.existsSync(fullPath)) {
        results.push({ relPath, fullPath });
        break;
      }
    }
  }
  return results;
}

// Compute baseline hashes for all critical files
function computeBaselineHashes() {
  const hashes = {};
  const files = getCriticalFilePaths();
  
  for (const { relPath, fullPath } of files) {
    const hash = computeFileHash(fullPath);
    if (hash) {
      hashes[relPath] = hash;
    }
  }
  
  // Also hash the main executable itself (if we can find it)
  try {
    const exePath = process.execPath;
    if (fs.existsSync(exePath)) {
      hashes['executable'] = computeFileHash(exePath);
    }
  } catch (e) {
    // Ignore
  }
  
  return hashes;
}

// Save baseline hashes encrypted
function saveBaselineHashes(hashes) {
  try {
    const data = JSON.stringify({ hashes, createdAt: Date.now(), version: require('../package.json').version });
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(data);
      fs.writeFileSync(path.join(app.getPath('userData'), TAMPER_STATE_FILE), encrypted);
    }
    baselineHashes = hashes;
    return true;
  } catch (e) {
    console.error('[tamper] Failed to save baseline:', e.message);
    return false;
  }
}

// Load baseline hashes
function loadBaselineHashes() {
  try {
    const filePath = path.join(app.getPath('userData'), TAMPER_STATE_FILE);
    const encrypted = fs.readFileSync(filePath);
    if (!safeStorage.isEncryptionAvailable()) return null;
    const data = safeStorage.decryptString(encrypted);
    const parsed = JSON.parse(data);
    baselineHashes = parsed.hashes;
    return baselineHashes;
  } catch (e) {
    return null;
  }
}

// Verify current files against baseline
function verifyIntegrity() {
  if (!baselineHashes) {
    return { verified: false, reason: 'No baseline', mismatches: [] };
  }
  
  const currentHashes = computeBaselineHashes();
  const mismatches = [];
  
  // Check for modified files
  for (const [relPath, baselineHash] of Object.entries(baselineHashes)) {
    const currentHash = currentHashes[relPath];
    if (!currentHash) {
      mismatches.push({ file: relPath, type: 'missing', baseline: baselineHash });
    } else if (currentHash !== baselineHash) {
      mismatches.push({ file: relPath, type: 'modified', baseline: baselineHash, current: currentHash });
    }
  }
  
  // Check for new unexpected files (optional - could be updates)
  for (const relPath of Object.keys(currentHashes)) {
    if (!baselineHashes[relPath]) {
      mismatches.push({ file: relPath, type: 'new', current: currentHashes[relPath] });
    }
  }
  
  return {
    verified: mismatches.length === 0,
    mismatches,
    timestamp: Date.now(),
  };
}

// Initialize tamper detection
function initTamperDetection() {
  // Load existing baseline or create new one
  const loaded = loadBaselineHashes();
  if (!loaded) {
    const hashes = computeBaselineHashes();
    saveBaselineHashes(hashes);
    console.log('[tamper] Created new baseline for', Object.keys(hashes).length, 'files');
  } else {
    console.log('[tamper] Loaded baseline for', Object.keys(loaded).length, 'files');
  }
  
  // Run initial verification
  const result = verifyIntegrity();
  if (!result.verified) {
    console.error('[tamper] INTEGRITY CHECK FAILED:', result.mismatches);
    reportTampering(result);
  } else {
    console.log('[tamper] Initial integrity check passed');
  }
  
  // Schedule periodic verification
  setInterval(() => {
    const result = verifyIntegrity();
    if (!result.verified) {
      console.error('[tamper] PERIODIC CHECK FAILED:', result.mismatches);
      reportTampering(result);
    } else {
      console.log('[tamper] Periodic integrity check passed');
    }
  }, VERIFICATION_INTERVAL_MS);
  
  return { verify: verifyIntegrity, baseline: baselineHashes };
}

// Report tampering to backend (async, non-blocking)
async function reportTampering(result) {
  try {
    // This would need the API token - for now just log
    // In production, queue this for the next heartbeat
    console.error('[tamper] TAMPERING DETECTED - would report to backend:', result.mismatches.map(m => m.file).join(', '));
    
    // Could also trigger immediate session stop, alert admin, etc.
  } catch (e) {
    console.error('[tamper] Failed to report tampering:', e.message);
  }
}

// Verify config.json hasn't been tampered with (critical settings)
function verifyConfigIntegrity(expectedConfig) {
  try {
    const configPath = path.join(__dirname, '..', 'config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const criticalKeys = ['apiBaseUrl', 'companyCode', 'localServerPort'];
    for (const key of criticalKeys) {
      if (currentConfig[key] !== expectedConfig[key]) {
        return { valid: false, key, expected: expectedConfig[key], actual: currentConfig[key] };
      }
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

module.exports = { initTamperDetection, verifyIntegrity, verifyConfigIntegrity, computeBaselineHashes };