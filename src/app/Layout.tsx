import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Bolt,
  ChevronUp,
  ChevronsLeftRightEllipsis,
  FolderKanban,
  Keyboard,
  Logs as LogsIcon,
  Notebook,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAppContext, useTheme, type AppTheme } from "./context/AppContext";
import { DeviceStatusSummary } from "./components/DeviceStatusSummary";
import WindowStrip from "./components/WindowStrip";
import { useDeviceStatuses } from "./hooks/useDeviceStatuses";
import { useWindowFullscreen } from "./hooks/useWindowFullscreen";
import { readMotionScale, subscribeMotionSpeedChange } from "./services/motion";
import { loadDashboardLayout } from "./services/runtimeState";
import { compileDashboardRows } from "./services/dashboardTasks";
import { listStreamDeckDevices, pollStreamDeckButtonEvents, type StreamDeckDevice } from "./services/streamdeck";
import { isTauri, tauriInvoke } from "./services/tauri";

const TOPBAR_H = 70;
const SIDEBAR_W = 280;
const APP_INNER_GUTTER = 8;
const EASE = [0.4, 0, 0.2, 1] as const;
const STREAMDECK_DIRECT_SYNC_KEY = "autocom.streamdeck.directSync.v1";
const STREAMDECK_SELECTED_SERIAL_KEY = "autocom.streamdeck.selectedSerial.v1";
const STREAMDECK_ACTIVE_PAGE_KEY = "autocom.streamdeck.activePage.v1";
const MAPPING_STORAGE_KEY = "autocom.button-mapping.v1";
const SPECIAL_MAPPING_PREFIX = "__special__:";
const SPECIAL_MAPPING_PAGE_NEXT = `${SPECIAL_MAPPING_PREFIX}page_next`;
const SPECIAL_MAPPING_PAGE_PREVIOUS = `${SPECIAL_MAPPING_PREFIX}page_previous`;
const SPECIAL_MAPPING_NONE = `${SPECIAL_MAPPING_PREFIX}none`;

function readDirectSyncEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(STREAMDECK_DIRECT_SYNC_KEY);
  return raw == null ? true : raw === "1";
}

function readSelectedSerial(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STREAMDECK_SELECTED_SERIAL_KEY) ?? "";
}

function readActivePage(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(STREAMDECK_ACTIVE_PAGE_KEY);
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

function writeActivePage(page: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STREAMDECK_ACTIVE_PAGE_KEY, String(Math.max(1, page)));
  window.dispatchEvent(new CustomEvent("autocom:streamdeck-active-page-changed"));
}

function readMappings(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MAPPING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function maxMappedPage(mappings: Record<string, string>): number {
  let max = 1;
  for (const key of Object.keys(mappings)) {
    const [page] = key.split("/");
    const parsed = Number.parseInt(page, 10);
    if (Number.isFinite(parsed)) {
      max = Math.max(max, parsed);
    }
  }
  return max;
}

type DashboardApiEvent = { name: string; data?: unknown };
type DashboardApiResponse = { status: number; body?: { success?: boolean; error?: string }; events?: DashboardApiEvent[] };

// ── Unified nav config ─────────────────────────────────────────────────────────
// Single source of truth for sidebar navigation items.

export type NavItem = {
  label: string;
  icon: React.ReactNode;
  path: string;
};

export const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Project",     icon: <FolderKanban size={16} />,              path: "/"            },
  { label: "Connections", icon: <ChevronsLeftRightEllipsis size={16} />, path: "/connections" },
  { label: "Button Mapping", icon: <Keyboard size={16} />,               path: "/button-mapping" },
  { label: "Logs",        icon: <LogsIcon size={16} />,                  path: "/logs"        },
  { label: "User Guide",  icon: <Notebook size={16} />,                  path: "/user-guide"  },
  { label: "Settings",    icon: <Bolt size={16} />,                      path: "/settings"    },
];

// ── NavRow ─────────────────────────────────────────────────────────────────────
// Extracted outside Layout so it is not re-created on every render.

function NavRow({
  label,
  icon,
  active,
  onClick,
  rightSlot,
  t,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  rightSlot?: React.ReactNode;
  t: AppTheme;
}) {
  return (
    <div className="px-[17px]">
      <motion.button
        className="nav-button relative flex items-center w-full gap-[9px] px-[10px] transition-colors hover:bg-[var(--nav-hover)]"
        style={{
          height: 35,
          backgroundColor: active ? t.navActive : undefined,
        }}
        onClick={onClick}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.08 }}
      >
        <span style={{ color: t.textPrimary }} className="shrink-0">
          {icon}
        </span>
        <span
          style={{ color: t.textPrimary }}
          className="text-[14px] flex-1 text-left whitespace-nowrap overflow-hidden"
        >
          {label}
        </span>
        {rightSlot}
      </motion.button>
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────

export default function Layout() {
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [motionScale, setMotionScale] = useState(() => readMotionScale());
  const [streamDeckConnected, setStreamDeckConnected] = useState(false);
  const [deckDevices, setDeckDevices] = useState<StreamDeckDevice[]>([]);
  const [directSyncEnabled, setDirectSyncEnabled] = useState(() => readDirectSyncEnabled());
  const [selectedDeckSerial, setSelectedDeckSerial] = useState(() => readSelectedSerial());
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const { connections, projects, font, theme, sidebarOpen, setSidebarOpen } =
    useAppContext();
  const t = useTheme();
  const deviceStatuses = useDeviceStatuses();
  const { isFullscreen, toggleFullscreen } = useWindowFullscreen();
  const isProjectDashboardRoute = location.pathname.startsWith("/project/");
  const selectedDeckDevice =
    deckDevices.find((device) => device.serialNumber === selectedDeckSerial) ?? null;
  const deckSelectBorderColor = streamDeckConnected ? t.toggleColor : "#ef4444";

  const fontFamily =
    font === "mono" ? "'JetBrains Mono', monospace" : "'Inter', sans-serif";

  useEffect(() => subscribeMotionSpeedChange((scale) => setMotionScale(scale)), []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const lowerKey = event.key.toLowerCase();
      const hasCommand = event.metaKey || event.ctrlKey;
      if (hasCommand && lowerKey === "k" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        setSidebarOpen(true);
        navigate("/");
        return;
      }
      if (hasCommand && lowerKey === "n" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        navigate("/connections");
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("autocom:open-add-connection")), 0);
        return;
      }
      if (hasCommand && lowerKey === "f" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        navigate("/logs");
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("autocom:focus-log-search")), 0);
        return;
      }
      if (hasCommand && event.key === "Backspace" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        navigate("/logs");
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("autocom:clear-logs")), 0);
        return;
      }
      if (event.key === "F11" && !event.repeat) {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, setSidebarOpen, toggleFullscreen]);

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/" || location.pathname.startsWith("/project/")
      : location.pathname === path;
  const showActiveDevicesOnTopBar =
    location.pathname === "/connections" || isProjectDashboardRoute;
  const isButtonMappingRoute = location.pathname === "/button-mapping";
  const routeTransitionKey = `${location.pathname}${location.search}`;
  const motionDuration = (seconds: number) =>
    Number((seconds * motionScale).toFixed(3));

  useEffect(() => {
    if (!isButtonMappingRoute) {
      setStreamDeckConnected(false);
      return;
    }
    setStreamDeckConnected(deckDevices.length > 0);
  }, [deckDevices.length, isButtonMappingRoute]);

  useEffect(() => {
    if (!isButtonMappingRoute) return;
    let disposed = false;
    const loadDeckDevices = async () => {
      try {
        const devices = await listStreamDeckDevices();
        if (disposed) return;
        setDeckDevices(devices);
        setStreamDeckConnected(devices.length > 0);
        const hasSelectedSerial = devices.some((device) => device.serialNumber === selectedDeckSerial);
        if (devices.length > 0 && !hasSelectedSerial) {
          const next = devices[0].serialNumber ?? "";
          setSelectedDeckSerial(next);
          window.localStorage.setItem(STREAMDECK_SELECTED_SERIAL_KEY, next);
          window.dispatchEvent(new CustomEvent("autocom:streamdeck-controls-changed"));
        }
      } catch {
        if (disposed) return;
        setDeckDevices([]);
        setStreamDeckConnected(false);
      }
    };
    void loadDeckDevices();
    const pollId = window.setInterval(() => void loadDeckDevices(), 2000);
    const onFocus = () => void loadDeckDevices();
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      window.clearInterval(pollId);
      window.removeEventListener("focus", onFocus);
    };
  }, [isButtonMappingRoute, selectedDeckSerial]);

  // Expanded sidebar: Project item is special (has chevron + sub-list).
  // The remaining items use NavRow directly.
  const [projectItem, ...restNavItems] = ALL_NAV_ITEMS;

  const toggleDirectSync = () => {
    const next = !directSyncEnabled;
    setDirectSyncEnabled(next);
    window.localStorage.setItem(STREAMDECK_DIRECT_SYNC_KEY, next ? "1" : "0");
    window.dispatchEvent(new CustomEvent("autocom:streamdeck-controls-changed"));
  };

  const updateSelectedDeckSerial = (serial: string) => {
    setSelectedDeckSerial(serial);
    window.localStorage.setItem(STREAMDECK_SELECTED_SERIAL_KEY, serial);
    window.dispatchEvent(new CustomEvent("autocom:streamdeck-controls-changed"));
  };

  const executeMappedDashboardButton = useCallback(
    async (mappingId: string) => {
      if (!isTauri()) return;
      const split = mappingId.indexOf(":");
      if (split <= 0 || split >= mappingId.length - 1) return;
      const projectId = mappingId.slice(0, split).trim();
      const buttonId = mappingId.slice(split + 1).trim();
      if (!projectId || !buttonId) return;

      const layout = await loadDashboardLayout<Record<string, unknown>>(projectId);
      const mapped = layout.find((entry) => {
        const type = typeof entry?.type === "string" ? entry.type.toLowerCase() : "";
        const id = typeof entry?.id === "string" ? entry.id.trim() : "";
        return type === "button" && id === buttonId;
      });
      if (!mapped) return;

      const tasks = Array.isArray(mapped.tasks) ? mapped.tasks : [];
      const activeTasks = tasks.filter((task) => {
        if (!task || typeof task !== "object") return false;
        const enabled = (task as { enabled?: boolean }).enabled;
        return enabled !== false;
      });
      if (!activeTasks.length) return;

      const rows = compileDashboardRows(activeTasks as never[], connections);
      await tauriInvoke<DashboardApiResponse>("api_request", {
        method: "POST",
        path: "/api/execute",
        body: { rows },
      });
    },
    [connections],
  );

  const handleMappedStreamDeckAction = useCallback(
    async (mappingId: string | undefined) => {
      if (!mappingId || mappingId === SPECIAL_MAPPING_NONE) return;
      if (mappingId === SPECIAL_MAPPING_PAGE_NEXT || mappingId === SPECIAL_MAPPING_PAGE_PREVIOUS) {
        const mappings = readMappings();
        const maxPage = maxMappedPage(mappings);
        const currentPage = readActivePage();
        if (mappingId === SPECIAL_MAPPING_PAGE_NEXT) {
          writeActivePage(currentPage >= maxPage ? 1 : currentPage + 1);
        } else {
          writeActivePage(currentPage <= 1 ? maxPage : currentPage - 1);
        }
        return;
      }
      await executeMappedDashboardButton(mappingId);
    },
    [executeMappedDashboardButton],
  );

  useEffect(() => {
    if (!isTauri()) return;
    if (!directSyncEnabled) return;
    if (!selectedDeckSerial) return;
    let disposed = false;
    let inFlight = false;

    const tick = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      try {
        const events = await pollStreamDeckButtonEvents({ serialNumber: selectedDeckSerial });
        if (!events.length || disposed) return;
        const mappings = readMappings();
        const activePage = readActivePage();
        for (const event of events) {
          if (!event.pressed) continue;
          const key = `${activePage}/${event.row}/${event.col}`;
          await handleMappedStreamDeckAction(mappings[key]);
        }
      } catch {
        // Ignore polling errors when device is unplugged or unavailable.
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const pollId = window.setInterval(() => void tick(), 90);
    return () => {
      disposed = true;
      window.clearInterval(pollId);
    };
  }, [directSyncEnabled, handleMappedStreamDeckAction, selectedDeckSerial]);

  return (
    <div
      data-theme={theme}
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ fontFamily, backgroundColor: t.bgOuter }}
    >
      <WindowStrip isFullscreen={isFullscreen} onToggleFullscreen={() => { void toggleFullscreen(); }} />

      <div
        className="flex flex-1 overflow-hidden"
        style={{
          backgroundColor: t.bgSidebar,
          paddingTop: isFullscreen ? 0 : APP_INNER_GUTTER,
          paddingLeft: isFullscreen ? 0 : (sidebarOpen ? 0 : APP_INNER_GUTTER),
          paddingRight: isFullscreen ? 0 : APP_INNER_GUTTER,
          paddingBottom: isFullscreen ? 0 : APP_INNER_GUTTER,
        }}
      >
        <motion.div
          className="relative h-full shrink-0 overflow-hidden"
          style={{ backgroundColor: t.bgSidebar, willChange: "width" }}
          animate={{ width: sidebarOpen ? SIDEBAR_W : 0 }}
          transition={{ duration: motionDuration(0.18), ease: EASE }}
        >
          {/* ── Expanded sidebar ──────────────────────────────────────────── */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                key="expanded"
                className="absolute inset-0 flex flex-col overflow-y-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: motionDuration(0.12) }}
              >
                <div className="px-[26px]" style={{ paddingTop: 25, paddingBottom: 10 }}>
                  <span className="text-[14px] whitespace-nowrap" style={{ color: t.branding }}>
                    Dashboard
                  </span>
                </div>

                {/* Project item — special: has chevron + sub-list */}
                <NavRow
                  label={projectItem.label}
                  icon={projectItem.icon}
                  active={isActive(projectItem.path)}
                  onClick={() => navigate(projectItem.path)}
                  t={t}
                  rightSlot={projects.length > 0 ? (
                    <motion.span
                      className="shrink-0 -mr-[8px]"
                      style={{ color: t.textPrimary }}
                      animate={{ rotate: projectsExpanded ? 0 : 180 }}
                      transition={{ duration: motionDuration(0.14), ease: EASE }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectsExpanded((v) => !v);
                      }}
                    >
                      <ChevronUp size={16} />
                    </motion.span>
                  ) : undefined}
                />

                <AnimatePresence initial={false}>
                  {projectsExpanded && (
                    <motion.div
                      key="sub"
                      className="relative flex flex-col pl-[54px]"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: motionDuration(0.14), ease: EASE }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        className="absolute left-[44px] top-0 bottom-0 w-px"
                        style={{ backgroundColor: t.subLine }}
                      />
                      {projects.map((project) => {
                        const projectPath = `/project/${project.id}`;
                        const isActiveProject = location.pathname === projectPath;
                        return (
                          <div key={project.id} className="pr-[19px]">
                            <div
                              className="text-[12px] py-[5px] pl-[12px] pr-[8px] cursor-pointer whitespace-nowrap transition-colors"
                              style={{
                                color: isActiveProject ? t.textPrimary : t.textMuted,
                                backgroundColor: isActiveProject ? t.navActive : undefined,
                              }}
                              onClick={() => navigate(projectPath)}
                              onMouseEnter={(e) => {
                                if (!isActiveProject)
                                  e.currentTarget.style.color = t.textPrimary;
                              }}
                              onMouseLeave={(e) => {
                                if (!isActiveProject)
                                  e.currentTarget.style.color = t.textMuted;
                              }}
                            >
                              {project.name}
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Remaining nav items */}
                {restNavItems.map((item) => (
                  <NavRow
                    key={item.path}
                    label={item.label}
                    icon={item.icon}
                    active={isActive(item.path)}
                    onClick={() => navigate(item.path)}
                    t={t}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>

        {/* ── Main content area ──────────────────────────────────────────── */}
        <div
          className="flex flex-1 h-full overflow-hidden"
          style={{
            backgroundColor: t.bgSidebar,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
          }}
        >
          <div
            className="flex flex-col flex-1 overflow-hidden"
            style={{ backgroundColor: t.bgContent }}
          >
            <div
              className="relative shrink-0 flex items-center justify-between border-b"
              style={{
                height: TOPBAR_H,
                paddingLeft: 18,
                paddingRight: 20,
                borderColor: t.topbarBorder,
              }}
            >
              <motion.button
                className="transition-colors sidebar-toggle"
                style={{ color: t.textPrimary }}
                onClick={() => setSidebarOpen((v) => !v)}
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                whileTap={{ scale: 0.85, rotate: sidebarOpen ? -10 : 10 }}
                transition={{ duration: motionDuration(0.12) }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {sidebarOpen ? (
                    <motion.span
                      key="close"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: motionDuration(0.12) }}
                    >
                      <PanelLeftClose size={16} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="open"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: motionDuration(0.12) }}
                    >
                      <PanelLeftOpen size={16} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <div className="flex items-center gap-3">
                <AnimatePresence>
                  {showActiveDevicesOnTopBar && connections.some((connection) => connection.active) && (
                    <motion.div
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: motionDuration(0.14) }}
                    >
                      <DeviceStatusSummary
                        connections={connections}
                        statuses={deviceStatuses}
                        t={t}
                        label=""
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {isButtonMappingRoute && (
                    <motion.div
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: motionDuration(0.14) }}
                      className="flex items-center gap-4 text-[12px]"
                      style={{ color: t.textPrimary }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: t.textSecondary }}>Sync</span>
                        <button
                          className="h-[24px] border px-2"
                          style={{
                            borderColor: directSyncEnabled ? "#8b5cf6" : t.topbarBorder,
                            backgroundColor: directSyncEnabled ? t.navActive : t.bgSidebar,
                            color: directSyncEnabled ? t.textPrimary : t.textSecondary,
                          }}
                          onClick={toggleDirectSync}
                        >
                          {directSyncEnabled ? "On" : "Off"}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span style={{ color: t.textSecondary }}>Device</span>
                        <select
                          className="h-[24px] border px-1 outline-none max-w-[220px]"
                          style={{ backgroundColor: t.bgSidebar, borderColor: deckSelectBorderColor, color: t.textPrimary }}
                          value={selectedDeckSerial}
                          onChange={(event) => updateSelectedDeckSerial(event.target.value)}
                        >
                          {deckDevices.length === 0 ? (
                            <option value="">No deck</option>
                          ) : (
                            deckDevices.map((device) => (
                              <option key={`${device.serialNumber}-${device.productName}`} value={device.serialNumber}>
                                {device.productName}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      {selectedDeckDevice ? (
                        <span style={{ color: t.textSecondary }}>{selectedDeckDevice.rows}x{selectedDeckDevice.cols}</span>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                id="layout-topbar-center-slot"
              />
            </div>

            <div className="route-transition-shell flex flex-col flex-1 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={routeTransitionKey}
                  className="route-transition-page flex flex-col flex-1 overflow-hidden"
                  initial={{ opacity: 0, y: 8, scale: 0.995 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.995 }}
                  transition={{ duration: motionDuration(0.16), ease: EASE }}
                >
                  {outlet}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
