# OSC Dashboard

Desktop control dashboard for show cues and device triggers (Resolume, grandMA3, vMix, HTTP, audio, and generic TCP/OSC).

## Features

- Visual dashboard with floating edit window (draggable)
- Per-button task sequences (serial, delay, parallel)
- Right sidebar with switchable tabs:
  - `Connections`
  - `Action Logs` (default on startup)
- Connection management with status indicators and active toggles
- Sequence editor with:
  - Apply (save, keep open)
  - Apply & Close
  - Cancel (discard unsaved modal changes)
- Pixel-based inspector controls:
  - Title
  - X, Y
  - W, H
  - Text size
  - BG color
  - Text color
- Edit tool modes:
  - Move mode (drag selected item on canvas)
  - Resize mode (resize from all edges/corners)
- Label boxes for dashboard organization (non-trigger items)
- Image widgets (add image to dashboard, move/resize anywhere)
- Canvas background color control
- Grid lines shown only in edit mode
- Snap-to-grid option
- Show/hide borders option with global border color
- Scroll mode options in floating editor (`True`, `False`, `Vertical`, `Horizontal`, `Always`)
- Hidden visual scrollbars for cleaner on-screen output
- Save toast popup (`Ctrl+S`) instead of blocking alert
- Scrollable workspace for large button layouts
- Windows installer build (`.exe`)

## Editor Controls

- Toggle edit mode: `G`
- Save layout: `Ctrl+S`
- Add button: `Ctrl+N`
- Clear active button: `C`

In edit mode:

- Select an item with single click
- Move item when `Move` tool is selected
- Resize item when `Resize` tool is selected
- Use inspector fields for precise layout and styling changes
- Drag floating edit window by its header to reposition it

## Sidebar Tabs

- `Action Logs` tab:
  - displays runtime logs
  - no add/delete device footer actions shown
- `Connections` tab:
  - view/edit connections
  - footer actions:
    - `Add Device` (opens add connection editor)
    - `Delete Device` (delete by number or name)

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

- `dist/Automation Companion Setup.exe`

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
