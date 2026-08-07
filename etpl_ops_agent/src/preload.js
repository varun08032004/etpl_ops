'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  login: (email, password, totpToken, backupCode) => ipcRenderer.invoke('auth:login', { email, password, totpToken, backupCode }),
  logout: () => ipcRenderer.invoke('auth:logout'),
  status: () => ipcRenderer.invoke('auth:status'),
  startSession: () => ipcRenderer.invoke('session:start'),
  stopSession: () => ipcRenderer.invoke('session:stop'),
  onStatusUpdate: (callback) => ipcRenderer.on('status:update', (_evt, patch) => callback(patch)),
});
