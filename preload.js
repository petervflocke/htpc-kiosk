const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  systemCommand: (cmd) => ipcRenderer.send('system-command', cmd),
  openLinkInKiosk: (url) => ipcRenderer.send('open-link-in-kiosk', url),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  onRefreshGeolocation: (callback) => ipcRenderer.on('refresh-geolocation', callback)
});
