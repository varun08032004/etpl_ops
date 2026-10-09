'use strict';

const { powerMonitor } = require('electron');
const os = require('os');
const { exec } = require('child_process');

const APP_POLL_MS = 1000;
const IDLE_POLL_MS = 1000;
const EXTENSION_FRESHNESS_MS = 5000;
const WORK_MODE_CHECK_MS = 30000;
const VM_CHECK_MS = 300000;

const BROWSER_PROCESSES = new Set(['chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe', 'msedgewebview2.exe']);

const MEETING_APPS = new Set([
  'zoom.exe', 'zoom.us.exe', 'zoom.vdi.exe',
  'teams.exe', 'ms-teams.exe', 'teamswebview2.exe',
  'meet.exe', 'googlemeet.exe',
  'webex.exe', 'cisco-webex.exe', 'webexhost.exe',
  'slack.exe', 'discord.exe',
  'skype.exe', 'lync.exe',
  'gotomeeting.exe', 'g2m.exe',
  'bluejeans.exe', 'whereby.exe', 'around.exe',
  'jami.exe', 'ring.exe',
  'signal.exe', 'telegram.exe', 'whatsapp.exe'
]);

let OFFICE_NETWORKS = [];
let vmDetectionCache = { isVM: false, details: [], checkedAt: 0 };

function extractDomainGuess(title) {
  if (!title) return null;
  const match = title.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function isOfficeNetwork() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        for (const network of OFFICE_NETWORKS) {
          if (ipInCidr(ip, network.cidr)) return true;
        }
      }
    }
  }
  return false;
}

function ipInCidr(ip, cidr) {
  const [rangeIp, bits] = cidr.split('/');
  const mask = ~((1 << (32 - parseInt(bits, 10))) - 1);
  const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  const rangeNum = rangeIp.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

async function detectVM() {
  const now = Date.now();
  if (vmDetectionCache.checkedAt && (now - vmDetectionCache.checkedAt) < VM_CHECK_MS) {
    return vmDetectionCache;
  }

  const details = [];
  let isVM = false;

  try {
    const { stdout } = await execAsync('wmic cpu get Manufacturer,Name,Caption /value');
    if (stdout.toLowerCase().includes('virtual') || stdout.toLowerCase().includes('vmware') || stdout.toLowerCase().includes('hyper-v')) {
      isVM = true; details.push('cpu_info_virtual');
    }
  } catch (e) {}

  try {
    const { stdout } = await execAsync('wmic computersystem get Manufacturer,Model /value');
    const out = stdout.toLowerCase();
    const vmIndicators = ['vmware', 'virtualbox', 'qemu', 'xen', 'hyper-v', 'parallels', 'innotek', 'microsoft corporation'];
    for (const indicator of vmIndicators) {
      if (out.includes(indicator)) { isVM = true; details.push(`wmi_${indicator.replace(/[^a-z]/g, '_')}`); break; }
    }
  } catch (e) {}

  try {
    const { stdout } = await execAsync('systeminfo');
    if (stdout.toLowerCase().includes('vmware') || stdout.toLowerCase().includes('virtual machine')) {
      isVM = true; details.push('systeminfo_vm');
    }
  } catch (e) {}

  try {
    const { stdout } = await execAsync('reg query "HKLM\\HARDWARE\\ACPI\\DSDT\\VBOX__" 2>nul || reg query "HKLM\\HARDWARE\\ACPI\\DSDT\\VMWARE" 2>nul || reg query "HKLM\\HARDWARE\\ACPI\\DSDT\\QEMU" 2>nul');
    if (stdout.trim()) { isVM = true; details.push('registry_acpi'); }
  } catch (e) {}

  try {
    const interfaces = os.networkInterfaces();
    const vmMacPrefixes = [
      '00:05:69', '00:0c:29', '00:1c:14', '00:50:56',
      '08:00:27',
      '00:16:3e', '00:1a:4a',
      '00:03:ff',
      '00:1c:42',
    ];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.mac) {
          const prefix = iface.mac.substring(0, 8).toLowerCase();
          if (vmMacPrefixes.includes(prefix)) { isVM = true; details.push(`mac_prefix_${prefix.replace(/:/g, '')}`); }
        }
      }
    }
  } catch (e) {}

  vmDetectionCache = { isVM, details, checkedAt: now };
  return vmDetectionCache;
}

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err && err.code !== 1) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

class Tracker {
  constructor({ idleThresholdSeconds = 300, onUpdate, excludedApps = [] } = {}) {
    this.idleThresholdSeconds = idleThresholdSeconds;
    this.onUpdate = onUpdate || (() => {});
    this.excludedApps = new Set(excludedApps.map(a => a.toLowerCase()));
    this.running = false;

    this.reportedDomain = null;
    this.reportedDomainAt = 0;
    this.lastExtensionReportAt = 0;
    this.extensionConnected = false;

    this.currentSegment = null;
    this.currentIdlePeriod = null;
    this.isIdle = false;

    this.appSegments = [];
    this.websiteSegments = [];
    this.idlePeriods = [];
    this.activeSecondsSinceHeartbeat = 0;
    this.idleSecondsSinceHeartbeat = 0;

    this.lastPollAt = null;
    this._appTimer = null;
    this._idleTimer = null;
    this._workModeTimer = null;
    this._vmTimer = null;
    this.currentWorkMode = null;
    this.currentVMStatus = false;
    
    this.lastKnownActiveApp = null;
    this.lastKnownActiveTitle = null;
    this.lastKnownDomain = null;
    this.segmentStartTime = null;
  }

  setOfficeNetworks(networks) {
    OFFICE_NETWORKS = networks || [];
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastPollAt = Date.now();
    this.segmentStartTime = Date.now();
    
    this._appTimer = setInterval(() => this._pollActiveWindow(), APP_POLL_MS);
    this._idleTimer = setInterval(() => this._pollIdle(), IDLE_POLL_MS);
    this._workModeTimer = setInterval(() => this._checkWorkMode(), WORK_MODE_CHECK_MS);
    this._vmTimer = setInterval(() => this._checkVM(), VM_CHECK_MS);
    
    this._checkWorkMode();
    this._checkVM();
    this._pollActiveWindow();
    this._pollIdle();
  }

  stop() {
    this.running = false;
    clearInterval(this._appTimer);
    clearInterval(this._idleTimer);
    clearInterval(this._workModeTimer);
    clearInterval(this._vmTimer);
    this._closeCurrentSegment();
    this._closeCurrentIdlePeriod();
  }

  async _checkVM() {
    const vmInfo = await detectVM();
    if (this.currentVMStatus !== vmInfo.isVM) {
      this.currentVMStatus = vmInfo.isVM;
      this.onUpdate({ vm_detected: vmInfo.isVM, vm_details: vmInfo.details });
    }
  }

  _checkWorkMode() {
    const isOffice = isOfficeNetwork();
    const newMode = isOffice ? 'office' : 'wfh';
    if (this.currentWorkMode !== newMode) {
      this.currentWorkMode = newMode;
      this.onUpdate({ work_mode: newMode });
    }
  }

  async _pollActiveWindow() {
    if (!this.running) return;
    
    const now = Date.now();
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
      return;
    }
    if (!win) return;

    const appName = win.owner?.name || 'Unknown';
    const windowTitle = win.title || '';

    if (this.excludedApps.has(appName.toLowerCase())) {
      this._closeCurrentSegment(now);
      return;
    }

    const appChanged = !this.currentSegment || 
      this.currentSegment.app_name !== appName || 
      this.currentSegment.window_title !== windowTitle;

    if (appChanged) {
      this._closeCurrentSegment(now);
      
      const isMeetingApp = MEETING_APPS.has(appName.toLowerCase());
      this.currentSegment = { 
        app_name: appName, 
        window_title: windowTitle, 
        started_at: new Date(now),
        is_meeting: isMeetingApp
      };
      this.segmentStartTime = now;
      this.lastKnownActiveApp = appName;
      this.lastKnownActiveTitle = windowTitle;

      if (BROWSER_PROCESSES.has(appName.toLowerCase())) {
        const extensionFresh = this.reportedDomain && (Date.now() - this.reportedDomainAt) < EXTENSION_FRESHNESS_MS;
        const domain = extensionFresh ? this.reportedDomain : extractDomainGuess(windowTitle);
        if (domain) {
          this.currentWebsiteSegment = { domain, started_at: new Date(now) };
          this.lastKnownDomain = domain;
        } else {
          this.currentWebsiteSegment = null;
        }
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

  reportBrowserTab(domain) {
    if (!domain || !this.running) return;
    this.reportedDomain = domain;
    this.reportedDomainAt = Date.now();
    this.lastExtensionReportAt = Date.now();
    this.extensionConnected = true;

    if (!this.currentSegment || !BROWSER_PROCESSES.has(this.currentSegment.app_name.toLowerCase())) return;
    if (this.currentWebsiteSegment?.domain === domain) return;

    const now = Date.now();
    this._closeCurrentWebsiteSegment(now);
    this.currentWebsiteSegment = { domain, started_at: new Date(now) };
    this.lastKnownDomain = domain;
    this.onUpdate({ current_domain: domain });
  }

  checkExtensionConnection() {
    if (!this.running) return true;
    if (!this.lastExtensionReportAt) return false;
    
    const timeSinceLastReport = Date.now() - this.lastExtensionReportAt;
    const EXTENSION_TIMEOUT_MS = 30000;
    return timeSinceLastReport < EXTENSION_TIMEOUT_MS;
  }

  _pollIdle() {
    if (!this.running) return;
    
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const now = Date.now();
    const shouldBeIdle = idleSeconds >= this.idleThresholdSeconds;

    if (shouldBeIdle && !this.isIdle) {
      this.isIdle = true;
      this.currentIdlePeriod = { started_at: new Date(now - this.idleThresholdSeconds * 1000) };
      this._closeCurrentSegment(now);
    } else if (!shouldBeIdle && this.isIdle) {
      this.isIdle = false;
      this._closeCurrentIdlePeriod(now);
    }
  }

  _closeCurrentSegment(endedAt = Date.now()) {
    if (!this.currentSegment) return;
    const durationSeconds = Math.max(0, Math.round((endedAt - this.currentSegment.started_at) / 1000));
    if (durationSeconds > 0) {
      this.appSegments.push({ 
        ...this.currentSegment, 
        ended_at: new Date(endedAt), 
        duration_seconds: durationSeconds 
      });
    }
    this.currentSegment = null;
    this._closeCurrentWebsiteSegment(endedAt);
  }

  _closeCurrentWebsiteSegment(endedAt = Date.now()) {
    if (!this.currentWebsiteSegment) return;
    const durationSeconds = Math.max(0, Math.round((endedAt - this.currentWebsiteSegment.started_at) / 1000));
    if (durationSeconds > 0) {
      this.websiteSegments.push({ 
        ...this.currentWebsiteSegment, 
        ended_at: new Date(endedAt), 
        duration_seconds: durationSeconds 
      });
    }
    this.currentWebsiteSegment = null;
  }

  _closeCurrentIdlePeriod(endedAt = Date.now()) {
    if (!this.currentIdlePeriod) return;
    const durationSeconds = Math.max(0, Math.round((endedAt - this.currentIdlePeriod.started_at) / 1000));
    this.idlePeriods.push({ 
      ...this.currentIdlePeriod, 
      ended_at: new Date(endedAt), 
      duration_seconds: durationSeconds 
    });
    this.currentIdlePeriod = null;
  }

  drainForHeartbeat() {
    const payload = {
      active_seconds_delta: Math.round(this.activeSecondsSinceHeartbeat),
      idle_seconds_delta: Math.round(this.idleSecondsSinceHeartbeat),
      app_segments: this.appSegments,
      website_segments: this.websiteSegments,
      idle_periods: this.idlePeriods,
      current_app: this.currentSegment?.app_name || this.lastKnownActiveApp || null,
      current_window_title: this.currentSegment?.window_title || this.lastKnownActiveTitle || null,
      current_domain: this.currentWebsiteSegment?.domain || this.lastKnownDomain || null,
      work_mode: this.currentWorkMode,
      vm_detected: this.currentVMStatus,
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