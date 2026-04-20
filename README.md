# AutoCom

![AutoCom Logo](public/autocom-title.ico)

[![Release](https://img.shields.io/github/v/release/sharvantej/AutoCom.io?label=v2.0.0&color=blue)](https://github.com/sharvantej/AutoCom.io/releases/latest)
[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](#license)

## 🚀 Overview

AutoCom is a high-performance cross-platform desktop control dashboard for live production and stage lighting engines.
It supports many transport protocols with low-latency Rust backend and a modern React UI.

- Protocols: `OSC`, `Art-Net`, `DMX`, `RossTalk`, `UDP`, `TCP`, `WebSocket`, `HTTP`
- UI: React + Vite + Tailwind
- Desktop: Tauri v2 (`Rust + WebView2` on Windows)
- Bundle: NSIS installer (Windows) + DMG (macOS)

## 💡 Why AutoCom

- Native Rust transport layer for realtime command integrity
- Lightweight, fast startup with Tauri vs Electron
- Ultra-responsive custom UI for device dashboard workflows
- Multi-protocol in one binary (no external dependencies at runtime)

## 🧩 Features

- Connect and send commands to multiple target devices in parallel
- Project & connection persistence on disk
- Reliable reconnect for UDP/TCP/WebSocket bridges
- Adaptive UI panel layouts and filterable logs
- Playback automation and scheduling (future roadmap)

## 📁 Repository Structure

- `src/` - React UI components and pages
- `src-tauri/` - Tauri config, Rust backend, bundler settings
- `src-tauri/src/` - protocol implementation (OSC, UDP, TCP, WS, HTTP, Art-Net)
- `public/` - static assets, icons, default shortcuts
- `scripts/` - build utilities
- `docs/` - release notes and build/release guides

## ⚙️ Prerequisites

- Node.js 18+ (or latest LTS)
- Rust + Cargo (`rustup toolchain install stable`)
- Tauri prerequisites:
  - Windows: Visual Studio Build Tools, C++ toolchain, WebView2 SDK
  - macOS: Xcode Command Line Tools

## 🛠️ Install

```bash
npm ci
```

## ▶️ Run (Dev)

```bash
npm run dev
```

Open <http://localhost:1430> in browser and see live reload.

## 🏗  Build (Production)

```bash
npm run build
```

## 🪟 Build Windows installer

```bash
npm run build:windows
```

- Output installer: `build/windows/Autocom_2.0.0_x64-setup.exe`

## 🍎 Build macOS package

```bash
npm run build:macos
```

## 🧹 Clean

```bash
npm run clean
```

## 🧠 Backend commands (from UI)

- `healthcheck`
- `send_protocol`

### `send_protocol` payload

- `protocol`: `osc | udp | tcp | ws | http | artnet | dmx | rosstalk`
- `host`: string
- `port`: number
- `address`: optional string
- `args`: optional array (OSC arguments)
- `payload`: optional string (binary / message body)

### Art-Net / DMX object

```json
{ "universe": 0, "values": [255, 0, 0, ...] }
```

or

```json
{ "universe": 0, "channel": 1, "value": 255 }
```

## 🛡️ Security

- CSP configured in `src-tauri/tauri.conf.json`
- Frontend locked to same-site asset policies
- Strong default permissions and sandboxing via Tauri

## 🧩 Contributing

1. Fork repository and create feature branch
2. Install dependencies
3. Add/update tests with `vitest`
4. Send PR with description and testing steps

## 📦 Release process

- Push to `main`
- Create GitHub release tag e.g. `v2.0.0`
- Attach installer from `build/windows`

## 📝 License

This project is `UNLICENSED` in this repository.

---

> Built with Tauri, React, and Rust for supercharged live controller performance.
