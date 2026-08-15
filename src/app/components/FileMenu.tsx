import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ChevronRight,
  Download,
  FilePlus2,
  FolderOpen,
  History,
  LogOut,
  Save,
} from "lucide-react";
import { useAppContext, useTheme } from "../context/AppContext";
import { newProjectFile, openProjectFile, projectDisplayName, saveProjectAs } from "../services/projectFile";

type ActionNoticeTone = "success" | "error" | "info";
type ActionNotice = { tone: ActionNoticeTone; text: string };

export default function FileMenu() {
  const { activeProjectPath, setActiveProjectPath, recentProjectPaths } = useAppContext();
  const t = useTheme();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentPos, setRecentPos] = useState<{ left: number; top: number } | null>(null);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const recentTriggerRef = useRef<HTMLDivElement>(null);
  const recentCloseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setRecentOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (recentCloseTimeoutRef.current !== null) window.clearTimeout(recentCloseTimeoutRef.current);
    };
  }, []);

  const openRecentFlyout = () => {
    if (recentCloseTimeoutRef.current !== null) {
      window.clearTimeout(recentCloseTimeoutRef.current);
      recentCloseTimeoutRef.current = null;
    }
    if (recentProjectPaths.length === 0) return;
    if (recentTriggerRef.current) {
      const rect = recentTriggerRef.current.getBoundingClientRect();
      const flyoutWidth = 240;
      const overflowsRight = rect.right + flyoutWidth > window.innerWidth;
      setRecentPos({
        left: overflowsRight ? rect.left - flyoutWidth : rect.right,
        top: rect.top,
      });
    }
    setRecentOpen(true);
  };

  const scheduleCloseRecentFlyout = () => {
    recentCloseTimeoutRef.current = window.setTimeout(() => setRecentOpen(false), 150);
  };

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(null), 3400);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const openProject = (path: string) => {
    setActiveProjectPath(path);
    navigate(`/project/${encodeURIComponent(path)}`);
    setOpen(false);
    setRecentOpen(false);
  };

  const toggleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ left: rect.left, top: rect.bottom });
    }
    setOpen((v) => !v);
    setRecentOpen(false);
  };

  const handleNewProject = async () => {
    setOpen(false);
    try {
      const path = await newProjectFile();
      if (path) openProject(path);
    } catch (error) {
      console.error("Failed to create new project:", error);
      setNotice({ tone: "error", text: "Couldn't create the new project." });
    }
  };

  const handleOpenProject = async () => {
    setOpen(false);
    try {
      const path = await openProjectFile();
      if (path) openProject(path);
    } catch (error) {
      console.error("Failed to open project:", error);
      setNotice({ tone: "error", text: "Couldn't open that project." });
    }
  };

  useEffect(() => {
    const handler = () => { void handleOpenProject(); };
    window.addEventListener("autocom:open-project-picker", handler);
    return () => window.removeEventListener("autocom:open-project-picker", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    window.dispatchEvent(new CustomEvent("autocom:save-request", { detail: {} }));
    setOpen(false);
  };

  const handleSaveAs = async () => {
    setOpen(false);
    if (!activeProjectPath) {
      setNotice({ tone: "info", text: "No open project to save." });
      return;
    }
    window.dispatchEvent(new CustomEvent("autocom:save-request", { detail: {} }));
    try {
      const path = await saveProjectAs();
      if (path) {
        setNotice({ tone: "success", text: `Saved as "${projectDisplayName(path)}".` });
        openProject(path);
      }
    } catch (error) {
      console.error("Failed to save project as:", error);
      setNotice({ tone: "error", text: "Couldn't save a copy of the project." });
    }
  };

  const handleCloseProject = () => {
    setActiveProjectPath(null);
    navigate("/");
    setOpen(false);
  };

  return (
    <div className="relative h-full" ref={menuRef}>
      <button
        ref={buttonRef}
        className="h-full flex items-center px-[14px] text-[12px] transition-colors"
        style={{ color: open ? t.textPrimary : t.textMuted, backgroundColor: open ? t.navActive : "transparent" }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.backgroundColor = t.rowBg; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.backgroundColor = "transparent"; }}
        onClick={toggleOpen}
      >
        File
      </button>

      {open && menuPos && (
        <div
          className="fixed z-50 w-[240px] border shadow-xl card-pop"
          style={{ left: menuPos.left, top: menuPos.top, backgroundColor: t.ctxBg, borderColor: t.ctxBorder }}
        >
          <MenuItem t={t} icon={<FilePlus2 size={14} />} label="New Project" onClick={() => { void handleNewProject(); }} />
          <MenuItem t={t} icon={<FolderOpen size={14} />} label="Open Project…" onClick={() => { void handleOpenProject(); }} />
          <div
            ref={recentTriggerRef}
            onMouseEnter={openRecentFlyout}
            onMouseLeave={scheduleCloseRecentFlyout}
          >
            <button
              className="flex items-center justify-between gap-3 w-full px-4 py-[8px] text-[13px] transition-colors disabled:opacity-40 hover:bg-[var(--ctx-hover)]"
              style={{ color: t.textPrimary }}
              onClick={() => (recentOpen ? setRecentOpen(false) : openRecentFlyout())}
              disabled={recentProjectPaths.length === 0}
            >
              <span className="flex items-center gap-3"><History size={14} />Open Recent</span>
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="h-px" style={{ backgroundColor: t.ctxBorder }} />
          <MenuItem t={t} icon={<Save size={14} />} label="Save" onClick={handleSave} disabled={!activeProjectPath} />
          <MenuItem t={t} icon={<Download size={14} />} label="Save As…" onClick={() => { void handleSaveAs(); }} disabled={!activeProjectPath} />
          <div className="h-px" style={{ backgroundColor: t.ctxBorder }} />
          <MenuItem t={t} icon={<LogOut size={14} />} label="Close Project" onClick={handleCloseProject} disabled={!activeProjectPath} />
        </div>
      )}

      {open && recentOpen && recentPos && recentProjectPaths.length > 0 && (
        <div
          className="fixed z-50 w-[240px] border shadow-xl card-pop"
          style={{ left: recentPos.left, top: recentPos.top, backgroundColor: t.ctxBg, borderColor: t.ctxBorder }}
          onMouseEnter={openRecentFlyout}
          onMouseLeave={scheduleCloseRecentFlyout}
        >
          {recentProjectPaths.map((path) => (
            <button
              key={path}
              className="flex items-center w-full px-4 py-[8px] text-[13px] transition-colors hover:bg-[var(--ctx-hover)] truncate"
              style={{ color: t.textPrimary }}
              title={path}
              onClick={() => openProject(path)}
            >
              {projectDisplayName(path)}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <div
          className="fixed z-50 text-[12px] px-[8px] py-[6px] border"
          style={{
            top: 43,
            right: 20,
            color: notice.tone === "error" ? "#f87171" : notice.tone === "info" ? t.textMuted : "#86efac",
            borderColor: t.inputBorder,
            backgroundColor: t.inputBg,
          }}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, disabled, t }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <button
      className="flex items-center gap-3 w-full px-4 py-[8px] text-[13px] transition-colors disabled:opacity-40 hover:bg-[var(--ctx-hover)]"
      style={{ color: t.textPrimary }}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}<span>{label}</span>
    </button>
  );
}
