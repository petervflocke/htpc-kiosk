const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dialogAPI', {
  onDialogOptions: (callback) => ipcRenderer.on('dialog-options', (event, ...args) => callback(...args)),
  sendResponse: (response) => ipcRenderer.send('dialog-response', response),
});