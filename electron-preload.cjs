const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopBridge", {
  openGlbFile: () => ipcRenderer.invoke("open-glb-file"),
});
