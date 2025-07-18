const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('infoAPI', {
  getFullInfo: () => ipcRenderer.invoke('get-full-info'),
  closeWindow: () => ipcRenderer.send('info-close'),
  setActivityIndicator: (options) => ipcRenderer.send('set-activity-indicator', options),
});