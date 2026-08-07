'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor, desktopCapturer, nativeImage } = require('electron');
const os = require('os');
const path = require('path');
const api = require('./api');
const store = require('./store');
const { Tracker } = require('./tracker');
const { startLocalServer } = require('./localServer');
const { applyIncognitoRestriction, alreadyApplied } = require('./incognitoLock');

const AGENT_VERSION = require('../package.json').version;

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

// Matched case-insensitively against active-win's owner.name. 'electron'/
// 'electron.exe' covers `npm start` in dev; the productName variants cover
// the packaged installer (see package.json's build.productName).
const SELF_PROCESS_NAMES = ['electron', 'electron.exe', 'ethertrack agent', 'ethertrack agent.exe', 'ethertrack-agent', 'ethertrack-agent.exe'];

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

// ── window helpers ─────────────────────────────────────────────────────
function createLoginWindow() {
  mainWindow = new BrowserWindow({
    width: 380, height: 460, resizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'windows', 'login.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createStatusWindow() {
  if (statusWindow) { statusWindow.show(); statusWindow.focus(); return; }
  statusWindow = new BrowserWindow({
    width: 320, height: 380, resizable: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  statusWindow.setMenuBarVisibility(false);
  statusWindow.loadFile(path.join(__dirname, 'windows', 'status.html'));
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
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray-icon.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('EtherTrack Agent');
  refreshTrayMenu();
  tray.on('click', () => createStatusWindow());
}

function refreshTrayMenu() {
  if (!tray) return;
  const loggedIn = !!token;
  const sessionOpen = !!session;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: loggedIn ? 'Open EtherTrack Agent' : 'Sign in…', click: () => (loggedIn ? createStatusWindow() : createLoginWindow()) },
    { type: 'separator' },
    { label: 'Start Work', enabled: loggedIn && !sessionOpen, click: () => handleStartSession() },
    { label: 'Stop Work', enabled: loggedIn && sessionOpen, click: () => handleStopSession() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

// ── session lifecycle ─────────────────────────────────────────────────
async function handleStartSession() {
  const res = await api.sessionStart(token);
  session = { id: res.session_id, clock_in: res.clock_in };
  dailyTotals = { active: res.today_totals?.active_seconds || 0, idle: res.today_totals?.idle_seconds || 0 };
  tracker = new Tracker({
    idleThresholdSeconds: settings?.idle_threshold_seconds || 300,
    onUpdate: (patch) => pushStatusUpdate(patch),
    excludedApps: SELF_PROCESS_NAMES,
  });
  tracker.start();

  const heartbeatMs = (settings?.heartbeat_interval_seconds || 30) * 1000;
  heartbeatTimer = setInterval(runHeartbeat, heartbeatMs);

  if (settings?.screenshots_enabled) {
    const shotMs = (settings.screenshot_interval_seconds || 600) * 1000;
    screenshotTimer = setInterval(captureScreenshot, shotMs);
  }

  refreshTrayMenu();
  // workedSeconds/idleSeconds here are the AUTHORITATIVE today-so-far totals
  // (carried over from any earlier session today) — the tray seeds its
  // display from these instead of restarting its own count at 0.
  pushStatusUpdate({ sessionOpen: true, clockIn: session.clock_in, workedSeconds: dailyTotals.active, idleSeconds: dailyTotals.idle });
}

async function handleStopSession() {
  if (!session) return;
  clearInterval(heartbeatTimer);
  clearInterval(screenshotTimer);
  await runHeartbeat().catch(() => {}); // flush anything left before closing — also syncs dailyTotals one last time
  await api.sessionStop(token, session.id).catch((err) => console.error('[session:stop]', err.message));
  if (tracker) tracker.stop();
  session = null;
  tracker = null;
  refreshTrayMenu();
  pushStatusUpdate({ sessionOpen: false, workedSeconds: dailyTotals.active, idleSeconds: dailyTotals.idle });
}

async function runHeartbeat() {
  if (!session || !tracker) return;
  const payload = { session_id: session.id, ...tracker.drainForHeartbeat() };
  try {
    const res = await api.heartbeat(token, payload);
    // This is the fix for the dashboard/tray numbers drifting apart: the
    // tray now displays exactly what the server just confirmed it has,
    // every 30s, rather than a locally-ticked guess that resets on restart.
    if (res.today_totals) {
      dailyTotals = { active: res.today_totals.active_seconds, idle: res.today_totals.idle_seconds };
      pushStatusUpdate({ workedSeconds: dailyTotals.active, idleSeconds: dailyTotals.idle });
    }
  } catch (err) {
    console.error('[heartbeat]', err.message); // buffers already cleared client-side; next tick just resumes — acceptable data loss on a single failed beat rather than unbounded retry buildup
  }
}

async function captureScreenshot() {
  if (!session) return;
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1280, height: 800 } });
    if (!sources[0]) return;
    const buffer = sources[0].thumbnail.toJPEG(70);
    await api.uploadScreenshot(token, { sessionId: session.id, capturedAt: new Date().toISOString(), buffer, mimeType: 'image/jpeg' });
  } catch (err) {
    console.error('[screenshot]', err.message);
  }
}

// ── auth ────────────────────────────────────────────────────────────────
async function maybeApplyIncognitoRestriction() {
  if (!settings?.restrict_incognito || alreadyApplied()) return;
  const result = await applyIncognitoRestriction();
  if (result.applied) console.log('[incognitoLock] applied successfully');
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
    }
    maybeApplyIncognitoRestriction(); // fire-and-forget — the UAC prompt shouldn't block login
    return true;
  } catch {
    token = null;
    store.clearToken();
    return false;
  }
}

// ── IPC ────────────────────────────────────────────────────────────────
ipcMain.handle('auth:login', async (_evt, { email, password, totpToken, backupCode }) => {
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
  if (me.open_session) {
    session = { id: me.open_session.id, clock_in: me.open_session.clock_in };
    dailyTotals = { active: me.today_totals?.active_seconds || 0, idle: me.today_totals?.idle_seconds || 0 };
  }
  maybeApplyIncognitoRestriction();

  createStatusWindow();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  refreshTrayMenu();

  return { ok: true, employee: me.employee, consentNotice: settings.consent_notice };
});

ipcMain.handle('auth:status', async () => ({
  loggedIn: !!token,
  sessionOpen: !!session,
  clockIn: session?.clock_in || null,
  workedSeconds: dailyTotals.active,
  idleSeconds: dailyTotals.idle,
}));

ipcMain.handle('auth:logout', async () => {
  if (session) await handleStopSession();
  token = null;
  store.clearToken();
  refreshTrayMenu();
  return { ok: true };
});

ipcMain.handle('session:start', async () => {
  await handleStartSession();
  return { ok: true, clockIn: session.clock_in, workedSeconds: dailyTotals.active, idleSeconds: dailyTotals.idle };
});

ipcMain.handle('session:stop', async () => {
  await handleStopSession();
  return { ok: true };
});

// ── app lifecycle ─────────────────────────────────────────────────────
app.on('window-all-closed', (e) => e.preventDefault()); // tray app — stays alive with no windows open

app.whenReady().then(async () => {
  app.setLoginItemSettings({ openAtLogin: true, name: 'EtherTrack Agent' }); // run at Windows startup

  buildTray();
  startLocalServer(() => tracker); // always running — no-ops until a session/tracker exists; the extension can start reporting the moment it's paired, whether or not Start Work has been clicked yet
  const loggedIn = await attemptAutoLogin();
  if (loggedIn) {
    createStatusWindow();
    if (session) {
      // Resuming a session that survived a restart (e.g. agent was just
      // updated) — re-attach a fresh tracker rather than double-starting,
      // and seed the display from the authoritative dailyTotals
      // attemptAutoLogin() already pulled, not from 0.
      tracker = new Tracker({ idleThresholdSeconds: settings?.idle_threshold_seconds || 300, onUpdate: pushStatusUpdate, excludedApps: SELF_PROCESS_NAMES });
      tracker.start();
      heartbeatTimer = setInterval(runHeartbeat, (settings?.heartbeat_interval_seconds || 30) * 1000);
      pushStatusUpdate({ sessionOpen: true, clockIn: session.clock_in, workedSeconds: dailyTotals.active, idleSeconds: dailyTotals.idle });
    }
  } else {
    createLoginWindow();
  }
  refreshTrayMenu();
});

// Best-effort — fires on Windows shutdown/restart/logoff. Not guaranteed
// (hard power loss won't trigger it), which is exactly why the backend
// also auto-closes sessions after a heartbeat gap — see closeStaleSessions()
// in routes/agent.js.
powerMonitor.on('shutdown', async (event) => {
  event.preventDefault();
  if (session) {
    await api.forceLogout(token, session.id).catch(() => {});
  }
  app.exit(0);
});