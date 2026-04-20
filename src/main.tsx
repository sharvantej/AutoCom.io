
import "@fontsource-variable/jetbrains-mono";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import ErrorBoundary from "./app/components/ErrorBoundary";
import { applyMotionPreferences } from "./app/services/motion";
import "./styles/index.css";

// Disable native WebView/browser context menu globally.
// This removes default options like Back/Refresh/Inspect.
applyMotionPreferences();

window.addEventListener(
  "contextmenu",
  (event) => {
    event.preventDefault();
  },
  { capture: true },
);

function shouldBlockBrowserShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  const primary = event.ctrlKey || event.metaKey;

  if (event.key === "F5" || event.key === "F12") return true;
  if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return true;

  if (primary && ["r", "p", "s", "o"].includes(key)) return true;
  if (primary && ["=", "+", "-", "0"].includes(key)) return true;
  if (primary && event.shiftKey && ["r", "i", "j", "c"].includes(key)) return true;

  return false;
}

// Disable browser-centric shortcuts inside the desktop app.
window.addEventListener(
  "keydown",
  (event) => {
    if (!shouldBlockBrowserShortcut(event)) return;
    event.preventDefault();
    event.stopPropagation();
  },
  { capture: true },
);

// Prevent file-drop navigation / replacing app content.
window.addEventListener(
  "dragover",
  (event) => {
    event.preventDefault();
  },
  { capture: true },
);

window.addEventListener(
  "drop",
  (event) => {
    event.preventDefault();
  },
  { capture: true },
);

type HapticStrength = "off" | "soft" | "default" | "strong";

const HAPTIC_COOLDOWN_MS = 80;
const HAPTIC_PATTERN: Record<Exclude<HapticStrength, "off">, number | number[]> = {
  soft: 4,
  default: 6,
  strong: [7, 14, 6],
};

let lastHapticAt = 0;

function getHapticTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const interactive = target.closest("button, [role='button'], [data-haptic]");
  if (!(interactive instanceof HTMLElement)) return null;
  if (interactive instanceof HTMLButtonElement && interactive.disabled) return null;
  return interactive;
}

function resolveHapticStrength(target: HTMLElement): HapticStrength {
  const hint = (target.dataset.haptic || "").trim().toLowerCase();
  if (hint === "off" || hint === "false" || hint === "none") return "off";
  if (hint === "soft" || hint === "light") return "soft";
  if (hint === "strong" || hint === "heavy") return "strong";
  return "default";
}

function triggerHaptic(strength: Exclude<HapticStrength, "off">): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const now = performance.now();
  if (now - lastHapticAt < HAPTIC_COOLDOWN_MS) return;
  lastHapticAt = now;
  navigator.vibrate(HAPTIC_PATTERN[strength]);
}

// Lightweight global haptic hint for press interactions across all pages.
window.addEventListener(
  "pointerdown",
  (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (event.pointerType === "mouse") return;
    const target = getHapticTarget(event.target);
    if (!target) return;
    const strength = resolveHapticStrength(target);
    if (strength === "off") return;
    triggerHaptic(strength);
  },
  { capture: true },
);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
  
