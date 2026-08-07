'use strict';

const config = require('../config.json');

const BASE_URL = process.env.ETHERTRACK_API_BASE_URL || config.apiBaseUrl;

async function request(path, { method = 'GET', token, body, isForm = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`Could not reach EtherTrack backend at ${BASE_URL}: ${err.message}`);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json;
}

function login({ email, password, deviceName, os, agentVersion, totpToken, backupCode }) {
  return request('/agent/login', {
    method: 'POST',
    body: {
      email, password,
      company_code: config.companyCode,
      device_name: deviceName,
      os,
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

function heartbeat(token, payload) {
  return request('/agent/session/heartbeat', { method: 'POST', token, body: payload });
}

function sessionStop(token, sessionId) {
  return request('/agent/session/stop', { method: 'POST', token, body: { session_id: sessionId } });
}

function forceLogout(token, sessionId) {
  return request('/agent/session/force-logout', { method: 'POST', token, body: { session_id: sessionId } });
}

function uploadScreenshot(token, { sessionId, capturedAt, buffer, mimeType }) {
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('captured_at', capturedAt);
  form.append('image', new Blob([buffer], { type: mimeType }), `shot.${mimeType.includes('png') ? 'png' : 'jpg'}`);
  return request('/agent/screenshot', { method: 'POST', token, body: form, isForm: true });
}

module.exports = { login, getMe, sessionStart, heartbeat, sessionStop, forceLogout, uploadScreenshot, BASE_URL };
