'use strict';

const config = require('../config.json');
const os = require('os');

const ENV = process.env.ETHERTRACK_ENV || config.environment || 'development';
const BASE_URL = process.env.ETHERTRACK_API_BASE_URL || 
  (ENV === 'production' ? config.apiBaseUrlProd : config.apiBaseUrl);

console.log(`[api] Environment: ${ENV}, Base URL: ${BASE_URL}`);

// Generate hardware fingerprint from system components
async function generateHwIdComponents() {
  // Use os and node's built-in modules to get stable hardware identifiers
  // Note: These require native modules or WMI on Windows for real hardware IDs
  // For now, we'll use a combination of available identifiers
  
  const cpuId = getCpuId();
  const motherboardSerial = getMotherboardSerial();
  const diskSerial = getDiskSerial();
  const macAddresses = getMacAddresses();
  
  return { cpuId, motherboardSerial, diskSerial, macAddresses };
}

function getCpuId() {
  try {
    // On Windows, use wmic to get CPU ID
    // This is a placeholder - in production, use a native module
    const cpus = os.cpus();
    if (cpus.length > 0) {
      return `cpu-${cpus[0].model}-${cpus[0].speed}`.replace(/\s+/g, '-').toLowerCase();
    }
  } catch (e) {}
  return 'unknown-cpu';
}

function getMotherboardSerial() {
  // Placeholder - would use WMI on Windows: wmic baseboard get serialnumber
  return 'unknown-motherboard';
}

function getDiskSerial() {
  // Placeholder - would use WMI: wmic diskdrive get serialnumber
  return 'unknown-disk';
}

function getMacAddresses() {
  const interfaces = os.networkInterfaces();
  const macs = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.mac && iface.mac !== '00:00:00:00:00:00' && !iface.internal) {
        macs.push(iface.mac.toLowerCase());
      }
    }
  }
  return macs.sort();
}

async function request(path, { method = 'GET', token, body, isForm = false, hwId, heartbeatSeq, retries = 3 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (hwId) headers['X-EtherTrack-HwId'] = JSON.stringify(hwId);
  if (heartbeatSeq !== undefined) headers['X-EtherTrack-Heartbeat-Seq'] = String(heartbeatSeq);
  if (!isForm) headers['Content-Type'] = 'application/json';

  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const url = `${BASE_URL}${path}`;
      console.log(`[api] ${method} ${url} (attempt ${attempt + 1})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(url, {
        method,
        headers,
        body: isForm ? body : body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log(`[api] ${method} ${url} -> ${res.status}`);
      
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const error = new Error(json?.error || `Request failed (${res.status})`);
        error.status = res.status;
        error.code = json?.code;
        
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw error;
        }
        
        lastError = error;
      } else {
        return json;
      }
    } catch (err) {
      lastError = err;
      console.error(`[api] ${method} ${BASE_URL}${path} ERROR:`, err.name, err.message, err.cause?.message || '');
      
      if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }
    }
    
    if (attempt < retries) {
      const baseDelay = Math.pow(2, attempt) * 1000;
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      console.log(`[api] Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${Math.round(delay)}ms: ${lastError?.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  if (path === '/agent/session/heartbeat' && token) {
    queueFailedHeartbeat({ path, method, token, body, isForm, hwId, heartbeatSeq });
  }
  
  throw lastError;
}

// Failed request queue for offline support
const failedRequestQueue = [];
const MAX_QUEUE_SIZE = 100;

function queueFailedHeartbeat(requestData) {
  if (failedRequestQueue.length >= MAX_QUEUE_SIZE) {
    failedRequestQueue.shift(); // Remove oldest
  }
  failedRequestQueue.push({ ...requestData, queuedAt: Date.now() });
  console.log(`[api] Queued failed heartbeat (queue size: ${failedRequestQueue.length})`);
}

// Process queued requests when connection restored
let queueProcessorRunning = false;
async function processQueuedRequests(token) {
  if (queueProcessorRunning || failedRequestQueue.length === 0 || !token) return;
  
  queueProcessorRunning = true;
  console.log(`[api] Processing ${failedRequestQueue.length} queued requests...`);
  
  while (failedRequestQueue.length > 0) {
    const requestData = failedRequestQueue[0];
    try {
      await request(requestData.path, { ...requestData, retries: 0 }); // No retries for queued
      failedRequestQueue.shift(); // Remove on success
    } catch (err) {
      // If still failing, stop processing and keep in queue
      console.log(`[api] Queued request still failing, will retry later: ${err.message}`);
      break;
    }
  }
  
  queueProcessorRunning = false;
}

// Call this after successful heartbeat to process queue
async function flushRequestQueue(token) {
  if (failedRequestQueue.length > 0) {
    await processQueuedRequests(token);
  }
}

function login({ email, password, deviceName, os: osType, agentVersion, totpToken, backupCode }) {
  return request('/agent/login', {
    method: 'POST',
    body: {
      email, password,
      company_code: config.companyCode,
      device_name: deviceName,
      os: osType,
      agent_version: agentVersion,
      totp_token: totpToken,
      backup_code: backupCode,
    },
  });
}

function getMe(token) {
  return request('/agent/me', { token });
}

function sessionStart(token) {
  return request('/agent/session/start', { method: 'POST', token, body: {} });
}

function heartbeat(token, payload, heartbeatSeq, hwId) {
  return request('/agent/session/heartbeat', { 
    method: 'POST', 
    token, 
    body: { ...payload, heartbeat_seq: heartbeatSeq },
    hwId,
    heartbeatSeq,
  });
}

function sessionStop(token, sessionId) {
  return request('/agent/session/stop', { method: 'POST', token, body: { session_id: sessionId } });
}

function forceLogout(token, sessionId) {
  return request('/agent/session/force-logout', { method: 'POST', token, body: { session_id: sessionId } });
}

function uploadScreenshot(token, { sessionId, capturedAt, buffer, mimeType, monitorIndex = 0, monitorName = 'Primary', hash }) {
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('captured_at', capturedAt);
  form.append('monitor_index', String(monitorIndex));
  form.append('monitor_name', monitorName);
  if (hash) form.append('hash', hash);
  form.append('image', new Blob([buffer], { type: mimeType }), `shot_${monitorIndex}.${mimeType.includes('png') ? 'png' : 'jpg'}`);
  return request('/agent/screenshot', { method: 'POST', token, body: form, isForm: true });
}

async function punchIn(token, { source = 'agent', device_info = {} } = {}) {
  return request('/attendance/punch-in', { method: 'POST', token, body: { source, device_info } });
}

async function punchOut(token, { source = 'agent', device_info = {} } = {}) {
  return request('/attendance/punch-out', { method: 'POST', token, body: { source, device_info } });
}

async function getTodayAttendance(token) {
  return request('/attendance/me/today', { token });
}

async function undoPunchIn(token) {
  return request('/attendance/punch-in/undo', { method: 'POST', token });
}

async function undoPunchOut(token) {
  return request('/attendance/punch-out/undo', { method: 'POST', token });
}

module.exports = { login, getMe, sessionStart, heartbeat, sessionStop, forceLogout, uploadScreenshot, BASE_URL, generateHwIdComponents, flushRequestQueue, punchIn, punchOut, getTodayAttendance, undoPunchIn, undoPunchOut };
