import { useState } from "react";
import { Maximize, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTheme } from "../context/AppContext";

const TITLE_STRIP_H = 35;
const CONTROL_W = 40;
const LOGO_BOX = 35;
const LOGO_SIZE = 14;
const CONTROL_HOVER = "rgba(255,255,255,0.08)";
const CLOSE_HOVER = "#e81123";

// Helper for window actions (Minimize/Maximize/Close)
async function winAction(action: (win: any) => Promise<void>) {
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
      <div className="h-full flex-1 min-w-0 flex items-center px-[6px]" data-tauri-drag-region>
        <div
          className="h-full flex items-center justify-center shrink-0"
          style={{ width: LOGO_BOX }}
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
        <span
          className="text-[13px] font-semibold tracking-wide pl-2 truncate"
          style={{
            color: t.textPrimary,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Autocom
        </span>
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
          onClick={() => winAction(w => w.minimize())}
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
