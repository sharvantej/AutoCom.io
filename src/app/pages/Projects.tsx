import { useAppContext, useTheme, type Project, type Connection, type AppTheme } from "../context/AppContext";
import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import {
  SquareArrowOutUpRight,
  Ellipsis,
  Pencil, CopyPlus, Download, Trash2, X, Plus,
} from "lucide-react";
import { createNumericId } from "../services/ids";
import { isTauri } from "../services/tauri";
import { loadDashboardLayout, saveDashboardLayout, saveProjects } from "../services/runtimeState";

type ContextMenu = { projectId: number; x: number; y: number } | null;
type Modal = "new" | "edit" | null;
const DASHBOARD_STORAGE_PREFIX = "autocom.project.dashboard";

type ProjectExportBundle = {
  format: "autocom-project-export";
  version: 1;
  exportedAt: string;
  project: Project;
  connections: Connection[];
  layout: unknown[];
};

type ProjectImportBundle = {
  projectName: string;
  connections: Connection[];
  layout: unknown[];
};

type ActionNoticeTone = "success" | "error" | "info";
type ActionNotice = {
  tone: ActionNoticeTone;
  text: string;
};

function collectGlobalConnections(connections: Connection[]) {
  return connections.map((connection) => ({ ...connection }));
}

function sanitizeFileName(value: string): string {
  const safe = value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return safe || "project";
}

function buildExportFileName(projectName: string): string {
  return `${sanitizeFileName(projectName)}.autocom-project.json`;
}

function readStoredDashboardLayout(projectId: number): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${DASHBOARD_STORAGE_PREFIX}.${projectId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredDashboardLayout(projectId: number, items: unknown[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${DASHBOARD_STORAGE_PREFIX}.${projectId}`, JSON.stringify(items));
  } catch {
    // Ignore storage write failures.
  }
}

async function loadProjectLayout(projectId: number): Promise<unknown[]> {
  if (isTauri()) {
    try {
      return await loadDashboardLayout<unknown>(String(projectId));
    } catch {
      return [];
    }
  }
  return readStoredDashboardLayout(projectId);
}

async function persistImportedLayout(projectId: number, layout: unknown[]): Promise<void> {
  if (isTauri()) {
    await saveDashboardLayout<unknown>(String(projectId), layout);
    return;
  }
  writeStoredDashboardLayout(projectId, layout);
}

function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return fallback;
}

function normalizeImportedConnections(
  imported: unknown,
  existingConnections: Connection[],
): Connection[] {
  if (!Array.isArray(imported)) return [];
  const usedIds = new Set(existingConnections.map((connection) => connection.id));
  const nextConnections: Connection[] = [];

  for (const entry of imported) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const source = entry as Partial<Connection>;
    let nextId =
      typeof source.id === "number" && Number.isFinite(source.id)
        ? Math.trunc(source.id)
        : 1;
    if (nextId < 1) nextId = 1;
    while (usedIds.has(nextId)) nextId += 1;
    usedIds.add(nextId);

    nextConnections.push({
      ...(source as Connection),
      id: nextId,
      name: toNonEmptyString(source.name, `Connection ${nextConnections.length + 1}`),
      ip: toNonEmptyString(source.ip, "127.0.0.1"),
      port: toNonEmptyString(source.port, ""),
      protocol: toNonEmptyString(source.protocol, "OSC"),
      device: toNonEmptyString(source.device, "Generic"),
      path: typeof source.path === "string" ? source.path : "",
      active: typeof source.active === "boolean" ? source.active : true,
    });
  }

  return nextConnections;
}

function parseImportBundle(raw: unknown, sourceFileName?: string): ProjectImportBundle | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;

  const exportedProject =
    data.project && typeof data.project === "object" && !Array.isArray(data.project)
      ? (data.project as Record<string, unknown>)
      : null;

  const fromFileName = (() => {
    const rawName = typeof sourceFileName === "string" ? sourceFileName.trim() : "";
    if (!rawName) return "";
    return rawName
      .replace(/\.autocom-project\.json$/i, "")
      .replace(/\.json$/i, "")
      .trim();
  })();
  const projectName = exportedProject
    ? toNonEmptyString(
      exportedProject.name,
      toNonEmptyString(data.projectName, toNonEmptyString(data.name, toNonEmptyString(fromFileName, "Imported Project"))),
    )
    : toNonEmptyString(data.projectName, toNonEmptyString(data.name, toNonEmptyString(fromFileName, "Imported Project")));

  const layout = Array.isArray(data.layout)
    ? data.layout
    : Array.isArray(data.items)
      ? data.items
      : [];

  const connectionsRaw = Array.isArray(data.connections) ? data.connections : [];

  return {
    projectName,
    connections: normalizeImportedConnections(connectionsRaw, []),
    layout,
  };
}

function buildUniqueProjectName(existingProjects: Project[], baseName: string): string {
  const trimmed = baseName.trim() || "Imported Project";
  if (!existingProjects.some((project) => project.name === trimmed)) return trimmed;
  let suffix = 2;
  let candidate = `${trimmed} (${suffix})`;
  while (existingProjects.some((project) => project.name === candidate)) {
    suffix += 1;
    candidate = `${trimmed} (${suffix})`;
  }
  return candidate;
}

async function saveJsonFile(fileName: string, data: unknown): Promise<"saved" | "downloaded" | "cancelled"> {
  if (typeof window === "undefined" || typeof document === "undefined") return "cancelled";
  const payload = JSON.stringify(data, null, 2);
  const savePicker = (
    window as unknown as { showSaveFilePicker?: (options?: unknown) => Promise<any> }
  ).showSaveFilePicker;

  if (savePicker) {
    try {
      const handle = await savePicker({
        suggestedName: fileName,
        types: [
          {
            description: "AutoCom Project Export",
            accept: { "application/json": [".json", ".autocom-project.json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(payload);
      await writable.close();
      return "saved";
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && (error as { name?: string }).name === "AbortError") {
        return "cancelled";
      }
    }
  }

  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return "downloaded";
}

export default function Projects() {
  const { projects, connections, setProjects, setConnections } = useAppContext();
  const t = useTheme();
  const navigate = useNavigate();

  const [contextMenu,      setContextMenu]      = useState<ContextMenu>(null);
  const [modal,            setModal]            = useState<Modal>(null);
  const [editingProject,   setEditingProject]   = useState<Project | null>(null);
  const [newProjectName,   setNewProjectName]   = useState("");
  const [actionNotice,     setActionNotice]     = useState<ActionNotice | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node))
        setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!actionNotice) return;
    const timeoutId = window.setTimeout(() => setActionNotice(null), 3400);
    return () => window.clearTimeout(timeoutId);
  }, [actionNotice]);

  const openContextMenu = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    if (contextMenu?.projectId === projectId) { setContextMenu(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ projectId, x: rect.left, y: rect.bottom + 4 });
  };

  const handleEdit   = (p: Project) => { setEditingProject({ ...p }); setModal("edit"); setContextMenu(null); };
  const handleDelete = (id: number)  => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setContextMenu(null);
  };

  const handleClone  = (p: Project)  => {
    setProjects(prev => [...prev, { id: createNumericId(prev), name: `${p.name} (Copy)` }]);
    setContextMenu(null);
  };
  const handleExport = async (project: Project) => {
    setContextMenu(null);
    try {
      const layout = await loadProjectLayout(project.id);
      const projectConnections = collectGlobalConnections(connections);
      const exportPayload: ProjectExportBundle = {
        format: "autocom-project-export",
        version: 1,
        exportedAt: new Date().toISOString(),
        project: { ...project },
        connections: projectConnections,
        layout,
      };
      const saveResult = await saveJsonFile(buildExportFileName(project.name), exportPayload);
      if (saveResult === "cancelled") {
        setActionNotice({ tone: "info", text: "Export canceled." });
      } else if (saveResult === "saved") {
        setActionNotice({ tone: "success", text: `Exported "${project.name}".` });
      } else {
        setActionNotice({ tone: "success", text: `Export downloaded for "${project.name}".` });
      }
    } catch (error) {
      console.error("Failed to export project:", error);
      setActionNotice({ tone: "error", text: "Project export failed. Please try again." });
    }
  };
  const handleImportFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as unknown;
      const imported = parseImportBundle(parsed, file.name);
      if (!imported) {
        setActionNotice({ tone: "error", text: "Invalid project file format." });
        return;
      }

      const nextProjectId = createNumericId(projects);
      const nextProjectName = buildUniqueProjectName(projects, imported.projectName);
      const nextProject: Project = { id: nextProjectId, name: nextProjectName };
      const nextProjects = [...projects, nextProject];

      setProjects(nextProjects);
      setConnections((prev) => [
        ...prev,
        ...normalizeImportedConnections(imported.connections, prev),
      ]);
      if (isTauri()) {
        // Ensure project metadata exists before writing imported layout,
        // so the XML file keeps the chosen project name.
        await saveProjects(nextProjects);
      }
      await persistImportedLayout(nextProjectId, imported.layout);
      setActionNotice({ tone: "success", text: `Imported "${nextProjectName}".` });
    } catch (error) {
      console.error("Failed to import project:", error);
      setActionNotice({ tone: "error", text: "Project import failed. Select a valid export file." });
    }
  };
  const handleSaveEdit = () => {
    if (!editingProject?.name.trim()) return;
    setProjects(prev => prev.map(p => p.id === editingProject.id ? editingProject : p));
    setModal(null); setEditingProject(null);
  };
  const handleNewProject = () => {
    if (!newProjectName.trim()) return;
    setProjects(prev => [...prev, { id: createNumericId(prev), name: newProjectName.trim() }]);
    setNewProjectName(""); setModal(null);
  };

  const selectedProject = projects.find(p => p.id === contextMenu?.projectId);

  return (
    <>
      <div className="flex-1 overflow-y-auto page-pop" style={{ backgroundColor: t.bgContent }}>
        <div className="px-[16px]" style={{ paddingTop: 16 }}>

          {/* ── Action buttons ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-[8px]">
            <div className="flex items-center" style={{ gap: 15 }}>
              <button
                className="flex items-center justify-center text-[14px] px-[12px] hover:bg-[var(--btn-hover)] transition-colors"
                style={{ height: 35, backgroundColor: t.rowBg, color: t.textPrimary, border: `1px solid ${t.inputBorder}` }}
                onClick={() => { setNewProjectName(""); setModal("new"); }}
              >
                New Project
              </button>
              <button
                className="flex items-center justify-center text-[14px] px-[12px] hover:bg-[var(--btn-hover)] transition-colors"
                style={{ height: 35, backgroundColor: t.rowBg, color: t.textPrimary, border: `1px solid ${t.inputBorder}` }}
                onClick={() => importFileInputRef.current?.click()}
              >
                Import Project
              </button>
            </div>
            {actionNotice ? (
              <div
                className="text-[12px] px-[8px] py-[6px] border min-h-[35px] min-w-[280px] flex items-center justify-end"
                style={{
                  color:
                    actionNotice.tone === "error"
                      ? "#f87171"
                      : actionNotice.tone === "info"
                        ? t.textMuted
                        : "#86efac",
                  borderColor: t.inputBorder,
                  backgroundColor: t.inputBg,
                }}
              >
                {actionNotice.text}
              </div>
            ) : null}
          </div>

          {/* Projects heading */}
          <div style={{ marginTop: 16 }}>
            <span className="text-[14px]" style={{ color: t.projectsHeading }}>Projects</span>
          </div>

          {/* Project rows */}
          <div style={{ marginTop: 16, backgroundColor: t.rowBg }}>
            {projects.map(project => (
              <div
                key={project.id}
                className="flex items-center justify-between h-[35px] pl-[16px] pr-0 group card-pop
                           hover:bg-[var(--row-hover)] transition-colors border-b"
                style={{ borderColor: t.divider }}
              >
                <span className="text-[14px]" style={{ color: t.textPrimary }}>{project.name}</span>
                <div className="flex items-center gap-[8px] ml-auto">
                  <button
                    className="h-[35px] w-[35px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center border"
                    style={{ color: t.textMuted, borderColor: t.inputBorder, backgroundColor: t.rowBg }}
                    onClick={e => openContextMenu(e, project.id)}
                    title="More options"
                    onMouseEnter={e => (e.currentTarget.style.color = t.textPrimary)}
                    onMouseLeave={e => (e.currentTarget.style.color = t.textMuted)}
                  >
                    <Ellipsis size={14} />
                  </button>
                  <button
                    className="h-[35px] px-[10px] border flex items-center gap-[6px] text-[13px] transition-colors"
                    style={{ color: t.textPrimary, borderColor: t.inputBorder, backgroundColor: t.rowBg }}
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <span>Open</span>
                    <SquareArrowOutUpRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <input
        ref={importFileInputRef}
        type="file"
        accept=".autocom-project.json,.json,application/json"
        className="hidden"
        onChange={e => { void handleImportFileSelection(e); }}
      />

      {/* ── CONTEXT MENU ──────────────────────────────────────────────────── */}
      {contextMenu && selectedProject && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 border shadow-xl card-pop"
          style={{ top: contextMenu.y, left: contextMenu.x, backgroundColor: t.ctxBg, borderColor: t.ctxBorder }}
        >
          <CtxItem t={t} icon={<Pencil size={14} />}   label="Edit"   onClick={() => handleEdit(selectedProject)} />
          <CtxItem t={t} icon={<CopyPlus size={14} />} label="Clone"  onClick={() => handleClone(selectedProject)} />
          <CtxItem t={t} icon={<Download size={14} />} label="Export" onClick={() => { void handleExport(selectedProject); }} />
          <div className="h-px" style={{ backgroundColor: t.ctxBorder }} />
          <CtxItem t={t} icon={<Trash2 size={14} />}   label="Delete" onClick={() => handleDelete(selectedProject.id)} danger />
        </div>
      )}

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      {modal === "new" && (
        <ModalOverlay onClose={() => setModal(null)}>
          <ModalBox title="New Project" onClose={() => setModal(null)} t={t} widthClass="w-[360px]">
            <div className="flex flex-col" style={{ gap: 10 }}>
              <div className="flex flex-col" style={{ gap: 7 }}>
                <input
                  autoFocus
                  className="w-full px-3 outline-none border"
                  style={{
                    height: 40,
                    backgroundColor: t.inputBg,
                    borderColor: t.inputBorder,
                    color: t.textPrimary,
                    fontSize: 13,
                  }}
                  placeholder="Enter Project Name"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleNewProject()}
                />
              </div>
              <ModalActions
                t={t}
                onCancel={() => setModal(null)}
                onConfirm={handleNewProject}
                confirmLabel="Create"
                confirmIcon={<Plus size={12} />}
              />
            </div>
          </ModalBox>
        </ModalOverlay>
      )}
      {modal === "edit" && editingProject && (
        <ModalOverlay onClose={() => setModal(null)}>
          <ModalBox title="Edit Project" onClose={() => setModal(null)} t={t}>
            <input autoFocus
              className="w-full text-[14px] px-3 py-2 outline-none border"
              style={{ backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }}
              value={editingProject.name}
              onChange={e => setEditingProject({ ...editingProject, name: e.target.value })}
              onKeyDown={e => e.key === "Enter" && handleSaveEdit()}
            />
            <ModalActions t={t} onCancel={() => setModal(null)} onConfirm={handleSaveEdit}
              confirmLabel="Save" confirmIcon={<Pencil size={13} />} />
          </ModalBox>
        </ModalOverlay>
      )}
    </>
  );
}

// ── small reusable pieces ─────────────────────────────────────────────────────

function CtxItem({ icon, label, onClick, danger, t }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; t: AppTheme;
}) {
  return (
    <button
      className="flex items-center gap-3 w-full px-4 py-[8px] text-[13px] hover:bg-[var(--ctx-hover)] transition-colors"
      style={{ color: danger ? t.deleteHover : t.textPrimary }}
      onClick={onClick}
    >
      {icon}<span>{label}</span>
    </button>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModalBox({ title, children, onClose, t, widthClass = "w-[380px]" }: {
  title: string; children: React.ReactNode; onClose: () => void; t: AppTheme; widthClass?: string;
}) {
  return (
    <div className={`${widthClass} p-6 shadow-2xl border card-pop`}
      style={{ backgroundColor: t.modalBg, borderColor: t.ctxBorder }}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-[14px]" style={{ color: t.textPrimary }}>{title}</span>
        <button className="transition-colors p-1 rounded" style={{ color: t.textMuted }}
          onMouseEnter={e => (e.currentTarget.style.color = t.deleteHover)}
          onMouseLeave={e => (e.currentTarget.style.color = t.textMuted)}
          onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel, confirmIcon, t }: {
  onCancel: () => void; onConfirm: () => void;
  confirmLabel: string; confirmIcon: React.ReactNode; t: AppTheme;
}) {
  return (
    <div className="flex justify-end gap-2 mt-3">
      <button
        className="px-4 py-[7px] text-[13px] border transition-all"
        style={{ color: t.textPrimary, borderColor: t.ctxBorder, backgroundColor: t.inputBg }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "#EF4444";
          e.currentTarget.style.boxShadow = "0 0 0 1px #EF4444";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = t.ctxBorder;
          e.currentTarget.style.boxShadow = "none";
        }}
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        className="flex items-center gap-2 px-4 py-[7px] text-[13px] border transition-all"
        style={{ color: t.textPrimary, backgroundColor: t.inputBg, borderColor: t.ctxBorder }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "#8E51FF";
          e.currentTarget.style.boxShadow = "0 0 0 1px #8E51FF";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = t.ctxBorder;
          e.currentTarget.style.boxShadow = "none";
        }}
        onClick={onConfirm}
      >
        {confirmIcon}{confirmLabel}
      </button>
    </div>
  );
}
