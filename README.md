# AutoCom

![AutoCom Logo](public/autocom-title.ico)

[![Release](https://img.shields.io/github/v/release/sharvantej/AutoCom.io?label=v2.0.0-alpha&include_prereleases&color=blue)](https://github.com/sharvantej/AutoCom.io/releases/latest)
[![License](https://img.shields.io/badge/license-proprietary-red.svg)](#license)

## What is AutoCom

AutoCom is a fast, reliable control dashboard for live broadcast and stage production.
Trigger cues, control switchers, cameras, and lighting, and manage every device on your
network from one screen — built to be quick and dependable when timing matters.

- Works with vMix, OBS, ATEM, Ross switchers, GrandMA, Resolume, VideoHub, and any
  generic OSC/UDP/TCP/WebSocket/HTTP device
- Map buttons straight to a physical Elgato Stream Deck
- Runs natively on **Windows**, **macOS**, and **Linux** — no browser, no bulky runtime
- Your show files live on disk as plain files — nothing locked away in a database

## ⬇️ Download

Pick your platform — these link straight to the installer, no GitHub page in between.

| Platform | Download |
|---|---|
| 🪟 Windows | [Installer (recommended)](https://github.com/sharvantej/AutoCom.io/releases/download/v2.0.0-alpha/Autocom_2.0.0-alpha_x64-setup.exe) · [Portable .exe](https://github.com/sharvantej/AutoCom.io/releases/download/v2.0.0-alpha/Autocom.exe) |
| 🍎 macOS | [.dmg (Apple Silicon)](https://github.com/sharvantej/AutoCom.io/releases/download/v2.0.0-alpha/Autocom_2.0.0-alpha_aarch64.dmg) |
| 🐧 Linux | [.AppImage](https://github.com/sharvantej/AutoCom.io/releases/download/v2.0.0-alpha/Autocom_2.0.0-alpha_amd64.AppImage) · [.deb package](https://github.com/sharvantej/AutoCom.io/releases/download/v2.0.0-alpha/Autocom_2.0.0-alpha_amd64.deb) |

Current version: **v2.0.0-alpha** — an early build, expect some rough edges.
All release notes and past versions: [Releases](https://github.com/sharvantej/AutoCom.io/releases).

## 🚀 Getting started

1. Install and open AutoCom.
2. **File → New Project** to start a show file, or **Open Project** to pick an existing one from disk.
3. Go to **Connections** and add each device on your network (IP + port).
4. Enter edit mode on the dashboard (press `G`) and add buttons — each one can fire a
   command on any of your connections.
5. Optional: use **Button Mapping** to put the same buttons on a physical Stream Deck.

The in-app **User Guide** page walks through this in more detail, along with the full
keyboard shortcut list (customizable in **Settings → Shortcuts**).

## 🧩 Features

- Send commands to multiple devices in parallel, low-latency
- Elgato Stream Deck integration with live-updating button images
- Adaptive dashboard layouts, filterable live logs, and a per-project undo history
- Reliable auto-reconnect for UDP/TCP/WebSocket devices
- Windows: single-instance app, tray icon, close-to-tray, launch-at-login, start-minimized
- Auto-updates — the app checks for new releases on its own (Settings → About)

## 💬 Support

- **Website:** [website/](website/)
- **Bug reports / feature requests:** [open an issue](https://github.com/sharvantej/AutoCom.io/issues)
- **Email:** hello@autocom.app

## 🛠️ Building from source

Not needed to just use the app — only if you want to build it yourself or contribute.
See the [development guide](docs/DEVELOPMENT.md).

## 📝 License

AutoCom is proprietary software — see the full terms in [LICENSE](LICENSE).
The Windows installer shows this agreement during setup; you'll need to accept it to install.

---

> Built with Tauri, React, and Rust for supercharged live controller performance.
