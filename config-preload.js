const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('configAPI', {
  getNetworkConfig: () => ipcRenderer.invoke('get-network-config'),
  setNetworkConfig: (config) => ipcRenderer.invoke('set-network-config', config),
  closeWindow: () => ipcRenderer.send('config-close'),
});