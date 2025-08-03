const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dialogAPI', {
  onDialogOptions: (callback) => ipcRenderer.on('dialog-options', (event, ...args) => callback(...args)),
  sendResponse: (id, response) => ipcRenderer.send(`dialog-response-${id}`, response),
});