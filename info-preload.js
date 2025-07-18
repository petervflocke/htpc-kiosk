const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('infoAPI', {
  getSystemDetails: () => ipcRenderer.invoke('get-system-details'), // Use the new unified handler
  closeWindow: () => ipcRenderer.send('info-close'),
  setActivityIndicator: (options) => ipcRenderer.send('set-activity-indicator', options),
});