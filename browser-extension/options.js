'use strict';

const tokenEl = document.getElementById('token');
const saveEl = document.getElementById('save');
const statusEl = document.getElementById('status');
const dotEl = document.getElementById('dot');
const stateTextEl = document.getElementById('stateText');

chrome.storage.local.get(['token'], (res) => {
  if (res.token) tokenEl.value = res.token;
  checkConnection();
});

saveEl.addEventListener('click', () => {
  const token = tokenEl.value.trim();
  if (!token) {
    statusEl.textContent = 'Enter a token first.';
    statusEl.className = 'status err';
    return;
  }
  chrome.storage.local.set({ token }, () => {
    statusEl.textContent = 'Saved.';
    statusEl.className = 'status ok';
    checkConnection();
  });
});

// Pings the local agent (without a valid token, on purpose — a 401 still
// proves the agent process is up and listening; that's a different
// problem than "agent not running at all", and this tells the person
// which one they're looking at).
function checkConnection() {
  fetch('http://127.0.0.1:47823/tab-update', { method: 'POST', body: '{}' })
    .then(() => {
      dotEl.classList.add('connected');
      stateTextEl.textContent = 'EtherTrack Agent is running';
    })
    .catch(() => {
      dotEl.classList.remove('connected');
      stateTextEl.textContent = 'EtherTrack Agent not detected — is it running?';
    });
}
