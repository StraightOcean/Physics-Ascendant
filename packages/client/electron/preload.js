const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  scanModsFolder: () => ipcRenderer.invoke('scan-mods-folder'),
  readModFile: (filename) => ipcRenderer.invoke('read-mod-file', filename),
  startLANSever: (port) => ipcRenderer.invoke('start-lan-server', port),
  stopLANSever: () => ipcRenderer.invoke('stop-lan-server'),
});
