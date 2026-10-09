'use strict';

// Bound to 127.0.0.1 only — never reachable from the network, only from
// something running ON this machine. The token check on top of that stops
// some OTHER localhost process from spoofing tab-update calls; it's a
// per-install unique token stored securely via Electron's safeStorage (DPAPI).
// This prevents token extraction from config.json and ensures each installation
// has its own unique token that the browser extension must obtain at pairing time.

const http = require('http');
const config = require('../config.json');
const store = require('./store');

const PORT = config.localServerPort || 47823;

// Get per-install unique token (generated on first run, stored encrypted)
const TOKEN = store.getOrCreateLocalServerToken();

function startLocalServer(getTracker) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/tab-update') {
      res.writeHead(404);
      res.end();
      return;
    }
    if (TOKEN && req.headers['x-ethertrack-token'] !== TOKEN) {
      res.writeHead(401);
      res.end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) req.destroy(); // guard against something misbehaving — this endpoint expects a tiny JSON payload
    });
    req.on('end', () => {
      try {
        const { url } = JSON.parse(body);
        const domain = url ? new URL(url).hostname.replace(/^www\./, '') : null;
        const tracker = getTracker();
        if (domain && tracker) tracker.reportBrowserTab(domain);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end();
      }
    });
  });

  server.on('error', (err) => {
    // Most likely EADDRINUSE — another instance of the agent already
    // running. Not fatal: app/idle tracking keeps working fine without
    // this; only the extension-driven accurate website tracking is lost
    // for this instance.
    console.error('[localServer] failed to start:', err.message);
  });

  server.listen(PORT, '127.0.0.1');
  return server;
}

// Expose token for extension pairing (called via IPC from options page)
function getLocalServerToken() {
  return TOKEN;
}

module.exports = { startLocalServer, PORT, getLocalServerToken };
