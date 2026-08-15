# Development guide

This is the developer/contributor reference for AutoCom. If you just want to
*use* the app, see the main [README](../README.md) instead — this file is
for building it from source.

## Repository structure

- `src/` - React UI components and pages
- `src-tauri/` - Tauri config, Rust backend, bundler settings
- `src-tauri/src/` - protocol implementation (OSC, UDP, TCP, WS, HTTP, Art-Net)
- `public/` - static assets, icons, default shortcuts
- `scripts/` - build utilities
- `docs/` - release notes and build/release guides
- `website/` - the marketing/download site (separate from the app itself)

## Prerequisites

- Node.js 18+ (or latest LTS)
- Rust + Cargo (`rustup toolchain install stable`)
- Tauri prerequisites:
  - Windows: Visual Studio Build Tools, C++ toolchain, WebView2 SDK
  - macOS: Xcode Command Line Tools
  - Linux: `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libudev-dev`

## Install

```bash
npm ci
```

## Run (dev)

```bash
npm run dev
```

Starts Vite + a live Tauri window with hot reload. `npm run web:dev` alone
(no Tauri window, browser only) also works for pure frontend iteration.

## Build (production)

```bash
npm run build
```

Platform-specific variants: `npm run build:windows`, `npm run build:macos`,
`npm run build:linux`. Each produces installers under `build/<platform>/`:

- Windows: `build/windows/Autocom_<version>_x64-setup.exe`
- macOS: `build/macos/*.dmg`
- Linux: `build/linux/*.AppImage` and `build/linux/*.deb`
  — run the AppImage directly with
  `chmod +x build/linux/*.AppImage && ./build/linux/*.AppImage`
  (use `--appimage-extract-and-run` if your environment has no FUSE)

## Clean

```bash
npm run clean
```

Removes `dist/` and `src-tauri/target/` (the Rust build cache — this is what
grows to several GB over time; safe to delete anytime, the next build just
recompiles from scratch).

## Verification commands

Run these before committing, matched to what you changed:

| When | Command | Why |
|---|---|---|
| Iterating on frontend or Rust code | `npm run dev` | Starts Vite + a live app window; frontend hot-reloads, Rust auto-rebuilds on save. |
| After any `.ts`/`.tsx` change | `npx tsc --noEmit -p .` | Type-check with no emit. |
| " | `npm run lint` | ESLint (`npm run lint:fix` to auto-fix). |
| " | `npm run test:run` | Runs the Vitest suite once (`npm run test` for watch mode). |
| " | `npm run web:build` | Production Vite build — catches build-only errors tests/lint miss. |
| After any `src-tauri/*.rs` change | `cd src-tauri && cargo check` | Fast compile-check without a full build. |
| After adding/removing an **npm** dependency | `npm install` (or `npm ci` for a clean install matching the lockfile), then re-run the frontend checks above | |
| After adding/removing a **Rust** crate | `cargo check` inside `src-tauri/` (updates `Cargo.lock`) | |
| After *any* dependency bump | `npm run dev` once, end-to-end | `cargo check` doesn't link or run the binary — only an actual dev run proves the app still starts. Dependency updates are the most common thing that silently breaks a build. |
| You want a shippable installer | `npm run build:windows` / `build:macos` / `build:linux` | Full release compile — slow (30+ min from a clean cache), only needed for real artifacts, not routine changes. |
| Disk space getting out of hand | `npm run clean` | See above. |

## Backend commands (from the UI)

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

## Security

- CSP configured in `src-tauri/tauri.conf.json`
- Frontend locked to same-site asset policies
- Strong default permissions and sandboxing via Tauri

## Contributing

1. Fork the repository and create a feature branch
2. Install dependencies
3. Add/update tests with `vitest`
4. Run the verification commands above
5. Open a PR with a description and testing steps

## Release process

- Push to `main`
- Create and push a GitHub release tag, e.g. `v2.0.0` — CI builds Windows/macOS/Linux installers, signs them, generates `latest.json`, and publishes them all to the GitHub Release automatically, marked as a prerelease if the tag contains `-alpha`/`-beta`/`-rc`
- The app checks `latest.json` on that release feed for updates (Settings → About)

### Updater signing key

Auto-updates require two secrets so builds can sign release artifacts:

- `TAURI_SIGNING_PRIVATE_KEY` — the updater's private signing key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — its password

**CI** reads these from GitHub Actions repo secrets (Settings → Secrets and variables → Actions).

**Local signed builds** (`npm run build:*`) read them from a `.env` file at the repo root —
copy `.env.example` to `.env` and fill in real values. `.env` is gitignored and never leaves
your machine; `npm run dev` and the verification commands don't need it at all.

Generate a new keypair with `npx tauri signer generate -w <path>`. The public key goes in
`src-tauri/tauri.conf.json` under `plugins.updater.pubkey` (already set); the private key and
password must **only** live in `.env` (local) or GitHub Actions secrets (CI) — never commit them.
