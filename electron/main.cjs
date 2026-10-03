const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { fork } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const { waitForOwnServer } = require("./serverProcess.cjs");
const { UpdateService } = require('./update/updateService.cjs');

// An explicit profile directory lets release smoke tests avoid real player saves.
if (process.env.SEER_USER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.SEER_USER_DATA_DIR));
}

const PORT = Number(process.env.SEER_PORT || 3000);
let serverProcess;
let mainWindow;

function serverScriptPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "dist", "server.cjs")
    : path.join(__dirname, "..", "dist", "server.cjs");
}

async function startServer() {
  const cwd = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
  serverProcess = fork(serverScriptPath(), [], {
    cwd,
    silent: true,
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORT), ELECTRON_RUN_AS_NODE: "1",
      SEER_HOST: "127.0.0.1", SEER_CACHE_DIR: path.join(app.getPath("userData"), "seer-cache") },
    execPath: process.execPath,
  });
  serverProcess.stderr?.on("data", (data) => console.error(`[server] ${data}`));
  serverProcess.on("exit", (code) => {
    if (code && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox("對戰模擬器", `本機伺服器已停止（代碼 ${code}）。`);
    }
  });
  // Wait for THIS child's ready message, not any development server on PORT.
  const port = await waitForOwnServer(serverProcess);
  const url = `http://127.0.0.1:${port}`;
  await new Promise((resolve, reject) => {
    const req = http.get(`${url}/api/ai-status`, (res) => {
      res.resume();
      res.statusCode === 200 ? resolve() : reject(new Error("本機伺服器健康檢查失敗"));
    });
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("健康檢查逾時")));
  });
  return url;
}

async function createWindow() {
  const url = await startServer();
  const updates = new UpdateService({ version: app.getVersion(), kind: process.env.PORTABLE_EXECUTABLE_FILE ? 'portable' : 'installer',
    directory: path.join(app.getPath('userData'), 'updates'), originalExe: process.env.PORTABLE_EXECUTABLE_FILE });
  const guard = event => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || new URL(event.senderFrame.url).origin !== url) throw new Error('不允許的更新呼叫');
  };
  for (const [channel, handler] of Object.entries({
    'seer:update:check': () => updates.check(), 'seer:update:status': () => updates.status(),
    'seer:update:download': snapshot => updates.download(snapshot), 'seer:update:cancel': () => updates.cancel(),
    'seer:update:folder': () => { const folder = updates.status().folder; return folder ? shell.openPath(folder) : ''; },
  })) ipcMain.handle(channel, (event, ...args) => { guard(event); return handler(...args); });
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: "#101827",
    icon: path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, ".."),
      "public", "seer", "head", "5000.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await mainWindow.loadURL(url);
  console.log(`Desktop ready: ${url}`);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else app.whenReady().then(() => createWindow()).catch((error) => {
  dialog.showErrorBox("對戰模擬器無法啟動", error.message);
  app.quit();
});
app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
