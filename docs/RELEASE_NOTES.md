# AutoCom v2.0.0-alpha

This is an **alpha** build — expect rough edges. Feedback and bug reports are welcome.

## Highlights

- Title-bar navigation merged into a single Windows-11-style tab strip
- File-based projects (no internal registry) with Open/Recent via native file dialogs
- Dashboard: unsaved-changes indicator, undo bounded to the last save, live Stream Deck sync
- Stream Deck: fixed images not reaching hardware, persistent HID connection instead of
  reconnecting per action
- Customizable keyboard shortcuts (Settings → Shortcuts)
- Linux packaging (AppImage + .deb) alongside existing Windows/macOS builds

## Known limitations

- Cross-platform native builds (Windows/macOS installers, Stream Deck hardware behavior)
  are only verified via CI, not hand-tested on every platform for this alpha.
