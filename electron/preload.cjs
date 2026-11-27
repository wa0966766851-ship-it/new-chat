const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("seerDesktop", {
  isElectron: true,
  fullscreen: {
    status: () => ipcRenderer.invoke('seer:fullscreen:status'),
    set: enabled => ipcRenderer.invoke('seer:fullscreen:set', enabled),
    onChange: listener => {
      const forward = (_event, active) => listener(active === true);
      ipcRenderer.on('seer:fullscreen:changed', forward);
      return () => ipcRenderer.removeListener('seer:fullscreen:changed', forward);
    },
  },
  launcher: {
    status: () => ipcRenderer.invoke('seer:launcher:status'),
    preferences: enabled => ipcRenderer.invoke('seer:launcher:preferences', enabled),
    create: confirm => ipcRenderer.invoke('seer:launcher:create', confirm),
  },
  updates: {
    check: () => ipcRenderer.invoke('seer:update:check'), status: () => ipcRenderer.invoke('seer:update:status'),
    download: snapshot => ipcRenderer.invoke('seer:update:download', snapshot), cancel: () => ipcRenderer.invoke('seer:update:cancel'),
    openFolder: () => ipcRenderer.invoke('seer:update:folder'),
  },
});
