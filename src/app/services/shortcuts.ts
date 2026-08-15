// Central registry of the app's keyboard shortcuts. Default bindings mirror
// what's actually wired into Layout.tsx / ProjectDashboard.tsx's keydown
// handlers — those handlers resolve bindings through this module (instead of
// hardcoded key checks) so a user-recorded override takes effect immediately,
// with no extra plumbing needed between Settings and the rest of the app.

export type ShortcutId =
  | "dashboard.editMode"
  | "dashboard.toolSelect"
  | "dashboard.toolMove"
  | "dashboard.toolResize"
  | "dashboard.toolLabel"
  | "dashboard.toolButton"
  | "dashboard.undo"
  | "dashboard.redo"
  | "dashboard.save"
  | "dashboard.cancel"
  | "global.openProject"
  | "global.newConnection"
  | "global.searchLogs"
  | "global.clearLogs"
  | "global.toggleFullscreen"
  | "global.toggleSidebar";

export type ShortcutBinding = {
  /** Normalized `event.key.toLowerCase()` — e.g. "s", "f11", "escape". */
  key: string;
  /** Ctrl on Windows/Linux, Cmd on Mac — matches the app's existing
   *  cross-platform "hasCommand" convention. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type ShortcutDef = {
  id: ShortcutId;
  group: string;
  action: string;
  defaultBinding: ShortcutBinding;
};

export const SHORTCUT_DEFS: ShortcutDef[] = [
  { id: "dashboard.editMode",      group: "Dashboard Editor", action: "Enter / exit edit mode", defaultBinding: { key: "g" } },
  { id: "dashboard.toolSelect",    group: "Dashboard Editor", action: "Select tool",             defaultBinding: { key: "v" } },
  { id: "dashboard.toolMove",      group: "Dashboard Editor", action: "Move tool",               defaultBinding: { key: "m" } },
  { id: "dashboard.toolResize",    group: "Dashboard Editor", action: "Resize tool",             defaultBinding: { key: "r" } },
  { id: "dashboard.toolLabel",     group: "Dashboard Editor", action: "Label tool",              defaultBinding: { key: "l" } },
  { id: "dashboard.toolButton",    group: "Dashboard Editor", action: "Button tool",             defaultBinding: { key: "b" } },
  { id: "dashboard.undo",          group: "Dashboard Editor", action: "Undo",                    defaultBinding: { key: "z", mod: true } },
  { id: "dashboard.redo",          group: "Dashboard Editor", action: "Redo",                    defaultBinding: { key: "z", mod: true, shift: true } },
  { id: "dashboard.save",          group: "Dashboard Editor", action: "Save dashboard",          defaultBinding: { key: "s", mod: true } },
  { id: "dashboard.cancel",        group: "Dashboard Editor", action: "Cancel / close",          defaultBinding: { key: "escape" } },
  { id: "global.openProject",      group: "Global",           action: "Quick project jump",      defaultBinding: { key: "k", mod: true } },
  { id: "global.newConnection",    group: "Global",           action: "New connection",          defaultBinding: { key: "n", mod: true } },
  { id: "global.searchLogs",       group: "Global",           action: "Search logs",             defaultBinding: { key: "f", mod: true } },
  { id: "global.clearLogs",        group: "Global",           action: "Clear logs",              defaultBinding: { key: "backspace", mod: true } },
  { id: "global.toggleFullscreen", group: "Global",           action: "Toggle fullscreen",       defaultBinding: { key: "f11" } },
  { id: "global.toggleSidebar",    group: "Global",           action: "Toggle sidebar",          defaultBinding: { key: "b", mod: true } },
];

const STORAGE_KEY = "autocom.shortcuts.custom.v1";

function readOverrides(): Partial<Record<ShortcutId, ShortcutBinding>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Partial<Record<ShortcutId, ShortcutBinding>>;
  } catch {
    return {};
  }
}

function writeOverrides(next: Partial<Record<ShortcutId, ShortcutBinding>>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota / private-mode failures.
  }
}

export function getShortcutBinding(id: ShortcutId): ShortcutBinding {
  const override = readOverrides()[id];
  if (override) return override;
  return SHORTCUT_DEFS.find((def) => def.id === id)?.defaultBinding ?? { key: "" };
}

export function setShortcutBinding(id: ShortcutId, binding: ShortcutBinding): void {
  writeOverrides({ ...readOverrides(), [id]: binding });
}

export function resetShortcutBinding(id: ShortcutId): void {
  const overrides = readOverrides();
  if (!(id in overrides)) return;
  const next = { ...overrides };
  delete next[id];
  writeOverrides(next);
}

export function isShortcutCustomized(id: ShortcutId): boolean {
  return id in readOverrides();
}

/** Builds a binding from a keydown event, or `null` for a bare modifier
 *  press (Ctrl/Shift/Alt/Meta alone) — callers should keep listening in
 *  that case rather than treat it as a completed recording. */
export function bindingFromEvent(event: KeyboardEvent): ShortcutBinding | null {
  if (["Control", "Meta", "Shift", "Alt"].includes(event.key)) return null;
  return {
    key: event.key.toLowerCase(),
    mod: (event.ctrlKey || event.metaKey) || undefined,
    shift: event.shiftKey || undefined,
    alt: event.altKey || undefined,
  };
}

export function matchesBinding(
  binding: ShortcutBinding,
  event: KeyboardEvent,
  opts?: { ignoreShift?: boolean },
): boolean {
  if (!binding.key) return false;
  if (event.key.toLowerCase() !== binding.key) return false;
  if (Boolean(binding.mod) !== Boolean(event.ctrlKey || event.metaKey)) return false;
  if (!opts?.ignoreShift && Boolean(binding.shift) !== Boolean(event.shiftKey)) return false;
  if (Boolean(binding.alt) !== Boolean(event.altKey)) return false;
  return true;
}

export function matchesShortcut(
  id: ShortcutId,
  event: KeyboardEvent,
  opts?: { ignoreShift?: boolean },
): boolean {
  return matchesBinding(getShortcutBinding(id), event, opts);
}

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
}

const NAMED_KEY_LABELS: Record<string, string> = {
  " ": "Space",
  "escape": "Esc",
  "backspace": "Backspace",
  "delete": "Delete",
  "enter": "Enter",
  "tab": "Tab",
  "arrowup": "↑",
  "arrowdown": "↓",
  "arrowleft": "←",
  "arrowright": "→",
  "f11": "F11",
};

function formatKeyLabel(key: string): string {
  if (NAMED_KEY_LABELS[key]) return NAMED_KEY_LABELS[key];
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function formatBinding(binding: ShortcutBinding): string[] {
  const parts: string[] = [];
  if (binding.mod) parts.push(isMacPlatform() ? "Cmd" : "Ctrl");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push("Alt");
  if (binding.key) parts.push(formatKeyLabel(binding.key));
  return parts;
}
