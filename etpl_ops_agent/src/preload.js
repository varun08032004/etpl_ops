'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  login: (email, password, totpToken, backupCode) => ipcRenderer.invoke('auth:login', { email, password, totpToken, backupCode }),
  logout: () => ipcRenderer.invoke('auth:logout'),
  status: () => ipcRenderer.invoke('auth:status'),
  onStatusUpdate: (callback) => ipcRenderer.on('status:update', (_evt, patch) => callback(patch)),
  getLocalServerToken: () => ipcRenderer.invoke('local-server:get-token'),
  // Attendance punch in/out
  punchIn: () => ipcRenderer.invoke('attendance:punch-in'),
  punchOut: () => ipcRenderer.invoke('attendance:punch-out'),
  undoPunchIn: () => ipcRenderer.invoke('attendance:undo-punch-in'),
  undoPunchOut: () => ipcRenderer.invoke('attendance:undo-punch-out'),
  getTodayAttendance: () => ipcRenderer.invoke('attendance:get-today'),
  // Device management
  getMyDevices: () => ipcRenderer.invoke('attendance:my-devices'),
  getMyDeviceRequests: () => ipcRenderer.invoke('attendance:my-device-requests'),
  requestDeviceChange: (fingerprint, name, reason) => ipcRenderer.invoke('attendance:device-change-request', { new_device_fingerprint: fingerprint, new_device_name: name, reason }),
  // Dialogs (via main process since contextIsolation blocks confirm/alert)
  confirm: (message) => ipcRenderer.invoke('dialog:confirm', message),
  alert: (message) => ipcRenderer.invoke('dialog:alert', message),
});
