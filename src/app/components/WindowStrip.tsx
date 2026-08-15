import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Maximize, Minus, Square, X } from "lucide-react";
import { getCurrentWindow, type Window as TauriWindow } from "@tauri-apps/api/window";
import { useAppContext, useTheme, type AppTheme } from "../context/AppContext";
import { isTauri, tauriInvoke } from "../services/tauri";
import { DASHBOARD_LABEL, NAV_ITEMS } from "../navItems";
import FileMenu from "./FileMenu";

const TITLE_STRIP_H = 35;
const CONTROL_W = 40;
const LOGO_BOX = 35;
const LOGO_SIZE = 14;
const CONTROL_HOVER = "rgba(255,255,255,0.08)";
const CLOSE_HOVER = "#e81123";

// ── Nav tabs ─────────────────────────────────────────────────────────────────
// Rendered right in the title-bar row (Windows-11-style — File Explorer/
// Terminal/Notepad all put their tab strip in the title bar itself, not a
// separate row below it). Tabs are plain text — no icons, no underline; the
// active page is identified by its heading in that page's own top bar
// instead (see Layout.tsx), so all tabs share identical typography here.

function NavTab({
  label,
  active,
  onClick,
  t,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  t: AppTheme;
}) {
  return (
    <motion.button
      className="nav-tab relative flex items-center h-full px-[14px] transition-colors shrink-0"
      style={{
        backgroundColor: active ? t.navActive : undefined,
        color: active ? t.textPrimary : t.textMuted,
      }}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.08 }}
    >
      <span className="text-[12px] whitespace-nowrap">{label}</span>
    </motion.button>
  );
}

// Helper for window actions (Minimize/Maximize/Close)
async function winAction(action: (win: TauriWindow) => Promise<void>) {
  try {
    const win = getCurrentWindow();
    await action(win);
  } catch (e) { console.error(e); }
}

type WindowStripProps = {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

export default function WindowStrip({ isFullscreen, onToggleFullscreen }: WindowStripProps) {
  const t = useTheme();
  const [logoIndex, setLogoIndex] = useState(0);
  const logoSources = ["/autocom-title.png", "/autocom-title.ico"] as const;
  const navigate = useNavigate();
  const location = useLocation();
  const { activeProjectPath } = useAppContext();

  const isProjectDashboardRoute = location.pathname.startsWith("/project/");
  const isDashboardActive = location.pathname === "/" || isProjectDashboardRoute;
  const dashboardPath = activeProjectPath !== null
    ? `/project/${encodeURIComponent(activeProjectPath)}`
    : "/";
  const isActive = (path: string) => location.pathname === path;

  const handleMinimize = async () => {
    try {
      const win = getCurrentWindow();
      if (!isTauri()) {
        await win.minimize();
        return;
      }
      const closeToTray = await tauriInvoke<boolean>("get_close_to_tray");
      if (closeToTray) {
        await win.hide();
        return;
      }
      await win.minimize();
    } catch (e) {
      console.error(e);
    }
  };

  const baseControlStyle = {
    width: CONTROL_W,
    borderLeft: `1px solid ${t.topbarBorder}`,
    outline: "none",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
  } as const;

  return (
    <div
      className={`shrink-0 flex items-center justify-between select-none overflow-hidden ${isFullscreen ? "hidden" : "border-b"}`}
      style={{
        height: TITLE_STRIP_H,
        backgroundColor: t.bgSidebar,
        borderColor: t.topbarBorder,
        pointerEvents: "auto",
      }}
    >
      <div className="h-full flex-1 min-w-0 flex items-center">
        <div
          className="h-full flex items-center justify-center shrink-0 pl-[6px]"
          style={{ width: LOGO_BOX }}
          data-tauri-drag-region
        >
          {logoIndex < logoSources.length && (
            <img
              src={logoSources[logoIndex]}
              alt="Logo"
              className="object-contain"
              style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
              onError={() => setLogoIndex(v => v + 1)}
            />
          )}
        </div>

        {/* Menu bar + nav tabs — deliberately outside the drag-region
            siblings so buttons/dropdowns/tabs stay clickable instead of
            being swallowed by window-drag handling. */}
        <div className="h-full flex items-center shrink-0">
          <FileMenu />
        </div>
        <div className="h-full flex items-stretch overflow-x-auto shrink min-w-0">
          <NavTab
            label={DASHBOARD_LABEL}
            active={isDashboardActive}
            onClick={() => navigate(dashboardPath)}
            t={t}
          />
          {NAV_ITEMS.map((item) => (
            <NavTab
              key={item.path}
              label={item.label}
              active={isActive(item.path)}
              onClick={() => navigate(item.path)}
              t={t}
            />
          ))}
        </div>

        <div className="h-full flex-1 min-w-0" data-tauri-drag-region />
      </div>

      <div className="h-full flex items-stretch border-l" style={{ borderColor: t.topbarBorder }}>
        <button
          type="button"
          className="h-full flex items-center justify-center transition-colors"
          style={baseControlStyle}
          onMouseDown={e => { e.preventDefault(); }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = CONTROL_HOVER; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
          onClick={onToggleFullscreen}
          title="Fullscreen"
        >
          <Maximize size={12} color={t.textPrimary} />
        </button>
        <button
          type="button"
          className="h-full flex items-center justify-center transition-colors"
          style={baseControlStyle}
          onMouseDown={e => { e.preventDefault(); }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = CONTROL_HOVER; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
          onClick={handleMinimize}
          title="Minimize"
        >
          <Minus size={12} color={t.textPrimary} />
        </button>
        <button
          type="button"
          className="h-full flex items-center justify-center transition-colors"
          style={baseControlStyle}
          onMouseDown={e => { e.preventDefault(); }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = CONTROL_HOVER; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
          onClick={() => winAction(w => w.toggleMaximize())}
          title="Maximize"
        >
          <Square size={11} color={t.textPrimary} />
        </button>
        <button
          type="button"
          className="h-full flex items-center justify-center transition-colors"
          style={baseControlStyle}
          onMouseDown={e => { e.preventDefault(); }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = CLOSE_HOVER; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
          onClick={() => winAction(w => w.close())}
          title="Close"
        >
          <X size={12} color={t.textPrimary} />
        </button>
      </div>
    </div>
  );
}
