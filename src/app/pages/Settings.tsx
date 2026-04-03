import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Palette, PanelLeft, Keyboard, Info, Grid3X3,
  Sun, Moon, Check, Zap, MousePointer2, Terminal,
  GitBranch, PackageOpen, Hash,
} from "lucide-react";
import { useAppContext, useTheme } from "../context/AppContext";
import { setMotionSpeed, type MotionSpeed } from "../services/motion";
import type { ThemeMode, FontMode } from "../types";
import pkg from "../../../package.json";

const APP_VERSION = `v${pkg.version}`;

type TabId = "appearance" | "editor" | "shortcuts" | "about";

const TABS: { id: TabId; label: string }[] = [
  { id: "appearance", label: "Appearance" },
  { id: "editor",     label: "Editor"     },
  { id: "shortcuts",  label: "Shortcuts"  },
  { id: "about",      label: "About"      },
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
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.065,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
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
  label, children, t, last,
}: {
  label: string; children: React.ReactNode; t: T; last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-[20px]"
      style={{ height: 56, borderBottom: last ? "none" : `1px solid ${t.divider}` }}
    >
      <span className="text-[13px]" style={{ color: t.textPrimary }}>{label}</span>
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
      className="flex rounded-[4px] overflow-hidden"
      style={{ border: `1px solid ${t.btnToggleBorder}` }}
    >
      {options.map((o, i) => {
        const active = value === o.value;
        return (
          <motion.button
            key={String(o.value)}
            className="px-[14px] text-[12px] transition-colors"
            style={{
              height: 30,
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
      className={`rounded-[4px] overflow-hidden card-pop ${className}`}
      style={{ border: `1px solid ${t.divider}`, backgroundColor: t.rowBg }}
      variants={cardVariants}
    >
      {title && (
        <div
          className="px-[20px] flex items-center"
          style={{ height: 36, borderBottom: `1px solid ${t.divider}`, backgroundColor: t.bgContent }}
        >
          <span className="text-[11px] uppercase tracking-wider" style={{ color: t.textMuted, letterSpacing: "0.08em" }}>
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
          className="inline-flex items-center justify-center rounded-[3px] px-[7px] text-[11px]"
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

// ── Appearance ────────────────────────────────────────────────────────────────

function AppearanceTab({
  t, theme, setTheme, font, setFont, sidebarOpen, setSidebarOpen,
}: {
  t: T;
  theme: ThemeMode;
  setTheme: React.Dispatch<React.SetStateAction<ThemeMode>>;
  font: FontMode;
  setFont: React.Dispatch<React.SetStateAction<FontMode>>;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const monoFont = "'JetBrains Mono', monospace";
  const sansFont = "'Inter', sans-serif";

  return (
    <div className="grid grid-cols-2 gap-[16px]">

      {/* Theme — full width */}
      <Card title="Theme" t={t} className="col-span-2">
        <div className="p-[20px] flex gap-[16px]">
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
                className="flex-1 rounded-[6px] overflow-hidden text-left"
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
                <div className="flex" style={{ height: 88, backgroundColor: opt.bg }}>
                  <div style={{ width: 48, backgroundColor: opt.sidebar, borderRight: `1px solid ${opt.sidebarBorder}` }}>
                    <div style={{ height: 8, margin: "10px 8px 6px", backgroundColor: opt.bar1, borderRadius: 2 }} />
                    <div style={{ height: 5, margin: "0 8px 5px", backgroundColor: opt.bar2, borderRadius: 2, width: "60%" }} />
                    <div style={{ height: 5, margin: "0 8px 5px", backgroundColor: opt.bar2, borderRadius: 2, width: "40%" }} />
                    <div style={{ height: 5, margin: "0 8px", backgroundColor: opt.bar2, borderRadius: 2, width: "50%" }} />
                  </div>
                  <div className="flex flex-col gap-[5px] p-[10px] flex-1">
                    <div style={{ height: 7, width: "55%", backgroundColor: opt.bar1, borderRadius: 2 }} />
                    <div style={{ height: 7, width: "35%", backgroundColor: opt.bar2, borderRadius: 2 }} />
                    <div style={{ height: 18, width: "80%", marginTop: 4, backgroundColor: opt.rowBg, borderRadius: 2, border: `1px solid ${opt.rowBorder}` }} />
                    <div style={{ height: 18, width: "80%", backgroundColor: opt.rowBg, borderRadius: 2, border: `1px solid ${opt.rowBorder}` }} />
                  </div>
                </div>

                {/* Label row */}
                <div
                  className="flex items-center justify-between px-[12px]"
                  style={{ height: 36, backgroundColor: opt.footer, borderTop: `1px solid ${opt.footerBorder}` }}
                >
                  <div className="flex items-center gap-[6px]">
                    {opt.icon}
                    <span className="text-[12px]" style={{ color: opt.labelColor }}>{opt.label}</span>
                  </div>
                  <AnimatePresence>
                    {active && (
                      <motion.div
                        className="rounded-full flex items-center justify-center"
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

      {/* Font */}
      <Card title="Font" t={t}>
        <Row label="Interface typeface" t={t} last>
          <Seg
            options={[
              { value: "mono" as FontMode, label: <span style={{ fontFamily: monoFont }}>Mono</span> },
              { value: "sans" as FontMode, label: <span style={{ fontFamily: sansFont }}>Sans</span> },
            ]}
            value={font} onChange={setFont} t={t}
          />
        </Row>
        <div
          className="mx-[20px] mb-[16px] px-[14px] py-[12px] rounded-[4px]"
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
      </Card>

      {/* Sidebar default */}
      <Card title="Sidebar" t={t}>
        <Row label="Default on launch" t={t} last>
          <Seg
            options={[
              { value: "expanded",  label: "Expanded"  },
              { value: "collapsed", label: "Collapsed" },
            ]}
            value={sidebarOpen ? "expanded" : "collapsed"}
            onChange={(v) => setSidebarOpen(v === "expanded")}
            t={t}
          />
        </Row>
      </Card>

    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

const EDITOR_STORAGE = {
  snap:  "settings.editor.snap",
  grid:  "settings.editor.grid",
  speed: "settings.editor.speed",
  save:  "settings.editor.save",
} as const;

function readEditorPref<V extends string>(key: string, fallback: V): V {
  try {
    return (localStorage.getItem(key) as V) ?? fallback;
  } catch {
    return fallback;
  }
}

function EditorTab({ t }: { t: T }) {
  const [snap,  setSnap]  = useState<"on"  | "off">(() => readEditorPref(EDITOR_STORAGE.snap,  "on"));
  const [grid,  setGrid]  = useState<"8"   | "16"  | "24">(() => readEditorPref(EDITOR_STORAGE.grid,  "16"));
  const [speed, setSpeed] = useState<MotionSpeed>(() => readEditorPref(EDITOR_STORAGE.speed, "normal"));
  const [save,  setSave]  = useState<"on"  | "off">(() => readEditorPref(EDITOR_STORAGE.save,  "on"));

  function persist(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }

  return (
    <div className="grid grid-cols-2 gap-[16px]">

      <Card title="Canvas" t={t}>
        <Row label="Snap to grid" t={t}>
          <Seg options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
            value={snap} onChange={(v) => { setSnap(v); persist(EDITOR_STORAGE.snap, v); }} t={t} />
        </Row>
        <Row label="Grid size" t={t} last>
          <Seg
            options={[{ value: "8", label: "8px" }, { value: "16", label: "16px" }, { value: "24", label: "24px" }]}
            value={grid} onChange={(v) => { setGrid(v); persist(EDITOR_STORAGE.grid, v); }} t={t}
          />
        </Row>
      </Card>

      <Card title="Behaviour" t={t}>
        <Row label="Auto-save" t={t}>
          <Seg options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
            value={save} onChange={(v) => { setSave(v); persist(EDITOR_STORAGE.save, v); }} t={t} />
        </Row>
        <Row label="Animation speed" t={t} last>
          <Seg
            options={[{ value: "fast", label: "Fast" }, { value: "normal", label: "Normal" }, { value: "slow", label: "Slow" }]}
            value={speed} onChange={(v) => { setSpeed(v); setMotionSpeed(v); }} t={t}
          />
        </Row>
        {/* Speed indicator */}
        <div className="px-[20px] pb-[16px]">
          <div
            className="relative rounded-[3px] overflow-hidden"
            style={{ height: 4, backgroundColor: t.bgContent, border: `1px solid ${t.divider}` }}
          >
            <motion.div
              className="absolute left-0 top-0 bottom-0 rounded-[3px]"
              style={{ backgroundColor: t.toggleColor, width: "40%" }}
              animate={{ x: ["-100%", "350%"] }}
              transition={{
                repeat: Infinity, repeatType: "loop", ease: "easeInOut",
                duration: speed === "fast" ? 0.5 : speed === "slow" ? 2 : 1,
              }}
            />
          </div>
        </div>
      </Card>

    </div>
  );
}

// ── Shortcuts ─────────────────────────────────────────────────────────────────

function ShortcutsTab({ t }: { t: T }) {
  const cols = [
    [
      { action: "Enter / exit edit mode", keys: ["G"]        },
      { action: "Select tool",            keys: ["S"]        },
      { action: "Move tool",              keys: ["M"]        },
      { action: "Resize tool",            keys: ["R"]        },
      { action: "Label tool",             keys: ["L"]        },
      { action: "Button tool",            keys: ["B"]        },
      { action: "Cancel / close",         keys: ["Esc"]      },
    ],
    [
      { action: "Toggle sidebar",         keys: ["⌘", "B"]  },
      { action: "Quick project jump",     keys: ["⌘", "K"]  },
      { action: "New connection",         keys: ["⌘", "N"]  },
      { action: "Clear logs",             keys: ["⌘", "⌫"] },
      { action: "Search",                 keys: ["⌘", "F"]  },
      { action: "Copy selected",          keys: ["⌘", "C"]  },
      { action: "Export",                 keys: ["⌘", "S"]  },
    ],
  ];

  return (
    <div className="grid grid-cols-2 gap-[16px]">
      {cols.map((col, ci) => (
        <Card key={ci} t={t}>
          {col.map((item, i) => (
            <div
              key={item.action}
              className="flex items-center justify-between px-[20px]"
              style={{
                height: 48,
                borderBottom: i < col.length - 1 ? `1px solid ${t.divider}` : "none",
              }}
            >
              <span className="text-[13px]" style={{ color: t.textSecondary }}>{item.action}</span>
              <Kbd keys={item.keys} t={t} />
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────

function AboutTab({ t }: { t: T }) {
  return (
    <div className="grid grid-cols-2 gap-[16px]">

      {/* Version */}
      <Card t={t}>
        <div
          className="flex flex-col items-center justify-center gap-[6px]"
          style={{ height: 120, borderBottom: `1px solid ${t.divider}` }}
        >
          <span className="text-[32px]" style={{ color: t.textPrimary, letterSpacing: "-0.03em" }}>
            {APP_VERSION}
          </span>
          <span
            className="px-[10px] py-[2px] rounded-[3px] text-[11px]"
            style={{
              backgroundColor: t.btnToggleActive,
              border: `1px solid ${t.btnToggleBorder}`,
              color: t.textMuted,
            }}
          >
            alpha
          </span>
        </div>

        {[
          { label: "Build date", value: import.meta.env.VITE_BUILD_DATE || "N/A", icon: <Hash size={12} />        },
          { label: "Branch",     value: import.meta.env.VITE_GIT_BRANCH || "N/A", icon: <GitBranch size={12} />   },
          { label: "Commit",     value: import.meta.env.VITE_GIT_COMMIT || "N/A", icon: <PackageOpen size={12} /> },
        ].map((row, i, arr) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-[20px]"
            style={{ height: 48, borderBottom: i < arr.length - 1 ? `1px solid ${t.divider}` : "none" }}
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
        {[
          { label: "Runtime",    value: "Tauri v2"         },
          { label: "UI",         value: "React 18"         },
          { label: "Bundler",    value: "Vite"             },
          { label: "Language",   value: "TypeScript"       },
          { label: "Styling",    value: "Tailwind v4"      },
          { label: "Animation",  value: "Motion"           },
          { label: "Router",     value: "React Router v7"  },
        ].map((s, i, arr) => (
          <div
            key={s.label}
            className="flex items-center justify-between px-[20px]"
            style={{ height: 44, borderBottom: i < arr.length - 1 ? `1px solid ${t.divider}` : "none" }}
          >
            <span className="text-[13px]" style={{ color: t.textSecondary }}>{s.label}</span>
            <span className="text-[12px]" style={{ color: t.textMuted }}>{s.value}</span>
          </div>
        ))}
      </Card>

    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { theme, setTheme, font, setFont, sidebarOpen, setSidebarOpen } = useAppContext();
  const t = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("appearance");

  return (
    <div className="flex flex-col flex-1 overflow-hidden page-pop" style={{ backgroundColor: t.bgContent }}>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-end gap-[2px] px-[16px]"
        style={{ height: 44, borderBottom: `1px solid ${t.divider}` }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              className="relative px-[14px] text-[13px] transition-colors"
              style={{
                height: 36,
                color: active ? t.textPrimary : t.textMuted,
                backgroundColor: active ? t.navActive : "transparent",
                borderRadius: "4px 4px 0 0",
              }}
              animate={{ scale: active ? 1.02 : 1, y: active ? 0 : 1 }}
              onClick={() => setActiveTab(tab.id)}
              onPointerDown={tapFeedback}
              whileHover={{ y: active ? 0 : -1 }}
              whileTap={{ scale: 0.95, y: 1 }}
              transition={pressTransition}
            >
              {tab.label}
              {active && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0"
                  style={{ height: 2, backgroundColor: t.toggleColor, borderRadius: "2px 2px 0 0" }}
                  layoutId="tab-ul"
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                />
              )}
            </motion.button>
          );
        })}

        <div className="ml-auto flex items-center pb-[6px]">
          <span className="text-[11px]" style={{ color: t.textMuted }}>{APP_VERSION}-alpha</span>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabPaneVariants}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {activeTab === "appearance" && (
              <AppearanceTab
                t={t}
                theme={theme}
                setTheme={setTheme}
                font={font}
                setFont={setFont}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
              />
            )}
            {activeTab === "editor"    && <EditorTab    t={t} />}
            {activeTab === "shortcuts" && <ShortcutsTab t={t} />}
            {activeTab === "about"     && <AboutTab     t={t} />}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
