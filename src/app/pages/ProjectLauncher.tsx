import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { FilePlus2, FolderOpen } from "lucide-react";
import { useAppContext, useTheme } from "../context/AppContext";
import { newProjectFile, openProjectFile, projectDisplayName } from "../services/projectFile";

export default function ProjectLauncher() {
  const { activeProjectPath, recentProjectPaths, setActiveProjectPath, runtimeLoaded } = useAppContext();
  const navigate = useNavigate();
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeProjectPath) {
      navigate(`/project/${encodeURIComponent(activeProjectPath)}`, { replace: true });
    }
  }, [activeProjectPath, navigate]);

  if (!runtimeLoaded || activeProjectPath) {
    return null;
  }

  const openProject = (path: string) => {
    setActiveProjectPath(path);
    navigate(`/project/${encodeURIComponent(path)}`);
  };

  const handleNewProject = async () => {
    setBusy(true);
    setError(null);
    try {
      const path = await newProjectFile();
      if (path) openProject(path);
    } catch (err) {
      console.error("Failed to create new project:", err);
      setError("Couldn't create the new project.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenProject = async () => {
    setBusy(true);
    setError(null);
    try {
      const path = await openProjectFile();
      if (path) openProject(path);
    } catch (err) {
      console.error("Failed to open project:", err);
      setError("Couldn't open that project.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center page-pop" style={{ backgroundColor: t.bgContent }}>
      <FolderOpen size={40} style={{ color: t.textMuted, marginBottom: 20, opacity: 0.5 }} />
      <span className="text-[15px] mb-[8px]" style={{ color: t.textPrimary }}>No project open</span>
      <span className="text-[13px] mb-[24px]" style={{ color: t.textMuted }}>
        Create a new project file or open an existing one from disk.
      </span>

      <div className="flex items-center gap-[10px]">
        <button
          className="flex items-center gap-[6px] h-[35px] px-[14px] text-[13px] border transition-colors disabled:opacity-50"
          style={{ color: t.textPrimary, borderColor: t.inputBorder, backgroundColor: t.rowBg }}
          disabled={busy}
          onClick={() => { void handleNewProject(); }}
        >
          <FilePlus2 size={14} />
          New Project
        </button>
        <button
          className="flex items-center gap-[6px] h-[35px] px-[14px] text-[13px] border transition-colors disabled:opacity-50"
          style={{ color: t.textPrimary, borderColor: t.inputBorder, backgroundColor: t.rowBg }}
          disabled={busy}
          onClick={() => { void handleOpenProject(); }}
        >
          <FolderOpen size={14} />
          Open Project…
        </button>
      </div>

      {error ? (
        <span className="text-[12px] mt-[16px]" style={{ color: "#f87171" }}>{error}</span>
      ) : null}

      {recentProjectPaths.length > 0 && (
        <div className="mt-[32px] w-[420px]">
          <div className="text-[12px] mb-[8px]" style={{ color: t.projectsHeading }}>Recent</div>
          <div style={{ backgroundColor: t.rowBg, border: `1px solid ${t.divider}` }}>
            {recentProjectPaths.map((path) => (
              <button
                key={path}
                className="flex items-center w-full h-[35px] px-[12px] text-[13px] text-left transition-colors hover:bg-[var(--row-hover)] border-b truncate"
                style={{ color: t.textPrimary, borderColor: t.divider }}
                title={path}
                onClick={() => openProject(path)}
              >
                {projectDisplayName(path)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
