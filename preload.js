const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  systemCommand: (cmd) => ipcRenderer.send('system-command', cmd),
  openLinkInKiosk: (url) => ipcRenderer.send('open-link-in-kiosk', url),
  getSystemDetails: () => ipcRenderer.invoke('get-system-details'), // Use the new unified handler
  onRefreshGeolocation: (callback) => ipcRenderer.on('refresh-geolocation', callback),
  onRefreshSidebar: (callback) => ipcRenderer.on('refresh-sidebar', callback),
  onSetActivityIndicator: (callback) => ipcRenderer.on('set-activity-indicator', callback),
});
