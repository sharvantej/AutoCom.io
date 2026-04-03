import { useEffect, useState } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Bolt,
  ChevronUp,
  ChevronsLeftRightEllipsis,
  FolderKanban,
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

const TOPBAR_H = 70;
const SIDEBAR_W = 280;
const APP_INNER_GUTTER = 8;
const APP_INNER_FRAME_COLOR = "#101828";
const EASE = [0.4, 0, 0.2, 1] as const;

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
        className="relative flex items-center w-full gap-[9px] px-[10px] transition-colors hover:bg-[var(--nav-hover)]"
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
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const { connections, projects, font, theme, sidebarOpen, setSidebarOpen } =
    useAppContext();
  const t = useTheme();
  const deviceStatuses = useDeviceStatuses();
  const { isFullscreen, toggleFullscreen } = useWindowFullscreen();

  const fontFamily =
    font === "mono" ? "'JetBrains Mono', monospace" : "'Inter', sans-serif";

  useEffect(() => subscribeMotionSpeedChange((scale) => setMotionScale(scale)), []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F11" && !event.repeat) {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleFullscreen]);

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/" || location.pathname.startsWith("/project/")
      : location.pathname === path;
  const showActiveDevicesOnTopBar =
    location.pathname === "/connections" || location.pathname.startsWith("/project/");
  const motionDuration = (seconds: number) =>
    Number((seconds * motionScale).toFixed(3));

  // Expanded sidebar: Project item is special (has chevron + sub-list).
  // The remaining items use NavRow directly.
  const [projectItem, ...restNavItems] = ALL_NAV_ITEMS;

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
          backgroundColor: APP_INNER_FRAME_COLOR,
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
                  rightSlot={
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
                  }
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
                className="transition-colors"
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

              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                id="layout-topbar-center-slot"
              />
            </div>

            <div className="flex flex-col flex-1 overflow-hidden">
              {outlet}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

