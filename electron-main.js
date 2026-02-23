const electron = require("electron");
console.log("Electron module:", electron);
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const nativeImage = electron.nativeImage;
const path = require("path");
const fs = require("fs");

console.log("App:", app);
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  return;
}

function configureShowDirEnv() {
  const userShowDir = path.join(app.getPath("userData"), "show");
  process.env.AUTO_OSC_SHOW_DIR = userShowDir;
}

// start backend server after show-dir is configured
configureShowDirEnv();
require("./server.js");

function resolveIconPath() {
  const isWin = process.platform === "win32";
  const candidates = isWin
    ? ["logo.ico", "logo.png", "logo.svg"]
    : ["logo.png", "logo.svg"];

  for (const file of candidates) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return path.join(__dirname, "logo.svg");
}

function createWindow() {
  const iconPath = resolveIconPath();
  const iconImage = nativeImage.createFromPath(iconPath);

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#0b0f14",
    icon: iconImage.isEmpty() ? iconPath : iconImage,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  function loadApp(win, retries = 20) {
    win.loadURL("http://localhost:3000").catch(() => {
      if (retries > 0) {
        setTimeout(() => loadApp(win, retries - 1), 500);
      }
    });
  }

  loadApp(win);
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.autoosc.controller");
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
