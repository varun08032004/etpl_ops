'use strict';

// Talks ONLY to 127.0.0.1 — this never leaves the machine. See
// agent/src/localServer.js on the other end. If EtherTrack Agent isn't
// running (not installed, not logged in, computer without the agent at
// all), every fetch here just fails silently — no retry storm, no error
// shown to the user, this extension simply does nothing.
const LOCAL_SERVER_URL = 'http://127.0.0.1:47823/tab-update';

let token = null;
chrome.storage.local.get(['token'], (res) => { token = res.token || null; });
chrome.storage.onChanged.addListener((changes) => {
  if (changes.token) token = changes.token.newValue;
});

let lastReportedUrl = null;
let debounceTimer = null;

function reportTab(tab) {
  if (!tab || !tab.active || !tab.url) return;
  if (!/^https?:\/\//.test(tab.url)) return; // skip chrome://, edge://, file://, extension pages — nothing to report
  if (tab.url === lastReportedUrl) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    lastReportedUrl = tab.url;
    fetch(LOCAL_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-EtherTrack-Token': token || '' },
      body: JSON.stringify({ url: tab.url, title: tab.title || '' }),
    }).catch(() => {
      // Agent not running/reachable — expected outside work hours. Not an error state.
    });
  }, 400); // small debounce so a fast typed-URL/redirect chain doesn't fire a report per intermediate URL
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return; // tab closed before we got to it
    reportTab(tab);
  });
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') reportTab(tab);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return; // browser itself lost focus — the agent's own app-poll already handles "not in the browser at all"
  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (tabs[0]) reportTab(tabs[0]);
  });
});
