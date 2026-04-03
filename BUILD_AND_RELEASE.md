# Building & Releasing AutoCom v2.0.0

This guide explains how to build both Windows (.exe) and macOS (.dmg) installers.

---

## 📋 Quick Reference

| Platform | File | Build Command | Output Location |
|----------|------|-------|---------|
| **Windows** | `.exe` | `npm run build:windows` | `src-tauri/target/release/bundle/nsis/` |
| **macOS** | `.dmg` | `npm run build:macos` | `src-tauri/target/release/bundle/dmg/` |

---

## Option 1: Automatic Builds with GitHub Actions ⭐ (RECOMMENDED)

GitHub automatically builds both Windows and macOS versions when you push code.

### Setup (One-time)

1. **Push code to GitHub**:
   ```bash
   git add .
   git commit -m "v2.0.0: Ready for release"
   git push origin main
   ```

2. **Create a Release Tag**:
   ```bash
   git tag v2.0.0
   git push origin v2.0.0
   ```

3. **GitHub Actions will automatically**:
   - Run linting & tests
   - Build Windows .exe
   - Build macOS .dmg
   - Create GitHub Release with both files

4. **View builds**:
   - Go to: https://github.com/sharvantej/AutoCom.io/actions
   - Wait for workflow to complete (5-10 minutes)
   - Download artifacts

### Download Artifacts

After workflow completes:
1. Go to **Actions** tab
2. Click latest workflow run
3. Scroll to **Artifacts** section
4. Download `autocom-windows` and `autocom-macos`

---

## Option 2: Local Builds

### Windows Build (from Windows)

**Prerequisites**:
- Node.js 18+
- Rust toolchain (`rustup`)
- Windows 10+

**Steps**:
```bash
# Install dependencies
npm install

# Build Windows installer
npm run build:windows

# Output file will be at:
# src-tauri/target/release/bundle/nsis/Autocom_2.0.0_x64-setup.exe
```

### macOS Build (requires Mac)

**Prerequisites**:
- macOS 11+
- Node.js 18+
- Rust toolchain
- Xcode Command Line Tools: `xcode-select --install`

**Steps**:
```bash
# Install dependencies
npm install

# Build macOS installer
npm run build:macos

# Output file will be at:
# src-tauri/target/release/bundle/dmg/Autocom_2.0.0_universal.dmg
```

---

## Option 3: Cross-Platform Development

### From Windows + macOS VM

If you have access to a Mac (physical or VM):

**On Windows**:
```bash
npm run build:windows
# Produces: Autocom_2.0.0_x64-setup.exe
```

**On macOS (VM or physical Mac)**:
```bash
npm run build:macos
# Produces: Autocom_2.0.0_universal.dmg
```

---

## 🚀 Creating a GitHub Release

### Automatic (with GitHub Actions)

When you tag a version, releases are created automatically:
```bash
git tag v2.0.0
git push origin v2.0.0
```

### Manual Release

1. Go to **Releases** → **Draft a new release**
2. Tag: `v2.0.0`
3. Title: `v2.0.0 - Complete Rewrite`
4. Description: Copy from `RELEASE_NOTES_v2.0.0.md`
5. **Attach Files**:
   - `Autocom_2.0.0_x64-setup.exe`
   - `Autocom_2.0.0_universal.dmg`
6. Click **Publish release**

---

## 📦 Distribution

### Windows Users
- Download `Autocom_2.0.0_x64-setup.exe`
- Run installer
- If "Unknown Developer" warning appears, click "Run anyway"

### macOS Users
- Download `Autocom_2.0.0_universal.dmg`
- Open DMG file
- Drag app to Applications folder
- If "App is damaged" warning appears:
  - Right-click app → Open → Open in security dialog

### Website Distribution
```html
<a href="https://github.com/sharvantej/AutoCom.io/releases/download/v2.0.0/Autocom_2.0.0_x64-setup.exe">
  Download for Windows
</a>
<a href="https://github.com/sharvantej/AutoCom.io/releases/download/v2.0.0/Autocom_2.0.0_universal.dmg">
  Download for macOS
</a>
```

---

## 🔧 Troubleshooting

### Windows Build Errors

**Error: "Rust toolchain not found"**
```bash
rustup update stable
```

**Error: "node_modules not found"**
```bash
npm install
```

**Error: "WebView2 not found"**
- Tauri will prompt to download on first run
- Or install manually: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### macOS Build Errors

**Error: "Xcode Command Line Tools not found"**
```bash
xcode-select --install
```

**Error: "aarch64-apple-darwin target not found"**
```bash
rustup target add aarch64-apple-darwin
```

**Error: "Cannot notarize app"**
- Skip notarization for private distribution
- Add to Tauri config: `"signingIdentity": null`

---

## 📊 Build Artifacts

### Windows (.exe)

**File**: `Autocom_2.0.0_x64-setup.exe`
- Size: ~72MB
- Format: NSIS installer
- Installation: Admin not required
- Target: Windows 10+ x64

### macOS (.dmg)

**File**: `Autocom_2.0.0_universal.dmg`
- Size: ~85MB
- Format: Apple Disk Image
- Target: macOS 11+ (Intel + Apple Silicon)
- Extras: Drag-to-install experience

---

## 🔐 Signing & Notarization

### Windows Code Signing

Currently: Unsigned (shows warning)

To sign:
1. Purchase code signing certificate
2. Update `tauri.conf.json`:
   ```json
   "windows": {
     "certificateThumbprint": "THUMB_HERE",
     "digestAlgorithm": "sha256"
   }
   ```
3. Rebuild

### macOS Notarization

Currently: Not notarized (shows warning on first launch)

To notarize:
1. Enroll in Apple Developer Program ($99/year)
2. Generate API key
3. Update workflow with Apple credentials
4. GitHub Actions will notarize automatically

---

## 📝 Release Checklist

Before releasing:

- [ ] Update version in `package.json` (if new version)
- [ ] Update version in `src-tauri/tauri.conf.json`
- [ ] Update `RELEASE_NOTES_v2.0.0.md`
- [ ] Commit and push changes
- [ ] Create version tag: `git tag v2.0.0 && git push origin v2.0.0`
- [ ] Wait for GitHub Actions to complete
- [ ] Download and test both installers
- [ ] Create Release on GitHub
- [ ] Upload to website/company server (optional)
- [ ] Announce update to users

---

## 🔄 Future Updates

For next version (v2.1.0):

1. Update version numbers in:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `README.md`

2. Create `RELEASE_NOTES_v2.1.0.md`

3. Push and tag:
   ```bash
   git tag v2.1.0
   git push origin v2.1.0
   ```

4. GitHub Actions builds everything

---

## 💡 Tips

- Build takes ~5-10 minutes per platform
- GitHub Actions caches dependencies for faster builds
- Both builds can run in parallel
- Test installers before release
- Keep release notes handy for announcements

---

**Need help?** Check [RELEASE_NOTES_v2.0.0.md](./RELEASE_NOTES_v2.0.0.md) for user-facing documentation.
