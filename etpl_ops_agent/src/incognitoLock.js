'use strict';

// Applies (and reverses) the same two registry values as the standalone
// disable_incognito.reg file, but driven by monitoring_settings.
// restrict_incognito instead of hand-merging a .reg on every laptop.
// Writing to HKEY_LOCAL_MACHINE needs admin rights — this agent runs as a
// normal user, so it asks Windows for elevation (a UAC prompt) the same
// way double-clicking the .reg file would. That's not a limitation to
// work around: a background process silently rewriting machine-wide
// policy without ANY local consent isn't something this agent does, on
// this laptop or any other — the UAC prompt IS the correct behavior here.
//
// State is tracked (not just "was it ever applied") specifically so
// turning the dashboard toggle back OFF actually reverts the registry
// change — earlier version of this file could only apply, never undo.

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
    return { applied: false };
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
    exec(elevateCmd, (err) => (err ? reject(err) : resolve()));
  });
}

async function applyIncognitoRestriction() {
  if (os.platform() !== 'win32') return { applied: false, reason: 'not Windows' };
  if (isApplied()) return { applied: false, reason: 'already applied' };

  const cmd =
    `reg add "HKLM\\SOFTWARE\\Policies\\Google\\Chrome" /v IncognitoModeAvailability /t REG_DWORD /d 1 /f && ` +
    `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v InPrivateModeAvailability /t REG_DWORD /d 1 /f`;

  try {
    await runElevated(cmd);
    writeState({ applied: true, appliedAt: new Date().toISOString() });
    return { applied: true };
  } catch (err) {
    // Most likely: the person clicked "No" on the UAC prompt. Not
    // retried automatically — the next settings refresh (every 2 min, or
    // agent restart) tries again as long as the dashboard toggle is on.
    console.error('[incognitoLock] apply failed or declined:', err.message);
    return { applied: false, reason: err.message };
  }
}

async function revertIncognitoRestriction() {
  if (os.platform() !== 'win32') return { reverted: false, reason: 'not Windows' };
  if (!isApplied()) return { reverted: false, reason: 'not currently applied' };

  // '&' not '&&' — best-effort each deletion independently; one key
  // already being gone shouldn't stop the other from being removed.
  const cmd =
    `reg delete "HKLM\\SOFTWARE\\Policies\\Google\\Chrome" /v IncognitoModeAvailability /f & ` +
    `reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v InPrivateModeAvailability /f`;

  try {
    await runElevated(cmd);
    writeState({ applied: false, revertedAt: new Date().toISOString() });
    return { reverted: true };
  } catch (err) {
    console.error('[incognitoLock] revert failed or declined:', err.message);
    return { reverted: false, reason: err.message };
  }
}

module.exports = { applyIncognitoRestriction, revertIncognitoRestriction, isApplied };