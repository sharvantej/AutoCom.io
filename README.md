# OSC Dashboard

Desktop control dashboard for show cues and device triggers (Resolume, grandMA3, vMix, HTTP, audio, and generic TCP/OSC).

## Features

- Visual button dashboard with drag/resize editing
- Per-button task sequences (serial, delay, parallel)
- Device connections manager with status indicators
- Action log panel
- Sequence editor with:
  - Apply (save, keep open)
  - Apply & Close
  - Cancel (discard unsaved modal changes)
- Pixel-based button controls (X, Y, W, H, text size)
- Scrollable workspace for large button layouts
- Windows installer build (`.exe`)

## Tech Stack

- Electron
- Node.js + Express
- Socket.IO

## Project Structure

- `electron-main.js` - Electron app entry
- `server.js` - API + socket server
- `engine/` - cue/task execution and transport logic
- `devices/` - device-specific helpers
- `public/` - frontend UI (HTML/CSS/JS)
- `show/` - layout, connections, and show cue data

## Requirements

- Node.js 18+ (recommended: LTS)
- npm
- Windows (for installer build)

## Install Dependencies

```bash
npm install
```

## Run in Development

```bash
npm start
```

## Build Windows Installer

```bash
npm run dist
```

Output:

- `dist/OSC Controller Setup 1.0.0.exe`

This installer is configured for normal install flow (not one-click) and allows selecting installation directory.

## Data Files

Runtime show data is persisted under Electron user data path (configured via `AUTO_OSC_SHOW_DIR` at app startup).  
Repository defaults are in `show/`:

- `show/layout.json`
- `show/connections.json`
- `show/show.json`

## Git Notes

Large generated folders are ignored:

- `node_modules/`
- `dist/`

See `.gitignore`.

## Troubleshooting

- If device status does not turn green, verify host/port and enabled state in Connections.
- If triggers work but status looks wrong, check connection type/protocol and health behavior in `engine/transports.js`.
- After frontend changes, restart/reload the app to ensure latest UI is loaded.
