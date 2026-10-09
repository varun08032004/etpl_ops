'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor, desktopCapturer, nativeImage } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const api = require('./api');
const store = require('./store');
const { Tracker } = require('./tracker');
const { startLocalServer, getLocalServerToken } = require('./localServer');
const { applyIncognitoRestriction, revertIncognitoRestriction, isApplied } = require('./incognitoLock');
const { initTamperDetection, verifyConfigIntegrity } = require('./tamperDetection');

const AGENT_VERSION = require('../package.json').version;

// Get local IP for device info
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Check if running under watchdog (managed mode)
const IS_WATCHDOG_MODE = process.argv.includes('--watchdog-mode') || process.env.ETHERTRACK_WATCHDOG === '1';
const WATCHDOG_PID = parseInt(process.env.ETHERTRACK_WATCHDOG_PID || '0', 10);

// Check for force-close flag (used by installer to close existing instance)
const FORCE_CLOSE = process.argv.includes('--force-close');

// Chromium/Electron tries to create GPU-related disk caches in the app's
// userData folder on startup. On some Windows setups that folder gets
// locked (antivirus scanning it, OneDrive syncing it, a permissions
// quirk), producing the "Gpu Cache Creation failed" / "Unable to move the
// cache: Access is denied" lines. Harmless on their own — but disabling
// hardware acceleration outright is the actual fix, not just quieting one
// specific cache; this tray/status-window app has no need for GPU
// rendering anyway.
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.disableHardwareAcceleration();

// Handle force-close BEFORE single instance lock
// If installer runs us with --force-close, we kill existing instances and exit
if (FORCE_CLOSE) {
  console.log('[force-close] Killing existing EtherTrack Agent instances...');
  // Use synchronous taskkill equivalent via PowerShell to wait for completion
  try {
    const { execSync } = require('child_process');
    // Use PowerShell to forcefully stop all EtherTrack Agent processes
    execSync('powershell -Command "Get-Process -Name \'EtherTrack Agent\' -ErrorAction SilentlyContinue | Stop-Process -Force"', {
      stdio: 'ignore',
      timeout: 5000
    });
  } catch (err) {
    // Ignore errors - process might not exist
    console.log('[force-close] No existing instances found or already terminated');
  }
  console.log('[force-close] Existing instances terminated, exiting');
  app.quit();
  process.exit(0);
}

// Prevent multiple instances - but allow watchdog to restart us
// Skip single instance lock if FORCE_CLOSE (we're explicitly closing others)
const gotTheLock = !FORCE_CLOSE ? app.requestSingleInstanceLock() : true;
if (!gotTheLock && !IS_WATCHDOG_MODE) {
  app.quit();
  process.exit(0);
}

// Matched case-insensitively against active-win's owner.name. 'electron'/
// 'electron.exe' covers `npm start` in dev; the productName variants cover
// the packaged installer (see package.json's build.productName).
const SELF_PROCESS_NAMES = ['electron', 'electron.exe', 'ethertrack agent', 'ethertrack agent.exe', 'ethertrack-agent', 'ethertrack-agent.exe'];

// Browser process names for extension connection checking
const BROWSER_PROCESSES = new Set(['chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe']);

let mainWindow = null;   // login window
let statusWindow = null;
let tray = null;

let token = null;
let session = null;      // { id, clock_in }
let settings = null;     // from /agent/me
let dailyTotals = { active: 0, idle: 0 }; // authoritative — from the server, never counted locally from zero
let tracker = null;
let heartbeatTimer = null;
let screenshotTimer = null;
let heartbeatSeq = 0;    // Monotonically increasing sequence for replay protection
let hwId = null;         // Hardware fingerprint for this device

// ── window helpers ─────────────────────────────────────────────────────
// Resolve file paths that work in both dev (disk) and packaged (asar) modes
function getAssetPath(relativePath) {
  // In dev: __dirname = /path/to/project/src
  // In packaged: __dirname = /path/to/resources/app.asar/src
  // Both work with loadFile and preload
  const resolved = path.join(__dirname, relativePath);
  console.log('[getAssetPath]', relativePath, '->', resolved);
  return resolved;
}

function createLoginWindow() {
  mainWindow = new BrowserWindow({
    width: 380, height: 460, resizable: false,
    webPreferences: { preload: getAssetPath('preload.js'), contextIsolation: true },
  });
  mainWindow.setMenuBarVisibility(false);
  
  // Add error handling for load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[login] Failed to load:', errorCode, errorDescription, validatedURL);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[login] Page loaded successfully');
  });
  
  mainWindow.loadFile(getAssetPath('windows/login.html'));
  // DEBUG: Open DevTools to see console errors in packaged app
  mainWindow.webContents.openDevTools();
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createStatusWindow() {
  if (statusWindow) { statusWindow.show(); statusWindow.focus(); return; }
  statusWindow = new BrowserWindow({
    width: 320, height: 380, resizable: false, show: false,
    webPreferences: { preload: getAssetPath('preload.js'), contextIsolation: true },
  });
  statusWindow.setMenuBarVisibility(false);
  statusWindow.loadFile(getAssetPath('windows/status.html'));
  statusWindow.once('ready-to-show', () => statusWindow.show());
  statusWindow.on('close', (e) => { e.preventDefault(); statusWindow.hide(); }); // tray app — never actually quit on X
}

function pushStatusUpdate(patch) {
  if (statusWindow && !statusWindow.isDestroyed()) {
    statusWindow.webContents.send('status:update', patch);
  }
}

// ── tray ────────────────────────────────────────────────────────────────
function buildTray() {
  // Assets are in resources/ in packaged mode, not in asar
  const isPackaged = app.isPackaged;
  const iconPath = isPackaged
    ? path.join(process.resourcesPath, 'assets', 'tray-icon.png')
    : path.join(__dirname, '..', 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('EtherTrack Agent');
  refreshTrayMenu();
  tray.on('click', () => createStatusWindow());
}

function refreshTrayMenu() {
  if (!tray) return;
  const loggedIn = !!token;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: loggedIn ? 'Open EtherTrack Agent' : 'Sign in…', click: () => (loggedIn ? createStatusWindow() : createLoginWindow()) },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

// ── Initialize tracker for activity monitoring (no session tracking) ──────────
async function initializeTracker() {
  if (!token || !settings) return;
  
  tracker = new Tracker({
    idleThresholdSeconds: settings?.idle_threshold_seconds || 300,
    onUpdate: (patch) => pushStatusUpdate(patch),
    excludedApps: SELF_PROCESS_NAMES,
  });
  
  if (settings?.office_networks) {
    tracker.setOfficeNetworks(settings.office_networks);
  }
  tracker.start();

  const heartbeatMs = (settings?.heartbeat_interval_seconds || 30) * 1000;
  heartbeatTimer = setInterval(runHeartbeat, heartbeatMs);

  if (settings?.screenshots_enabled) {
    const baseIntervalMs = (settings?.screenshot_interval_seconds || 600) * 1000;
    const jitter = baseIntervalMs * 0.3; // ±30%
    const shotMs = baseIntervalMs + (Math.random() * 2 - 1) * jitter;
    screenshotTimer = setInterval(captureScreenshot, shotMs);
  }

  // Sync attendance punch state
  let attendancePatch = { workingHours: workingHoursConfig };
  try {
    const res = await api.getTodayAttendance(token);
    if (res.ok && res.record) {
      attendancePatch = {
        ...attendancePatch,
        punchIn: res.record.clock_in,
        punchOut: res.record.clock_out,
        lateMinutes: res.record.late_minutes || 0,
        earlyLeaveMinutes: res.record.early_leave_minutes || 0,
        attendanceStatus: res.record.status
      };
    }
  } catch (e) {
    console.error('[tracker init] attendance sync failed:', e.message);
  }
  
  pushStatusUpdate({ 
    workedSeconds: dailyTotals.active, 
    idleSeconds: dailyTotals.idle,
    ...attendancePatch
  });
  
  startAutoPunchOutTimer();
}

async function stopTracker() {
  if (!tracker) return;
  clearInterval(heartbeatTimer);
  clearInterval(screenshotTimer);
  stopAutoPunchOutTimer();
  await runHeartbeat().catch(() => {}); // flush anything left before closing
  tracker.stop();
  tracker = null;
}

async function runHeartbeat() {
  if (!session || !tracker) return;
  const payload = { session_id: session.id, ...tracker.drainForHeartbeat() };
  try {
    // Send HWID header and current sequence
    const res = await api.heartbeat(token, payload, heartbeatSeq, hwId);
    // Update sequence from server response
    if (res.next_heartbeat_seq) {
      heartbeatSeq = res.next_heartbeat_seq;
    }
    // This is the fix for the dashboard/tray numbers drifting apart: the
    // tray now displays exactly what the server just confirmed it has,
    // every 30s, rather than a locally-ticked guess that resets on restart.
    if (res.today_totals) {
      dailyTotals = { active: res.today_totals.active_seconds, idle: res.today_totals.idle_seconds };
      pushStatusUpdate({ workedSeconds: dailyTotals.active, idleSeconds: dailyTotals.idle });
    }
    // Flush any queued requests now that connection is restored
    await api.flushRequestQueue(token);
  } catch (err) {
    console.error('[heartbeat]', err.message); // buffers already cleared client-side; next tick just resumes — acceptable data loss on a single failed beat rather than unbounded retry buildup
    // On auth error (fingerprint mismatch, sequence invalid), stop session
    if (err.message.includes('FINGERPRINT_MISMATCH') || err.message.includes('SEQUENCE_INVALID') || err.message.includes('401')) {
      console.error('[heartbeat] Auth failure, stopping session');
      await handleStopSession();
    }
  }
}

async function captureScreenshot() {
  if (!session) return;
  try {
    // Capture all monitors
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: { width: 1920, height: 1080 } 
    });
    
    if (!sources.length) return;
    
    const { nativeImage } = require('electron');
    const crypto = require('crypto');
    
    // Create watermark text
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const watermarkText = `EtherTrack | ${settings?.employee?.employee_code || 'EMP'} | ${timestamp} | Session: ${session.id.slice(0, 8)}`;
    
    // Process each monitor
    const screenshots = [];
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      let buffer = source.thumbnail.toJPEG(70);
      
      // Add watermark if enabled
      if (settings?.blur_screenshots !== true) { // blur_screenshots=false means watermark is ok
        try {
          const img = nativeImage.createFromBuffer(buffer);
          const watermarkImg = addWatermark(img, watermarkText, i + 1, sources.length);
          buffer = watermarkImg.toJPEG(70);
        } catch (wmErr) {
          console.error('[screenshot] Watermark failed:', wmErr.message);
        }
      }
      
      // Generate hash for verification
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      
      screenshots.push({
        monitorIndex: i,
        monitorName: source.name || `Monitor ${i + 1}`,
        buffer,
        mimeType: 'image/jpeg',
        hash,
        capturedAt: new Date().toISOString(),
      });
    }
    
    // Upload all screenshots
    for (const shot of screenshots) {
      await api.uploadScreenshot(token, { 
        sessionId: session.id, 
        capturedAt: shot.capturedAt, 
        buffer: shot.buffer, 
        mimeType: shot.mimeType,
        monitorIndex: shot.monitorIndex,
        monitorName: shot.monitorName,
        hash: shot.hash,
      });
    }
  } catch (err) {
    console.error('[screenshot]', err.message);
  }
}

// Add watermark to image using offscreen BrowserWindow for canvas rendering
async function addWatermark(image, text, monitorNumber, totalMonitors) {
  const { BrowserWindow, nativeImage } = require('electron');
  const path = require('path');
  
  const size = image.getSize();
  const width = size.width;
  const height = size.height;
  
  // Create offscreen window for canvas rendering
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  // Load a simple HTML page that draws the watermark
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; overflow: hidden; }
        canvas { display: block; }
      </style>
    </head>
    <body>
      <canvas id="c" width="${width}" height="${height}"></canvas>
      <script>
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          
          // Semi-transparent overlay at bottom
          const overlayHeight = 40;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, canvas.height - overlayHeight, canvas.width, overlayHeight);
          
          // Watermark text
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = '14px "Segoe UI", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(${JSON.stringify(text)}, 10, canvas.height - 15);
          
          // Monitor indicator
          if (${totalMonitors} > 1) {
            ctx.textAlign = 'right';
            ctx.fillText('Monitor ${monitorNumber}/${totalMonitors}', canvas.width - 10, canvas.height - 15);
          }
          
          // Diagonal repeating watermark (subtle)
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(-Math.PI / 6);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.font = 'bold 48px "Segoe UI", sans-serif';
          for (let x = -canvas.width; x < canvas.width * 2; x += 300) {
            for (let y = -canvas.height; y < canvas.height * 2; y += 150) {
              ctx.fillText('ETHERTRACK', x, y);
            }
          }
          ctx.restore();
          
          // Send result back
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          require('electron').ipcRenderer.send('watermark-done', dataUrl);
        };
        img.src = ${JSON.stringify(image.toDataURL())};
      </script>
    </body>
    </html>
  `;
  
  return new Promise((resolve) => {
    const { ipcMain } = require('electron');
    
    const handler = (event, dataUrl) => {
      ipcMain.removeListener('watermark-done', handler);
      win.close();
      resolve(nativeImage.createFromDataURL(dataUrl));
    };
    
    ipcMain.once('watermark-done', handler);
    
    win.loadURL(`data:text/html,${encodeURIComponent(html)}`);
    
    // Timeout fallback
    setTimeout(() => {
      ipcMain.removeListener('watermark-done', handler);
      win.close();
      // Return original image if watermark fails
      resolve(image);
    }, 5000);
  });
}

// ── auth ────────────────────────────────────────────────────────────────
// Reacts to whatever `settings` currently holds — applies the incognito
// restriction if the toggle is on and it isn't applied yet, REVERTS it if
// the toggle got turned back off. Called after every settings refresh,
// not just at login, which is the actual fix for "toggling it on/off
// doesn't do anything" — the old code only ever checked this once.
async function syncIncognitoRestriction() {
  if (settings?.restrict_incognito && !isApplied()) {
    const result = await applyIncognitoRestriction();
    if (result.applied) console.log('[incognitoLock] applied');
  } else if (!settings?.restrict_incognito && isApplied()) {
    const result = await revertIncognitoRestriction();
    if (result.reverted) console.log('[incognitoLock] reverted');
  }
}

// This is the fix for "screenshots on but nothing captures" too — the
// agent used to read settings exactly once (at login) and never again.
// Flip the dashboard toggle while someone's already mid-session and the
// old code had no way of finding out. Runs every 2 minutes, no-ops
// without a token.
let settingsRefreshTimer = null;
let extensionCheckTimer = null;

function startSettingsRefreshLoop() {
  if (settingsRefreshTimer) return;
  settingsRefreshTimer = setInterval(refreshSettings, 2 * 60 * 1000);
}

function startExtensionCheckLoop() {
  if (extensionCheckTimer) return;
  extensionCheckTimer = setInterval(checkBrowserExtension, 60 * 1000); // Check every minute
}

async function checkBrowserExtension() {
  if (!session || !tracker) return;
  
  const isConnected = tracker.checkExtensionConnection();
  const isBrowserActive = tracker.currentSegment && BROWSER_PROCESSES.has(tracker.currentSegment.app_name.toLowerCase());
  
  // Only alert if browser is active but extension is disconnected
  if (isBrowserActive && !isConnected) {
    console.warn('[extension] Browser active but extension not reporting - possible tampering or extension disabled');
    // Could send alert to backend, show notification, etc.
    if (statusWindow && !statusWindow.isDestroyed()) {
      statusWindow.webContents.send('extension:warning', { 
        message: 'Browser extension disconnected - website tracking unavailable',
        severity: 'warning'
      });
    }
  }
}

async function refreshSettings() {
  if (!token) return;
  try {
    const me = await api.getMe(token);
    settings = me.settings;

    // Verify config.json integrity
    const configCheck = verifyConfigIntegrity({
      apiBaseUrl: require('../config.json').apiBaseUrl,
      companyCode: require('../config.json').companyCode,
      localServerPort: require('../config.json').localServerPort,
    });
    if (!configCheck.valid) {
      console.error('[tamper] Config integrity check failed:', configCheck);
      // Could trigger alert, stop session, etc.
    }

    if (session) {
      if (settings.screenshots_enabled && !screenshotTimer) {
        const baseIntervalMs = (settings.screenshot_interval_seconds || 600) * 1000;
        const jitter = baseIntervalMs * 0.3; // ±30%
        const shotMs = baseIntervalMs + (Math.random() * 2 - 1) * jitter;
        screenshotTimer = setInterval(captureScreenshot, shotMs);
      } else if (!settings.screenshots_enabled && screenshotTimer) {
        clearInterval(screenshotTimer);
        screenshotTimer = null;
      }
    }

    await syncIncognitoRestriction();
  } catch (err) {
    console.error('[settingsRefresh]', err.message);
  }
}

async function attemptAutoLogin() {
  const saved = store.loadToken();
  if (!saved) return false;
  token = saved;
  try {
    const me = await api.getMe(token);
    settings = me.settings;
    if (me.open_session) {
      session = { id: me.open_session.id, clock_in: me.open_session.clock_in };
      dailyTotals = { active: me.today_totals?.active_seconds || 0, idle: me.today_totals?.idle_seconds || 0 };
      heartbeatSeq = me.open_session.heartbeat_seq ? me.open_session.heartbeat_seq + 1 : 1;
    }
    syncIncognitoRestriction(); // fire-and-forget — the UAC prompt shouldn't block login
    return true;
  } catch {
    token = null;
    store.clearToken();
    return false;
  }
}

// Generate and cache hardware fingerprint on first run
async function initializeHwId() {
  if (hwId) return hwId;
  const components = await api.generateHwIdComponents();
  hwId = components; // Store full components for header
  return hwId;
}

// ── IPC ────────────────────────────────────────────────────────────────
ipcMain.handle('auth:login', async (_evt, { email, password, totpToken, backupCode }) => {
  // Generate HWID before login
  await initializeHwId();
  
  const res = await api.login({
    email, password, totpToken, backupCode,
    deviceName: os.hostname(), os: `${os.platform()} ${os.release()}`, agentVersion: AGENT_VERSION,
  });

  if (res.two_factor_required) {
    return { ok: false, twoFactorRequired: true, message: res.message };
  }

  token = res.token;
  store.saveToken(token);
  const me = await api.getMe(token);
  settings = me.settings;
  
  // Initialize tracker for activity monitoring (no session tracking)
  await initializeTracker();
  syncIncognitoRestriction();

  createStatusWindow();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  refreshTrayMenu();

  return { ok: true, employee: me.employee, consentNotice: settings.consent_notice, autoStarted: false };
});

ipcMain.handle('auth:status', async () => {
  // Get today's attendance punch state via API (not direct DB)
  let attendanceState = { punchIn: null, punchOut: null, lateMinutes: 0, earlyLeaveMinutes: 0, status: null };
  if (token) {
    try {
      const res = await api.getTodayAttendance(token);
      if (res.ok && res.record) {
        attendanceState = {
          punchIn: res.record.clock_in,
          punchOut: res.record.clock_out,
          lateMinutes: res.record.late_minutes || 0,
          earlyLeaveMinutes: res.record.early_leave_minutes || 0,
          status: res.record.status
        };
      }
    } catch (e) {
      console.error('[auth:status] attendance check failed:', e.message);
    }
  }
  return {
    loggedIn: !!token,
    workedSeconds: dailyTotals.active,
    idleSeconds: dailyTotals.idle,
    workingHours: workingHoursConfig,
    // Attendance punch state
    punchIn: attendanceState.punchIn,
    punchOut: attendanceState.punchOut,
    lateMinutes: attendanceState.lateMinutes,
    earlyLeaveMinutes: attendanceState.earlyLeaveMinutes,
    attendanceStatus: attendanceState.status
  };
});

ipcMain.handle('auth:logout', async () => {
  await stopTracker();
  token = null;
  store.clearToken();
  refreshTrayMenu();
  return { ok: true };
});

// ── attendance punch in/out ──────────────────────────────────────────────
ipcMain.handle('attendance:punch-in', async () => {
  if (!token) return { ok: false, error: 'Not authenticated' };
  try {
    const res = await api.punchIn(token, { source: 'agent', device_info: { ip: getLocalIP(), userAgent: `EtherTrack Agent/${AGENT_VERSION}` } });
    if (res.record) {
      pushStatusUpdate({ 
        punchIn: res.record.clock_in, 
        lateMinutes: res.record.late_minutes || 0,
        status: res.record.status 
      });
    }
    return { ok: true, record: res.record };
  } catch (err) {
    console.error('[punch-in]', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('attendance:punch-out', async () => {
  if (!token) return { ok: false, error: 'Not authenticated' };
  try {
    const res = await api.punchOut(token, { source: 'agent', device_info: { ip: getLocalIP(), userAgent: `EtherTrack Agent/${AGENT_VERSION}` } });
    if (res.record) {
      pushStatusUpdate({ 
        punchOut: res.record.clock_out, 
        earlyLeaveMinutes: res.record.early_leave_minutes || 0,
        status: res.record.status 
      });
      stopAutoPunchOutTimer();
    }
    return { ok: true, record: res.record };
  } catch (err) {
    console.error('[punch-out]', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('attendance:get-today', async () => {
  if (!token) return { ok: false, error: 'Not authenticated' };
  try {
    const res = await api.getTodayAttendance(token);
    return { ok: true, ...res };
  } catch (err) {
    console.error('[attendance:get-today]', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('attendance:undo-punch-in', async () => {
  if (!token) return { ok: false, error: 'Not authenticated' };
  try {
    const res = await api.undoPunchIn(token);
    pushStatusUpdate({ punchIn: null, punchOut: null, lateMinutes: 0, status: null });
    return { ok: true, ...res };
  } catch (err) {
    console.error('[undo-punch-in]', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('attendance:undo-punch-out', async () => {
  if (!token) return { ok: false, error: 'Not authenticated' };
  try {
    const res = await api.undoPunchOut(token);
    pushStatusUpdate({ punchOut: null, earlyLeaveMinutes: 0, status: res.record?.status || 'pending' });
    return { ok: true, ...res };
  } catch (err) {
    console.error('[undo-punch-out]', err.message);
    return { ok: false, error: err.message };
  }
});

// Expose local server token for browser extension pairing
// This is called by the extension's options page to get the unique per-install token
ipcMain.handle('local-server:get-token', async () => {
  return { token: getLocalServerToken() };
});

// ── app lifecycle ─────────────────────────────────────────────────────
app.on('window-all-closed', (e) => e.preventDefault()); // tray app — stays alive with no windows open

// Health check file for watchdog monitoring
const HEALTH_CHECK_FILE = path.join(app.getPath('userData'), 'agent-health.json');
function writeHealthCheck() {
  try {
    fs.writeFileSync(HEALTH_CHECK_FILE, JSON.stringify({
      pid: process.pid,
      timestamp: Date.now(),
      version: AGENT_VERSION,
      sessionActive: !!session,
    }));
  } catch (e) {
    // Ignore
  }
}

// Write health check every 30 seconds
setInterval(writeHealthCheck, 30000);

// ── Auto punch-out at configured time (default 7 PM) ───────────────────────
let autoPunchOutTimer = null;
let workingHoursConfig = { punch_out_time: '19:00:00', punch_in_time: '09:30:00', grace_period_minutes: 15, is_working_day: true };

function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function isWithinGracePeriod(now, targetMinutes, graceMinutes) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return Math.abs(nowMinutes - targetMinutes) <= graceMinutes;
}

async function checkAutoPunchOut() {
  if (!token || !session) return;
  
  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon, 7=Sun
  
  // Skip weekends
  if (dayOfWeek === 6 || dayOfWeek === 7) return;
  
  // Check if today is a working day
  if (!workingHoursConfig.is_working_day) return;
  
  const punchOutMinutes = parseTimeToMinutes(workingHoursConfig.punch_out_time);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const graceMinutes = workingHoursConfig.grace_period_minutes || 15;
  
  // If it's past punch-out time + grace period, auto punch out
  if (nowMinutes >= punchOutMinutes + graceMinutes) {
    console.log('[auto-punch-out] Time exceeded, punching out...');
    await handleStopSession();
    pushStatusUpdate({ sessionOpen: false, autoPunchedOut: true });
  }
}

function startAutoPunchOutTimer() {
  if (autoPunchOutTimer) clearInterval(autoPunchOutTimer);
  // Check every minute
  autoPunchOutTimer = setInterval(checkAutoPunchOut, 60000);
  // Also run immediately
  checkAutoPunchOut();
  console.log('[auto-punch-out] Timer started');
}

function stopAutoPunchOutTimer() {
  if (autoPunchOutTimer) {
    clearInterval(autoPunchOutTimer);
    autoPunchOutTimer = null;
  }
}

// ── Working hours sync from server ────────────────────────────────────────
let workingHoursSyncTimer = null;

async function fetchWorkingHoursConfig() {
  if (!token) return;
  try {
    // Get settings which should include working hours
    const me = await api.getMe(token);
    if (me.settings?.working_hours) {
      workingHoursConfig = { ...workingHoursConfig, ...me.settings.working_hours };
    } else if (me.settings?.company_working_hours) {
      // Try to find today's config
      const dayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
      const todayConfig = me.settings.company_working_hours.find(c => c.day_of_week === dayOfWeek);
      if (todayConfig) {
        workingHoursConfig = { ...workingHoursConfig, ...todayConfig };
      }
    }
    console.log('[working-hours] Config updated:', workingHoursConfig);
  } catch (err) {
    console.error('[working-hours] Failed to fetch:', err.message);
  }
}

function startWorkingHoursSync() {
  if (workingHoursSyncTimer) clearInterval(workingHoursSyncTimer);
  // Fetch immediately
  fetchWorkingHoursConfig();
  // Then every 30 minutes
  workingHoursSyncTimer = setInterval(fetchWorkingHoursConfig, 30 * 60 * 1000);
  console.log('[working-hours] Sync started');
}

function stopWorkingHoursSync() {
  if (workingHoursSyncTimer) {
    clearInterval(workingHoursSyncTimer);
    workingHoursSyncTimer = null;
  }
}

app.whenReady().then(async () => {
  console.log('[app] whenReady fired');
  try {
    // Initialize tamper detection
    console.log('[app] Initializing tamper detection...');
    initTamperDetection();
    console.log('[app] Tamper detection initialized');
    
    // Write initial health check
    writeHealthCheck();
    console.log('[app] Health check written');
    
    app.setLoginItemSettings({ openAtLogin: true, name: 'EtherTrack Agent' }); // run at Windows startup
    console.log('[app] Login item settings set');

    buildTray();
    console.log('[app] Tray built');
    
    startLocalServer(() => tracker);
    console.log('[app] Local server started');
    
    startSettingsRefreshLoop();
    console.log('[app] Settings refresh loop started');
    
    startExtensionCheckLoop();
    console.log('[app] Extension check loop started');
    
    console.log('[app] Attempting auto-login...');
    const loggedIn = await attemptAutoLogin();
    console.log('[app] Auto-login result:', loggedIn);
    
    if (loggedIn) {
      createStatusWindow();
      console.log('[app] Status window created');
      
      // Fetch and push attendance punch state on startup
      const today = new Date().toISOString().slice(0, 10);
      try {
        const res = await api.getTodayAttendance(token);
        if (res.ok && res.record) {
          pushStatusUpdate({ 
            punchIn: res.record.clock_in, 
            punchOut: res.record.clock_out, 
            lateMinutes: res.record.late_minutes || 0, 
            earlyLeaveMinutes: res.record.early_leave_minutes || 0,
            attendanceStatus: res.record.status
          });
        }
      } catch (e) {
        console.error('[startup] attendance sync failed:', e.message);
      }
      
      // Initialize tracker for activity monitoring
      await initializeTracker();
    } else {
      console.log('[app] Creating login window...');
      createLoginWindow();
    }
    refreshTrayMenu();
    console.log('[app] Tray menu refreshed');
    
    // Notify watchdog we're ready (via stdout)
    if (IS_WATCHDOG_MODE) {
      console.log('[agent] READY');
    }
    
    // Fetch working hours config from server periodically
    startWorkingHoursSync();
  } catch (err) {
    console.error('[app] STARTUP ERROR:', err);
  }
});

// Best-effort — fires on Windows shutdown/restart/logoff. Not guaranteed
// (hard power loss won't trigger it), which is exactly why the backend
// also auto-closes sessions after a heartbeat gap — see closeStaleSessions()
// in routes/agent.js.
powerMonitor.on('shutdown', async (event) => {
  event.preventDefault();
  await stopTracker();
  app.exit(0);
});