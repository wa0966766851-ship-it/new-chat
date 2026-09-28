const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("seerDesktop", {
  isElectron: true,
});
