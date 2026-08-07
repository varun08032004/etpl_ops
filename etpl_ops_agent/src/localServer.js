'use strict';

// Bound to 127.0.0.1 only — never reachable from the network, only from
// something running ON this machine. The token check on top of that stops
// some OTHER localhost process from spoofing tab-update calls; it's a
// shared secret baked into both this config.json and the extension's
// options page at setup time, not a cryptographic identity — same trust
// model as the agent's own company_code. Good enough for "only the
// EtherTrack extension talks to this," not meant to survive a
// sophisticated local attacker with access to the same machine.

const http = require('http');
const config = require('../config.json');

const PORT = config.localServerPort || 47823;
const TOKEN = config.localServerToken;

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

module.exports = { startLocalServer, PORT };
