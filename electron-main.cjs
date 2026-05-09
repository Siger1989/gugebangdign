const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: "#0b111a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("open-glb-file", async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(window, {
    title: "导入 T-Pose GLB 模型",
    properties: ["openFile"],
    filters: [
      { name: "GLB / glTF 模型", extensions: ["glb", "gltf"] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const filePath = result.filePaths[0];
  const buffer = await fs.readFile(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    size: buffer.byteLength,
    buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
