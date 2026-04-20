import { useState } from "react";
import { useTheme } from "../context/AppContext";
import {
  FolderKanban,
  ChevronsLeftRightEllipsis,
  Keyboard,
  Logs as LogsIcon,
  Bolt,
  Notebook,
  MousePointer2,
  Plus,
  Zap,
  Layout,
  Box,
  Tag,
  ArrowRight,
  Terminal,
  Globe,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type SectionId =
  | "overview"
  | "projects"
  | "connections"
  | "dashboard"
  | "tasks"
  | "button-mapping"
  | "logs"
  | "settings"
  | "shortcuts";

type Section = {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
};

const SECTIONS: Section[] = [
  { id: "overview",       label: "Overview",        icon: <Globe size={14} /> },
  { id: "projects",       label: "Projects",         icon: <FolderKanban size={14} /> },
  { id: "connections",    label: "Connections",      icon: <ChevronsLeftRightEllipsis size={14} /> },
  { id: "dashboard",      label: "Dashboard Editor", icon: <Layout size={14} /> },
  { id: "tasks",          label: "Tasks",            icon: <Zap size={14} /> },
  { id: "button-mapping", label: "Button Mapping",   icon: <Keyboard size={14} /> },
  { id: "logs",           label: "Logs",             icon: <LogsIcon size={14} /> },
  { id: "settings",       label: "Settings",         icon: <Bolt size={14} /> },
  { id: "shortcuts",      label: "Shortcuts",        icon: <Terminal size={14} /> },
];

function Divider({ t }: { t: ReturnType<typeof useTheme> }) {
  return <div className="h-px w-full" style={{ backgroundColor: t.divider }} />;
}

function SectionHeading({ icon, label, t }: { icon: React.ReactNode; label: string; t: ReturnType<typeof useTheme> }) {
  return (
    <div className="flex items-center gap-[10px] mb-[20px]">
      <span style={{ color: t.textMuted }}>{icon}</span>
      <span className="text-[13px] font-semibold tracking-wide uppercase" style={{ color: t.textMuted, letterSpacing: "0.08em" }}>
        {label}
      </span>
    </div>
  );
}

function Paragraph({ children, t }: { children: React.ReactNode; t: ReturnType<typeof useTheme> }) {
  return (
    <p className="text-[13px] leading-[1.75] mb-[14px]" style={{ color: t.textSecondary }}>
      {children}
    </p>
  );
}

function Strong({ children, t }: { children: React.ReactNode; t: ReturnType<typeof useTheme> }) {
  return <span style={{ color: t.textPrimary, fontWeight: 500 }}>{children}</span>;
}

function Code({ children, t }: { children: React.ReactNode; t: ReturnType<typeof useTheme> }) {
  return (
    <code
      className="text-[12px] px-[6px] py-[2px] rounded"
      style={{ backgroundColor: t.inputBg, color: "#a78bfa", border: `1px solid ${t.inputBorder}`, fontFamily: "'JetBrains Mono', monospace" }}
    >
      {children}
    </code>
  );
}

function Callout({ children, t, tone = "info" }: { children: React.ReactNode; t: ReturnType<typeof useTheme>; tone?: "info" | "warning" | "tip" }) {
  const colors = {
    info:    { bg: "rgba(124,58,237,0.1)",  border: "rgba(124,58,237,0.35)", label: "Note",    labelColor: "#a78bfa" },
    warning: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.35)", label: "Warning", labelColor: "#fbbf24" },
    tip:     { bg: "rgba(0,201,81,0.08)",  border: "rgba(0,201,81,0.28)",  label: "Tip",     labelColor: "#4ade80" },
  }[tone];
  return (
    <div className="mb-[14px] px-[14px] py-[12px] text-[13px] leading-[1.7] rounded-sm border-l-2" style={{ backgroundColor: colors.bg, borderColor: colors.border, borderLeftColor: colors.labelColor }}>
      <span style={{ color: colors.labelColor, fontWeight: 600, marginRight: 6 }}>{colors.label}:</span>
      <span style={{ color: t.textSecondary }}>{children}</span>
    </div>
  );
}

function StepList({ steps, t }: { steps: { label: string; detail?: string }[]; t: ReturnType<typeof useTheme> }) {
  return (
    <ol className="mb-[14px] space-y-[10px]">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-[12px]">
          <span
            className="flex-shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold mt-[1px]"
            style={{ backgroundColor: "rgba(124,58,237,0.2)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.35)" }}
          >
            {i + 1}
          </span>
          <div>
            <span className="text-[13px]" style={{ color: t.textPrimary }}>{step.label}</span>
            {step.detail && (
              <p className="text-[12px] mt-[2px]" style={{ color: t.textMuted }}>{step.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items, t }: { items: React.ReactNode[]; t: ReturnType<typeof useTheme> }) {
  return (
    <ul className="mb-[14px] space-y-[8px]">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-[10px] text-[13px] leading-[1.65]">
          <ArrowRight size={13} style={{ color: "#a78bfa", flexShrink: 0, marginTop: 3 }} />
          <span style={{ color: t.textSecondary }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center px-[8px] py-[3px] text-[11px] rounded border"
      style={{ backgroundColor: "#1a2231", borderColor: "#32353e", color: "#d1d5db", fontFamily: "'JetBrains Mono', monospace" }}
    >
      {children}
    </kbd>
  );
}

function ShortcutRow({ keys, desc, t }: { keys: React.ReactNode[]; desc: string; t: ReturnType<typeof useTheme> }) {
  return (
    <div className="flex items-center justify-between py-[10px] border-b" style={{ borderColor: t.divider }}>
      <span className="text-[13px]" style={{ color: t.textSecondary }}>{desc}</span>
      <div className="flex items-center gap-[4px]">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-[4px]">
            {i > 0 && <span style={{ color: t.textMuted, fontSize: 11 }}>+</span>}
            <KeyBadge>{k}</KeyBadge>
          </span>
        ))}
      </div>
    </div>
  );
}

function CollapsibleSection({ title, children, t, defaultOpen = false }: {
  title: string; children: React.ReactNode; t: ReturnType<typeof useTheme>; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-[8px] border rounded-sm" style={{ borderColor: t.inputBorder }}>
      <button
        className="w-full flex items-center justify-between px-[14px] py-[11px] text-[13px] text-left transition-colors hover:bg-white/5"
        style={{ color: t.textPrimary }}
        onClick={() => setOpen(o => !o)}
      >
        <span>{title}</span>
        {open ? <ChevronDown size={14} style={{ color: t.textMuted }} /> : <ChevronRight size={14} style={{ color: t.textMuted }} />}
      </button>
      {open && (
        <div className="px-[14px] pb-[14px] pt-[4px]" style={{ borderTop: `1px solid ${t.inputBorder}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

const PROTOCOL_OVERVIEW = [
  { name: "OSC",      detail: "Open Sound Control — UDP/TCP-based message bus. Works with Resolume, GrandMA, QLab, and more." },
  { name: "TCP",      detail: "Raw TCP socket connection. Used for vMix API, RossTalk, and generic TCP devices." },
  { name: "WebSocket",detail: "Full-duplex WebSocket connection. Required for OBS Studio." },
  { name: "HTTP",     detail: "REST-style HTTP/HTTPS request sending. Useful for generic REST endpoints." },
  { name: "Art-Net",  detail: "DMX over IP. For lighting consoles and LED processors that support Art-Net." },
  { name: "UDP",      detail: "Connectionless UDP datagrams. For ATEM, Videohub, GrandMA2/3, X32, and more." },
];

// ── Section content components ────────────────────────────────────────────────

function SectionOverview({ t }: { t: ReturnType<typeof useTheme> }) {
  return (
    <div>
      <SectionHeading icon={<Globe size={14} />} label="Overview" t={t} />
      <Paragraph t={t}>
        <Strong t={t}>AutoCom</Strong> is a high-performance broadcast automation and control dashboard. It lets you build custom control surfaces that send commands to professional AV devices — all from a single, unified interface.
      </Paragraph>
      <Paragraph t={t}>
        Connect to video switchers, lighting consoles, media servers, and more. Design drag-and-drop dashboards with buttons that fire sequences of commands — across multiple devices — in a single click.
      </Paragraph>

      <Callout t={t} tone="info">
        You are running AutoCom in <Strong t={t}>web mode</Strong>. All project data and layouts are saved automatically to your browser's local storage. Hardware features like physical Stream Deck control require the native desktop app.
      </Callout>

      <div className="grid grid-cols-3 gap-[12px] mt-[24px] mb-[16px]">
        {[
          { icon: <FolderKanban size={18} />, title: "Projects",      desc: "Organise your control surfaces by show or venue." },
          { icon: <ChevronsLeftRightEllipsis size={18} />, title: "Connections", desc: "Define all of your hardware endpoints once." },
          { icon: <Layout size={18} />,        title: "Dashboards",    desc: "Build WYSIWYG control surfaces with drag-and-drop." },
          { icon: <Zap size={18} />,           title: "Tasks",         desc: "Buttons can fire multi-step command sequences." },
          { icon: <Keyboard size={18} />,       title: "Button Mapping",desc: "Map Elgato Stream Deck keys to dashboard buttons." },
          { icon: <LogsIcon size={18} />,       title: "Logs",          desc: "Live feed of every command sent and received." },
        ].map((card) => (
          <div
            key={card.title}
            className="p-[14px] rounded-sm border flex flex-col gap-[8px]"
            style={{ borderColor: t.inputBorder, backgroundColor: t.inputBg }}
          >
            <span style={{ color: "#a78bfa" }}>{card.icon}</span>
            <span className="text-[13px] font-medium" style={{ color: t.textPrimary }}>{card.title}</span>
            <span className="text-[12px] leading-[1.6]" style={{ color: t.textMuted }}>{card.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionProjects({ t }: { t: ReturnType<typeof useTheme> }) {
  return (
    <div>
      <SectionHeading icon={<FolderKanban size={14} />} label="Projects" t={t} />
      <Paragraph t={t}>
        Projects are top-level containers. Each project gets its own dashboard canvas. A project might represent a single show, a venue, or a specific production setup.
      </Paragraph>
      <StepList t={t} steps={[
        { label: "Click New Project", detail: "Enter a name and press Enter or click Create." },
        { label: "Click Open", detail: "This takes you into the project's dashboard editor." },
        { label: "Build your dashboard", detail: "Add buttons and labels to the canvas — see Dashboard Editor." },
        { label: "Export when ready", detail: "Right-click any project → Export to save a portable .json file." },
      ]} />
      <Callout t={t} tone="tip">
        Use <Strong t={t}>Export / Import</Strong> to move projects between computers or share them with your team. The export bundle includes your layout and all connection definitions.
      </Callout>
    </div>
  );
}

function SectionConnections({ t }: { t: ReturnType<typeof useTheme> }) {
  return (
    <div>
      <SectionHeading icon={<ChevronsLeftRightEllipsis size={14} />} label="Connections" t={t} />
      <Paragraph t={t}>
        Connections define how AutoCom talks to your hardware. Set up each device once here, then reference it in any dashboard task across all projects.
      </Paragraph>
      <StepList t={t} steps={[
        { label: "Navigate to Connections", detail: "Click the Connections item in the left sidebar." },
        { label: "Click Add Connection", detail: "Choose your device type from the dropdown list." },
        { label: "Enter IP address and port", detail: "These match the settings on your hardware or software." },
        { label: "Toggle the connection on", detail: "The status indicator turns green when connected." },
      ]} />
      <div className="mb-[16px]">
        <p className="text-[12px] font-semibold uppercase tracking-wide mb-[10px]" style={{ color: t.textMuted, letterSpacing: "0.08em" }}>Supported Protocols</p>
        <div className="space-y-[1px]">
          {PROTOCOL_OVERVIEW.map((p) => (
            <div key={p.name} className="flex gap-[12px] py-[9px] border-b" style={{ borderColor: t.divider }}>
              <span className="text-[12px] w-[90px] flex-shrink-0 font-medium" style={{ color: "#a78bfa", fontFamily: "'JetBrains Mono', monospace" }}>{p.name}</span>
              <span className="text-[12px] leading-[1.6]" style={{ color: t.textSecondary }}>{p.detail}</span>
            </div>
          ))}
        </div>
      </div>
      <Callout t={t} tone="tip">
        Connections are <Strong t={t}>global</Strong> — they're shared across all your projects. If you update an IP address in Connections, every button that uses that device picks up the change instantly.
      </Callout>
    </div>
  );
}

function SectionDashboard({ t }: { t: ReturnType<typeof useTheme> }) {
  return (
    <div>
      <SectionHeading icon={<Layout size={14} />} label="Dashboard Editor" t={t} />
      <Paragraph t={t}>
        The dashboard is a free-form canvas where you place <Strong t={t}>buttons</Strong> and <Strong t={t}>labels</Strong>. Open a project to enter its dashboard. Switch between <Strong t={t}>Edit</Strong> and <Strong t={t}>Control</Strong> modes using the toggle in the top bar.
      </Paragraph>

      <div className="grid grid-cols-2 gap-[10px] mb-[18px]">
        {[
          { icon: <Box size={15} />, title: "Button", desc: "An interactive control that fires a task list when clicked. Style the background, border, text colour, and font size." },
          { icon: <Tag size={15} />, title: "Label",  desc: "Static text or a section divider. Same full style control as buttons but non-interactive." },
        ].map((item) => (
          <div key={item.title} className="p-[12px] rounded-sm border" style={{ borderColor: t.inputBorder, backgroundColor: t.inputBg }}>
            <div className="flex items-center gap-[8px] mb-[6px]">
              <span style={{ color: "#a78bfa" }}>{item.icon}</span>
              <span className="text-[13px] font-medium" style={{ color: t.textPrimary }}>{item.title}</span>
            </div>
            <p className="text-[12px] leading-[1.6]" style={{ color: t.textMuted }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-[12px] font-semibold uppercase tracking-wide mb-[10px]" style={{ color: t.textMuted, letterSpacing: "0.08em" }}>Editor Tools</p>
      <BulletList t={t} items={[
        <><Strong t={t}>Select (S)</Strong> — Click to select an item; drag the resize handles to resize.</>,
        <><Strong t={t}>Move (M)</Strong> — Drag selected items around the canvas. Hold Shift to disable snapping.</>,
        <><Strong t={t}>Button (B)</Strong> — Draw a new button by clicking and dragging on the canvas.</>,
        <><Strong t={t}>Label (L)</Strong> — Draw a new label by clicking and dragging on the canvas.</>,
        <><Strong t={t}>Snap to grid</Strong> — Toggle from the toolbar. Supported grid sizes: 8, 16, 24 px.</>,
        <><Strong t={t}>Auto-save</Strong> — Layouts are saved automatically a short delay after every change.</>,
        <><Strong t={t}>Undo / Redo</Strong> — <KeyBadge>Ctrl</KeyBadge> + <KeyBadge>Z</KeyBadge> / <KeyBadge>Ctrl</KeyBadge> + <KeyBadge>Shift</KeyBadge> + <KeyBadge>Z</KeyBadge>, up to 100 steps.</>,
      ]} />

      <Callout t={t} tone="tip">
        In <Strong t={t}>Control</Strong> mode the editor UI disappears and buttons become fully clickable — great for touchscreen setups or operator hand-off.
      </Callout>
    </div>
  );
}

function SectionTasks({ t }: { t: ReturnType<typeof useTheme> }) {
  return (
    <div>
      <SectionHeading icon={<Zap size={14} />} label="Tasks" t={t} />
      <Paragraph t={t}>
        Tasks are the commands that run when a button is clicked. Each button holds an ordered list of tasks. They execute from top to bottom when the button is pressed in Control mode.
      </Paragraph>
      <StepList t={t} steps={[
        { label: "Double-click a button in the editor", detail: "This opens the Edit window with the task list." },
        { label: "Click Add Task", detail: "Select a connection from the left panel, then choose the action." },
        { label: "Configure the task parameters", detail: "Each task type has its own input fields — function, value, path, etc." },
        { label: "Reorder tasks with the arrow buttons", detail: "Tasks run in order, top to bottom." },
        { label: "Click Save", detail: "The button is updated immediately." },
      ]} />

      <div className="mb-[16px]">
        <p className="text-[12px] font-semibold uppercase tracking-wide mb-[10px]" style={{ color: t.textMuted, letterSpacing: "0.08em" }}>Common Task Types</p>
        {[
          { name: "Send OSC Message",       desc: "Fire an OSC address with an optional value argument." },
          { name: "Send TCP Command",        desc: "Send a raw string or hex payload over the TCP connection." },
          { name: "HTTP Request",            desc: "Trigger a GET or POST request to any URL." },
          { name: "Wait",                    desc: "Pause execution for a fixed number of milliseconds." },
          { name: "vMix — Function",         desc: "Call any vMix API function by name with optional input and value." },
          { name: "OBS — Set Scene",         desc: "Transition OBS to any named scene." },
          { name: "ATEM — Cut / Auto",       desc: "Trigger a cut or auto-transition on a Blackmagic ATEM switcher." },
          { name: "Videohub — Route",        desc: "Change a source-to-destination crosspoint on a Videohub router." },
        ].map((item) => (
          <div key={item.name} className="flex gap-[10px] py-[9px] border-b" style={{ borderColor: t.divider }}>
            <span className="text-[12px] w-[180px] flex-shrink-0 font-medium" style={{ color: t.textPrimary }}>{item.name}</span>
            <span className="text-[12px] leading-[1.6]" style={{ color: t.textMuted }}>{item.desc}</span>
          </div>
        ))}
      </div>

      <Callout t={t} tone="info">
        The <Strong t={t}>Wait</Strong> task is particularly useful when chaining multiple commands that need time between them — for example, switching a video source and then triggering a fade.
      </Callout>
    </div>
  );
}

function SectionButtonMapping({ t }: { t: ReturnType<typeof useTheme> }) {
  return (
    <div>
      <SectionHeading icon={<Keyboard size={14} />} label="Button Mapping" t={t} />
      <Paragraph t={t}>
        The Button Mapping page lets you assign dashboard buttons to physical keys on an <Strong t={t}>Elgato Stream Deck</Strong>. This requires the native desktop version of AutoCom — Stream Deck access is not available in the web browser.
      </Paragraph>
      <Callout t={t} tone="warning">
        Stream Deck hardware control requires the <Strong t={t}>Tauri desktop app</Strong>. In web mode you can still configure mappings and preview layouts, but keys won't fire physically.
      </Callout>
      <StepList t={t} steps={[
        { label: "Connect your Stream Deck via USB" },
        { label: "Open Button Mapping from the sidebar" },
        { label: "Select your device from the dropdown" },
        { label: "Click a key on the Stream Deck layout" },
        { label: "Choose the dashboard button to assign to that key" },
        { label: "Enable Direct Sync to push key labels to the display" },
      ]} />
      <BulletList t={t} items={[
        <><Strong t={t}>Pages</Strong> — Mappings are organised into pages. Use special keys (Next Page / Prev Page) to navigate between them.</>,
        <><Strong t={t}>Key Style</Strong> — Customise label text, text colour, background colour, and alignment per key.</>,
        <><Strong t={t}>Direct Sync</Strong> — When enabled, AutoCom pushes rendered key images directly to the Stream Deck display.</>,
      ]} />
    </div>
  );
}

function SectionLogs({ t }: { t: ReturnType<typeof useTheme> }) {
  return (
    <div>
      <SectionHeading icon={<LogsIcon size={14} />} label="Logs" t={t} />
      <Paragraph t={t}>
        The Logs page shows a live, searchable stream of every event AutoCom captures — connection attempts, command sends, heartbeats, errors, and more.
      </Paragraph>
      <BulletList t={t} items={[
        <><Strong t={t}>Search</Strong> — Type in the search box to filter by timestamp, source, or message content. Focus with <KeyBadge>Ctrl</KeyBadge> + <KeyBadge>F</KeyBadge>.</>,
        <><Strong t={t}>Clear</Strong> — Hides all logs older than the moment you clicked Clear. Logs are not deleted.</>,
        <><Strong t={t}>Export CSV</Strong> — Downloads all current logs (including hidden ones) as a <Code t={t}>.csv</Code> file for external analysis.</>,
        <><Strong t={t}>Auto-scroll</Strong> — New entries appear at the top. The view stays pinned to latest as long as you don't scroll up.</>,
      ]} />
      <Callout t={t} tone="tip">
        In the desktop app, the log feed is populated in real-time from the Rust backend as commands are dispatched. In web mode, logs show events generated by the frontend (e.g. import/export activity).
      </Callout>
    </div>
  );
}

function SectionSettings({ t }: { t: ReturnType<typeof useTheme> }) {
  return (
    <div>
      <SectionHeading icon={<Bolt size={14} />} label="Settings" t={t} />
      <Paragraph t={t}>
        Application-wide preferences. Changes apply immediately and persist across sessions.
      </Paragraph>
      {[
        { title: "Appearance — Theme",        detail: "Switch between Dark and Light mode. Preview updates in real time on the Settings page." },
        { title: "Appearance — Font",         detail: "Choose between JetBrains Mono (monospace) or System UI (sans-serif) across the entire application." },
        { title: "Editor — Snap to Grid",     detail: "Default state for the snap toggle when you open a project dashboard." },
        { title: "Editor — Grid Size",        detail: "Default canvas grid size (8, 16, or 24 px) for new sessions." },
        { title: "Editor — Auto-save",        detail: "When on, layouts save automatically after each change. When off, you must save manually." },
        { title: "Motion — Animation Speed",  detail: "Scale the UI animation speed from 0× (instant) to 2× (slow). Useful for reducing motion." },
      ].map((item) => (
        <CollapsibleSection key={item.title} title={item.title} t={t}>
          <p className="text-[13px] leading-[1.7] pt-[8px]" style={{ color: t.textSecondary }}>{item.detail}</p>
        </CollapsibleSection>
      ))}
    </div>
  );
}

function SectionShortcuts({ t }: { t: ReturnType<typeof useTheme> }) {
  return (
    <div>
      <SectionHeading icon={<Terminal size={14} />} label="Keyboard Shortcuts" t={t} />
      <Paragraph t={t}>All shortcuts are active within their respective context.</Paragraph>

      <p className="text-[12px] font-semibold uppercase tracking-wide mb-[8px] mt-[16px]" style={{ color: t.textMuted, letterSpacing: "0.08em" }}>Dashboard Editor</p>
      <div className="mb-[20px]">
        <ShortcutRow t={t} desc="Undo" keys={["Ctrl", "Z"]} />
        <ShortcutRow t={t} desc="Redo" keys={["Ctrl", "Shift", "Z"]} />
        <ShortcutRow t={t} desc="Select tool" keys={["S"]} />
        <ShortcutRow t={t} desc="Move tool" keys={["M"]} />
        <ShortcutRow t={t} desc="Button tool" keys={["B"]} />
        <ShortcutRow t={t} desc="Label tool" keys={["L"]} />
        <ShortcutRow t={t} desc="Delete selected item" keys={["Delete"]} />
        <ShortcutRow t={t} desc="Deselect" keys={["Escape"]} />
        <ShortcutRow t={t} desc="Save layout manually" keys={["Ctrl", "S"]} />
        <ShortcutRow t={t} desc="Move selected (1 px)" keys={["↑ / ↓ / ← / →"]} />
        <ShortcutRow t={t} desc="Move selected (grid)" keys={["Shift + Arrow"]} />
      </div>

      <p className="text-[12px] font-semibold uppercase tracking-wide mb-[8px]" style={{ color: t.textMuted, letterSpacing: "0.08em" }}>Logs Page</p>
      <div className="mb-[20px]">
        <ShortcutRow t={t} desc="Focus search box" keys={["Ctrl", "F"]} />
        <ShortcutRow t={t} desc="Clear log view" keys={["Ctrl", "K"]} />
      </div>

      <p className="text-[12px] font-semibold uppercase tracking-wide mb-[8px]" style={{ color: t.textMuted, letterSpacing: "0.08em" }}>Global</p>
      <div>
        <ShortcutRow t={t} desc="Toggle sidebar" keys={["Ctrl", "B"]} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UserGuide() {
  const t = useTheme();
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  const renderSection = () => {
    switch (activeSection) {
      case "overview":       return <SectionOverview t={t} />;
      case "projects":       return <SectionProjects t={t} />;
      case "connections":    return <SectionConnections t={t} />;
      case "dashboard":      return <SectionDashboard t={t} />;
      case "tasks":          return <SectionTasks t={t} />;
      case "button-mapping": return <SectionButtonMapping t={t} />;
      case "logs":           return <SectionLogs t={t} />;
      case "settings":       return <SectionSettings t={t} />;
      case "shortcuts":      return <SectionShortcuts t={t} />;
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden page-pop" style={{ backgroundColor: t.bgContent }}>
      {/* Sidebar nav */}
      <div
        className="w-[200px] flex-shrink-0 flex flex-col py-[12px] overflow-y-auto"
        style={{ backgroundColor: t.bgSidebar, borderRight: `1px solid ${t.divider}` }}
      >
        <div className="px-[12px] mb-[8px]">
          <div className="flex items-center gap-[8px] px-[4px] py-[6px]">
            <Notebook size={13} style={{ color: t.textMuted }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.textMuted, letterSpacing: "0.08em" }}>User Guide</span>
          </div>
        </div>
        <Divider t={t} />
        <nav className="flex flex-col px-[8px] pt-[8px] gap-[2px]">
          {SECTIONS.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                className="flex items-center gap-[9px] px-[10px] py-[8px] text-left text-[13px] rounded-sm transition-colors"
                style={{
                  backgroundColor: isActive ? t.navActive : "transparent",
                  color: isActive ? t.textPrimary : t.textMuted,
                }}
                onClick={() => setActiveSection(section.id)}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] px-[32px] py-[28px]">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
