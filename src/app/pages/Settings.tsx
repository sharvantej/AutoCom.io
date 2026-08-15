import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sun, Moon, Check,
  GitBranch, PackageOpen, Hash,
  Trash2, Database, AlertTriangle, Copy, FileText, RotateCcw,
} from "lucide-react";
import { useAppContext, useTheme } from "../context/AppContext";
import { setMotionSpeed, type MotionSpeed } from "../services/motion";
import { isTauri, tauriInvoke } from "../services/tauri";
import {
  SHORTCUT_DEFS,
  getShortcutBinding,
  setShortcutBinding,
  resetShortcutBinding,
  isShortcutCustomized,
  bindingFromEvent,
  formatBinding,
  type ShortcutId,
  type ShortcutBinding,
} from "../services/shortcuts";
import type { ThemeMode, FontMode } from "../types";
import pkg from "../../../package.json";
import { check as checkForUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const APP_VERSION = `v${pkg.version}`;
type TabId = "general" | "shortcuts" | "about";
type NativeCloseBehavior = "tray" | "quit";
const NATIVE_CLOSE_BEHAVIOR_KEY = "settings.native.closeBehavior";
const TABS: { id: TabId; label: string }[] = [
  { id: "general",   label: "General"   },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about",     label: "About"     },
];

// ── Primitives ────────────────────────────────────────────────────────────────

type T = ReturnType<typeof useTheme>;

const pressTransition = { type: "spring", stiffness: 560, damping: 28, mass: 0.42 } as const;
const tapFeedback = () => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
};

const tabPaneVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.065,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 250, damping: 24, mass: 0.65 },
  },
} as const;

/** A labelled settings row — full-width, tall, single control on the right */
function Row({
  label, children, t, last, sublabel,
}: {
  label: string; children: React.ReactNode; t: T; last?: boolean; sublabel?: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-[16px] gap-[10px]"
      style={{ minHeight: 48, borderBottom: last ? "none" : `1px solid ${t.divider}`, paddingTop: sublabel ? 10 : 0, paddingBottom: sublabel ? 10 : 0 }}
    >
      <div className="flex flex-col gap-[2px]">
        <span className="text-[12px]" style={{ color: t.textPrimary }}>{label}</span>
        {sublabel && <span className="text-[11px]" style={{ color: t.textMuted }}>{sublabel}</span>}
      </div>
      {children}
    </div>
  );
}

/** Segmented toggle group */
function Seg<V extends string>({
  options, value, onChange, t,
}: {
  options: { value: V; label: React.ReactNode }[];
  value: V; onChange: (v: V) => void; t: T;
}) {
  return (
    <div
      className="flex rounded-none overflow-hidden flex-shrink-0"
      style={{ border: `1px solid ${t.btnToggleBorder}` }}
    >
      {options.map((o, i) => {
        const active = value === o.value;
        return (
          <motion.button
            key={String(o.value)}
            className="px-[12px] text-[11px] transition-colors"
            style={{
              height: 28,
              color: active ? t.textPrimary : t.textMuted,
              backgroundColor: active ? t.btnToggleActive : "transparent",
              borderRight: i < options.length - 1 ? `1px solid ${t.btnToggleBorder}` : "none",
            }}
            animate={{
              scale: active ? 1.02 : 1,
              boxShadow: active ? `inset 0 0 0 1px ${t.toggleColor}66` : "inset 0 0 0 0px transparent",
            }}
            onClick={() => onChange(o.value)}
            onPointerDown={tapFeedback}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.94, y: 1 }}
            transition={pressTransition}
          >
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Section card with optional title */
function Card({
  title, children, t, className = "",
}: {
  title?: string; children: React.ReactNode; t: T; className?: string;
}) {
  return (
    <motion.div
      className={`rounded-none overflow-hidden card-pop ${className}`}
      style={{ border: `1px solid ${t.divider}`, backgroundColor: t.rowBg }}
      variants={cardVariants}
    >
      {title && (
        <div
          className="px-[16px] flex items-center"
          style={{ height: 30, borderBottom: `1px solid ${t.divider}`, backgroundColor: t.bgContent }}
        >
          <span className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted, letterSpacing: "0.08em" }}>
            {title}
          </span>
        </div>
      )}
      {children}
    </motion.div>
  );
}

/** Keyboard key badge */
function Kbd({ keys, t }: { keys: string[]; t: T }) {
  return (
    <div className="flex items-center gap-[4px]">
      {keys.map((k, i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center rounded-none px-[7px] text-[11px]"
          style={{
            height: 22, minWidth: 22,
            backgroundColor: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            color: t.textSecondary,
          }}
        >
          {k}
        </span>
      ))}
    </div>
  );
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function getStorageUsageKb(): number {
  if (typeof window === "undefined") return 0;
  try {
    let total = 0;
    for (const key of Object.keys(localStorage)) {
      total += (localStorage.getItem(key) ?? "").length + key.length;
    }
    return Math.round((total * 2) / 1024);
  } catch {
    return 0;
  }
}

function getStorageItemCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    return localStorage.length;
  } catch {
    return 0;
  }
}

function readNativeCloseBehavior(): NativeCloseBehavior {
  try {
    const raw = localStorage.getItem(NATIVE_CLOSE_BEHAVIOR_KEY);
    return raw === "quit" ? "quit" : "tray";
  } catch {
    return "tray";
  }
}

// ── General tab ───────────────────────────────────────────────────────────────

function GeneralTab({
  t, theme, setTheme, font, setFont,
}: {
  t: T;
  theme: ThemeMode;
  setTheme: React.Dispatch<React.SetStateAction<ThemeMode>>;
  font: FontMode;
  setFont: React.Dispatch<React.SetStateAction<FontMode>>;
}) {
  const monoFont = "'JetBrains Mono', monospace";
  const sansFont = "'Inter', sans-serif";
  const isDesktop = isTauri();
  const [closeBehavior, setCloseBehavior] = useState<NativeCloseBehavior>(() => readNativeCloseBehavior());
  const [launchAtLogin, setLaunchAtLogin] = useState<"on" | "off">("off");
  const [startMinimized, setStartMinimized] = useState<"on" | "off">("off");

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;

    const syncFromRuntime = async () => {
      try {
        const closeToTray = await tauriInvoke<boolean>("get_close_to_tray");
        if (cancelled) return;
        const behavior: NativeCloseBehavior = closeToTray ? "tray" : "quit";
        setCloseBehavior(behavior);
        localStorage.setItem(NATIVE_CLOSE_BEHAVIOR_KEY, behavior);

        const startOnLogin = await tauriInvoke<boolean>("get_launch_at_login");
        if (cancelled) return;
        setLaunchAtLogin(startOnLogin ? "on" : "off");

        const minimizeOnStartup = await tauriInvoke<boolean>("get_start_minimized");
        if (cancelled) return;
        setStartMinimized(minimizeOnStartup ? "on" : "off");
      } catch (error) {
        console.error("Failed to read native desktop settings:", error);
      }
    };

    void syncFromRuntime();
    return () => { cancelled = true; };
  }, [isDesktop]);

  const handleCloseBehaviorChange = useCallback(async (next: NativeCloseBehavior) => {
    setCloseBehavior(next);
    try {
      localStorage.setItem(NATIVE_CLOSE_BEHAVIOR_KEY, next);
    } catch {
      // ignore storage issues
    }

    if (!isDesktop) return;
    try {
      await tauriInvoke("set_close_to_tray", { enabled: next === "tray" });
    } catch (error) {
      console.error("Failed to update native close behavior:", error);
    }
  }, [isDesktop]);

  const handleLaunchAtLoginChange = useCallback(async (next: "on" | "off") => {
    setLaunchAtLogin(next);
    if (!isDesktop) return;
    try {
      await tauriInvoke("set_launch_at_login", { enabled: next === "on" });
    } catch (error) {
      console.error("Failed to update launch-at-login setting:", error);
    }
  }, [isDesktop]);

  const handleStartMinimizedChange = useCallback(async (next: "on" | "off") => {
    setStartMinimized(next);
    if (!isDesktop) return;
    try {
      await tauriInvoke("set_start_minimized", { enabled: next === "on" });
    } catch (error) {
      console.error("Failed to update start-minimized setting:", error);
    }
  }, [isDesktop]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[12px]">

      {/* Theme — full width */}
      <Card title="Theme" t={t} className="xl:col-span-2">
        <div className="p-[14px] flex gap-[10px]">
          {[
            {
              id: "dark" as ThemeMode, label: "Dark",
              icon: <Moon size={13} color="#99a1af" />,
              labelColor: "#99a1af",
              bg: "#030712", sidebar: "#101828", sidebarBorder: "#1c202a",
              bar1: "#1e2939", bar2: "#1e2939", rowBg: "#101828", rowBorder: "#1c202a",
              footer: "#0a0f1a", footerBorder: "#1c202a",
            },
            {
              id: "light" as ThemeMode, label: "Light",
              icon: <Sun size={13} color="#64748b" />,
              labelColor: "#64748b",
              bg: "#f8fafc", sidebar: "#e2e8f0", sidebarBorder: "#cbd5e1",
              bar1: "#cbd5e1", bar2: "#cbd5e1", rowBg: "#e2e8f0", rowBorder: "#cbd5e1",
              footer: "#f1f5f9", footerBorder: "#cbd5e1",
            },
          ].map((opt) => {
            const active = theme === opt.id;
            return (
              <motion.button
                key={opt.id}
                className="flex-1 rounded-none overflow-hidden text-left"
                style={{
                  border: active ? `2px solid ${t.toggleColor}` : `2px solid ${t.divider}`,
                }}
                animate={{
                  scale: active ? 1.01 : 1,
                  y: active ? -1 : 0,
                  boxShadow: active ? `0 6px 18px -12px ${t.toggleColor}` : "0 0 0 transparent",
                }}
                onClick={() => setTheme(opt.id)}
                onPointerDown={tapFeedback}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97, y: 1 }}
                transition={pressTransition}
              >
                {/* Mini UI preview */}
                <div className="relative flex" style={{ height: 72, backgroundColor: opt.bg }}>
                  <span
                    className="absolute left-[8px] top-[6px] z-[1] rounded-none px-[6px] py-[1px] text-[10px]"
                    style={{
                      color: opt.id === "dark" ? "#cbd5e1" : "#475569",
                      backgroundColor: opt.id === "dark" ? "rgba(15,23,42,0.82)" : "rgba(226,232,240,0.92)",
                      border: `1px solid ${opt.id === "dark" ? "#334155" : "#cbd5e1"}`,
                    }}
                  >
                    {opt.label}
                  </span>
                  <div style={{ width: 42, backgroundColor: opt.sidebar, borderRight: `1px solid ${opt.sidebarBorder}` }}>
                    <div style={{ height: 6, margin: "9px 8px 5px", backgroundColor: opt.bar1, borderRadius: 0 }} />
                    <div style={{ height: 4, margin: "0 8px 4px", backgroundColor: opt.bar2, borderRadius: 0, width: "60%" }} />
                    <div style={{ height: 4, margin: "0 8px 4px", backgroundColor: opt.bar2, borderRadius: 0, width: "40%" }} />
                    <div style={{ height: 4, margin: "0 8px", backgroundColor: opt.bar2, borderRadius: 0, width: "50%" }} />
                  </div>
                  <div className="flex flex-col gap-[4px] p-[8px] flex-1">
                    <div style={{ height: 6, width: "55%", backgroundColor: opt.bar1, borderRadius: 0 }} />
                    <div style={{ height: 6, width: "35%", backgroundColor: opt.bar2, borderRadius: 0 }} />
                    <div style={{ height: 14, width: "80%", marginTop: 3, backgroundColor: opt.rowBg, borderRadius: 0, border: `1px solid ${opt.rowBorder}` }} />
                    <div style={{ height: 14, width: "80%", backgroundColor: opt.rowBg, borderRadius: 0, border: `1px solid ${opt.rowBorder}` }} />
                  </div>
                </div>
                {/* Label row */}
                <div
                  className="flex items-center justify-between px-[10px]"
                  style={{ height: 30, backgroundColor: opt.footer, borderTop: `1px solid ${opt.footerBorder}` }}
                >
                  <div className="flex items-center gap-[6px]">
                    {opt.icon}
                    <span className="text-[11px]" style={{ color: opt.labelColor }}>{opt.label}</span>
                  </div>
                  <AnimatePresence>
                    {active && (
                      <motion.div
                        className="rounded-none flex items-center justify-center"
                        style={{ width: 16, height: 16, backgroundColor: t.toggleColor }}
                        initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 600, damping: 24 }}
                      >
                        <Check size={9} color="#fff" strokeWidth={3} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
            );
          })}
        </div>
      </Card>

      {/* Font + Sidebar combined */}
      <Card title="Font &amp; Sidebar" t={t}>
        <Row label="Interface typeface" t={t}>
          <Seg
            options={[
              { value: "mono" as FontMode, label: <span style={{ fontFamily: monoFont }}>Mono</span> },
              { value: "sans" as FontMode, label: <span style={{ fontFamily: sansFont }}>Sans</span> },
            ]}
            value={font} onChange={setFont} t={t}
          />
        </Row>
        <div
          className="mx-[16px] mb-[12px] px-[12px] py-[10px] rounded-none"
          style={{ backgroundColor: t.bgContent, border: `1px solid ${t.divider}` }}
        >
          <div className="text-[10px] mb-[6px]" style={{ color: t.textMuted }}>Preview</div>
          <div
            className="text-[14px] mb-[3px]"
            style={{ color: t.textPrimary, fontFamily: font === "mono" ? monoFont : sansFont }}
          >
            The quick brown fox
          </div>
          <div
            className="text-[11px]"
            style={{ color: t.textMuted, fontFamily: font === "mono" ? monoFont : sansFont }}
          >
            0123456789 &nbsp;!@#$%^&amp;
          </div>
        </div>
        {isDesktop && (
          <div style={{ borderTop: `1px solid ${t.divider}` }}>
            <Row
              label="Close button action"
              sublabel="Tray keeps Autocom running in background; Quit exits immediately."
              t={t}
              last={false}
            >
              <Seg
                options={[
                  { value: "tray" as NativeCloseBehavior, label: "To tray" },
                  { value: "quit" as NativeCloseBehavior, label: "Quit" },
                ]}
                value={closeBehavior}
                onChange={(next) => { void handleCloseBehaviorChange(next); }}
                t={t}
              />
            </Row>
            <Row
              label="Launch at login"
              sublabel="Start Autocom automatically when you sign in to Windows."
              t={t}
              last={false}
            >
              <Seg
                options={[
                  { value: "on" as const, label: "On" },
                  { value: "off" as const, label: "Off" },
                ]}
                value={launchAtLogin}
                onChange={(next) => { void handleLaunchAtLoginChange(next); }}
                t={t}
              />
            </Row>
            <Row
              label="Start minimized"
              sublabel="Open directly to system tray instead of showing the main window."
              t={t}
              last
            >
              <Seg
                options={[
                  { value: "on" as const, label: "On" },
                  { value: "off" as const, label: "Off" },
                ]}
                value={startMinimized}
                onChange={(next) => { void handleStartMinimizedChange(next); }}
                t={t}
              />
            </Row>
          </div>
        )}
      </Card>

      {/* Editor — Canvas */}
      <Card title="Editor" t={t}>
        <Row label="Snap to grid" t={t}>
          <EditorSnapRow t={t} />
        </Row>
        <Row label="Grid size" t={t}>
          <EditorGridRow t={t} />
        </Row>
        <Row label="Auto-save" t={t}>
          <EditorSaveRow t={t} />
        </Row>
        <Row label="Animation speed" t={t} last>
          <EditorSpeedRow t={t} />
        </Row>
        <EditorSpeedBar t={t} />
      </Card>

    </div>
  );
}

// ── Editor sub-rows (isolated state so they don't re-render parent) ───────────

const EDITOR_STORAGE = {
  snap:  "settings.editor.snap",
  grid:  "settings.editor.grid",
  speed: "settings.editor.speed",
  save:  "settings.editor.save",
} as const;

function readEditorPref<V extends string>(key: string, fallback: V): V {
  try { return (localStorage.getItem(key) as V) ?? fallback; } catch { return fallback; }
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent("editor-pref-changed", { detail: { key, value } }));
  } catch { /* ignore */ }
}

function EditorSnapRow({ t }: { t: T }) {
  const [snap, setSnap] = useState<"on" | "off">(() => readEditorPref(EDITOR_STORAGE.snap, "on"));
  return <Seg options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
    value={snap} onChange={(v) => { setSnap(v); persist(EDITOR_STORAGE.snap, v); }} t={t} />;
}

function EditorGridRow({ t }: { t: T }) {
  const [grid, setGrid] = useState<"8" | "16" | "24">(() => readEditorPref(EDITOR_STORAGE.grid, "16"));
  return <Seg
    options={[{ value: "8", label: "8px" }, { value: "16", label: "16px" }, { value: "24", label: "24px" }]}
    value={grid} onChange={(v) => { setGrid(v); persist(EDITOR_STORAGE.grid, v); }} t={t} />;
}

function EditorSaveRow({ t }: { t: T }) {
  const [save, setSave] = useState<"on" | "off">(() => readEditorPref(EDITOR_STORAGE.save, "on"));
  return <Seg options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
    value={save} onChange={(v) => { setSave(v); persist(EDITOR_STORAGE.save, v); }} t={t} />;
}

function EditorSpeedRow({ t }: { t: T }) {
  const [speed, setSpeed] = useState<MotionSpeed>(() => readEditorPref(EDITOR_STORAGE.speed, "normal"));
  return <Seg
    options={[{ value: "fast", label: "Fast" }, { value: "normal", label: "Normal" }, { value: "slow", label: "Slow" }]}
    value={speed} onChange={(v) => { setSpeed(v); setMotionSpeed(v); }} t={t} />;
}

function EditorSpeedBar({ t }: { t: T }) {
  const [speed] = useState<MotionSpeed>(() => readEditorPref(EDITOR_STORAGE.speed, "normal"));
  return (
    <div className="px-[16px] pb-[12px]">
      <div className="relative rounded-none overflow-hidden"
        style={{ height: 4, backgroundColor: t.bgContent, border: `1px solid ${t.divider}` }}>
        <motion.div
          className="absolute left-0 top-0 bottom-0 rounded-none"
          style={{ backgroundColor: t.toggleColor, width: "40%" }}
          animate={{ x: ["-100%", "350%"] }}
          transition={{ repeat: Infinity, repeatType: "loop", ease: "easeInOut",
            duration: speed === "fast" ? 0.5 : speed === "slow" ? 2 : 1 }}
        />
      </div>
    </div>
  );
}

// ── Data management ───────────────────────────────────────────────────────────

function DataTab({ t }: { t: T }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [usageKb, setUsageKb] = useState(() => getStorageUsageKb());
  const [itemCount, setItemCount] = useState(() => getStorageItemCount());

  const handleClearAll = useCallback(() => {
    try {
      localStorage.clear();
      setUsageKb(0);
      setItemCount(0);
      setCleared(true);
      setConfirmOpen(false);
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setConfirmOpen(false);
    }
  }, []);

  const usagePercent = Math.min((usageKb / 5120) * 100, 100);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[12px]">

      {/* Storage usage */}
      <Card title="Storage" t={t}>
        <div className="px-[16px] py-[14px]">
          <div className="flex items-end justify-between mb-[8px]">
            <div className="flex items-center gap-[8px]">
              <Database size={14} style={{ color: t.textMuted }} />
              <span className="text-[12px]" style={{ color: t.textSecondary }}>Browser local storage</span>
            </div>
            <span className="text-[12px]" style={{ color: t.textMuted }}>
              {usageKb} KB / ~5 MB
            </span>
          </div>
          {/* Bar */}
          <div className="rounded-none overflow-hidden mb-[10px]"
            style={{ height: 6, backgroundColor: t.bgContent, border: `1px solid ${t.divider}` }}>
            <motion.div
              className="h-full"
              style={{ backgroundColor: usagePercent > 80 ? "#f87171" : t.toggleColor }}
              initial={{ width: 0 }}
              animate={{ width: `${usagePercent}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: t.textMuted }}>{itemCount} stored items</span>
            <span className="text-[11px]" style={{ color: t.textMuted }}>{usagePercent.toFixed(1)}% used</span>
          </div>
        </div>
      </Card>

      {/* Clear data */}
      <Card title="Clear Data" t={t}>
        <div className="px-[16px] py-[14px] flex flex-col gap-[12px]">
          <p className="text-[12px] leading-[1.65]" style={{ color: t.textSecondary }}>
            Permanently removes all projects, connections, dashboard layouts, logs, and preferences from your browser. The page will reload automatically.
          </p>

          <AnimatePresence mode="wait">
            {cleared ? (
              <motion.div
                key="cleared"
                className="flex items-center gap-[8px] text-[12px]"
                style={{ color: t.toggleColor }}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                <Check size={13} />
                <span>Cleared — reloading…</span>
              </motion.div>
            ) : confirmOpen ? (
              <motion.div
                key="confirm"
                className="border px-[12px] py-[10px] flex flex-col gap-[10px]"
                style={{ borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.06)" }}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              >
                <div className="flex items-center gap-[7px]">
                  <AlertTriangle size={13} color="#f87171" />
                  <span className="text-[12px]" style={{ color: "#f87171" }}>This cannot be undone. Are you sure?</span>
                </div>
                <div className="flex items-center gap-[8px]">
                  <button
                    className="flex items-center gap-[6px] px-[12px] text-[12px] border transition-colors"
                    style={{ height: 30, backgroundColor: "rgba(239,68,68,0.15)", borderColor: "#ef4444", color: "#f87171" }}
                    onClick={handleClearAll}
                  >
                    <Trash2 size={12} /> Yes, clear everything
                  </button>
                  <button
                    className="px-[12px] text-[12px] border transition-colors"
                    style={{ height: 30, backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textMuted }}
                    onClick={() => setConfirmOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="trigger"
                className="flex items-center gap-[7px] px-[12px] text-[12px] border w-fit transition-colors"
                style={{ height: 30, backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textMuted }}
                onClick={() => setConfirmOpen(true)}
                whileHover={{ borderColor: "#ef4444", color: "#f87171" }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.15 }}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              >
                <Trash2 size={12} /> Clear all data
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </Card>

    </div>
  );
}

// ── Shortcuts tab ─────────────────────────────────────────────────────────────

function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  return a.key === b.key && Boolean(a.mod) === Boolean(b.mod)
    && Boolean(a.shift) === Boolean(b.shift) && Boolean(a.alt) === Boolean(b.alt);
}

function ShortcutRecordButton({
  def, binding, recording, onStartRecording, t,
}: {
  def: { id: ShortcutId; action: string };
  binding: ShortcutBinding;
  recording: boolean;
  onStartRecording: (id: ShortcutId) => void;
  t: T;
}) {
  return (
    <button
      type="button"
      className="flex items-center justify-center px-[8px] transition-colors"
      style={{
        height: 26,
        border: `1px solid ${recording ? "#8b5cf6" : "transparent"}`,
        backgroundColor: recording ? "rgba(139,92,246,0.12)" : "transparent",
      }}
      onClick={() => onStartRecording(def.id)}
      title={`Click, then press a new key combination for "${def.action}"`}
    >
      {recording ? (
        <span className="text-[11px]" style={{ color: "#8b5cf6" }}>Press keys…</span>
      ) : (
        <Kbd keys={formatBinding(binding)} t={t} />
      )}
    </button>
  );
}

function ShortcutsTab({ t }: { t: T }) {
  const [bindings, setBindings] = useState<Record<ShortcutId, ShortcutBinding>>(() => {
    const map = {} as Record<ShortcutId, ShortcutBinding>;
    SHORTCUT_DEFS.forEach((def) => { map[def.id] = getShortcutBinding(def.id); });
    return map;
  });
  const [recordingId, setRecordingId] = useState<ShortcutId | null>(null);

  useEffect(() => {
    if (!recordingId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecordingId(null);
        return;
      }
      const binding = bindingFromEvent(event);
      if (!binding) return; // bare modifier press — keep listening
      setShortcutBinding(recordingId, binding);
      setBindings((prev) => ({ ...prev, [recordingId]: binding }));
      setRecordingId(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recordingId]);

  const handleReset = (id: ShortcutId) => {
    resetShortcutBinding(id);
    const def = SHORTCUT_DEFS.find((d) => d.id === id);
    if (def) setBindings((prev) => ({ ...prev, [id]: def.defaultBinding }));
  };

  const groupTitles = Array.from(new Set(SHORTCUT_DEFS.map((def) => def.group)));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[12px]">
      {groupTitles.map((groupTitle) => {
        const defs = SHORTCUT_DEFS.filter((def) => def.group === groupTitle);
        return (
          <Card key={groupTitle} title={groupTitle} t={t}>
            {defs.map((def, i) => {
              const binding = bindings[def.id];
              const customized = isShortcutCustomized(def.id) || !bindingsEqual(binding, def.defaultBinding);
              return (
                <div
                  key={def.id}
                  className="flex items-center justify-between px-[16px]"
                  style={{
                    height: 42,
                    borderBottom: i < defs.length - 1 ? `1px solid ${t.divider}` : "none",
                  }}
                >
                  <span className="text-[13px]" style={{ color: t.textSecondary }}>{def.action}</span>
                  <div className="flex items-center gap-[6px]">
                    {customized && (
                      <button
                        type="button"
                        className="flex items-center justify-center transition-colors"
                        style={{ width: 22, height: 22, color: t.textMuted }}
                        title="Reset to default"
                        onClick={() => handleReset(def.id)}
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                    <ShortcutRecordButton
                      def={def}
                      binding={binding}
                      recording={recordingId === def.id}
                      onStartRecording={setRecordingId}
                      t={t}
                    />
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}

// ── About tab ─────────────────────────────────────────────────────────────────

type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";

function UpdateCard({ t }: { t: T }) {
  const isDesktop = isTauri();
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [errorText, setErrorText] = useState("");

  const handleCheck = useCallback(async () => {
    setStatus("checking");
    setErrorText("");
    try {
      const update = await checkForUpdate();
      if (update) {
        setPendingUpdate(update);
        setStatus("available");
      } else {
        setPendingUpdate(null);
        setStatus("up-to-date");
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Update check failed.");
      setStatus("error");
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (!pendingUpdate) return;
    setStatus("downloading");
    setErrorText("");
    let totalBytes = 0;
    let downloadedBytes = 0;
    try {
      await pendingUpdate.download((event) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          setProgressPct(totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null);
        }
      });
      await pendingUpdate.install();
      setStatus("ready");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Update install failed.");
      setStatus("error");
    }
  }, [pendingUpdate]);

  useEffect(() => {
    if (!isDesktop) return;
    void handleCheck();
  }, [isDesktop, handleCheck]);

  return (
    <Card title="Updates" t={t}>
      <div className="px-[16px] py-[14px] flex flex-col gap-[10px]">
        {!isDesktop ? (
          <p className="text-[12px] leading-[1.65]" style={{ color: t.textSecondary }}>
            Update checks only run in the desktop app.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-[10px]">
              <span className="text-[12px]" style={{ color: t.textSecondary }}>
                {status === "idle" && "—"}
                {status === "checking" && "Checking for updates…"}
                {status === "up-to-date" && "You're on the latest version."}
                {status === "available" && pendingUpdate && `Version ${pendingUpdate.version} is available.`}
                {status === "downloading" && (progressPct != null ? `Downloading… ${progressPct}%` : "Downloading…")}
                {status === "ready" && "Update installed — restart to apply."}
                {status === "error" && (errorText || "Update check failed.")}
              </span>
              {status !== "downloading" && status !== "ready" && (
                <button
                  className="flex items-center gap-[6px] px-[12px] text-[12px] border shrink-0 transition-colors"
                  style={{ height: 30, backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textMuted }}
                  onClick={() => { void handleCheck(); }}
                  disabled={status === "checking"}
                >
                  Check Again
                </button>
              )}
            </div>
            {status === "available" && (
              <button
                className="flex items-center gap-[7px] px-[12px] text-[12px] border w-fit transition-colors"
                style={{ height: 30, backgroundColor: "rgba(94,234,212,0.1)", borderColor: t.toggleColor, color: t.toggleColor }}
                onClick={() => { void handleInstall(); }}
              >
                Download &amp; Install
              </button>
            )}
            {status === "ready" && (
              <button
                className="flex items-center gap-[7px] px-[12px] text-[12px] border w-fit transition-colors"
                style={{ height: 30, backgroundColor: "rgba(94,234,212,0.1)", borderColor: t.toggleColor, color: t.toggleColor }}
                onClick={() => { void relaunch(); }}
              >
                Restart Now
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function DiagnosticsCard({ t }: { t: T }) {
  const isDesktop = isTauri();
  const [logDir, setLogDir] = useState<string | null>(null);
  const [logDirError, setLogDirError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    tauriInvoke<string>("get_log_dir")
      .then((dir) => { if (!cancelled) setLogDir(dir); })
      .catch(() => { if (!cancelled) setLogDirError(true); });
    return () => { cancelled = true; };
  }, [isDesktop]);

  const handleCopy = useCallback(() => {
    if (!logDir) return;
    navigator.clipboard.writeText(logDir).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [logDir]);

  return (
    <Card title="Diagnostics" t={t}>
      <div className="px-[16px] py-[14px] flex flex-col gap-[10px]">
        <p className="text-[12px] leading-[1.65]" style={{ color: t.textSecondary }}>
          {isDesktop
            ? "Autocom writes structured logs here — include them when reporting a bug or a device that misbehaved mid-show."
            : "Diagnostic logs are only written by the desktop app, not the web build."}
        </p>
        {isDesktop && (
          <div className="flex items-center gap-[8px]">
            <div className="flex items-center gap-[8px] flex-1 min-w-0 px-[10px]"
              style={{ height: 32, backgroundColor: t.inputBg, border: `1px solid ${t.inputBorder}` }}>
              <FileText size={12} style={{ color: t.textMuted, flexShrink: 0 }} />
              <span className="text-[11px] truncate" style={{ color: t.textMuted }}>
                {logDirError ? "Unavailable" : (logDir ?? "Loading…")}
              </span>
            </div>
            <button
              className="flex items-center gap-[6px] px-[12px] text-[12px] border shrink-0 transition-colors"
              style={{ height: 32, backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textMuted }}
              onClick={handleCopy}
              disabled={!logDir}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy Path"}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function AboutTab({ t }: { t: T }) {
  const isDesktop = isTauri();

  const stackRows = [
    { label: "Runtime",   value: isDesktop ? "Tauri v2" : "Web / Vite" },
    { label: "UI",        value: "React 18"         },
    { label: "Bundler",   value: "Vite"             },
    { label: "Language",  value: "TypeScript"       },
    { label: "Styling",   value: "Tailwind v4"      },
    { label: "Animation", value: "Motion"           },
    { label: "Router",    value: "React Router v7"  },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[12px]">

      {/* Version */}
      <Card t={t}>
        <div
          className="flex flex-col items-center justify-center gap-[6px]"
          style={{ height: 102, borderBottom: `1px solid ${t.divider}` }}
        >
          <span className="text-[28px]" style={{ color: t.textPrimary, letterSpacing: "-0.03em" }}>
            {APP_VERSION}
          </span>
          <div className="flex items-center gap-[6px]">
            <span
              className="px-[10px] py-[2px] rounded-none text-[11px]"
              style={{
                backgroundColor: t.btnToggleActive,
                border: `1px solid ${t.btnToggleBorder}`,
                color: t.textMuted,
              }}
            >
              alpha
            </span>
            {!isDesktop && (
              <span
                className="px-[10px] py-[2px] rounded-none text-[11px]"
                style={{
                  backgroundColor: "rgba(124,58,237,0.15)",
                  border: "1px solid rgba(124,58,237,0.35)",
                  color: "#a78bfa",
                }}
              >
                web
              </span>
            )}
          </div>
        </div>

        {[
          { label: "Build date", value: import.meta.env.VITE_BUILD_DATE || "N/A", icon: <Hash size={12} />        },
          { label: "Branch",     value: import.meta.env.VITE_GIT_BRANCH || "N/A", icon: <GitBranch size={12} />   },
          { label: "Commit",     value: import.meta.env.VITE_GIT_COMMIT || "N/A", icon: <PackageOpen size={12} /> },
        ].map((row, i, arr) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-[16px]"
            style={{ height: 42, borderBottom: i < arr.length - 1 ? `1px solid ${t.divider}` : "none" }}
          >
            <div className="flex items-center gap-[8px]">
              <span style={{ color: t.textMuted }}>{row.icon}</span>
              <span className="text-[13px]" style={{ color: t.textSecondary }}>{row.label}</span>
            </div>
            <span className="text-[12px]" style={{ color: t.textMuted }}>{row.value}</span>
          </div>
        ))}
      </Card>

      {/* Stack */}
      <Card title="Stack" t={t}>
        {stackRows.map((s, i, arr) => (
          <div
            key={s.label}
            className="flex items-center justify-between px-[16px]"
            style={{ height: 40, borderBottom: i < arr.length - 1 ? `1px solid ${t.divider}` : "none" }}
          >
            <span className="text-[13px]" style={{ color: t.textSecondary }}>{s.label}</span>
            <span className="text-[12px]" style={{ color: s.label === "Runtime" && !isDesktop ? "#a78bfa" : t.textMuted }}>
              {s.value}
            </span>
          </div>
        ))}
      </Card>

      <UpdateCard t={t} />
      <DiagnosticsCard t={t} />

    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { theme, setTheme, font, setFont } = useAppContext();
  const t = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  return (
    <div className="flex flex-col flex-1 overflow-hidden page-pop" style={{ backgroundColor: t.bgContent }}>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-[12px] py-[10px] border-b"
        style={{ borderColor: t.divider }}
      >
        <div
          className="flex items-center gap-[6px] rounded-none p-[5px]"
          style={{ backgroundColor: t.rowBg, border: `1px solid ${t.divider}`, width: "fit-content" }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                className="relative flex items-center px-[10px] text-[12px] transition-colors rounded-none"
                style={{
                  height: 32,
                  color: active ? t.textPrimary : t.textMuted,
                  backgroundColor: active ? t.navActive : "transparent",
                }}
                animate={{ scale: active ? 1.01 : 1, y: 0 }}
                onClick={() => setActiveTab(tab.id)}
                onPointerDown={tapFeedback}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.95, y: 1 }}
                transition={pressTransition}
              >
                <span>{tab.label}</span>
                {active && (
                  <motion.div
                    className="absolute left-[10px] right-[10px] bottom-[4px]"
                    style={{ height: 2, backgroundColor: t.toggleColor, borderRadius: 0 }}
                    layoutId="tab-ul"
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto app-scrollbar px-[12px] py-[10px]">
        <div className="w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabPaneVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {activeTab === "general" ? (
                <div className="flex flex-col gap-[12px]">
                  <GeneralTab
                    t={t}
                    theme={theme}
                    setTheme={setTheme}
                    font={font}
                    setFont={setFont}
                  />
                  <DataTab t={t} />
                </div>
              ) : activeTab === "shortcuts" ? (
                <ShortcutsTab t={t} />
              ) : (
                <AboutTab t={t} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
