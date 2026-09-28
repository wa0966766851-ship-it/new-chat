const { app, BrowserWindow, dialog } = require("electron");
const { fork } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");

const PORT = Number(process.env.SEER_PORT || 3000);
let serverProcess;
let mainWindow;

function serverScriptPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "dist", "server.cjs")
    : path.join(__dirname, "..", "dist", "server.cjs");
}

function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve();
        retry();
      });
      req.on("error", retry);
      req.setTimeout(1000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) return reject(new Error("本機伺服器啟動逾時"));
      setTimeout(check, 250);
    };
    check();
  });
}

async function startServer() {
  const cwd = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
  serverProcess = fork(serverScriptPath(), [], {
    cwd,
    silent: true,
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORT), ELECTRON_RUN_AS_NODE: "1" },
    execPath: process.execPath,
  });
  serverProcess.stderr?.on("data", (data) => console.error(`[server] ${data}`));
  serverProcess.on("exit", (code) => {
    if (code && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox("對戰模擬器", `本機伺服器已停止（代碼 ${code}）。`);
    }
  });
  await waitForServer(`http://127.0.0.1:${PORT}/api/ai-status`);
}

async function createWindow() {
  await startServer();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: "#101827",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

app.whenReady().then(() => createWindow()).catch((error) => {
  dialog.showErrorBox("對戰模擬器無法啟動", error.message);
  app.quit();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
