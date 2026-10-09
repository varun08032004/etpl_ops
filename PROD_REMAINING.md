# PRODUCTION DEPLOYMENT - REMAINING ITEMS

## 🎯 **CRITICAL - Must Complete Before Go-Live**

### 1. **Real Office CIDR Configuration** ⚠️
**Status:** Script ready, needs actual IP
**Action Required:**
```bash
# Get your office public IP from office network:
# https://whatismyip.com (run from office laptop)

# Then run:
export PUNE_OFFICE_CIDR="203.0.113.0/24"  # Replace with actual
node backend/scripts/set-pune-office-cidr.js
```
**Location:** `backend/scripts/set-pune-office-cidr.js`
**Impact:** Without this, office/WFH detection defaults to placeholder CIDR

---

### 2. **Agent Build & Watchdog Installation** ⚠️
**Status:** Code complete, needs Windows build machine
**Action Required:**
```bash
# On Windows machine with Visual Studio Build Tools:
cd etpl_ops_agent
npm install
npm run dist          # Produces NSIS installer in dist/

# Deploy via Intune/GPO/SCCM
# Then on each machine (Admin):
install-watchdog.bat
```
**Location:** `etpl_ops_agent/install-watchdog.bat`, `etpl_ops_agent/uninstall-watchdog.bat`
**Impact:** Without watchdog, agent can be killed/uninstalled by users

---

### 3. **Browser Extension Deployment** ⚠️
**Status:** Extension code exists, needs packaging
**Action Required:**
```bash
# Package for Chrome Web Store / Edge Add-ons / Internal distribution
cd browser-extension
# zip extension folder for internal distribution
# Or publish to Chrome Web Store (requires $5 dev fee)
```
**Location:** `browser-extension/`
**Impact:** Without extension, website tracking falls back to window-title guess (inaccurate)

---

### 4. **End-to-End Testing** ⚠️ **NOT YET DONE**
**Status:** Code written + syntax checked, **no runtime testing**
**Required Tests:**
| Test | Status |
|------|--------|
| Agent install on clean Windows VM | ❌ |
| Auto-login on reboot | ❌ |
| Session start/stop (punch in/out) | ❌ |
| Idle detection (5min threshold) | ❌ |
| Heartbeat every 30s | ❌ |
| Screenshot capture + watermark | ❌ |
| Multi-monitor capture | ❌ |
| Work mode switch (office ↔ WFH) | ❌ |
| VM detection flag | ❌ |
| Extension connectivity | ❌ |
| Network disconnect/reconnect | ❌ |
| Watchdog restart on kill | ❌ |
| Token encryption (DPAPI) | ❌ |
| 2FA login flow | ❌ |
| HR dashboard: employee summary | ❌ |
| HR dashboard: productivity by location | ❌ |
| Performance cycle activate/close | ❌ |
| Composite score calculation | ❌ |

---

## 📋 **ATTENDANCE SYSTEM - CONFIRMED WORKING (Code Level)**

### Punch In / Punch Out Logic
**Backend: `backend/routes/agent.js`**

| Action | Endpoint | What Happens |
|--------|----------|--------------|
| **Punch In** | `POST /agent/session/start` | Creates `agent_sessions` row, `attendance_records` status='present', clock_in=now |
| **Punch Out (graceful)** | `POST /agent/session/stop` | Updates session `clock_out=now`, `end_reason='logout'`, updates attendance |
| **Force Logout** | `POST /agent/session/force-logout` | On OS shutdown/logoff, `end_reason='force_logout'` |
| **Auto-Timeout** | `closeStaleSessions()` | 10min no heartbeat → `end_reason='timeout'` |
| **Cron Cleanup** | `scripts/close-stale-sessions.js` | Server-side safety net |

**Attendance Records Table:**
- `clock_in` / `clock_out` timestamps
- `active_seconds` / `idle_seconds` accumulated
- `status`: present/absent/half_day/on_leave/holiday/weekend/wfh
- `source`: 'agent' (vs manual)

---

## 🔧 **MONITORING - CONFIRMED WORKING (Code Level)**

### What's Tracked Every 30s Heartbeat
| Data | Source |
|------|--------|
| Active app + window title | `active-win` poll (3s) |
| Current website domain | Browser extension → local server |
| Idle periods | `powerMonitor.getSystemIdleTime()` |
| App usage segments | App switches (start/end/duration) |
| Website segments | Tab switches (start/end/duration) |
| Work mode | CIDR check vs office networks |
| VM status | CPUID, WMI, registry, MAC prefixes |

### Productivity Classification
- **Productive:** VS Code, Terminal, Zoom, Teams, Meet, Jira, GitHub, etc. (configurable via `productivity_rules`)
- **Unproductive:** YouTube, Facebook, Instagram, Netflix, etc.
- **Neutral:** File Explorer, Settings, unknown apps
- **Blocked:** Explicitly blocked patterns

---

## 📝 **FRONTEND ALERT MARKERS NEEDED**

Add ⚠️ alert icons in these frontend sections:

### HR Dashboard → Performance
```
📊 Performance Reviews
   ⚠️ "Monitoring scores auto-populated on cycle activate — verify office CIDR configured"
   ⚠️ "Composite score: 30% monitoring + 50% manager + 20% goals"
```

### HR Dashboard → Monitoring → Live
```
📈 Live Monitoring
   ⚠️ "Office/WFH detection requires office_networks table configured"
   ⚠️ "Browser extension required for accurate website tracking"
```

### Admin → Settings → Monitoring
```
⚙️ Monitoring Settings
   ⚠️ "office_networks must be configured for Office/WFH detection"
   ⚠️ "enforce_office_network = false (enable after CIDR verified)"
```

### Employee → Agent Status (Tray Popup)
```
🟢 EtherTrack Agent
   ⚠️ "VM detected — performance review will be flagged" (if vm_detected=true)
   ℹ️ "Work mode: Office" / "Work mode: WFH" / "Work mode: Hybrid"
```

---

## 📦 **DEPLOYMENT ORDER**

```
1. [ ] Set PUNE_OFFICE_CIDR in env / run set-pune-office-cidr.js
2. [ ] Build agent on Windows: npm run dist
3. [ ] Publish browser extension (internal or Chrome Web Store)
4. [ ] Deploy agent via Intune/GPO + watchdog service
5. [ ] Create first review cycle in HR → Performance → Cycles
6. [ ] Activate cycle → monitoring scores auto-populate
7. [ ] Test with 2-3 pilot users for 1 week
8. [ ] Go live
```

---

## ❌ **WHAT I HAVEN'T TESTED (Critical Gap)**

> **I have only written code and syntax-checked it.** No runtime testing has been performed:
> - No agent installed on any machine
> - No heartbeat received by backend
> - No screenshots uploaded
> - No performance cycle activated
> - No watchdog service installed

**Recommendation:** Spin up a clean Windows VM, install agent, run through full workflow before any pilot deployment.