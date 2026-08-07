# EtherTrack Agent

Windows desktop agent for ETPL Ops. Sits in the tray, tracks attendance,
active application, best-effort website domain, and idle time, and syncs to
the backend every 30 seconds (configurable). Talks only to `/api/agent/*`
on your ETPL Ops backend — see `backend/routes/agent.js`.

## Before you build

1. Edit `config.json` — point `apiBaseUrl` at your real backend (not
   `localhost` — this has to be reachable from every employee's laptop) and
   set `companyCode` to match `AGENT_COMPANY_CODE` in the backend's `.env`.
2. Replace `assets/icon.ico` — the one in this bundle is a **placeholder,
   not a real .ico**. `electron-builder` will fail on the Windows build
   until you drop in a proper multi-resolution `.ico`. `assets/tray-icon.png`
   should also be swapped for real branding (16x16 or 32x32 PNG is fine
   for the tray).

## Run in dev (on Windows, or WSL with a display)

```bash
cd agent
npm install
npm start
```

## Build the installer

```bash
npm run dist
```

Produces an NSIS installer under `agent/dist/`. Must be run **on Windows**
(or in CI with a Windows runner) — `active-win`'s native binding and the
NSIS packager are both Windows-specific. This sandbox is Linux, so I
verified the agent's logic (segment tracking, idle detection, domain
extraction — see the mocked test I ran while building this) but could not
compile or run the actual installer here.

## What's real vs. best-effort

- **Attendance, idle detection, active-application tracking** — fully
  real. Idle uses Electron's built-in `powerMonitor.getSystemIdleTime()`
  (same signal Windows itself uses for screen lock), and app tracking uses
  `active-win` to poll the focused window every 3s.
- **Website domain tracking** — best-effort only, and this is worth being
  honest about: browser window titles usually show the page `<title>`, not
  the URL, so `extractDomainGuess()` in `src/tracker.js` only catches
  cases where a site happens to put its own domain in the title. For
  reliable per-site tracking you'd want a small companion browser
  extension (Chrome/Edge) that reports the active tab's URL to this agent
  over a local port or native messaging — that's a real follow-up piece,
  not something to fake here.
- **Force-logout on crash** — best-effort (`powerMonitor.on('shutdown')`
  fires on graceful shutdown/restart/logoff, not on a hard power cut). The
  backend's `closeStaleSessions()` is the real safety net — it auto-closes
  any session with no heartbeat for 10 minutes, from the *server* side,
  regardless of what the agent managed to report.

## Security notes

- The agent JWT (30-day expiry) is encrypted at rest via Electron's
  `safeStorage`, which uses Windows DPAPI tied to the logged-in Windows
  account — the same mechanism Chrome uses for saved passwords. A copied
  token file is useless off that machine/account.
- Each device gets its own row in `agent_devices` and can be revoked
  independently (HR → Monitoring → Devices, or `POST
  /api/monitoring/devices/:id/revoke`) without touching the employee's
  portal login.
- The consent notice from `monitoring_settings.consent_notice` is fetched
  and shown before the employee ever starts a session — update the backend
  copy in the HR settings UI (or straight in the DB for now — an admin UI
  for `monitoring_settings` beyond productivity rules wasn't built yet)
  rather than editing the agent.

## Files

```
agent/
  config.json          — apiBaseUrl + companyCode, edit before building
  package.json          — electron-builder config (NSIS target for Windows)
  src/
    main.js              — tray, windows, IPC, heartbeat/screenshot loops, auto-start
    preload.js            — contextBridge — renderer only gets 6 named calls, nothing else
    api.js                 — HTTP client for /api/agent/*
    store.js                — encrypted token storage (safeStorage)
    tracker.js                — active-window polling, idle detection, segment batching
    windows/
      login.html + login.js    — sign-in screen
      status.html + status.js   — tray popup: live status, Start/Stop, sign out
```
