# AUTO OSC (Tauri + React + Rust)

**v3.0.0 - Major Update**: Migrated from Electron to Tauri for better performance and smaller footprint.

High-performance desktop dashboard for sending control commands to devices using native protocols:

- OSC
- Art-Net / DMX
- RossTalk
- UDP
- TCP
- WebSocket
- HTTP

## Why this architecture

- Tauri reduces memory and startup overhead compared to Electron.
- Rust core sends protocols directly with low latency.
- React UI remains fast to iterate and easy to extend.

## Stack

- Frontend: React + Vite
- Desktop shell: Tauri v2
- Core transport engine: Rust (`src-tauri/src/lib.rs`)

## Project layout

- `src/` React UI
- `src-tauri/` Tauri app and Rust protocol dispatcher
- `src-tauri/src/protocols/` per-protocol transport modules (`osc`, `udp`, `tcp`, `ws`, `http`, `artnet`)
- `public/` static assets used by the UI shell
- runtime data is persisted in the Tauri app data directory (`projects.json`, `connections.json`, `layout.json`, `logs.json`, `show.json`)

## Prerequisites

- Node.js 18+
- Rust toolchain (`rustup`)
- Tauri system prerequisites for Windows

## Install

```bash
npm install
```

## Run (Tauri dev)

```bash
npm run dev
```

## Build desktop app

```bash
npm run build
```

## Clean generated artifacts

```bash
npm run clean
```

## Rust command API

Frontend invokes:

- `healthcheck`
- `send_protocol`

`send_protocol` accepts:

- `protocol`: `osc | udp | tcp | ws | http | artnet | dmx | rosstalk`
- `host`: string
- `port`: number
- `address`: optional string (OSC address or HTTP/WS path)
- `args`: optional array (for OSC args)
- `payload`: optional string (UDP/TCP/WS/HTTP body)

`artnet/dmx` payload forms:

- JSON object: `{"universe":0,"values":[255,0,0,...]}`
- JSON object: `{"universe":0,"channel":1,"value":255}`

## Runtime state

- `tauri::State` is used for shared runtime state.
- WebSocket command sessions are cached in Rust and reused to avoid reconnecting on every send.

## Protocol guidance

- Use native protocol per target device from Rust.
- Do not route device traffic through Socket.IO.
- Socket.IO/WebSocket is only useful for UI event streaming if needed later.
