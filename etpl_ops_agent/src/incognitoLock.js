'use strict';

// Applies (and reverses) incognito/private mode restrictions for Chrome, Edge, and Firefox.
// Uses multiple methods in order of preference:
// 1. Group Policy (gpedit) - for domain-joined machines, most robust
// 2. Registry (HKLM) - for standalone machines, requires UAC
// 3. Registry (HKCU) - fallback for non-admin users, less effective
// 4. Firefox policies.json - for Firefox
//
// State is tracked so turning the dashboard toggle back OFF actually reverts
// the changes — earlier version could only apply, never undo.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { app } = require('electron');

function statePath() {
  return path.join(app.getPath('userData'), 'incognito-restriction-state.json');
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return { applied: false, method: null };
  }
}

function writeState(state) {
  fs.writeFileSync(statePath(), JSON.stringify(state));
}

function isApplied() {
  return readState().applied === true;
}

function runElevated(cmd) {
  const elevateCmd = `powershell -Command "Start-Process cmd -ArgumentList '/c ${cmd.replace(/"/g, '\\"')}' -Verb RunAs -WindowStyle Hidden -Wait"`;
  return new Promise((resolve, reject) => {
    exec(elevateCmd, { timeout: 30000 }, (err) => (err ? reject(err) : resolve()));
  });
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

// Check if machine is domain-joined (Group Policy available)
async function isDomainJoined() {
  try {
    const { stdout } = await runCommand('powershell -Command "(Get-CimInstance -ClassName Win32_ComputerSystem).PartOfDomain"');
    return stdout.trim().toLowerCase() === 'true';
  } catch (e) {
    return false;
  }
}

// Apply via Group Policy (requires domain-joined machine and admin)
async function applyGroupPolicy() {
  try {
    // Use secedit or gpupdate to enforce policies
    // Chrome: Computer Configuration > Administrative Templates > Google > Google Chrome > IncognitoModeAvailability = 1 (Disabled)
    // Edge: Computer Configuration > Administrative Templates > Microsoft Edge > InPrivateModeAvailability = 1 (Disabled)
    
    const chromePolicy = `
      $policyPath = "HKLM:\\SOFTWARE\\Policies\\Google\\Chrome"
      if (-not (Test-Path $policyPath)) { New-Item -Path $policyPath -Force | Out-Null }
      Set-ItemProperty -Path $policyPath -Name "IncognitoModeAvailability" -Value 1 -Type DWord -Force
    `;
    
    const edgePolicy = `
      $policyPath = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge"
      if (-not (Test-Path $policyPath)) { New-Item -Path $policyPath -Force | Out-Null }
      Set-ItemProperty -Path $policyPath -Name "InPrivateModeAvailability" -Value 1 -Type DWord -Force
    `;
    
    await runElevated(`powershell -Command "${chromePolicy}; ${edgePolicy}; gpupdate /force /wait:0"`);
    return true;
  } catch (e) {
    console.error('[incognitoLock] Group Policy apply failed:', e.message);
    return false;
  }
}

// Revert Group Policy
async function revertGroupPolicy() {
  try {
    const chromePolicy = `
      $policyPath = "HKLM:\\SOFTWARE\\Policies\\Google\\Chrome"
      if (Test-Path $policyPath) { Remove-ItemProperty -Path $policyPath -Name "IncognitoModeAvailability" -ErrorAction SilentlyContinue }
    `;
    
    const edgePolicy = `
      $policyPath = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge"
      if (Test-Path $policyPath) { Remove-ItemProperty -Path $policyPath -Name "InPrivateModeAvailability" -ErrorAction SilentlyContinue }
    `;
    
    await runElevated(`powershell -Command "${chromePolicy}; ${edgePolicy}; gpupdate /force /wait:0"`);
    return true;
  } catch (e) {
    console.error('[incognitoLock] Group Policy revert failed:', e.message);
    return false;
  }
}

// Apply via Registry (HKLM - machine-wide, requires admin)
async function applyRegistryHKLM() {
  const cmd =
    `reg add "HKLM\\SOFTWARE\\Policies\\Google\\Chrome" /v IncognitoModeAvailability /t REG_DWORD /d 1 /f && ` +
    `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v InPrivateModeAvailability /t REG_DWORD /d 1 /f`;

  try {
    await runElevated(cmd);
    return true;
  } catch (e) {
    console.error('[incognitoLock] Registry HKLM apply failed:', e.message);
    return false;
  }
}

async function revertRegistryHKLM() {
  const cmd =
    `reg delete "HKLM\\SOFTWARE\\Policies\\Google\\Chrome" /v IncognitoModeAvailability /f & ` +
    `reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v InPrivateModeAvailability /f`;

  try {
    await runElevated(cmd);
    return true;
  } catch (e) {
    console.error('[incognitoLock] Registry HKLM revert failed:', e.message);
    return false;
  }
}

// Apply via Registry (HKCU - current user, no admin needed but less effective)
async function applyRegistryHKCU() {
  const cmd =
    `reg add "HKCU\\SOFTWARE\\Policies\\Google\\Chrome" /v IncognitoModeAvailability /t REG_DWORD /d 1 /f && ` +
    `reg add "HKCU\\SOFTWARE\\Policies\\Microsoft\\Edge" /v InPrivateModeAvailability /t REG_DWORD /d 1 /f`;

  try {
    await runCommand(cmd);
    return true;
  } catch (e) {
    console.error('[incognitoLock] Registry HKCU apply failed:', e.message);
    return false;
  }
}

async function revertRegistryHKCU() {
  const cmd =
    `reg delete "HKCU\\SOFTWARE\\Policies\\Google\\Chrome" /v IncognitoModeAvailability /f & ` +
    `reg delete "HKCU\\SOFTWARE\\Policies\\Microsoft\\Edge" /v InPrivateModeAvailability /f`;

  try {
    await runCommand(cmd);
    return true;
  } catch (e) {
    console.error('[incognitoLock] Registry HKCU revert failed:', e.message);
    return false;
  }
}

// Firefox policies.json (requires Firefox installation path)
async function applyFirefoxPolicy() {
  try {
    // Firefox reads policies.json from distribution folder
    const firefoxPaths = [
      path.join(os.homedir(), 'AppData', 'Local', 'Mozilla', 'Firefox'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox'),
      'C:\\Program Files\\Mozilla Firefox',
      'C:\\Program Files (x86)\\Mozilla Firefox',
    ];
    
    const policy = {
      policies: {
        DisablePrivateBrowsing: true,
      },
    };
    
    for (const basePath of firefoxPaths) {
      const distPath = path.join(basePath, 'distribution');
      if (fs.existsSync(distPath) || fs.existsSync(basePath)) {
        if (!fs.existsSync(distPath)) fs.mkdirSync(distPath, { recursive: true });
        fs.writeFileSync(path.join(distPath, 'policies.json'), JSON.stringify(policy, null, 2));
        console.log('[incognitoLock] Firefox policy applied at:', distPath);
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('[incognitoLock] Firefox policy apply failed:', e.message);
    return false;
  }
}

async function revertFirefoxPolicy() {
  try {
    const firefoxPaths = [
      path.join(os.homedir(), 'AppData', 'Local', 'Mozilla', 'Firefox'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox'),
      'C:\\Program Files\\Mozilla Firefox',
      'C:\\Program Files (x86)\\Mozilla Firefox',
    ];
    
    for (const basePath of firefoxPaths) {
      const policyFile = path.join(basePath, 'distribution', 'policies.json');
      if (fs.existsSync(policyFile)) {
        fs.unlinkSync(policyFile);
        console.log('[incognitoLock] Firefox policy reverted at:', policyFile);
      }
    }
    return true;
  } catch (e) {
    console.error('[incognitoLock] Firefox policy revert failed:', e.message);
    return false;
  }
}

// Verify if restriction is actually active
async function verifyRestriction() {
  try {
    // Check Chrome
    const chromeCheck = await runCommand('reg query "HKLM\\SOFTWARE\\Policies\\Google\\Chrome" /v IncognitoModeAvailability 2>nul');
    const edgeCheck = await runCommand('reg query "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v InPrivateModeAvailability 2>nul');
    const chromeHKCU = await runCommand('reg query "HKCU\\SOFTWARE\\Policies\\Google\\Chrome" /v IncognitoModeAvailability 2>nul');
    const edgeHKCU = await runCommand('reg query "HKCU\\SOFTWARE\\Policies\\Microsoft\\Edge" /v InPrivateModeAvailability 2>nul');
    
    const chromeActive = chromeCheck.stdout.includes('IncognitoModeAvailability') || chromeHKCU.stdout.includes('IncognitoModeAvailability');
    const edgeActive = edgeCheck.stdout.includes('InPrivateModeAvailability') || edgeHKCU.stdout.includes('InPrivateModeAvailability');
    
    return { chrome: chromeActive, edge: edgeActive, any: chromeActive || edgeActive };
  } catch (e) {
    return { chrome: false, edge: false, any: false };
  }
}

// Main apply function - tries methods in order of effectiveness
async function applyIncognitoRestriction() {
  if (os.platform() !== 'win32') return { applied: false, reason: 'not Windows' };
  if (isApplied()) return { applied: false, reason: 'already applied' };

  console.log('[incognitoLock] Applying incognito restriction...');
  
  // Try Group Policy first (most robust for domain machines)
  const domainJoined = await isDomainJoined();
  if (domainJoined) {
    console.log('[incognitoLock] Domain-joined machine detected, trying Group Policy...');
    if (await applyGroupPolicy()) {
      await applyFirefoxPolicy();
      writeState({ applied: true, appliedAt: new Date().toISOString(), method: 'group-policy' });
      return { applied: true, method: 'group-policy' };
    }
    console.log('[incognitoLock] Group Policy failed, falling back to registry...');
  }
  
  // Try HKLM registry (machine-wide, requires admin)
  if (await applyRegistryHKLM()) {
    await applyFirefoxPolicy();
    writeState({ applied: true, appliedAt: new Date().toISOString(), method: 'registry-hklm' });
    return { applied: true, method: 'registry-hklm' };
  }
  
  // Fallback to HKCU (current user, no admin needed)
  console.log('[incognitoLock] HKLM failed, trying HKCU fallback...');
  if (await applyRegistryHKCU()) {
    await applyFirefoxPolicy();
    writeState({ applied: true, appliedAt: new Date().toISOString(), method: 'registry-hkcu' });
    return { applied: true, method: 'registry-hkcu' };
  }
  
  return { applied: false, reason: 'all methods failed' };
}

// Main revert function
async function revertIncognitoRestriction() {
  if (os.platform() !== 'win32') return { reverted: false, reason: 'not Windows' };
  if (!isApplied()) return { reverted: false, reason: 'not currently applied' };

  const state = readState();
  console.log('[incognitoLock] Reverting incognito restriction...');
  
  let reverted = false;
  
  // Revert based on method used
  switch (state.method) {
    case 'group-policy':
      reverted = await revertGroupPolicy();
      break;
    case 'registry-hklm':
      reverted = await revertRegistryHKLM();
      break;
    case 'registry-hkcu':
      reverted = await revertRegistryHKCU();
      break;
    default:
      // Try all
      await revertGroupPolicy();
      await revertRegistryHKLM();
      await revertRegistryHKCU();
      reverted = true;
  }
  
  await revertFirefoxPolicy();
  
  if (reverted) {
    writeState({ applied: false, revertedAt: new Date().toISOString(), previousMethod: state.method });
    return { reverted: true };
  }
  
  return { reverted: false, reason: 'revert failed' };
}

module.exports = { applyIncognitoRestriction, revertIncognitoRestriction, isApplied, verifyRestriction };