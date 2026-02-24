const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;
const nativeImage = electron.nativeImage;
const path = require("path");
const fs = require("fs");
let mainWindow = null;

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
  const candidates = ["logo.ico", "logo.png"];
  for (const name of candidates) {
    const fullPath = path.join(__dirname, name);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  const iconPath = resolveIconPath();
  const iconImage = iconPath ? nativeImage.createFromPath(iconPath) : null;

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    backgroundColor: "#0b0f14",
    icon:
      iconImage && !iconImage.isEmpty()
        ? iconImage
        : (iconPath || undefined),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.setMenuBarVisibility(false);
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
  win.once("ready-to-show", () => {
    if (!win.isDestroyed()) win.show();
  });

  if (process.platform === "win32") {
    let lastWindowedBounds = win.getBounds();
    let suppressMaximizeToFullscreen = false;

    const captureWindowedBounds = () => {
      if (win.isFullScreen() || win.isMaximized() || win.isMinimized()) return;
      lastWindowedBounds = win.getBounds();
    };

    win.on("move", captureWindowedBounds);
    win.on("resize", captureWindowedBounds);
    win.on("enter-full-screen", () => {
      // Preserve a floating/restore target before fullscreen takeover.
      lastWindowedBounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    });

    // Make maximize behave like true fullscreen so it covers the taskbar.
    win.on("maximize", () => {
      if (suppressMaximizeToFullscreen) return;
      if (!win.isFullScreen()) {
        win.setFullScreen(true);
      }
    });

    function restoreDownFromFullscreen() {
      if (!win.isFullScreen()) return;
      suppressMaximizeToFullscreen = true;
      win.once("leave-full-screen", () => {
        if (win.isDestroyed()) return;
        // Explicitly restore down (not minimized / not maximized).
        win.restore();
        if (lastWindowedBounds) win.setBounds(lastWindowedBounds);
        win.show();
        win.focus();
        setTimeout(() => {
          suppressMaximizeToFullscreen = false;
        }, 250);
      });
      win.setFullScreen(false);
    }

    // Add keyboard fullscreen controls as backup.
    win.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      if (input.key === "F11") {
        if (win.isFullScreen()) {
          restoreDownFromFullscreen();
        } else {
          if (win.isMinimized()) {
            win.restore();
          }
          win.setFullScreen(true);
        }
        event.preventDefault();
        return;
      }
      if (input.key === "Escape" && win.isFullScreen()) {
        restoreDownFromFullscreen();
        event.preventDefault();
      }
    });
  }

  function loadApp(win, retries = 20) {
    win.loadURL("http://localhost:3000").catch(() => {
      if (retries > 0) {
        setTimeout(() => loadApp(win, retries - 1), 500);
      }
    });
  }

  loadApp(win);
  return win;
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  if (process.platform === "win32") {
    app.setAppUserModelId("com.bunny.app");
  }
  createWindow();
});

app.on("second-instance", () => {
  focusMainWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    return;
  }
  focusMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
