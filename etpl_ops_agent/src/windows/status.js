'use strict';

const badgeEl = document.getElementById('badge');
const clockInEl = document.getElementById('clockIn');
const workedEl = document.getElementById('worked');
const idleEl = document.getElementById('idle');
const currentAppEl = document.getElementById('currentApp');
const currentSiteEl = document.getElementById('currentSite');
const punchInBtn = document.getElementById('punchInBtn');
const punchOutBtn = document.getElementById('punchOutBtn');
const undoPunchInBtn = document.getElementById('undoPunchInBtn');
const undoPunchOutBtn = document.getElementById('undoPunchOutBtn');
const signOutBtn = document.getElementById('signOutBtn');
const pairingSection = document.getElementById('pairingSection');
const pairingTokenEl = document.getElementById('pairingToken');
const copyTokenBtn = document.getElementById('copyTokenBtn');
const punchStatus = document.getElementById('punchStatus');
const punchInTimeEl = document.getElementById('punchInTime');
const punchOutTimeEl = document.getElementById('punchOutTime');
const lateBadge = document.getElementById('lateBadge');
const earlyBadge = document.getElementById('earlyBadge');
const workingHoursEl = document.getElementById('workingHours');
const nextPunchOutEl = document.getElementById('nextPunchOut');
const workingHoursInfo = document.getElementById('workingHoursInfo');

let clockInAt = null;

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

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function render(hasPunchedIn, hasPunchedOut, lateMinutes, earlyLeaveMinutes, workingHours, attendanceStatus) {
  badgeEl.textContent = 'Online';
  badgeEl.className = 'badge online';
  
  // Always show punch controls (no session controls)
  punchStatus.style.display = 'flex';
  
  // Punch In button - only if not punched in yet
  punchInBtn.style.display = hasPunchedIn ? 'none' : 'block';
  
  // Punch Out button - only if punched in but not punched out
  punchOutBtn.style.display = (hasPunchedIn && !hasPunchedOut) ? 'block' : 'none';
  
  // Undo Punch In - only if punched in (pending) and not punched out
  const canUndoPunchIn = hasPunchedIn && !hasPunchedOut && attendanceStatus === 'pending';
  undoPunchInBtn.style.display = canUndoPunchIn ? 'block' : 'none';
  
  // Undo Punch Out - only if fully completed
  const canUndoPunchOut = hasPunchedIn && hasPunchedOut;
  undoPunchOutBtn.style.display = canUndoPunchOut ? 'block' : 'none';
  
  // Clock in display
  clockInEl.textContent = clockInAt ? `Since ${fmtTime(clockInAt)}` : '';
  
  // Punch status
  punchInTimeEl.textContent = hasPunchedIn ? `In: ${fmtTime(clockInAt)}` : 'In: —';
  punchInTimeEl.className = hasPunchedIn ? 'time punch-in' : 'time';
  
  punchOutTimeEl.textContent = hasPunchedOut ? `Out: ${fmtTime(punchOutTimeEl.dataset.punchOutAt || '')}` : 'Out: —';
  punchOutTimeEl.className = hasPunchedOut ? 'time punch-out' : 'time';
  
  // Late/Early badges
  if (lateMinutes > 0) {
    lateBadge.textContent = `⚠ Late ${lateMinutes}min`;
    lateBadge.classList.remove('hidden');
  } else {
    lateBadge.classList.add('hidden');
  }
  
  if (earlyLeaveMinutes > 0) {
    earlyBadge.textContent = `⚠ Early ${earlyLeaveMinutes}min`;
    earlyBadge.classList.remove('hidden');
  } else {
    earlyBadge.classList.add('hidden');
  }
  
  // Working hours display
  if (workingHours) {
    workingHoursEl.textContent = `${workingHours.punch_in_time?.slice(0,5) || '09:30'} — ${workingHours.punch_out_time?.slice(0,5) || '19:00'} (Mon-Fri)`;
    const grace = workingHours.grace_period_minutes || 15;
    nextPunchOutEl.textContent = `Auto punch-out at ${workingHours.punch_out_time?.slice(0,5) || '19:00'} + ${grace}min grace`;
    workingHoursInfo.style.display = 'block';
  }
}

async function refresh() {
  const status = await window.agent.status();
  clockInAt = status.clockIn;
  setBase(status.workedSeconds, status.idleSeconds);
  render(status.punchIn, status.punchOut, status.lateMinutes || 0, status.earlyLeaveMinutes || 0, status.workingHours, status.attendanceStatus);
  
  // Fetch and display pairing token for browser extension
  try {
    const { token } = await window.agent.getLocalServerToken();
    if (token) {
      pairingTokenEl.textContent = token;
      pairingSection.style.display = 'block';
    }
  } catch (err) {
    console.error('[status] Failed to get pairing token:', err);
  }
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
  if (patch.punchIn !== undefined) {
    render(true, patch.punchOut || false, patch.lateMinutes || 0, patch.earlyLeaveMinutes || 0, patch.workingHours, patch.attendanceStatus);
  }
  if (patch.punchOut !== undefined) {
    punchOutTimeEl.dataset.punchOutAt = patch.punchOut || new Date().toISOString();
    render(patch.punchIn || true, true, patch.lateMinutes || 0, patch.earlyLeaveMinutes || 0, patch.workingHours, patch.attendanceStatus);
  }
  // Auto punch-out notification
  if (patch.autoPunchedOut) {
    alert('⚠️ Auto punch-out: Your session was automatically ended at the scheduled punch-out time.');
  }
  // ⚠️ Show VM detection warning in tray
  if (patch.vm_detected === true) {
    if (!document.getElementById('vm-warning')) {
      const warning = document.createElement('div');
      warning.id = 'vm-warning';
      warning.style.cssText = 'background:#fff3cd;color:#856404;padding:8px;margin:8px 0;border-radius:4px;font-size:12px;border:1px solid #ffeeba;';
      warning.innerHTML = '⚠️ <strong>VM Detected:</strong> Running in a virtual machine — performance review will be flagged.';
      document.querySelector('.current').prepend(warning);
    }
  } else {
    const warning = document.getElementById('vm-warning');
    if (warning) warning.remove();
  }
});

// Punch In
punchInBtn.addEventListener('click', async () => {
  punchInBtn.disabled = true;
  try {
    const res = await window.agent.punchIn();
    if (res.ok && res.record) {
      clockInAt = res.record.clock_in;
      punchOutTimeEl.dataset.punchOutAt = '';
      render(true, false, res.record.late_minutes || 0, 0, null, res.record.status);
    } else {
      alert(res.error || 'Punch in failed');
    }
  } catch (err) {
    alert(err.message || 'Could not punch in.');
  } finally {
    punchInBtn.disabled = false;
  }
});

// Punch Out
punchOutBtn.addEventListener('click', async () => {
  punchOutBtn.disabled = true;
  try {
    const res = await window.agent.punchOut();
    if (res.ok && res.record) {
      punchOutTimeEl.dataset.punchOutAt = res.record.clock_out;
      render(true, true, res.record.late_minutes || 0, res.record.early_leave_minutes || 0, null, res.record.status);
    } else {
      alert(res.error || 'Punch out failed');
    }
  } catch (err) {
    alert(err.message || 'Could not punch out.');
  } finally {
    punchOutBtn.disabled = false;
  }
});

// Undo Punch In
undoPunchInBtn.addEventListener('click', async () => {
  if (!confirm('Undo punch in? This will remove your punch-in record for today.')) return;
  undoPunchInBtn.disabled = true;
  try {
    const res = await window.agent.undoPunchIn();
    if (res.ok) {
      clockInAt = null;
      punchOutTimeEl.dataset.punchOutAt = '';
      render(false, false, 0, 0, null, 'pending');
    } else {
      alert(res.error || 'Undo punch in failed');
    }
  } catch (err) {
    alert(err.message || 'Could not undo punch in.');
  } finally {
    undoPunchInBtn.disabled = false;
  }
});

// Undo Punch Out
undoPunchOutBtn.addEventListener('click', async () => {
  if (!confirm('Undo punch out? This will revert to punched-in state.')) return;
  undoPunchOutBtn.disabled = true;
  try {
    const res = await window.agent.undoPunchOut();
    if (res.ok && res.record) {
      punchOutTimeEl.dataset.punchOutAt = '';
      render(true, false, res.record.late_minutes || 0, 0, null, res.record.status);
    } else {
      alert(res.error || 'Undo punch out failed');
    }
  } catch (err) {
    alert(err.message || 'Could not undo punch out.');
  } finally {
    undoPunchOutBtn.disabled = false;
  }
});

signOutBtn.addEventListener('click', async () => {
  if (!confirm('Sign out of EtherTrack Agent on this device? This will stop any active session.')) return;
  await window.agent.logout();
  window.close();
});

copyTokenBtn.addEventListener('click', async () => {
  const token = pairingTokenEl.textContent;
  if (token) {
    await navigator.clipboard.writeText(token);
    const originalText = copyTokenBtn.textContent;
    copyTokenBtn.textContent = 'Copied!';
    setTimeout(() => { copyTokenBtn.textContent = originalText; }, 2000);
  }
});

// Auto-refresh today's attendance on load to get punch status
async function loadTodayAttendance() {
  try {
    const res = await window.agent.getTodayAttendance();
    if (res.ok && res.record) {
      clockInAt = res.record.clock_in;
      render(res.record.clock_in ? true : false, !!res.record.clock_out, res.record.late_minutes || 0, res.record.early_leave_minutes || 0, null, res.record.status);
    }
  } catch (err) {
    console.error('[status] Failed to load today attendance:', err);
  }
}

refresh();
loadTodayAttendance();