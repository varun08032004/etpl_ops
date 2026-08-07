'use strict';

const { powerMonitor } = require('electron');

const APP_POLL_MS = 3000;   // how often we sample the focused window
const IDLE_POLL_MS = 5000;  // how often we check system idle time
const EXTENSION_FRESHNESS_MS = 15000; // how long a browser-extension-reported domain is trusted before falling back to the title-guess

// Common browser process names — used to flag which app segments we'd
// ALSO want a website breakdown for, and to label the (best-effort) domain
// guess. See extractDomainGuess() below for the important caveat.
const BROWSER_PROCESSES = new Set(['chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe']);

// Window titles for browsers are usually "Page Title - Browser Name" and
// do NOT reliably include the domain (e.g. Chrome shows the <title> tag,
// not the URL). This is a best-effort fallback only — it catches cases
// where a site puts its own domain in the title (many docs/admin tools do)
// but will miss most consumer sites. Accurate domain-level tracking needs
// a companion browser extension talking to this agent over native
// messaging or a local port; that's flagged as a follow-up, not faked here.
function extractDomainGuess(title) {
  if (!title) return null;
  const match = title.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

class Tracker {
  constructor({ idleThresholdSeconds = 300, onUpdate, excludedApps = [] } = {}) {
    this.idleThresholdSeconds = idleThresholdSeconds;
    this.onUpdate = onUpdate || (() => {});
    // The agent's own window(s) — 'Electron' in dev (`npm start`), the
    // packaged exe name in production. Focusing the tray status popup
    // shouldn't log itself as an "app the employee used".
    this.excludedApps = new Set(excludedApps.map((a) => a.toLowerCase()));
    this.running = false;

    // Domain reported by the browser extension (real tab URL — accurate),
    // as opposed to the title-guess fallback below (best-effort only).
    // See reportBrowserTab(). Treated as stale after EXTENSION_FRESHNESS_MS
    // so a browser that closes the extension, or an uninstalled extension,
    // silently falls back to the title-guess rather than showing frozen
    // last-known data forever.
    this.reportedDomain = null;
    this.reportedDomainAt = 0;

    this.currentSegment = null;   // { app_name, window_title, started_at: Date }
    this.currentIdlePeriod = null; // { started_at: Date }
    this.isIdle = false;

    this.appSegments = [];
    this.websiteSegments = [];
    this.idlePeriods = [];
    this.activeSecondsSinceHeartbeat = 0;
    this.idleSecondsSinceHeartbeat = 0;

    this.lastPollAt = null;
    this._appTimer = null;
    this._idleTimer = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastPollAt = Date.now();
    this._appTimer = setInterval(() => this._pollActiveWindow(), APP_POLL_MS);
    this._idleTimer = setInterval(() => this._pollIdle(), IDLE_POLL_MS);
  }

  stop() {
    this.running = false;
    clearInterval(this._appTimer);
    clearInterval(this._idleTimer);
    this._closeCurrentSegment();
    this._closeCurrentIdlePeriod();
  }

  async _pollActiveWindow() {
    if (!this.running) return;
    const now = new Date();
    const elapsedSec = (now - this.lastPollAt) / 1000;
    this.lastPollAt = now;

    if (this.isIdle) {
      this.idleSecondsSinceHeartbeat += elapsedSec;
    } else {
      this.activeSecondsSinceHeartbeat += elapsedSec;
    }

    let win;
    try {
      const activeWin = (await import('active-win')).default;
      win = await activeWin();
    } catch (err) {
      return; // e.g. no window focused, or permissions not yet granted — just skip this tick
    }
    if (!win) return;

    const appName = win.owner?.name || 'Unknown';
    const windowTitle = win.title || '';

    if (this.excludedApps.has(appName.toLowerCase())) {
      // Focused on our own tray/status window — close whatever real
      // segment was open (the employee genuinely stopped using that app
      // the moment they clicked the tray icon), but don't open a new one
      // and don't push a live update for it. The last real app/site stays
      // shown until they focus something else.
      this._closeCurrentSegment(now);
      return;
    }

    if (!this.currentSegment || this.currentSegment.app_name !== appName || this.currentSegment.window_title !== windowTitle) {
      this._closeCurrentSegment(now);
      this.currentSegment = { app_name: appName, window_title: windowTitle, started_at: now };

      if (BROWSER_PROCESSES.has(appName.toLowerCase())) {
        // Prefer the real URL the browser extension just reported (see
        // reportBrowserTab()) over the title-guess — it's actually
        // accurate. Only fall back to guessing from the window title when
        // the extension hasn't reported anything recently (not installed,
        // disabled, or a non-Chromium browser it doesn't support yet).
        const extensionFresh = this.reportedDomain && (Date.now() - this.reportedDomainAt) < EXTENSION_FRESHNESS_MS;
        const domain = extensionFresh ? this.reportedDomain : extractDomainGuess(windowTitle);
        if (domain) this.currentWebsiteSegment = { domain, started_at: now };
        else this.currentWebsiteSegment = null;
      } else {
        this._closeCurrentWebsiteSegment(now);
      }
    }

    this.onUpdate({
      current_app: appName,
      current_window_title: windowTitle,
      current_domain: this.currentWebsiteSegment?.domain || null,
    });
  }

  // Called by the local HTTP server (src/localServer.js) whenever the
  // browser extension reports the newly-active tab's domain. This is
  // event-driven (fires on the actual tab switch) rather than waiting for
  // the next 3s poll, so segment boundaries line up with real tab
  // switches instead of being rounded to the poll cadence.
  reportBrowserTab(domain) {
    if (!domain || !this.running) return;
    this.reportedDomain = domain;
    this.reportedDomainAt = Date.now();

    // Only actually act on it if we're currently focused on a browser —
    // if the employee is in VS Code and a background browser tab changes,
    // that's not something that should open a website segment right now.
    if (!this.currentSegment || !BROWSER_PROCESSES.has(this.currentSegment.app_name.toLowerCase())) return;
    if (this.currentWebsiteSegment?.domain === domain) return;

    const now = new Date();
    this._closeCurrentWebsiteSegment(now);
    this.currentWebsiteSegment = { domain, started_at: now };
    this.onUpdate({ current_domain: domain });
  }

  _pollIdle() {
    if (!this.running) return;
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const now = new Date();
    const shouldBeIdle = idleSeconds >= this.idleThresholdSeconds;

    if (shouldBeIdle && !this.isIdle) {
      this.isIdle = true;
      // Idle actually started `idleThresholdSeconds` ago, not right now.
      this.currentIdlePeriod = { started_at: new Date(now.getTime() - this.idleThresholdSeconds * 1000) };
      this._closeCurrentSegment(now);
    } else if (!shouldBeIdle && this.isIdle) {
      this.isIdle = false;
      this._closeCurrentIdlePeriod(now);
    }
  }

  _closeCurrentSegment(endedAt = new Date()) {
    if (!this.currentSegment) return;
    const durationSeconds = Math.max(0, Math.round((endedAt - this.currentSegment.started_at) / 1000));
    if (durationSeconds > 0) {
      this.appSegments.push({ ...this.currentSegment, ended_at: endedAt, duration_seconds: durationSeconds });
    }
    this.currentSegment = null;
    this._closeCurrentWebsiteSegment(endedAt);
  }

  _closeCurrentWebsiteSegment(endedAt = new Date()) {
    if (!this.currentWebsiteSegment) return;
    const durationSeconds = Math.max(0, Math.round((endedAt - this.currentWebsiteSegment.started_at) / 1000));
    if (durationSeconds > 0) {
      this.websiteSegments.push({ ...this.currentWebsiteSegment, ended_at: endedAt, duration_seconds: durationSeconds });
    }
    this.currentWebsiteSegment = null;
  }

  _closeCurrentIdlePeriod(endedAt = new Date()) {
    if (!this.currentIdlePeriod) return;
    const durationSeconds = Math.max(0, Math.round((endedAt - this.currentIdlePeriod.started_at) / 1000));
    this.idlePeriods.push({ ...this.currentIdlePeriod, ended_at: endedAt, duration_seconds: durationSeconds });
    this.currentIdlePeriod = null;
  }

  // Called every heartbeat — hands over everything accumulated since the
  // last call and resets the buffers. Any segment still open (e.g. still
  // sitting in VS Code) is intentionally left open; it gets flushed on the
  // NEXT heartbeat once it actually ends, so durations stay accurate.
  drainForHeartbeat() {
    const payload = {
      active_seconds_delta: Math.round(this.activeSecondsSinceHeartbeat),
      idle_seconds_delta: Math.round(this.idleSecondsSinceHeartbeat),
      app_segments: this.appSegments,
      website_segments: this.websiteSegments,
      idle_periods: this.idlePeriods,
      current_app: this.currentSegment?.app_name || null,
      current_window_title: this.currentSegment?.window_title || null,
      current_domain: this.currentWebsiteSegment?.domain || null,
    };
    this.activeSecondsSinceHeartbeat = 0;
    this.idleSecondsSinceHeartbeat = 0;
    this.appSegments = [];
    this.websiteSegments = [];
    this.idlePeriods = [];
    return payload;
  }
}

module.exports = { Tracker };
