'use strict';

// Applies the same two registry values as the standalone disable_incognito.reg
// file, but driven by monitoring_settings.restrict_incognito instead of
// hand-merging a .reg on every laptop. Writing to HKEY_LOCAL_MACHINE needs
// admin rights — this agent runs as a normal user, so it asks Windows for
// elevation (a UAC prompt) the same way double-clicking the .reg file
// would. That's not a limitation to work around: a background process
// silently rewriting machine-wide policy without ANY local consent isn't
// something this agent does, on this laptop or any other — the UAC
// prompt IS the correct behavior here, not a bug.
//
// Applied once per install (tracked in a local marker file), and only
// re-attempted if the setting is re-enabled after being off. Does nothing
// on non-Windows.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { app } = require('electron');

function markerPath() {
  return path.join(app.getPath('userData'), 'incognito-restricted.marker');
}

function alreadyApplied() {
  return fs.existsSync(markerPath());
}

function applyIncognitoRestriction() {
  if (os.platform() !== 'win32') return Promise.resolve({ applied: false, reason: 'not Windows' });
  if (alreadyApplied()) return Promise.resolve({ applied: false, reason: 'already applied' });

  // reg.exe add — one value per browser, mirroring disable_incognito.reg.
  // Chained with && so both must succeed for the marker to be written.
  const cmd =
    `reg add "HKLM\\SOFTWARE\\Policies\\Google\\Chrome" /v IncognitoModeAvailability /t REG_DWORD /d 1 /f && ` +
    `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge" /v InPrivateModeAvailability /t REG_DWORD /d 1 /f`;

  // Wrapped through PowerShell's Start-Process -Verb RunAs to trigger the
  // UAC elevation prompt — reg.exe itself has no elevation mechanism of
  // its own.
  const elevateCmd = `powershell -Command "Start-Process cmd -ArgumentList '/c ${cmd.replace(/"/g, '\\"')}' -Verb RunAs -WindowStyle Hidden -Wait"`;

  return new Promise((resolve) => {
    exec(elevateCmd, (err) => {
      if (err) {
        // Most likely: the person clicked "No" on the UAC prompt. Not
        // retried automatically — re-enabling the setting from the
        // dashboard is what triggers another attempt.
        console.error('[incognitoLock] failed or declined:', err.message);
        resolve({ applied: false, reason: err.message });
        return;
      }
      fs.writeFileSync(markerPath(), new Date().toISOString());
      resolve({ applied: true });
    });
  });
}

module.exports = { applyIncognitoRestriction, alreadyApplied };