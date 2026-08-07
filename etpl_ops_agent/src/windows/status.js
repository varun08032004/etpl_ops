'use strict';

const badgeEl = document.getElementById('badge');
const clockInEl = document.getElementById('clockIn');
const workedEl = document.getElementById('worked');
const idleEl = document.getElementById('idle');
const currentAppEl = document.getElementById('currentApp');
const currentSiteEl = document.getElementById('currentSite');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const signOutBtn = document.getElementById('signOutBtn');

let clockInAt = null;

// This is the actual fix for the dashboard/tray mismatch: baseWorked/
// baseIdle are always seeded from the SERVER's confirmed totals (on open,
// on Start Work, and after every heartbeat) — never from a local counter
// that quietly resets to 0 whenever this window closes and reopens.
// Between syncs we tick baseWorked forward locally by wall-clock time just
// so the display feels alive; any drift self-corrects at the next
// heartbeat (≤ heartbeat_interval_seconds later, so worst case ~30s off,
// never "restarted from zero").
let baseWorked = 0;
let baseIdle = 0;
let baseSyncedAt = Date.now();

function setBase(worked, idle) {
  baseWorked = worked ?? baseWorked;
  baseIdle = idle ?? baseIdle;
  baseSyncedAt = Date.now();
  idleEl.textContent = fmt(baseIdle);
}

function fmt(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function render(sessionOpen) {
  badgeEl.textContent = sessionOpen ? 'Online' : 'Offline';
  badgeEl.className = `badge ${sessionOpen ? 'online' : 'offline'}`;
  startBtn.style.display = sessionOpen ? 'none' : 'block';
  stopBtn.style.display = sessionOpen ? 'block' : 'none';
  clockInEl.textContent = clockInAt ? `Since ${new Date(clockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
}

async function refresh() {
  const status = await window.agent.status();
  clockInAt = status.clockIn;
  setBase(status.workedSeconds, status.idleSeconds);
  render(status.sessionOpen);
}

setInterval(() => {
  if (badgeEl.classList.contains('online')) {
    const elapsed = Math.floor((Date.now() - baseSyncedAt) / 1000);
    workedEl.textContent = fmt(baseWorked + elapsed);
  }
}, 1000);

window.agent.onStatusUpdate((patch) => {
  if (patch.current_app !== undefined) currentAppEl.textContent = patch.current_app || '—';
  if (patch.current_domain !== undefined) currentSiteEl.textContent = patch.current_domain || '';
  if (patch.workedSeconds !== undefined || patch.idleSeconds !== undefined) {
    setBase(patch.workedSeconds, patch.idleSeconds);
  }
  if (patch.sessionOpen !== undefined) {
    clockInAt = patch.clockIn || clockInAt;
    render(patch.sessionOpen);
  }
});

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  try {
    const res = await window.agent.startSession();
    clockInAt = res.clockIn;
    setBase(res.workedSeconds, res.idleSeconds);
    render(true);
  } catch (err) {
    alert(err.message || 'Could not start session.');
  } finally {
    startBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', async () => {
  stopBtn.disabled = true;
  try {
    await window.agent.stopSession();
    render(false); // baseWorked/baseIdle intentionally left as-is — today's total stays visible even once offline
  } catch (err) {
    alert(err.message || 'Could not stop session.');
  } finally {
    stopBtn.disabled = false;
  }
});

signOutBtn.addEventListener('click', async () => {
  if (!confirm('Sign out of EtherTrack Agent on this device? This will stop any active session.')) return;
  await window.agent.logout();
  window.close();
});

refresh();
