import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Star } from "lucide-react";
import { useAppContext, useTheme } from "./context/AppContext";
import { DeviceStatusSummary } from "./components/DeviceStatusSummary";
import WindowStrip from "./components/WindowStrip";
import { useDeviceStatuses } from "./hooks/useDeviceStatuses";
import { useWindowFullscreen } from "./hooks/useWindowFullscreen";
import { readMotionScale, subscribeMotionSpeedChange } from "./services/motion";
import { loadConnectionsForProject, loadDashboardLayout } from "./services/runtimeState";
import { compileDashboardRows } from "./services/dashboardTasks";
import { projectDisplayName } from "./services/projectFile";
import { subscribeDashboardUnsavedChanges } from "./services/dashboardSaveState";
import { pollStreamDeckButtonEvents, subscribeStreamDeckDevices, type StreamDeckDevice } from "./services/streamdeck";
import { isTauri, tauriInvoke } from "./services/tauri";
import { DASHBOARD_LABEL, NAV_ITEMS } from "./navItems";
import { matchesShortcut } from "./services/shortcuts";

const TOPBAR_H = 70;
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

// ── Layout ─────────────────────────────────────────────────────────────────────

export default function Layout() {
  const [motionScale, setMotionScale] = useState(() => readMotionScale());
  const [streamDeckConnected, setStreamDeckConnected] = useState(false);
  const [deckDevices, setDeckDevices] = useState<StreamDeckDevice[]>([]);
  const [directSyncEnabled, setDirectSyncEnabled] = useState(() => readDirectSyncEnabled());
  const [selectedDeckSerial, setSelectedDeckSerial] = useState(() => readSelectedSerial());
  const [dashboardHasUnsavedChanges, setDashboardHasUnsavedChanges] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const { connections, font, theme, activeProjectPath } = useAppContext();
  const t = useTheme();
  const deviceStatuses = useDeviceStatuses();
  const { isFullscreen, toggleFullscreen } = useWindowFullscreen();
  const isProjectDashboardRoute = location.pathname.startsWith("/project/");
  const isDashboardRoute = location.pathname === "/" || isProjectDashboardRoute;
  const pageHeading = isDashboardRoute
    ? (activeProjectPath ? projectDisplayName(activeProjectPath) : DASHBOARD_LABEL)
    : (NAV_ITEMS.find((item) => item.path === location.pathname)?.label ?? "");
  const selectedDeckDevice =
    deckDevices.find((device) => device.serialNumber === selectedDeckSerial) ?? null;
  const deckSelectBorderColor = streamDeckConnected ? t.toggleColor : "#ef4444";

  const fontFamily =
    font === "mono" ? "'JetBrains Mono', monospace" : "'Inter', sans-serif";

  useEffect(() => subscribeMotionSpeedChange((scale) => setMotionScale(scale)), []);
  useEffect(() => subscribeDashboardUnsavedChanges(setDashboardHasUnsavedChanges), []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesShortcut("global.openProject", event)) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("autocom:open-project-picker"));
        return;
      }
      if (matchesShortcut("global.newConnection", event)) {
        event.preventDefault();
        navigate("/connections");
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("autocom:open-add-connection")), 0);
        return;
      }
      if (matchesShortcut("global.searchLogs", event)) {
        event.preventDefault();
        navigate("/logs");
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("autocom:focus-log-search")), 0);
        return;
      }
      // Save/Save-As share one shortcut id — Shift is forwarded as data
      // (which variant to run) rather than treated as a different binding.
      if (matchesShortcut("dashboard.save", event, { ignoreShift: true })) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent("autocom:save-request", { detail: { shiftKey: event.shiftKey } }),
        );
        return;
      }
      if (matchesShortcut("global.clearLogs", event)) {
        event.preventDefault();
        navigate("/logs");
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("autocom:clear-logs")), 0);
        return;
      }
      if (matchesShortcut("global.toggleFullscreen", event) && !event.repeat) {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, toggleFullscreen]);

  const showActiveDevicesOnTopBar =
    location.pathname === "/connections" || isProjectDashboardRoute;
  const isButtonMappingRoute = location.pathname === "/button-mapping";
  const routeTransitionKey = `${location.pathname}${location.search}`;
  const motionDuration = (seconds: number) =>
    Number((seconds * motionScale).toFixed(3));

  useEffect(() => {
    if (!isButtonMappingRoute) {
      setStreamDeckConnected(false);
      setDeckDevices([]);
      return;
    }
    return subscribeStreamDeckDevices((devices) => {
      setDeckDevices(devices);
      setStreamDeckConnected(devices.length > 0);
      setSelectedDeckSerial((current) => {
        const hasSelectedSerial = devices.some((device) => device.serialNumber === current);
        if (devices.length > 0 && !hasSelectedSerial) {
          const next = devices[0].serialNumber ?? "";
          window.localStorage.setItem(STREAMDECK_SELECTED_SERIAL_KEY, next);
          window.dispatchEvent(new CustomEvent("autocom:streamdeck-controls-changed"));
          return next;
        }
        return current;
      });
    });
  }, [isButtonMappingRoute]);

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
      // Mapping ids are JSON-encoded [projectPath, buttonId] pairs (not a
      // `:`-delimited string — a real Windows path contains `:` itself).
      let projectPath: string;
      let buttonId: string;
      try {
        const parsed: unknown = JSON.parse(mappingId);
        if (!Array.isArray(parsed) || parsed.length !== 2) return;
        [projectPath, buttonId] = parsed as [string, string];
      } catch {
        return;
      }
      if (!projectPath || !buttonId) return;

      // Resolve against the mapped project specifically, not whichever
      // project happens to be open right now — a Stream Deck key should
      // fire the button it was mapped to regardless of what's on screen.
      const [layout, mappedConnections] = await Promise.all([
        loadDashboardLayout<Record<string, unknown>>(projectPath),
        loadConnectionsForProject(projectPath),
      ]);
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

      const rows = compileDashboardRows(activeTasks as never[], mappedConnections);
      await tauriInvoke<DashboardApiResponse>("api_request", {
        method: "POST",
        path: "/api/execute",
        body: { rows },
      });
    },
    [],
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
          paddingLeft: isFullscreen ? 0 : APP_INNER_GUTTER,
          paddingRight: isFullscreen ? 0 : APP_INNER_GUTTER,
          paddingBottom: isFullscreen ? 0 : APP_INNER_GUTTER,
        }}
      >
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
              <div className="flex items-center gap-2">
                {pageHeading && (
                  <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: t.textPrimary }}>
                    {pageHeading}
                  </span>
                )}
                {isDashboardRoute && activeProjectPath && dashboardHasUnsavedChanges && (
                  <span className="flex items-center" title="Unsaved changes — press Ctrl+S to save">
                    <Star size={11} fill="#8b5cf6" color="#8b5cf6" />
                  </span>
                )}
                <div className="flex items-center" id="layout-topbar-left-slot" />
              </div>

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
                <div className="flex items-center" id="layout-topbar-right-slot" />
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
