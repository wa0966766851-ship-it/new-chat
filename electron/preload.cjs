const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("seerDesktop", {
  isElectron: true,
  updates: {
    check: () => ipcRenderer.invoke('seer:update:check'), status: () => ipcRenderer.invoke('seer:update:status'),
    download: snapshot => ipcRenderer.invoke('seer:update:download', snapshot), cancel: () => ipcRenderer.invoke('seer:update:cancel'),
    openFolder: () => ipcRenderer.invoke('seer:update:folder'),
  },
});
