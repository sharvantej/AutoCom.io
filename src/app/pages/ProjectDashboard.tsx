import { useState, useEffect, useRef, useCallback, useId, useMemo } from "react";
import { X, ArrowUp, ArrowDown, Copy, Eye, EyeOff, Trash2, Menu } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useParams } from "react-router";
import { createPortal } from "react-dom";
import { useAppContext, useTheme, type AppTheme } from "../context/AppContext";
import type { Connection, TaskEntry } from "../types";
import { compileDashboardRows } from "../services/dashboardTasks";
import { publishDashboardEditMode } from "../services/dashboardEditorMode";
import { readMotionScale } from "../services/motion";
import { isTauri, tauriInvoke } from "../services/tauri";
import {
  loadDashboardLayout,
  saveDashboardLayout,
  type RuntimeApiResponse,
} from "../services/runtimeState";
import { createEntityId } from "../services/ids";
import svgPaths from "../assets/generated/project-dashboard-svg";
import { AddTaskPanel, type WorkspaceTaskActions } from "../components/AddTaskPanel";
import { APP_THEME_PALETTE } from "../styles/palette";
const P = APP_THEME_PALETTE;
const PURPLE_ACCENT_BG = "#4c1d95";
const PURPLE_ACCENT_BG_SOFT = "rgba(124, 58, 237, 0.24)";
const PURPLE_ACCENT_BORDER = "#8b5cf6";
const PURPLE_ACCENT_TEXT = "#ede9fe";
// ── Constants ─────────────────────────────────────────────────────────────────
const DASHBOARD_STORAGE_PREFIX = "autocom.project.dashboard";
const EDITOR_STORAGE = {
  snap:  "settings.editor.snap",
  grid:  "settings.editor.grid",
  save:  "settings.editor.save",
} as const;
const sg = (v: number, gridSize: number) => Math.round(v / gridSize) * gridSize;
// ── Types ─────────────────────────────────────────────────────────────────────
type Tool     = "select" | "move" | "resize" | "label" | "button";
type RightTab = "attributes" | "position" | "style";
type TAlign   = "left" | "center" | "right";
type EditorWindowMode = "create" | "edit";
interface CanvasItem {
  id:          string;
  type:        "button" | "label";
  x:           number; y: number;
  w:           number; h: number;
  label:       string;
  tasks:       TaskEntry[];
  bgColor:     string;
  borderColor: string;
  fontSize:    number;
  fgColor:     string;
  textAlign:   TAlign;
}
interface DragState {
  kind:    "move" | "resize";
  id:      string;
  mx0:     number; my0: number;
  x0:      number; y0: number;
  w0?:     number; h0?: number;
  handle?: string;
}
interface NewItemDrag {
  type: "button" | "label";
  sx:   number; sy: number;
  cx:   number; cy: number;
}
interface EditorWindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface EditorWindowDrag {
  mx0: number;
  my0: number;
  x0: number;
  y0: number;
}
type DashboardSaveStatus = "idle" | "saving" | "saved" | "error";
const DASHBOARD_UNDO_LIMIT = 100;
type WindowResizeTarget = "editor" | "workspace";
interface WindowResizeDrag {
  target: WindowResizeTarget;
  mx0: number;
  my0: number;
  width0: number;
  height0: number;
}
function dashboardStorageKey(projectId: string): string {
  return `${DASHBOARD_STORAGE_PREFIX}.${projectId}`;
}
function readEditorPref(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function readDashboardGridSize(): number {
  const raw = readEditorPref(EDITOR_STORAGE.grid, "16");
  if (raw === "8") return 8;
  if (raw === "24") return 24;
  return 16;
}
function readDashboardSnapDefault(): boolean {
  return readEditorPref(EDITOR_STORAGE.snap, "on") !== "off";
}
function readDashboardAutoSaveDefault(): boolean {
  return readEditorPref(EDITOR_STORAGE.save, "on") !== "off";
}
function readDashboardAnimationScale(): number {
  return readMotionScale();
}
function readStoredDashboardItems(projectId: string): CanvasItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(dashboardStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CanvasItem[]) : [];
  } catch {
    return [];
  }
}
async function loadCanvasItems(projectId: string): Promise<CanvasItem[]> {
  if (isTauri()) {
    return loadDashboardLayout<CanvasItem>(projectId);
  }
  return readStoredDashboardItems(projectId);
}
async function persistCanvasItems(projectId: string, items: CanvasItem[]): Promise<void> {
  if (isTauri()) {
    await saveDashboardLayout(projectId, items);
    return;
  }
  writeStoredDashboardItems(projectId, items);
}
function writeStoredDashboardItems(projectId: string, items: CanvasItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dashboardStorageKey(projectId), JSON.stringify(items));
  } catch {
    // Ignore localStorage write failures (quota/private mode).
  }
}
// ── Resize handles ────────────────────────────────────────────────────────────
const HANDLES = ["nw","n","ne","e","se","s","sw","w"] as const;
const CURSORS: Record<string, string> = {
  nw:"nw-resize", n:"n-resize", ne:"ne-resize", e:"e-resize",
  se:"se-resize", s:"s-resize", sw:"sw-resize", w:"w-resize",
};
function hPos(h: string, w: number, ht: number) {
  switch (h) {
    case "nw": return { left:-4, top:-4 };
    case "n":  return { left: w/2-4, top:-4 };
    case "ne": return { left: w-4,  top:-4 };
    case "e":  return { left: w-4,  top: ht/2-4 };
    case "se": return { left: w-4,  top: ht-4 };
    case "s":  return { left: w/2-4, top: ht-4 };
    case "sw": return { left:-4, top: ht-4 };
    case "w":  return { left:-4, top: ht/2-4 };
    default:   return { left:0, top:0 };
  }
}
/** Build a readable display label from a TaskEntry */
function taskLabel(t: TaskEntry, connection: Connection | null = null): string {
  const connectionName = String(connection?.name ?? t.connection ?? "").trim();
  const rawLabel = String(t.label ?? "").trim();
  const functionName = String(t.funcName ?? "").trim();

  let detail = functionName;
  if (!detail && rawLabel) {
    const colonIndex = rawLabel.indexOf(":");
    detail = colonIndex >= 0 ? rawLabel.slice(colonIndex + 1).trim() : rawLabel;
  }
  if (!detail) {
    detail = String(t.input ?? "").trim();
  }

  const parts = [connectionName, detail].filter(Boolean);
  return parts.join(" - ") || "(empty task)";
}
function isTaskEnabled(task: TaskEntry): boolean {
  return task.enabled !== false;
}
function connectionDeviceColor(device: string): string {
  const d = String(device ?? "").trim().toLowerCase();
  if (d === "vmix" || d.includes("vmix")) return "#22c55e";
  if (d === "atem" || d.includes("atem")) return "#3b82f6";
  if (d === "obs") return "#f97316";
  if (d === "resolume") return "#ec4899";
  if (d.includes("grandma")) return "#a855f7";
  if (d.includes("companion")) return "#06b6d4";
  if (d.includes("ross")) return "#eab308";
  if (d.includes("http") || d.includes("https")) return "#64748b";
  return "#6366f1";
}
function isWaitTask(task: TaskEntry): boolean {
  const params = task.params as unknown;
  if (params && typeof params === "object" && !Array.isArray(params)) {
    const action = (params as Record<string, unknown>).action;
    if (typeof action === "string" && action.trim().toLowerCase() === "wait") {
      return true;
    }
  }
  return String(task.funcName ?? "").trim().toLowerCase() === "wait";
}
function parseTaskConnectionId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}
function resolveConnectionForTask(task: TaskEntry, connections: Connection[]): Connection | null {
  const parsedId = parseTaskConnectionId(task.connectionId);
  if (parsedId !== null) {
    const byId = connections.find((connection) => connection.id === parsedId);
    if (byId) return byId;
  }
  const taskConnection = String(task.connection ?? "").trim();
  if (!taskConnection) return null;
  const direct = connections.find((connection) => connection.name === taskConnection);
  if (direct) return direct;
  const key = taskConnection.toLowerCase();
  const byName = connections.find((connection) => connection.name.trim().toLowerCase() === key);
  if (byName) return byName;
  return connections.find((connection) => String(connection.device ?? "").trim().toLowerCase() === key) ?? null;
}
function ensureUniqueTaskIds(sourceTasks: TaskEntry[]): { tasks: TaskEntry[]; changed: boolean } {
  if (!sourceTasks.length) {
    return { tasks: sourceTasks, changed: false };
  }
  let changed = false;
  const seen = new Set<string>();
  const tasks = sourceTasks.map((task) => {
    const trimmedId = typeof task.id === "string" ? task.id.trim() : "";
    if (!trimmedId || seen.has(trimmedId)) {
      changed = true;
      const nextId = createEntityId("task");
      seen.add(nextId);
      return { ...task, id: nextId };
    }
    seen.add(trimmedId);
    if (trimmedId !== task.id) {
      changed = true;
      return { ...task, id: trimmedId };
    }
    return task;
  });
  return { tasks, changed };
}
function normalizeDashboardTaskConnections(
  sourceItems: CanvasItem[],
  connections: Connection[],
): { items: CanvasItem[]; changed: boolean } {
  if (!sourceItems.length) {
    return { items: sourceItems, changed: false };
  }
  let changed = false;
  const items = sourceItems.map((item) => {
    if (!item.tasks.length) return item;
    const deduped = ensureUniqueTaskIds(item.tasks);
    let itemChanged = deduped.changed;
    let tasks = deduped.tasks;
    if (connections.length) {
      tasks = tasks.map((task) => {
        const existingId = parseTaskConnectionId(task.connectionId);
        if (existingId !== null) return task;
        const matched = connections.find((connection) => connection.name === task.connection);
        if (!matched) return task;
        itemChanged = true;
        return { ...task, connectionId: matched.id };
      });
    }
    if (!itemChanged) return item;
    changed = true;
    return { ...item, tasks };
  });
  return { items, changed };
}
type DashboardApiResponse = RuntimeApiResponse<{
  success?: boolean;
  error?: string;
  results?: unknown;
}>;
function formatLogLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    pad(date.getFullYear() % 100),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join(".") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
function hasSuccessfulExecutionResult(results: unknown): boolean {
  if (!Array.isArray(results)) return false;
  return results.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const payload = entry as Record<string, unknown>;
    if (payload.ok === true && payload.skipped !== true) return true;
    if (Array.isArray(payload.results)) {
      return hasSuccessfulExecutionResult(payload.results);
    }
    return false;
  });
}
// ── SVG icon ──────────────────────────────────────────────────────────────────
function Icon({ d, size = 16 }: { d: string | string[]; size?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      style={{ display:"block", flexShrink:0 }}>
      {paths.map((p, i) => (
        <path key={i} d={p} stroke="currentColor"
          strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333"/>
      ))}
    </svg>
  );
}
const IC = {
  select:     svgPaths.pc084c80,
  move:       svgPaths.p1d4e2d00,
  resize:     svgPaths.p65c3f60,
  label:      svgPaths.pa68c500,
  button:     svgPaths.p5b64300,
};
const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id:"select", label:"Select", icon: IC.select  },
  { id:"move",   label:"Move",   icon: IC.move    },
  { id:"resize", label:"Resize", icon: IC.resize  },
  { id:"label",  label:"Label",  icon: IC.label   },
  { id:"button", label:"Button", icon: IC.button  },
];
const DASHBOARD_BUTTON_HEIGHT = 32;
const DASHBOARD_ICON_BUTTON_SIZE = 24;
const FLOATING_EDITOR_MARGIN = 24;
const FLOATING_EDITOR_OFFSET = 28;
const FLOATING_EDITOR_MIN_WIDTH = 380;
const FLOATING_EDITOR_MIN_HEIGHT = 300;
const WORKSPACE_WINDOW_MIN_WIDTH = 1100;
const WORKSPACE_WINDOW_MIN_HEIGHT = 680;
const WORKSPACE_WINDOW_PADDING = 36;
const WORKSPACE_SPLITTER_WIDTH = 0;
const WORKSPACE_LEFT_PANE_MIN_WIDTH = 280;
const WORKSPACE_RIGHT_PANE_MIN_WIDTH = 480;
function clampToRange(value: number, min: number, max: number): number {
  if (max < min) {
    // If viewport is smaller than our desired minimum, prefer fitting viewport.
    return Math.max(1, max);
  }
  return Math.min(Math.max(value, min), max);
}
function clampWorkspaceWindowSize(
  size: { width: number; height: number },
  host: HTMLDivElement | null,
): { width: number; height: number } {
  if (!host) return size;
  const maxWidth = Math.max(WORKSPACE_WINDOW_MIN_WIDTH, host.clientWidth - WORKSPACE_WINDOW_PADDING);
  const maxHeight = Math.max(WORKSPACE_WINDOW_MIN_HEIGHT, host.clientHeight - WORKSPACE_WINDOW_PADDING);
  return {
    width: clampToRange(size.width, WORKSPACE_WINDOW_MIN_WIDTH, maxWidth),
    height: clampToRange(size.height, WORKSPACE_WINDOW_MIN_HEIGHT, maxHeight),
  };
}
function clampWorkspaceSplitRatio(ratio: number, hostWidth: number): number {
  const total = Math.max(1, hostWidth - WORKSPACE_SPLITTER_WIDTH);
  const minRatio = Math.min(0.95, WORKSPACE_LEFT_PANE_MIN_WIDTH / total);
  const maxRatio = Math.max(0.05, 1 - (WORKSPACE_RIGHT_PANE_MIN_WIDTH / total));
  if (maxRatio < minRatio) return 0.5;
  return Math.min(Math.max(ratio, minRatio), maxRatio);
}
function getEditorWindowSize(
  type: CanvasItem["type"],
  mode: EditorWindowMode,
): Pick<EditorWindowRect, "width" | "height"> {
  if (type === "label") {
    return { width: 420, height: 280 };
  }
  if (mode === "create") {
    return { width: 452, height: 520 };
  }
  return { width: 760, height: 600 };
}
function clampEditorWindowRect(
  rect: EditorWindowRect,
  host: HTMLDivElement | null,
): EditorWindowRect {
  if (!host) return rect;
  const width = Math.min(rect.width, Math.max(320, host.clientWidth - FLOATING_EDITOR_MARGIN * 2));
  const height = Math.min(rect.height, Math.max(240, host.clientHeight - FLOATING_EDITOR_MARGIN * 2));
  const maxX = Math.max(FLOATING_EDITOR_MARGIN, host.clientWidth - width - FLOATING_EDITOR_MARGIN);
  const maxY = Math.max(FLOATING_EDITOR_MARGIN, host.clientHeight - height - FLOATING_EDITOR_MARGIN);
  return {
    width,
    height,
    x: Math.min(Math.max(FLOATING_EDITOR_MARGIN, rect.x), maxX),
    y: Math.min(Math.max(FLOATING_EDITOR_MARGIN, rect.y), maxY),
  };
}
function buildEditorWindowRect(
  item: CanvasItem,
  host: HTMLDivElement | null,
  mode: EditorWindowMode,
): EditorWindowRect {
  const size = getEditorWindowSize(item.type, mode);
  const fallbackRect = {
    x: item.x + FLOATING_EDITOR_OFFSET,
    y: item.y + FLOATING_EDITOR_OFFSET,
    ...size,
  };
  if (!host) {
    return fallbackRect;
  }
  const hostWidth = host.clientWidth;
  const hostHeight = host.clientHeight;
  let x = item.x + item.w + FLOATING_EDITOR_OFFSET;
  if (x + size.width + FLOATING_EDITOR_MARGIN > hostWidth) {
    x = item.x - size.width - FLOATING_EDITOR_OFFSET;
  }
  if (x < FLOATING_EDITOR_MARGIN) {
    x = Math.max(FLOATING_EDITOR_MARGIN, Math.floor((hostWidth - size.width) / 2));
  }
  let y = item.y;
  if (y + size.height + FLOATING_EDITOR_MARGIN > hostHeight) {
    y = Math.max(FLOATING_EDITOR_MARGIN, hostHeight - size.height - FLOATING_EDITOR_MARGIN);
  }
  return clampEditorWindowRect({ x, y, ...size }, host);
}
// ── Main component ────────────────────────────────────────────────────────────
export default function ProjectDashboard() {
  const { id: routeProjectId } = useParams();
  const projectId = routeProjectId ?? "default";
  const { connections, setLogs, theme } = useAppContext();
  const t         = useTheme();
  const patternId = useId().replace(/:/g, "");
  const [gridSize] = useState(() => readDashboardGridSize());
  const gridMajorSize = gridSize * 5;
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => readDashboardAutoSaveDefault());
  const [animationDurationScale] = useState(() => readDashboardAnimationScale());
  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [tool,     setTool]     = useState<Tool>("select");
  const [snap,     setSnap]     = useState(() => readDashboardSnapDefault());
  // Canvas items
  const [items, setItems] = useState<CanvasItem[]>(() =>
    isTauri() ? [] : readStoredDashboardItems(projectId),
  );
  const [itemsProjectKey, setItemsProjectKey] = useState(() =>
    isTauri() ? "" : projectId,
  );
  const [selId, setSelId] = useState<string | null>(null);
  const [editorItemId, setEditorItemId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorWindowMode>("edit");
  // Floating editor window
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [rightTab,    setRightTab]    = useState<RightTab>("attributes");
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskEntry[]>([]);
  const [selectedDraftTaskId, setSelectedDraftTaskId] = useState<string | null>(null);
  const [editingDraftTaskId, setEditingDraftTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [hoverDropTaskId, setHoverDropTaskId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<CanvasItem[][]>([]);
  const [executingButtonId, setExecutingButtonId] = useState<string | null>(null);
  const [tallyButtonId, setTallyButtonId] = useState<string | null>(null);
  const [dashboardSaveStatus, setDashboardSaveStatus] = useState<DashboardSaveStatus>("idle");
  const [workspaceWindowSize, setWorkspaceWindowSize] = useState(() => ({
    width: 1420,
    height: 860,
  }));
  const [workspaceSplitRatio, setWorkspaceSplitRatio] = useState(0.5);
  const [workspaceTaskActions, setWorkspaceTaskActions] = useState<WorkspaceTaskActions | null>(null);
  const [editorRect, setEditorRect] = useState<EditorWindowRect>(() => ({
    x: 96,
    y: 96,
    ...getEditorWindowSize("button", "create"),
  }));
  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ sx:number; sy:number } | null>(null);
  // Drag
  const dragRef    = useRef<DragState | null>(null);
  const newDragRef = useRef<NewItemDrag | null>(null);
  const editorDragRef = useRef<EditorWindowDrag | null>(null);
  const windowResizeRef = useRef<WindowResizeDrag | null>(null);
  const workspaceSplitDragRef = useRef<{ mx0: number; ratio0: number; width0: number } | null>(null);
  const saveStatusResetTimerRef = useRef<number | null>(null);
  const connectionsRef = useRef(connections);
  const canvasRef  = useRef<HTMLDivElement>(null);
  const workspaceSplitHostRef = useRef<HTMLDivElement>(null);
  const pendingLayoutRef = useRef<{ projectId: string; items: CanvasItem[] } | null>(null);
  const [newDrag,  setNewDrag] = useState<NewItemDrag | null>(null);
  const [topBarSlot, setTopBarSlot] = useState<HTMLElement | null>(null);
  const isDark     = theme === "dark";
  const editorItem = useMemo(
    () => items.find((item) => item.id === editorItemId) ?? null,
    [editorItemId, items],
  );
  // Grid — dark enough to actually see on the canvas
  const gridMinor  = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.14)";
  const gridMajor  = isDark ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.28)";
  const appendDashboardLog = useCallback((source: string, message: string) => {
    const timestamp = Date.now();
    setLogs(prev => [
      {
        id: timestamp,
        timestamp,
        label: formatLogLabel(timestamp),
        source,
        message,
      },
      ...prev,
    ].slice(0, 500));
  }, [setLogs]);
  const persistDashboardState = useCallback((layoutProjectId: string, nextItems: CanvasItem[]) => {
    void persistCanvasItems(layoutProjectId, nextItems).catch((error) => {
      appendDashboardLog(
        `Dashboard/${layoutProjectId}`,
        error instanceof Error ? error.message : "Failed to save dashboard layout.",
      );
    });
  }, [appendDashboardLog]);
  const normalizeTasksForConnections = useCallback((tasks: TaskEntry[]): TaskEntry[] => {
    if (!tasks.length) return tasks;
    const deduped = ensureUniqueTaskIds(tasks);
    if (!connections.length) {
      return deduped.changed ? deduped.tasks : tasks;
    }
    let changed = deduped.changed;
    const normalized = deduped.tasks.map((task) => {
      const existingId = parseTaskConnectionId(task.connectionId);
      if (existingId !== null) return task;
      const matched = connections.find((connection) => connection.name === task.connection);
      if (!matched) return task;
      changed = true;
      return { ...task, connectionId: matched.id };
    });
    return changed ? normalized : tasks;
  }, [connections]);
  const buttonHasConnectionIssue = useCallback((item: CanvasItem): boolean => {
    if (item.type !== "button") return false;
    const enabledTasks = item.tasks.filter(isTaskEnabled);
    if (!enabledTasks.length) return false;
    for (const task of enabledTasks) {
      if (isWaitTask(task)) continue;
      const connection = resolveConnectionForTask(task, connections);
      if (!connection) return true;
      if (connection.active === false) return true;
    }
    return false;
  }, [connections]);
  const cloneCanvasItems = useCallback((source: CanvasItem[]): CanvasItem[] => (
    source.map((item) => ({
      ...item,
      tasks: item.tasks.map((task) => ({
        ...task,
        params: task.params ? JSON.parse(JSON.stringify(task.params)) as Record<string, unknown> : task.params,
      })),
    }))
  ), []);
  const applyItemsUpdate = useCallback((updater: (previousItems: CanvasItem[]) => CanvasItem[]) => {
    setItems((previousItems) => {
      const nextItems = updater(previousItems);
      if (nextItems === previousItems) return previousItems;
      let changed = nextItems.length !== previousItems.length;
      if (!changed) {
        for (let i = 0; i < nextItems.length; i += 1) {
          if (nextItems[i] !== previousItems[i]) {
            changed = true;
            break;
          }
        }
      }
      if (!changed) return previousItems;
      setUndoStack((history) => {
        const trimmed = history.length >= DASHBOARD_UNDO_LIMIT
          ? history.slice(history.length - (DASHBOARD_UNDO_LIMIT - 1))
          : history;
        return [...trimmed, cloneCanvasItems(previousItems)];
      });
      return nextItems;
    });
  }, [cloneCanvasItems]);
  const performUndo = useCallback(() => {
    setUndoStack((history) => {
      if (!history.length) return history;
      const previousItems = history[history.length - 1];
      setItems(cloneCanvasItems(previousItems));
      return history.slice(0, -1);
    });
  }, [cloneCanvasItems]);
  const openEditorWindow = useCallback((item: CanvasItem, options?: {
    tab?: RightTab;
    addTask?: boolean;
    mode?: EditorWindowMode;
  }) => {
    const normalizedTasks = normalizeTasksForConnections(item.tasks);
    const mode = options?.mode ?? "edit";
    const shouldOpenTaskWorkspace = options?.addTask ?? (mode === "edit" && item.type === "button");
    setSelId(item.id);
    setEditorItemId(item.id);
    setPanelOpen(true);
    setEditorMode(mode);
    setRightTab(options?.tab ?? "attributes");
    setAddTaskOpen(shouldOpenTaskWorkspace);
    setTaskDraft(normalizedTasks);
    setSelectedDraftTaskId(normalizedTasks[0]?.id ?? null);
    setEditingDraftTaskId(normalizedTasks[0]?.id ?? null);
    setEditorRect(buildEditorWindowRect(item, canvasRef.current, mode));
    setCtxMenu(null);
  }, [normalizeTasksForConnections]);
  const closeEditorWindow = useCallback(() => {
    setPanelOpen(false);
    setAddTaskOpen(false);
    setEditorItemId(null);
    setEditorMode("edit");
    setTaskDraft([]);
    setSelectedDraftTaskId(null);
    setEditingDraftTaskId(null);
    windowResizeRef.current = null;
  }, []);
  const duplicateCanvasItemById = useCallback((itemId: string): string | null => {
    const source = items.find((item) => item.id === itemId);
    if (!source) return null;
    const duplicatedId = createEntityId("item");
    const duplicate: CanvasItem = {
      ...source,
      id: duplicatedId,
      x: source.x + gridSize,
      y: source.y + gridSize,
      tasks: source.tasks.map((task) => ({ ...task, id: createEntityId("task") })),
    };
    applyItemsUpdate((previousItems) => [...previousItems, duplicate]);
    setSelId(duplicatedId);
    return duplicatedId;
  }, [applyItemsUpdate, gridSize, items]);
  const deleteCanvasItemById = useCallback((itemId: string) => {
    applyItemsUpdate((previousItems) => previousItems.filter((item) => item.id !== itemId));
    if (editorItemId === itemId) {
      closeEditorWindow();
    }
    setSelId((previousId) => (previousId === itemId ? null : previousId));
  }, [applyItemsUpdate, closeEditorWindow, editorItemId]);
  const setDashboardEditModeState = useCallback((active: boolean) => {
    publishDashboardEditMode(active);
    if (!active) {
      closeEditorWindow();
      setCtxMenu(null);
      setSelId(null);
      setTool("select");
      setNewDrag(null);
      dragRef.current = null;
      newDragRef.current = null;
      editorDragRef.current = null;
      windowResizeRef.current = null;
    }
    setEditMode(active);
  }, [closeEditorWindow]);
  const runDashboardButton = useCallback(async (item: CanvasItem) => {
    if (item.type !== "button" || item.tasks.length === 0) return;
    const activeTasks = item.tasks.filter(isTaskEnabled);
    if (!activeTasks.length) {
      appendDashboardLog(`Dashboard/${item.label}`, "All tasks are excluded. Enable at least one task to run.");
      return;
    }
    if (!isTauri()) {
      appendDashboardLog(`Dashboard/${item.label}`, "Button execution requires the Tauri runtime.");
      return;
    }
    try {
      setExecutingButtonId(item.id);
      const rows = compileDashboardRows(activeTasks, connections);
      const response = await tauriInvoke<DashboardApiResponse>("api_request", {
        method: "POST",
        path: "/api/execute",
        body: { rows },
      });
      for (const event of response.events ?? []) {
        if (event.name !== "deviceLog") continue;
        const payload =
          event.data && typeof event.data === "object"
            ? (event.data as Record<string, unknown>)
            : null;
        const source =
          typeof payload?.device === "string"
            ? `Device/${payload.device}`
            : `Dashboard/${item.label}`;
        const message =
          typeof payload?.message === "string"
            ? payload.message
            : "Device log event received.";
        appendDashboardLog(source, message);
      }
      if (response.status >= 400 || response.body?.success === false) {
        appendDashboardLog(
          `Dashboard/${item.label}`,
          response.body?.error || `Execution failed with status ${response.status}.`,
        );
        return;
      }
      setTallyButtonId(item.id);
      appendDashboardLog(
        `Dashboard/${item.label}`,
        `Executed ${activeTasks.length} dashboard task${activeTasks.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      appendDashboardLog(
        `Dashboard/${item.label}`,
        error instanceof Error ? error.message : "Dashboard execution failed.",
      );
    } finally {
      setExecutingButtonId(null);
    }
  }, [appendDashboardLog, connections]);
  // Load canvas for the selected project.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextItems = await loadCanvasItems(projectId);
        if (cancelled) return;
        const normalized = normalizeDashboardTaskConnections(nextItems, connectionsRef.current);
        setItems(normalized.items);
        setUndoStack([]);
      } catch (error) {
        if (!cancelled) {
          appendDashboardLog(
            `Dashboard/${projectId}`,
            error instanceof Error ? error.message : "Failed to load dashboard layout.",
          );
          setItems(readStoredDashboardItems(projectId));
          setUndoStack([]);
        }
      } finally {
        if (!cancelled) {
          setItemsProjectKey(projectId);
          setSelId(null);
          setTallyButtonId(null);
          setDashboardSaveStatus("idle");
          setPanelOpen(false);
          setAddTaskOpen(false);
          setEditorItemId(null);
          setEditorMode("edit");
          editorDragRef.current = null;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appendDashboardLog, projectId]);
  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);
  useEffect(() => {
    if (!connections.length) return;
    setItems((previousItems) => {
      const normalized = normalizeDashboardTaskConnections(previousItems, connections);
      return normalized.changed ? normalized.items : previousItems;
    });
  }, [connections]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    setTopBarSlot(document.getElementById("layout-topbar-center-slot"));
  }, []);
  useEffect(() => {
    const syncAutoSavePreference = () => {
      const next = readDashboardAutoSaveDefault();
      setAutoSaveEnabled((previous) => (previous === next ? previous : next));
    };
    const onEditorPrefChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key === EDITOR_STORAGE.save) {
        syncAutoSavePreference();
      }
    };
    syncAutoSavePreference();
    window.addEventListener("focus", syncAutoSavePreference);
    window.addEventListener("storage", syncAutoSavePreference);
    window.addEventListener("editor-pref-changed", onEditorPrefChanged as EventListener);
    return () => {
      window.removeEventListener("focus", syncAutoSavePreference);
      window.removeEventListener("storage", syncAutoSavePreference);
      window.removeEventListener("editor-pref-changed", onEditorPrefChanged as EventListener);
    };
  }, []);
  useEffect(() => {
    return () => {
      publishDashboardEditMode(false);
    };
  }, []);
  useEffect(() => {
    return () => {
      if (saveStatusResetTimerRef.current !== null) {
        window.clearTimeout(saveStatusResetTimerRef.current);
        saveStatusResetTimerRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    return () => {
      const pending = pendingLayoutRef.current;
      if (!pending) return;
      pendingLayoutRef.current = null;
      persistDashboardState(pending.projectId, pending.items);
    };
  }, [persistDashboardState, projectId]);
  useEffect(() => {
    if (!panelOpen) return;
    const onResize = () => {
      setEditorRect(prev => clampEditorWindowRect(prev, canvasRef.current));
      setWorkspaceWindowSize((previous) => {
        const clamped = clampWorkspaceWindowSize(previous, canvasRef.current);
        if (clamped.width === previous.width && clamped.height === previous.height) return previous;
        return clamped;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [panelOpen]);
  useEffect(() => {
    if (!editorItem) {
      setTaskDraft([]);
      setEditingDraftTaskId(null);
      return;
    }
    if (addTaskOpen) return;
    setTaskDraft(normalizeTasksForConnections(editorItem.tasks));
  }, [addTaskOpen, editorItem, normalizeTasksForConnections]);
  useEffect(() => {
    if (!panelOpen || !editorItem || !addTaskOpen) return;
    setWorkspaceWindowSize((previous) => {
      const clamped = clampWorkspaceWindowSize(previous, canvasRef.current);
      if (clamped.width === previous.width && clamped.height === previous.height) return previous;
      return clamped;
    });
  }, [addTaskOpen, editorItem, panelOpen]);
  useEffect(() => {
    const activeTasks = addTaskOpen ? taskDraft : (editorItem?.tasks ?? []);
    if (!activeTasks.length) {
      setSelectedDraftTaskId(null);
      setEditingDraftTaskId(null);
      return;
    }
    if (!selectedDraftTaskId || !activeTasks.some((task) => task.id === selectedDraftTaskId)) {
      setSelectedDraftTaskId(activeTasks[0]?.id ?? null);
    }
    if (editingDraftTaskId && !activeTasks.some((task) => task.id === editingDraftTaskId)) {
      setEditingDraftTaskId(activeTasks[0]?.id ?? null);
    }
  }, [addTaskOpen, editorItem, editingDraftTaskId, selectedDraftTaskId, taskDraft]);
  // Persist canvas changes for the current project.
  useEffect(() => {
    if (itemsProjectKey !== projectId) return;
    if (!autoSaveEnabled) {
      pendingLayoutRef.current = { projectId, items };
      return;
    }
    pendingLayoutRef.current = null;
    persistDashboardState(projectId, items);
  }, [autoSaveEnabled, items, itemsProjectKey, persistDashboardState, projectId]);
  // Keyboard shortcuts and accessibility flow.
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const key = e.key;
      const lowerKey = key.toLowerCase();
      const hasCommand = e.metaKey || e.ctrlKey;
      if (hasCommand && lowerKey === "s") {
        e.preventDefault();
        void (async () => {
          const saved = await saveDashboardNow();
          if (saved && e.shiftKey && panelOpen) {
            closeEditorWindow();
          }
        })();
        return;
      }
      if (hasCommand && lowerKey === "z" && !e.shiftKey) {
        if (isTextEntryTarget(e.target)) return;
        e.preventDefault();
        performUndo();
        return;
      }
      if (isTextEntryTarget(e.target)) return;
      if (!hasCommand && !e.altKey && lowerKey === "g") {
        e.preventDefault();
        setDashboardEditModeState(!editMode);
        return;
      }
      if (key === "Escape") {
        e.preventDefault();
        if (addTaskOpen) {
          if (editorItem?.type === "button" && editorMode === "edit") {
            closeEditorWindow();
          } else {
            setAddTaskOpen(false);
          }
          return;
        }
        if (panelOpen) {
          closeEditorWindow();
          return;
        }
        setDashboardEditModeState(false);
        return;
      }
      if (!editMode) return;
      if (!panelOpen && !hasCommand && !e.altKey) {
        if (lowerKey === "v") { setTool("select"); return; }
        if (lowerKey === "m") { setTool("move"); return; }
        if (lowerKey === "r") { setTool("resize"); return; }
        if (lowerKey === "b") { setTool("button"); return; }
        if (lowerKey === "l") { setTool("label"); return; }
      }
      if (!panelOpen && key === "Tab") {
        if (!items.length) return;
        e.preventDefault();
        const direction = e.shiftKey ? -1 : 1;
        const currentIndex = selId ? items.findIndex((item) => item.id === selId) : -1;
        const startIndex = currentIndex >= 0 ? currentIndex : (direction > 0 ? -1 : 0);
        const nextIndex = (startIndex + direction + items.length) % items.length;
        setSelId(items[nextIndex]?.id ?? null);
        return;
      }
      if (hasCommand && lowerKey === "d" && selId && !panelOpen) {
        e.preventDefault();
        duplicateCanvasItemById(selId);
        return;
      }
      if (panelOpen && editorItem?.type === "button" && !addTaskOpen) {
        const activeTasks = editorItem.tasks;
        if (e.altKey && selectedDraftTaskId && (key === "ArrowUp" || key === "ArrowDown")) {
          e.preventDefault();
          const sourceIndex = activeTasks.findIndex((task) => task.id === selectedDraftTaskId);
          if (sourceIndex >= 0) {
            const targetIndex = key === "ArrowUp"
              ? Math.max(0, sourceIndex - 1)
              : Math.min(activeTasks.length - 1, sourceIndex + 1);
            if (targetIndex !== sourceIndex) {
              const nextTasks = [...activeTasks];
              const [task] = nextTasks.splice(sourceIndex, 1);
              nextTasks.splice(targetIndex, 0, task);
              const normalizedTasks = normalizeTasksForConnections(nextTasks);
              applyItemsUpdate((previousItems) => previousItems.map((item) => (
                item.id === editorItem.id ? { ...item, tasks: normalizedTasks } : item
              )));
              setTaskDraft(normalizedTasks);
              setSelectedDraftTaskId(task.id);
            }
          }
          return;
        }
        if (key === "ArrowUp" || key === "ArrowDown") {
          if (!activeTasks.length) return;
          e.preventDefault();
          const currentIndex = selectedDraftTaskId
            ? activeTasks.findIndex((task) => task.id === selectedDraftTaskId)
            : 0;
          const safeIndex = currentIndex >= 0 ? currentIndex : 0;
          const nextIndex = key === "ArrowDown"
            ? Math.min(activeTasks.length - 1, safeIndex + 1)
            : Math.max(0, safeIndex - 1);
          setSelectedDraftTaskId(activeTasks[nextIndex]?.id ?? null);
          return;
        }
        if (key === "Enter" && selectedDraftTaskId) {
          e.preventDefault();
          setTaskDraft(editorItem.tasks);
          setSelectedDraftTaskId(selectedDraftTaskId);
          setEditingDraftTaskId(selectedDraftTaskId);
          setAddTaskOpen(true);
          return;
        }
        if ((key === "Delete" || key === "Backspace") && selectedDraftTaskId) {
          e.preventDefault();
          const nextTasks = activeTasks.filter((task) => task.id !== selectedDraftTaskId);
          const normalizedTasks = normalizeTasksForConnections(nextTasks);
          applyItemsUpdate((previousItems) => previousItems.map((item) => (
            item.id === editorItem.id ? { ...item, tasks: normalizedTasks } : item
          )));
          setTaskDraft(normalizedTasks);
          setSelectedDraftTaskId((prev) => (
            prev && normalizedTasks.some((task) => task.id === prev)
              ? prev
              : (normalizedTasks[0]?.id ?? null)
          ));
          return;
        }
      }
      // Delete / Backspace removes the selected canvas item.
      if ((key === "Delete" || key === "Backspace") && selId) {
        e.preventDefault();
        deleteCanvasItemById(selId);
        return;
      }
      // Enter opens the selected component editor quickly.
      if (key === "Enter" && selId && !panelOpen) {
        e.preventDefault();
        const selectedItem = items.find((item) => item.id === selId);
        if (selectedItem) {
          openEditorWindow(selectedItem, { tab: rightTab, mode: "edit" });
        }
        return;
      }
      // Arrow-key nudge for precise placement.
      if (!panelOpen && selId && (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown")) {
        e.preventDefault();
        const step = e.shiftKey ? gridSize : (snap ? gridSize : 1);
        const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
        const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
        applyItemsUpdate((previousItems) => {
          let changed = false;
          const nextItems = previousItems.map((item) => {
            if (item.id !== selId) return item;
            const nextX = Math.max(0, snap ? sg(item.x + dx, gridSize) : item.x + dx);
            const nextY = Math.max(0, snap ? sg(item.y + dy, gridSize) : item.y + dy);
            if (nextX === item.x && nextY === item.y) return item;
            changed = true;
            return { ...item, x: nextX, y: nextY };
          });
          return changed ? nextItems : previousItems;
        });
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [
    addTaskOpen,
    closeEditorWindow,
    deleteCanvasItemById,
    duplicateCanvasItemById,
    editMode,
    editorMode,
    editorItem,
    gridSize,
    items,
    applyItemsUpdate,
    normalizeTasksForConnections,
    openEditorWindow,
    panelOpen,
    performUndo,
    rightTab,
    selId,
    selectedDraftTaskId,
    setDashboardEditModeState,
    snap,
  ]);
  // Global mouse drag handlers.
  useEffect(() => {
    const mm = (e: MouseEvent) => {
      const d = dragRef.current;
      if (d) {
        const dx = e.clientX - d.mx0;
        const dy = e.clientY - d.my0;
        const sn = (v: number) => (snap ? sg(v, gridSize) : v);
        if (d.kind === "move") {
          setItems((prev) => {
            let changed = false;
            const next = prev.map((item) => {
              if (item.id !== d.id) return item;
              const x = Math.max(0, sn(d.x0 + dx));
              const y = Math.max(0, sn(d.y0 + dy));
              if (x === item.x && y === item.y) return item;
              changed = true;
              return { ...item, x, y };
            });
            return changed ? next : prev;
          });
        } else {
          setItems((prev) => {
            let changed = false;
            const next = prev.map((item) => {
              if (item.id !== d.id) return item;
              let { x, y, w, h } = item;
              const sn2 = (v: number) => (snap ? sg(v, gridSize) : v);
              switch (d.handle) {
                case "se": w = sn2(Math.max(40, d.w0! + dx)); h = sn2(Math.max(20, d.h0! + dy)); break;
                case "s":  h = sn2(Math.max(20, d.h0! + dy)); break;
                case "e":  w = sn2(Math.max(40, d.w0! + dx)); break;
                case "sw": { const nw = sn2(Math.max(40, d.w0! - dx)); x = sn2(d.x0 + (d.w0! - nw)); w = nw; h = sn2(Math.max(20, d.h0! + dy)); break; }
                case "n":  { const nh = sn2(Math.max(20, d.h0! - dy)); y = sn2(d.y0 + (d.h0! - nh)); h = nh; break; }
                case "ne": { const nh = sn2(Math.max(20, d.h0! - dy)); y = sn2(d.y0 + (d.h0! - nh)); h = nh; w = sn2(Math.max(40, d.w0! + dx)); break; }
                case "nw": { const nw = sn2(Math.max(40, d.w0! - dx)); const nh = sn2(Math.max(20, d.h0! - dy)); x = sn2(d.x0 + (d.w0! - nw)); y = sn2(d.y0 + (d.h0! - nh)); w = nw; h = nh; break; }
                case "w":  { const nw = sn2(Math.max(40, d.w0! - dx)); x = sn2(d.x0 + (d.w0! - nw)); w = nw; break; }
              }
              const nextX = Math.max(0, x);
              const nextY = Math.max(0, y);
              if (nextX === item.x && nextY === item.y && w === item.w && h === item.h) {
                return item;
              }
              changed = true;
              return { ...item, x: nextX, y: nextY, w, h };
            });
            return changed ? next : prev;
          });
        }
      }
      // New-item drag preview (raw coords, no snap)
      if (newDragRef.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        if (newDragRef.current.cx === cx && newDragRef.current.cy === cy) {
          return;
        }
        const nd = { ...newDragRef.current, cx, cy };
        newDragRef.current = nd;
        setNewDrag({ ...nd });
      }
    };
    const mu = () => {
      dragRef.current = null;
      if (newDragRef.current && canvasRef.current) {
        const nd = newDragRef.current;
        newDragRef.current = null;
        setNewDrag(null);
        const sn = (v: number) => (snap ? sg(v, gridSize) : v);
        const rw = Math.abs(nd.cx - nd.sx);
        const rh = Math.abs(nd.cy - nd.sy);
        const w = sn(rw < 10 ? (nd.type === "button" ? 136 : 120) : rw);
        const h = sn(rh < 10 ? (nd.type === "button" ? 50 : 28) : rh);
        const x = sn(Math.min(nd.sx, nd.cx));
        const y = sn(Math.min(nd.sy, nd.cy));
        finishCreate(nd.type, x, y, w, h);
      }
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
  }, [gridSize, snap]);
  useEffect(() => {
    const mm = (e: MouseEvent) => {
      const drag = editorDragRef.current;
      if (drag) {
        const dragDx = e.clientX - drag.mx0;
        const dragDy = e.clientY - drag.my0;
        setEditorRect(prev => clampEditorWindowRect({
          ...prev,
          x: drag.x0 + dragDx,
          y: drag.y0 + dragDy,
        }, canvasRef.current));
      }
      const resize = windowResizeRef.current;
      if (resize) {
        const resizeDx = e.clientX - resize.mx0;
        const resizeDy = e.clientY - resize.my0;
        if (resize.target === "editor") {
          setEditorRect((previous) => clampEditorWindowRect({
            ...previous,
            width: Math.max(FLOATING_EDITOR_MIN_WIDTH, resize.width0 + resizeDx),
            height: Math.max(FLOATING_EDITOR_MIN_HEIGHT, resize.height0 + resizeDy),
          }, canvasRef.current));
        } else {
          setWorkspaceWindowSize((previous) => clampWorkspaceWindowSize({
            width: Math.max(WORKSPACE_WINDOW_MIN_WIDTH, resize.width0 + resizeDx),
            height: Math.max(WORKSPACE_WINDOW_MIN_HEIGHT, resize.height0 + resizeDy),
          }, canvasRef.current));
        }
        return;
      }
      const split = workspaceSplitDragRef.current;
      if (!split) return;
      const hostWidth = workspaceSplitHostRef.current?.clientWidth ?? (split.width0 + WORKSPACE_SPLITTER_WIDTH);
      const availableWidth = Math.max(1, hostWidth - WORKSPACE_SPLITTER_WIDTH);
      const dx = e.clientX - split.mx0;
      const startLeftWidth = split.ratio0 * split.width0;
      const nextLeftWidth = startLeftWidth + dx;
      const nextRatio = nextLeftWidth / availableWidth;
      setWorkspaceSplitRatio(clampWorkspaceSplitRatio(nextRatio, hostWidth));
    };
    const mu = () => {
      editorDragRef.current = null;
      windowResizeRef.current = null;
      workspaceSplitDragRef.current = null;
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
  }, []);
  // ── Helpers ──────────────────────────────────────────────────────────────────
  const finishCreate = useCallback((
    type: "button" | "label",
    x: number, y: number, w: number, h: number
  ) => {
    const item: CanvasItem = {
      id:          createEntityId("item"),
      type, x, y, w, h,
      label:       type === "button" ? "Button" : "Label",
      tasks:       [],
      bgColor:     type === "button" ? "#101828" : "",
      borderColor: "",
      fontSize:    14,
      fgColor:     "#f9fafb",
      textAlign:   "center",
    };
    applyItemsUpdate((prev) => [...prev, item]);
    setTool("select");
    setCtxMenu(null);
    if (type === "button") {
      openEditorWindow(item, { tab: "attributes", mode: "create" });
      return;
    }
    setSelId(item.id);
  }, [applyItemsUpdate, openEditorWindow]);
  const upd = useCallback((patch: Partial<CanvasItem>) => {
    const targetId = editorItemId ?? selId;
    if (!targetId) return;
    const nextPatch = patch.tasks
      ? { ...patch, tasks: normalizeTasksForConnections(patch.tasks) }
      : patch;
    applyItemsUpdate((all) => all.map((item) => (item.id === targetId ? { ...item, ...nextPatch } : item)));
  }, [applyItemsUpdate, editorItemId, normalizeTasksForConnections, selId]);
  function setTransientSaveStatus(status: DashboardSaveStatus, resetMs?: number): void {
    setDashboardSaveStatus(status);
    if (saveStatusResetTimerRef.current !== null) {
      window.clearTimeout(saveStatusResetTimerRef.current);
      saveStatusResetTimerRef.current = null;
    }
    if (!resetMs) return;
    saveStatusResetTimerRef.current = window.setTimeout(() => {
      setDashboardSaveStatus("idle");
      saveStatusResetTimerRef.current = null;
    }, resetMs);
  }
  async function saveDashboardNow(): Promise<boolean> {
    setTransientSaveStatus("saving");
    try {
      await persistCanvasItems(projectId, items);
      pendingLayoutRef.current = null;
      setTransientSaveStatus("saved", 1800);
      return true;
    } catch (error) {
      appendDashboardLog(
        `Dashboard/${projectId}`,
        error instanceof Error ? error.message : "Failed to save dashboard layout.",
      );
      setTransientSaveStatus("error", 2600);
      return false;
    }
  }
  const applyDashboardChanges = useCallback(() => {
    void saveDashboardNow();
  }, [saveDashboardNow]);
  const saveAndCloseEditorWindow = useCallback(() => {
    void (async () => {
      const saved = await saveDashboardNow();
      if (saved) {
        closeEditorWindow();
      }
    })();
  }, [closeEditorWindow, saveDashboardNow]);
  const startWindowResize = useCallback((target: WindowResizeTarget, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (target === "editor") {
      windowResizeRef.current = {
        target,
        mx0: event.clientX,
        my0: event.clientY,
        width0: editorRect.width,
        height0: editorRect.height,
      };
      return;
    }
    windowResizeRef.current = {
      target,
      mx0: event.clientX,
      my0: event.clientY,
      width0: workspaceWindowSize.width,
      height0: workspaceWindowSize.height,
    };
  }, [editorRect.height, editorRect.width, workspaceWindowSize.height, workspaceWindowSize.width]);
  const startWorkspaceSplitResize = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const hostWidth = workspaceSplitHostRef.current?.clientWidth ?? workspaceWindowSize.width;
    const availableWidth = Math.max(1, hostWidth - WORKSPACE_SPLITTER_WIDTH);
    const normalizedRatio = clampWorkspaceSplitRatio(workspaceSplitRatio, hostWidth);
    workspaceSplitDragRef.current = {
      mx0: event.clientX,
      ratio0: normalizedRatio,
      width0: availableWidth,
    };
  }, [workspaceSplitRatio, workspaceWindowSize.width]);
  const deleteCurrentEditorItem = useCallback(() => {
    if (!editorItemId) return;
    applyItemsUpdate((prev) => prev.filter((i) => i.id !== editorItemId));
    if (selId === editorItemId) {
      setSelId(null);
    }
    closeEditorWindow();
  }, [applyItemsUpdate, closeEditorWindow, editorItemId, selId]);
  const updateEditorTasks = useCallback((nextTasks: TaskEntry[]) => {
    const normalizedTasks = normalizeTasksForConnections(nextTasks);
    upd({ tasks: normalizedTasks });
    setTaskDraft(normalizedTasks);
    setSelectedDraftTaskId((prev) => (
      prev && normalizedTasks.some((task) => task.id === prev)
        ? prev
        : (normalizedTasks[0]?.id ?? null)
    ));
    setEditingDraftTaskId((prev) => (
      prev && normalizedTasks.some((task) => task.id === prev)
        ? prev
        : (normalizedTasks[0]?.id ?? null)
    ));
  }, [normalizeTasksForConnections, upd]);
  const openTaskWorkspace = useCallback((taskId?: string | null) => {
    if (!editorItem) return;
    const normalizedTasks = normalizeTasksForConnections(editorItem.tasks);
    setTaskDraft(normalizedTasks);
    if (taskId !== undefined) {
      const requestedTask = normalizedTasks.find((task) => task.id === taskId);
      const nextId = requestedTask?.id ?? normalizedTasks[0]?.id ?? null;
      setSelectedDraftTaskId(nextId);
      setEditingDraftTaskId(nextId);
    } else if (!selectedDraftTaskId || !normalizedTasks.some((task) => task.id === selectedDraftTaskId)) {
      const nextId = normalizedTasks[0]?.id ?? null;
      setSelectedDraftTaskId(nextId);
      setEditingDraftTaskId(nextId);
    } else if (!editingDraftTaskId || !normalizedTasks.some((task) => task.id === editingDraftTaskId)) {
      setEditingDraftTaskId(selectedDraftTaskId);
    }
    setAddTaskOpen(true);
  }, [editingDraftTaskId, editorItem, normalizeTasksForConnections, selectedDraftTaskId]);
  const reorderDraftTaskByDrop = useCallback((sourceTaskId: string, targetTaskId: string) => {
    if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) return;
    setTaskDraft((prevTasks) => {
      const sourceIndex = prevTasks.findIndex((entry) => entry.id === sourceTaskId);
      const targetIndex = prevTasks.findIndex((entry) => entry.id === targetTaskId);
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return prevTasks;
      const nextTasks = [...prevTasks];
      const [movedTask] = nextTasks.splice(sourceIndex, 1);
      const insertIndex = targetIndex;
      nextTasks.splice(insertIndex, 0, movedTask);
      return nextTasks;
    });
    setSelectedDraftTaskId(sourceTaskId);
    setEditingDraftTaskId(sourceTaskId);
  }, []);
  // Keep this effect below reorderDraftTaskByDrop to avoid temporal-dead-zone access
  // when dependencies are evaluated during render.
  useEffect(() => {
    if (!draggingTaskId) return;
    const clearDrag = () => {
      if (hoverDropTaskId && hoverDropTaskId !== draggingTaskId) {
        reorderDraftTaskByDrop(draggingTaskId, hoverDropTaskId);
      }
      setDraggingTaskId(null);
      setHoverDropTaskId(null);
    };
    window.addEventListener("mouseup", clearDrag);
    return () => window.removeEventListener("mouseup", clearDrag);
  }, [draggingTaskId, hoverDropTaskId, reorderDraftTaskByDrop]);
  const moveSelectedEditorTask = useCallback((direction: "first" | "up" | "down" | "last") => {
    if (!editorItem || !selectedDraftTaskId) return;
    const nextTasks = [...editorItem.tasks];
    const taskIndex = nextTasks.findIndex((task) => task.id === selectedDraftTaskId);
    if (taskIndex === -1) return;
    const [task] = nextTasks.splice(taskIndex, 1);
    let targetIndex = taskIndex;
    if (direction === "first") targetIndex = 0;
    if (direction === "up") targetIndex = Math.max(0, taskIndex - 1);
    if (direction === "down") targetIndex = Math.min(nextTasks.length, taskIndex + 1);
    if (direction === "last") targetIndex = nextTasks.length;
    nextTasks.splice(targetIndex, 0, task);
    updateEditorTasks(nextTasks);
    setSelectedDraftTaskId(task.id);
    setEditingDraftTaskId(task.id);
  }, [editorItem, selectedDraftTaskId, updateEditorTasks]);
  const deleteSelectedEditorTask = useCallback(() => {
    if (!editorItem || !selectedDraftTaskId) return;
    updateEditorTasks(editorItem.tasks.filter((task) => task.id !== selectedDraftTaskId));
  }, [editorItem, selectedDraftTaskId, updateEditorTasks]);
  const canvasXY = (ex: number, ey: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: snap ? sg(ex - r.left, gridSize) : ex - r.left,
      y: snap ? sg(ey - r.top, gridSize)  : ey - r.top,
    };
  };
  const canvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    setCtxMenu(null);
    if (tool === "button" || tool === "label") {
      const { x, y } = canvasXY(e.clientX, e.clientY);
      const nd: NewItemDrag = { type: tool as "button"|"label", sx:x, sy:y, cx:x, cy:y };
      newDragRef.current = nd;
      setNewDrag({ ...nd });
    } else {
      setSelId(null);
      closeEditorWindow();
    }
  };
  const canvasRClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCtxMenu({
      sx: e.clientX - rect.left,
      sy: e.clientY - rect.top,
    });
  };
  const previewRect = useMemo(() => {
    if (!newDrag) return null;
    const x = Math.min(newDrag.sx, newDrag.cx);
    const y = Math.min(newDrag.sy, newDrag.cy);
    const w = Math.abs(newDrag.cx - newDrag.sx);
    const h = Math.abs(newDrag.cy - newDrag.sy);
    const sw = snap ? sg(Math.max(w, 1), gridSize) : Math.max(w, 1);
    const sh = snap ? sg(Math.max(h, 1), gridSize) : Math.max(h, 1);
    return { x, y, w: Math.max(w, 1), h: Math.max(h, 1), sw, sh };
  }, [gridSize, newDrag, snap]);
  // ── Non-edit view ─────────────────────────────────────────────────────────
  if (!editMode) {
    return (
      <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden page-pop" style={{ backgroundColor: t.bgOuter }}>
        {items.map(item => {
          const sharedStyle = {
            left: item.x,
            top: item.y,
            width: item.w,
            height: item.h,
            backgroundColor: item.bgColor || (item.type === "button" ? "#101828" : "transparent"),
            border: item.borderColor ? `1px solid ${item.borderColor}` : "none",
            color: item.fgColor || "#F9FAFB",
            fontSize: item.fontSize,
            textAlign: item.textAlign,
            boxSizing: "border-box" as const,
          };
          if (item.type === "button") {
            const isRunning = executingButtonId === item.id;
            const isTallied = tallyButtonId === item.id;
            const enabledTaskCount = item.tasks.filter(isTaskEnabled).length;
            const hasRunnableTasks = enabledTaskCount > 0;
            const hasConnectionIssue = buttonHasConnectionIssue(item);
            return (
              <button
                key={item.id}
                className="absolute flex items-center justify-center overflow-hidden transition-opacity"
                style={{
                  ...sharedStyle,
                  backgroundColor: isRunning
                    ? "#7f1d1d"
                    : (isTallied ? "#5d1212" : (item.bgColor || "#101828")),
                  border: isRunning
                    ? "1px solid rgba(248,113,113,0.95)"
                    : (isTallied
                        ? "1px solid rgba(141,33,33,0.88)"
                        : (item.borderColor ? `1px solid ${item.borderColor}` : "none")),
                  boxShadow: isRunning
                    ? "0 0 0 1px rgba(239,68,68,0.4), 0 0 18px rgba(185,28,28,0.35)"
                    : (isTallied
                        ? "0 0 0 1px rgba(141,33,33,0.36), 0 0 18px rgba(93,18,18,0.3)"
                        : "none"),
                  cursor: hasRunnableTasks ? "pointer" : "default",
                  opacity: isRunning ? 0.7 : 1,
                }}
                disabled={isRunning}
                onClick={() => void runDashboardButton(item)}
              >
                {hasConnectionIssue ? (
                  <>
                    <span
                      className="pointer-events-none absolute top-[2px] right-[2px]"
                      style={{
                        width: 10,
                        height: 9,
                        backgroundColor: "#ef4444",
                        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                        filter: "drop-shadow(0 0 1px rgba(11,18,32,0.95))",
                      }}
                    />
                    <span
                      className="pointer-events-none absolute top-[2px] right-[2px]"
                      style={{
                        transform: "translate(0px, 2px)",
                        width: 10,
                        textAlign: "center",
                        color: "#0b1220",
                        fontSize: 6,
                        fontWeight: 800,
                        lineHeight: 1,
                      }}
                    >
                      !
                    </span>
                  </>
                ) : null}
                <span className="px-2 truncate w-full text-center pointer-events-none"
                  style={{ fontSize: item.fontSize }}>{item.label}</span>
              </button>
            );
          }
          return (
            <div key={item.id}
              className="absolute flex items-center justify-center overflow-hidden"
              style={sharedStyle}
            >
              <span className="px-2 truncate w-full text-center pointer-events-none"
                style={{ fontSize: item.fontSize }}>{item.label}</span>
            </div>
          );
        })}
      </div>
    );
  }
  // ── Drag preview ──────────────────────────────────────────────────────────
  const showTaskWorkspace = panelOpen && editorItem && addTaskOpen;
  const showFloatingCreate = panelOpen && editorItem && editorMode === "create" && !addTaskOpen;
  const showFullscreenEditor =
    panelOpen
    && editorItem
    && editorItem.type === "label"
    && editorMode === "edit"
    && !addTaskOpen;
  const workspaceTasks = addTaskOpen ? taskDraft : (editorItem?.tasks ?? []);
  const workspaceSplitHostWidth = workspaceSplitHostRef.current?.clientWidth ?? workspaceWindowSize.width;
  const workspaceContentWidth = Math.max(1, workspaceSplitHostWidth - WORKSPACE_SPLITTER_WIDTH);
  const workspaceLeftPaneWidth = Math.round(workspaceContentWidth * 0.4);
  const workspaceRightPaneWidth = Math.max(1, workspaceContentWidth - workspaceLeftPaneWidth);
  const sequencePreviewScale = editorItem
    ? Math.min(
        1,
        118 / Math.max(editorItem.w, 1),
        38 / Math.max(editorItem.h, 1),
      )
    : 1;
  const dashboardSaveLabel =
    dashboardSaveStatus === "saving"
      ? "Saving..."
      : dashboardSaveStatus === "saved"
        ? "Saved"
        : dashboardSaveStatus === "error"
          ? "Save failed"
          : "";
  const dashboardSaveColor =
    dashboardSaveStatus === "saved"
      ? "#86efac"
      : dashboardSaveStatus === "error"
        ? "#fca5a5"
        : "#94a3b8";
  // ── Edit mode render ──────────────────────────────────────────────────────
  return (
    <div
      className="relative flex flex-1 min-h-0 flex-col overflow-hidden page-pop"
      style={{
        backgroundColor: t.bgOuter,
        fontFamily: "'JetBrains Mono', monospace",
      }}
      onClick={() => setCtxMenu(null)}
    >
      {topBarSlot && (editMode || Boolean(dashboardSaveLabel))
        ? createPortal(
            <div className="flex min-w-0 items-center justify-center overflow-hidden gap-[10px]">
              {editMode ? (
                <div className="flex min-w-0 items-center overflow-hidden">
                  {TOOLS.map(tb => {
                    const active = tool === tb.id;
                    return (
                      <button key={tb.id} className="flex items-center border"
                        style={{
                          width:104, height:DASHBOARD_BUTTON_HEIGHT, paddingLeft:9, gap:6,
                          backgroundColor: active ? "#1a2231" : "#101828",
                          borderColor: active ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
                          color: "#f9fafb",
                        }}
                        onClick={() => setTool(tb.id)}>
                        <Icon d={tb.icon} size={14}/>
                        <span style={{ fontSize:11, lineHeight:1, color:"#f9fafb" }}>{tb.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {dashboardSaveLabel ? (
                <div
                  style={{
                    minWidth: 92,
                    height: 24,
                    borderRadius: 999,
                    border: `1px solid ${dashboardSaveColor}`,
                    backgroundColor: "rgba(15,23,42,0.85)",
                    color: dashboardSaveColor,
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 10px",
                  }}
                >
                  {dashboardSaveLabel}
                </div>
              ) : null}
            </div>,
            topBarSlot,
          )
        : null}
      <div className="flex flex-1 overflow-hidden">
        {/* Content */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ backgroundColor: t.bgContent }}>
          {/* ── BODY ───────────────────────────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden">
            {/* ── CANVAS ─────────────────────────────────────────────────── */}
            <div ref={canvasRef}
              className="flex-1 relative overflow-hidden"
              style={{
                backgroundColor: t.bgOuter,
                cursor: (tool==="button"||tool==="label") ? "crosshair" : "default",
              }}
              onMouseDown={canvasMouseDown}
              onContextMenu={canvasRClick}>
              {/* Grid */}
              <svg className="absolute inset-0 pointer-events-none" style={{ width:"100%", height:"100%" }}>
                <defs>
                  <pattern id={`${patternId}mn`} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                    <line x1={gridSize} y1="0" x2={gridSize} y2={gridSize} stroke={gridMinor} strokeWidth="0.75"/>
                    <line x1="0" y1={gridSize} x2={gridSize} y2={gridSize} stroke={gridMinor} strokeWidth="0.75"/>
                  </pattern>
                  <pattern id={`${patternId}mj`} width={gridMajorSize} height={gridMajorSize} patternUnits="userSpaceOnUse">
                    <rect width={gridMajorSize} height={gridMajorSize} fill={`url(#${patternId}mn)`}/>
                    <line x1={gridMajorSize} y1="0" x2={gridMajorSize} y2={gridMajorSize} stroke={gridMajor} strokeWidth="0.75"/>
                    <line x1="0" y1={gridMajorSize} x2={gridMajorSize} y2={gridMajorSize} stroke={gridMajor} strokeWidth="0.75"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#${patternId}mj)`}/>
              </svg>
              {/* New-item drag preview */}
              {previewRect && (
                <div className="absolute pointer-events-none" style={{
                  left:previewRect.x, top:previewRect.y, width:previewRect.w, height:previewRect.h,
                  border:`1px dashed ${newDrag?.type==="label"?"rgba(255,255,255,0.5)":"#8E51FF"}`,
                  backgroundColor: newDrag?.type==="button"?"rgba(142,81,255,0.10)":"transparent",
                }}>
                  <div className="absolute" style={{
                    top: previewRect.h+6, left:0,
                    backgroundColor:"rgba(0,0,0,0.75)", color:"#f9fafb",
                    fontSize:11, padding:"2px 6px", whiteSpace:"nowrap",
                    border:"1px solid rgba(255,255,255,0.12)", pointerEvents:"none",
                  }}>
                    {previewRect.sw} × {previewRect.sh}
                  </div>
                </div>
              )}
              {/* Canvas items */}
              {items.map(item => {
                const isSel = selId === item.id;
                return (
                  <div key={item.id}
                    className="absolute flex items-center justify-center overflow-hidden"
                    style={{
                      left:item.x, top:item.y, width:item.w, height:item.h,
                      backgroundColor: item.bgColor||(item.type==="button"?"#101828":"transparent"),
                      border: item.borderColor?`1px solid ${item.borderColor}`:"none",
                      color: item.fgColor||"#f9fafb",
                      fontSize: item.fontSize, textAlign: item.textAlign,
                      cursor: tool==="move"?"move":tool==="select"?"pointer":"default",
                      outline: isSel&&item.type==="button"?"1.5px solid #8E51FF":"none",
                      outlineOffset:2, boxSizing:"border-box", userSelect:"none",
                    }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      setSelId(item.id); setCtxMenu(null);
                      if (tool==="select"||tool==="move") {
                        dragRef.current = { kind:"move", id:item.id,
                          mx0:e.clientX, my0:e.clientY, x0:item.x, y0:item.y };
                      }
                    }}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      if (tool==="select") {
                        openEditorWindow(
                          item,
                          item.type === "button"
                            ? { tab: "attributes", mode: "edit", addTask: true }
                            : { tab: "attributes", mode: "edit" },
                        );
                      }
                    }}
                  >
                    <span className="px-2 truncate w-full text-center pointer-events-none"
                      style={{ fontSize:item.fontSize }}>{item.label}</span>
                    {isSel && tool==="resize" && HANDLES.map(h => {
                      const pos = hPos(h, item.w, item.h);
                      return (
                        <div key={h} className="absolute z-10" style={{
                          width:8, height:8, left:pos.left, top:pos.top,
                          backgroundColor:"white", border:"1px solid #1e2939",
                          cursor:CURSORS[h],
                        }}
                          onMouseDown={e => {
                            e.stopPropagation(); e.preventDefault();
                            dragRef.current = { kind:"resize", id:item.id, handle:h,
                              mx0:e.clientX, my0:e.clientY, x0:item.x, y0:item.y, w0:item.w, h0:item.h };
                          }}/>
                      );
                    })}
                  </div>
                );
              })}
              {/* Context menu */}
              {ctxMenu && (
                <CtxMenu
                  sx={ctxMenu.sx} sy={ctxMenu.sy} snap={snap}
                  onAddButton={() => {
                    const x = snap ? sg(ctxMenu.sx, gridSize) : ctxMenu.sx;
                    const y = snap ? sg(ctxMenu.sy, gridSize) : ctxMenu.sy;
                    finishCreate("button", x, y, 136, 50);
                  }}
                  onAddLabel={() => {
                    const x = snap ? sg(ctxMenu.sx, gridSize) : ctxMenu.sx;
                    const y = snap ? sg(ctxMenu.sy, gridSize) : ctxMenu.sy;
                    finishCreate("label", x, y, 120, 28);
                  }}
                  onDuplicateSelected={() => {
                    if (!selId) return;
                    duplicateCanvasItemById(selId);
                    setCtxMenu(null);
                  }}
                  onDeleteSelected={() => {
                    if (!selId) return;
                    deleteCanvasItemById(selId);
                    setCtxMenu(null);
                  }}
                  hasSelection={Boolean(selId)}
                  onToggleSnap={() => { setSnap(v=>!v); setCtxMenu(null); }}
                />
              )}
              {showTaskWorkspace && editorItem && (
                <motion.div
                  className="absolute top-0 right-0 bottom-0 z-[80] flex flex-col overflow-hidden border-l"
                  style={{
                    width: "30%",
                    minWidth: 320,
                    backgroundColor: P.surface900,
                    borderColor: P.surface600,
                    boxShadow: "-8px 0 40px rgba(0,0,0,0.45)",
                  }}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22 * animationDurationScale, ease: [0.16, 1, 0.3, 1] }}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                    <div
                      className="shrink-0 flex items-center border-b"
                      style={{
                        height: 44,
                        paddingLeft: 18,
                        paddingRight: 10,
                        borderColor: P.surface600,
                        backgroundColor: P.surface800,
                        color: P.text50,
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 600 }}>
                        Edit Task
                      </span>
                      <button
                        className="ml-auto flex items-center justify-center transition-colors hover:bg-red-500/20"
                        style={{ width: 28, height: 28, color: "#f9fafb" }}
                        onClick={closeEditorWindow}
                        title="Close task editor"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div
                      className="shrink-0 border-b px-[16px] py-[14px]"
                      style={{ borderColor: P.surface600, backgroundColor: P.surface800 }}
                    >
                      <div className="grid grid-cols-[minmax(0,1.8fr)_72px_72px_120px] gap-[14px]">
                        <div className="flex min-w-0 flex-col gap-[6px]">
                          <span style={{ fontSize: 12, color: "#f9fafb" }}>Name</span>
                          <input
                            className="w-full outline-none border px-3"
                            style={{
                              height: DASHBOARD_BUTTON_HEIGHT,
                              backgroundColor: P.ink950,
                              borderColor: P.surface600,
                              color: P.text50,
                              fontSize: 12,
                            }}
                            value={editorItem.label}
                            onChange={e => upd({ label: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-[6px]">
                          <span style={{ fontSize: 12, color: "#f9fafb" }}>BG</span>
                          <label
                            className="flex items-center justify-center border cursor-pointer"
                            style={{
                              height: DASHBOARD_BUTTON_HEIGHT,
                              backgroundColor: P.ink950,
                              borderColor: P.surface600,
                            }}
                          >
                            <input
                              type="color"
                              className="h-0 w-0 opacity-0"
                              value={editorItem.bgColor || "#101828"}
                              onChange={e => upd({ bgColor: e.target.value })}
                            />
                            <span
                              style={{
                                width: 26,
                                height: 26,
                                border: "1px solid #4b5563",
                                backgroundColor: editorItem.bgColor || "#101828",
                              }}
                            />
                          </label>
                        </div>
                        <div className="flex flex-col gap-[6px]">
                          <span style={{ fontSize: 12, color: "#f9fafb" }}>FG</span>
                          <label
                            className="flex items-center justify-center border cursor-pointer"
                            style={{
                              height: DASHBOARD_BUTTON_HEIGHT,
                              backgroundColor: P.ink950,
                              borderColor: P.surface600,
                            }}
                          >
                            <input
                              type="color"
                              className="h-0 w-0 opacity-0"
                              value={editorItem.fgColor || "#f9fafb"}
                              onChange={e => upd({ fgColor: e.target.value })}
                            />
                            <span
                              style={{
                                width: 26,
                                height: 26,
                                border: "1px solid #4b5563",
                                backgroundColor: editorItem.fgColor || "#f9fafb",
                              }}
                            />
                          </label>
                        </div>
                        <div className="flex flex-col gap-[6px]">
                          <span style={{ fontSize: 12, color: "#f9fafb" }}>Text(px)</span>
                          <input
                            className="w-full outline-none border px-3"
                            type="number"
                            min={1}
                            step={1}
                            style={{
                              height: DASHBOARD_BUTTON_HEIGHT,
                              backgroundColor: P.ink950,
                              borderColor: P.surface600,
                              color: P.text50,
                              fontSize: 12,
                            }}
                            value={String(editorItem.fontSize)}
                            onChange={e => {
                              const next = Number.parseFloat(e.target.value);
                              if (Number.isFinite(next) && next > 0) {
                                upd({ fontSize: next });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      ref={workspaceSplitHostRef}
                      className="flex min-h-0 flex-1 overflow-hidden"
                    >
                      <aside
                        className="flex min-h-0 min-w-0 shrink-0 flex-col border-r"
                        style={{
                          flex: `0 0 ${workspaceLeftPaneWidth}px`,
                          borderColor: P.surface600,
                          backgroundColor: P.surface900,
                        }}
                      >
                        <div className="flex min-h-0 flex-1 flex-col" style={{ borderColor: "#32353e" }}>
                          <div
                            className="shrink-0 flex items-center justify-center border-b"
                            style={{
                              height: 30,
                              backgroundColor: P.surface700,
                              borderColor: P.surface600,
                              fontSize: 14,
                              color: P.text50,
                            }}
                          >
                            Tasks List
                          </div>
                          <div className="flex-1 overflow-y-auto app-scrollbar px-4 pb-4">
                            {workspaceTasks.length === 0 ? (
                              <div
                                className="flex flex-col items-center justify-center gap-[8px] py-10 text-center"
                                style={{ color: P.muted500 }}
                              >
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="4" width="18" height="4" rx="1"/>
                                  <rect x="3" y="10" width="18" height="4" rx="1"/>
                                  <rect x="3" y="16" width="12" height="4" rx="1"/>
                                </svg>
                                <span style={{ fontSize: 12, color: P.muted500 }}>No tasks yet</span>
                                <span style={{ fontSize: 11, maxWidth: 148, lineHeight: 1.5 }}>
                                  Configure a task on the right, then click <strong style={{ color: "#c4b5fd" }}>Add</strong>
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-[8px]">
                                {workspaceTasks.map((task, taskIndex) => {
                                  const isSelected = selectedDraftTaskId === task.id;
                                  const isEnabled = isTaskEnabled(task);
                                  const isDragged = draggingTaskId === task.id;
                                  const isDropTarget = Boolean(draggingTaskId) && !isDragged && hoverDropTaskId === task.id;
                                  const resolvedConnection = resolveConnectionForTask(task, connections);
                                  const accentColor = isWaitTask(task)
                                    ? "#6b7280"
                                    : (resolvedConnection
                                        ? connectionDeviceColor(resolvedConnection.device)
                                        : "#334155");
                                  return (
                                  <div
                                    key={task.id}
                                    className="py-2 cursor-pointer transition-colors overflow-hidden"
                                    style={{
                                      paddingLeft: 10,
                                      paddingRight: 12,
                                      backgroundColor: P.surface900,
                                      borderLeft: `3px solid ${accentColor}`,
                                      boxShadow: isDropTarget
                                        ? "inset 0 0 0 1px rgba(142,81,255,0.95), 0 0 0 1px rgba(142,81,255,0.35)"
                                        : (isSelected ? "inset 0 0 0 1px rgba(142,81,255,0.55)" : "none"),
                                      opacity: isDragged
                                        ? 0.72
                                        : (isEnabled ? (isSelected ? 0.95 : 0.84) : 0.52),
                                      transform: isDragged ? "scale(1.01)" : "none",
                                      transition: "box-shadow 120ms ease, opacity 120ms ease, transform 120ms ease",
                                    }}
                                    onMouseEnter={() => {
                                      if (!draggingTaskId || draggingTaskId === task.id) return;
                                      setHoverDropTaskId(task.id);
                                    }}
                                    onMouseLeave={() => {
                                      if (hoverDropTaskId === task.id) {
                                        setHoverDropTaskId(null);
                                      }
                                    }}
                                    onMouseUp={(e) => {
                                      if (!draggingTaskId || draggingTaskId === task.id) return;
                                      e.stopPropagation();
                                      reorderDraftTaskByDrop(draggingTaskId, task.id);
                                      setDraggingTaskId(null);
                                      setHoverDropTaskId(null);
                                    }}
                                    onClick={() => {
                                      if (draggingTaskId) return;
                                      setSelectedDraftTaskId(task.id);
                                      setEditingDraftTaskId(task.id);
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="shrink-0 tabular-nums"
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 600,
                                          width: 18,
                                          textAlign: "right",
                                          color: isEnabled ? accentColor : "#475569",
                                          opacity: 0.85,
                                        }}
                                      >
                                        {String(taskIndex + 1).padStart(2, "0")}
                                      </span>
                                      <span
                                        className="shrink-0"
                                        style={{ color: isEnabled ? "#94a3b8" : "#64748b", cursor: isDragged ? "grabbing" : "grab" }}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setDraggingTaskId(task.id);
                                          setHoverDropTaskId(null);
                                        }}
                                        title="Drag to reorder task"
                                      >
                                        <Menu size={14} />
                                      </span>
                                      <div
                                        style={{ fontSize: 12, color: isEnabled ? (isSelected ? "#f8fafc" : "#cbd5e1") : "#94a3b8" }}
                                        className="min-w-0 flex-1 truncate"
                                      >
                                        {taskLabel(task, resolvedConnection)}{!isEnabled ? " [Excluded]" : ""}
                                      </div>
                                      <button
                                        className="shrink-0 flex items-center justify-center transition-colors text-[#9ca3af] hover:text-[#e9d5ff] active:text-[#8E51FF]"
                                        data-haptic="off"
                                        style={{
                                          width: 20,
                                          height: 20,
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTaskDraft((prevTasks) => {
                                            const sourceIndex = prevTasks.findIndex((entry) => entry.id === task.id);
                                            if (sourceIndex === -1) return prevTasks;
                                            const duplicate = { ...prevTasks[sourceIndex], id: createEntityId("task") };
                                            const nextTasks = [...prevTasks];
                                            nextTasks.splice(sourceIndex + 1, 0, duplicate);
                                            setSelectedDraftTaskId(duplicate.id);
                                            setEditingDraftTaskId(duplicate.id);
                                            return nextTasks;
                                          });
                                        }}
                                        title="Duplicate task"
                                      >
                                        <Copy size={14} />
                                      </button>
                                      <button
                                        className="shrink-0 flex items-center justify-center transition-colors text-[#9ca3af] hover:text-[#fb7185] active:text-[#ef4444]"
                                        data-haptic="off"
                                        style={{
                                          width: 20,
                                          height: 20,
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTaskDraft((prevTasks) => {
                                            const removeIndex = prevTasks.findIndex((entry) => entry.id === task.id);
                                            if (removeIndex === -1) return prevTasks;
                                            const nextTasks = prevTasks.filter((entry) => entry.id !== task.id);
                                            const nextSelected =
                                              nextTasks[removeIndex]
                                              ?? nextTasks[Math.max(0, removeIndex - 1)]
                                              ?? null;
                                            setSelectedDraftTaskId(nextSelected?.id ?? null);
                                            setEditingDraftTaskId((prevEditingId) => (
                                              prevEditingId === task.id
                                                ? (nextSelected?.id ?? null)
                                                : prevEditingId
                                            ));
                                            return nextTasks;
                                          });
                                        }}
                                        title="Delete task"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                      <button
                                        className="shrink-0 flex items-center justify-center transition-colors text-[#9ca3af] hover:text-[#e9d5ff] active:text-[#8E51FF]"
                                        data-haptic="off"
                                        style={{
                                          width: 20,
                                          height: 20,
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTaskDraft((prevTasks) => prevTasks.map((entry) => (
                                            entry.id === task.id ? { ...entry, enabled: !isTaskEnabled(entry) } : entry
                                          )));
                                          setSelectedDraftTaskId(task.id);
                                        }}
                                        title={isEnabled ? "Exclude this task" : "Include this task"}
                                      >
                                        {isEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
                                      </button>
                                    </div>
                                    {task.pause ? (
                                      <div style={{ marginTop: 4, fontSize: 10, color: isSelected ? "#cbd5e1" : "#9ca3af" }}>
                                        Pause: {task.pause}ms
                                      </div>
                                    ) : null}
                                  </div>
                                );
                                })}
                              </div>
                            )}
                          </div>
                          {workspaceTaskActions ? (
                            <div
                              className="shrink-0 border-t px-4 py-[12px]"
                              style={{ borderColor: P.surface600, backgroundColor: P.surface900 }}
                            >
                              <button
                                className="w-full flex items-center justify-center transition-colors"
                                data-haptic="strong"
                                style={{
                                  height: 32,
                                  backgroundColor: workspaceTaskActions.canTest ? P.surface800 : P.surface700,
                                  border: `1px solid ${workspaceTaskActions.canTest ? P.surface600 : "transparent"}`,
                                  fontSize: 12,
                                  color: workspaceTaskActions.canTest ? P.text50 : P.muted500,
                                  cursor: workspaceTaskActions.testing
                                    ? "wait"
                                    : (workspaceTaskActions.canTest ? "pointer" : "not-allowed"),
                                  opacity: workspaceTaskActions.testing ? 0.7 : 1,
                                }}
                                onClick={workspaceTaskActions.test}
                                disabled={!workspaceTaskActions.canTest || workspaceTaskActions.testing}
                                title="Send this task now without saving"
                              >
                                {workspaceTaskActions.testing ? "Testing..." : "Test Action"}
                              </button>
                              {workspaceTaskActions.testMessage ? (
                                <div
                                  className="mt-[6px] text-[11px]"
                                  style={{
                                    color: workspaceTaskActions.testMessage.toLowerCase().includes("fail")
                                      ? "#f87171"
                                      : P.muted500,
                                  }}
                                >
                                  {workspaceTaskActions.testMessage}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </aside>
                      <div className="relative min-w-0" style={{ flex: `1 1 ${workspaceRightPaneWidth}px` }}>
                        <AddTaskPanel
                          variant="workspace"
                          title="Edit Task"
                          tasks={workspaceTasks}
                          connections={connections}
                          onDraftChange={setTaskDraft}
                          selectedTaskId={editingDraftTaskId}
                          selectedTask={workspaceTasks.find((task) => task.id === editingDraftTaskId) ?? null}
                          onSelectionChange={(nextTaskId) => {
                            setSelectedDraftTaskId(nextTaskId);
                            setEditingDraftTaskId(nextTaskId);
                          }}
                          onClose={closeEditorWindow}
                          showWorkspaceTaskActions
                          onWorkspaceActionsChange={setWorkspaceTaskActions}
                          onSave={newTasks => {
                            upd({ tasks: newTasks });
                            setTaskDraft(newTasks);
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
              )}
              {showFloatingCreate && editorItem && (
                <div
                  className="absolute z-20 flex flex-col overflow-hidden card-pop"
                  style={{
                    left: editorRect.x,
                    top: editorRect.y,
                    width: editorRect.width,
                    height: editorRect.height,
                    backgroundColor: t.bgContent,
                    border: "1px solid #3c4350",
                    boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
                  }}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <div
                    className="shrink-0 flex items-center border-b select-none cursor-move"
                    style={{
                      height: 34,
                      paddingLeft: 12,
                      paddingRight: 8,
                      backgroundColor: "#151d2c",
                      borderColor: "#3c4350",
                      color: "#f9fafb",
                    }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      editorDragRef.current = {
                        mx0: e.clientX,
                        my0: e.clientY,
                        x0: editorRect.x,
                        y0: editorRect.y,
                      };
                    }}
                  >
                    <div className="flex items-center gap-[8px] min-w-0">
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 18,
                          height: 18,
                          backgroundColor: "#101828",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <Icon d={editorItem.type === "button" ? IC.button : IC.label} size={12} />
                      </div>
                      <span className="truncate" style={{ fontSize: 12 }}>
                        {editorItem.type === "button"
                          ? (editorMode === "create" ? "Insert Button Component" : "Add Task Component")
                          : "Edit Label Component"}
                      </span>
                      {editorMode === "create" ? (
                        <span
                          className="shrink-0"
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            border: "1px solid rgba(134,239,172,0.55)",
                            color: "#86efac",
                          }}
                        >
                          Unsaved
                        </span>
                      ) : null}
                    </div>
                    <button
                      className="ml-auto flex items-center justify-center hover:opacity-70"
                      style={{ width: 24, height: 24, color: "#f9fafb" }}
                      onClick={closeEditorWindow}
                      title="Close editor"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="relative flex flex-1 min-h-0 overflow-hidden">
                    {addTaskOpen && (
                      <div
                        className="absolute inset-0 z-10 flex items-center justify-center"
                        style={{ backgroundColor: "rgba(3, 7, 18, 0.72)", padding: 24 }}
                        onMouseDown={e => e.stopPropagation()}
                      >
                        <div
                          className="relative overflow-hidden card-pop"
                          style={{
                            width: "min(1120px, 100%)",
                            height: "min(760px, 100%)",
                            backgroundColor: t.bgContent,
                            border: "1px solid #3c4350",
                            boxShadow: "0 22px 48px rgba(0,0,0,0.45)",
                          }}
                        >
                          <AddTaskPanel
                            tasks={editorItem.tasks}
                            connections={connections}
                            onClose={() => setAddTaskOpen(false)}
                            onSave={newTasks => {
                              upd({ tasks: newTasks });
                              setAddTaskOpen(false);
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                      <div className="flex shrink-0 border-b" style={{ borderColor: "#3c4350" }}>
                        {(["attributes", "style"] as RightTab[]).map(tab => (
                          <button
                            key={tab}
                            className="flex-1 flex items-center justify-center border-r transition-colors"
                            style={{
                              height: DASHBOARD_BUTTON_HEIGHT,
                              backgroundColor: rightTab === tab ? "#1e2939" : "#1a2231",
                              borderColor: "#3c4350",
                              color: "#f9fafb",
                              fontSize: 12,
                            }}
                            onClick={() => setRightTab(tab)}
                          >
                            {tab === "attributes" ? "General Attributes" : "Style"}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar">
                        <AnimatePresence mode="wait" initial={false}>
                          {rightTab === "attributes" ? (
                            <motion.div
                              key="attributes"
                              className="flex flex-col p-[14px] gap-[12px] min-h-full tab-pop"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.22 * animationDurationScale, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <EditorField
                                label={editorItem.type === "label" ? "Text" : "Name"}
                                value={editorItem.label}
                                onChange={(nextValue) => upd({ label: nextValue })}
                                t={t}
                              />
                              {editorItem.type === "button" && (
                                <div className="flex flex-1 min-h-[220px] flex-col">
                                  <div
                                    className="flex items-center justify-center border"
                                    style={{
                                      minHeight: 28,
                                      fontSize: 13,
                                      color: t.textPrimary,
                                      borderColor: "#3c4350",
                                      backgroundColor: "#1a2231",
                                    }}
                                  >
                                    Tasks
                                  </div>
                                  <div
                                    className="flex flex-1 min-h-0 flex-col border border-t-0"
                                    style={{ borderColor: "#3c4350", backgroundColor: "#0b1220" }}
                                  >
                                    {editorItem.tasks.length === 0 ? (
                                      <div
                                        className="flex flex-1 items-center justify-center px-6 text-center"
                                        style={{ fontSize: 11, color: "#6b7280" }}
                                      >
                                        No tasks yet.
                                      </div>
                                    ) : (
                                      editorItem.tasks.map((task, i, arr) => {
                                        const resolvedConnection = resolveConnectionForTask(task, connections);
                                        const lbl = taskLabel(task, resolvedConnection);
                                        return (
                                          <div
                                            key={task.id}
                                            className="flex items-center"
                                            style={{
                                              minHeight: 36,
                                              borderBottom: i === arr.length - 1 ? "none" : "1px solid rgba(60,67,80,0.24)",
                                              paddingLeft: 10,
                                              paddingRight: 6,
                                              gap: 6,
                                            }}
                                          >
                                            <span className="flex-1 truncate" style={{ fontSize: 12, color: "#f9fafb" }}>
                                              {lbl}
                                            </span>
                                            {task.pause && (
                                              <span className="shrink-0" style={{ fontSize: 10, color: "#6b7280" }}>
                                                {task.pause}ms
                                              </span>
                                            )}
                                            <button
                                              className="shrink-0 flex items-center justify-center hover:opacity-70"
                                              data-haptic="off"
                                              style={{
                                                width: DASHBOARD_ICON_BUTTON_SIZE,
                                                height: DASHBOARD_ICON_BUTTON_SIZE,
                                                backgroundColor: "#101828",
                                                color: "#f9fafb",
                                                opacity: i === 0 ? 0.3 : 1,
                                                cursor: i === 0 ? "not-allowed" : "pointer",
                                              }}
                                              disabled={i === 0}
                                              onClick={() => {
                                                const ts = [...editorItem.tasks];
                                                [ts[i - 1], ts[i]] = [ts[i], ts[i - 1]];
                                                upd({ tasks: ts });
                                              }}
                                              title="Move task up"
                                            >
                                              <ArrowUp size={12} />
                                            </button>
                                            <button
                                              className="shrink-0 flex items-center justify-center hover:opacity-70"
                                              data-haptic="off"
                                              style={{
                                                width: DASHBOARD_ICON_BUTTON_SIZE,
                                                height: DASHBOARD_ICON_BUTTON_SIZE,
                                                backgroundColor: "#101828",
                                                color: "#f9fafb",
                                                opacity: i === arr.length - 1 ? 0.3 : 1,
                                                cursor: i === arr.length - 1 ? "not-allowed" : "pointer",
                                              }}
                                              disabled={i === arr.length - 1}
                                              onClick={() => {
                                                const ts = [...editorItem.tasks];
                                                [ts[i], ts[i + 1]] = [ts[i + 1], ts[i]];
                                                upd({ tasks: ts });
                                              }}
                                              title="Move task down"
                                            >
                                              <ArrowDown size={12} />
                                            </button>
                                            <button
                                              className="shrink-0 flex items-center justify-center hover:opacity-70"
                                              data-haptic="off"
                                              style={{
                                                width: DASHBOARD_ICON_BUTTON_SIZE,
                                                height: DASHBOARD_ICON_BUTTON_SIZE,
                                                backgroundColor: "#101828",
                                                color: "#f9fafb",
                                              }}
                                              onClick={() => {
                                                const ts = [...editorItem.tasks];
                                                ts.splice(i + 1, 0, { ...ts[i], id: createEntityId("task") });
                                                upd({ tasks: ts });
                                              }}
                                              title="Duplicate task"
                                            >
                                              <Copy size={12} />
                                            </button>
                                            <button
                                              className="shrink-0 flex items-center justify-center hover:opacity-70"
                                              data-haptic="off"
                                              style={{
                                                width: DASHBOARD_ICON_BUTTON_SIZE,
                                                height: DASHBOARD_ICON_BUTTON_SIZE,
                                                backgroundColor: "#101828",
                                                color: "#e84141",
                                              }}
                                              onClick={() => upd({ tasks: editorItem.tasks.filter((_, index) => index !== i) })}
                                              title="Delete task"
                                            >
                                              <X size={10} />
                                            </button>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          ) : (
                            <motion.div
                              key="style"
                              className="flex flex-col py-[12px] tab-pop"
                              style={{ gap: 14 }}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.22 * animationDurationScale, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <SRow label="Background Color:" type="color"
                                value={editorItem.bgColor ?? ""} disabled={!editorItem}
                                onChange={v => upd({ bgColor: v })} onClear={() => upd({ bgColor: "" })} t={t} />
                              <SRow label="Border Color:" type="color"
                                value={editorItem.borderColor ?? ""} disabled={!editorItem}
                                onChange={v => upd({ borderColor: v })} onClear={() => upd({ borderColor: "" })} t={t} />
                              <SRow label="Font Size:" type="select"
                                value={String(editorItem.fontSize)} disabled={!editorItem}
                                options={["10", "11", "12", "13", "14", "16", "18", "20", "24", "28", "32"]}
                                onChange={v => upd({ fontSize: Number(v) })} onClear={() => upd({ fontSize: 14 })} t={t} />
                              <SRow label="Foreground Color:" type="color"
                                value={editorItem.fgColor ?? ""} disabled={!editorItem}
                                onChange={v => upd({ fgColor: v })} onClear={() => upd({ fgColor: "" })} t={t} />
                              <SRow label="Text Alignment:" type="select"
                                value={editorItem.textAlign ?? ""} disabled={!editorItem}
                                options={["left", "center", "right"]}
                                onChange={v => upd({ textAlign: v as TAlign })}
                                onClear={() => upd({ textAlign: "center" })} t={t} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    <div className="shrink-0 flex border-t" style={{ borderColor: "#3c4350" }}>
                        {editorMode === "create" ? (
                          <>
                            {editorItem.type !== "label" ? (
                              <ActionBtn
                                label="Add Task"
                                color={t.textPrimary}
                                accent
                                accentTone="soft"
                                disabled={!editorItem}
                                onClick={() => {
                                  setRightTab("attributes");
                                  setAddTaskOpen(true);
                                }}
                              />
                            ) : null}
                            <ActionBtn
                              label={editorItem.type === "label" ? "Save Label" : "Save Button"}
                              accent
                              accentTone="solid"
                              color="#86efac"
                              onClick={saveAndCloseEditorWindow}
                            />
                            <ActionBtn
                              label="Cancel"
                              color="#fca5a5"
                              onClick={deleteCurrentEditorItem}
                            />
                          </>
                        ) : (
                          <>
                            {editorItem.type !== "label" ? (
                              <ActionBtn
                                label="Add Task"
                                color={t.textPrimary}
                                accent
                                accentTone="soft"
                                disabled={!editorItem}
                                onClick={() => {
                                  setRightTab("attributes");
                                  setAddTaskOpen(true);
                                }}
                              />
                            ) : (
                              <ActionBtn
                                label="Apply Changes"
                                color={t.textPrimary}
                                accent
                                accentTone="solid"
                                onClick={applyDashboardChanges}
                              />
                            )}
                            <ActionBtn
                              label="Delete"
                              color="#e84141"
                              onClick={deleteCurrentEditorItem}
                            />
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      className="absolute flex items-center justify-center"
                      data-haptic="off"
                      style={{
                        right: 6,
                        bottom: 6,
                        width: 14,
                        height: 14,
                        border: "1px solid rgba(148,163,184,0.7)",
                        backgroundColor: "rgba(15,23,42,0.92)",
                        color: "#cbd5e1",
                        cursor: "nwse-resize",
                        fontSize: 10,
                        lineHeight: 1,
                      }}
                      onMouseDown={(event) => startWindowResize("editor", event)}
                      title="Resize window"
                    >
                      //
                    </button>
                  </div>
                </div>
              )}
              {showFullscreenEditor && editorItem && (
                <EditorPanel
                  item={editorItem}
                  onClose={closeEditorWindow}
                  onSaveAndClose={saveAndCloseEditorWindow}
                  onUpdate={upd}
                  onDelete={deleteCurrentEditorItem}
                  onOpenTaskWorkspace={openTaskWorkspace}
                  onMoveTask={moveSelectedEditorTask}
                  onDeleteTask={deleteSelectedEditorTask}
                  selectedTaskId={selectedDraftTaskId}
                  onSelectTask={setSelectedDraftTaskId}
                  t={t}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── Helper components ─────────────────────────────────────────────────────────
interface EditorFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  t: AppTheme;
}
function EditorField({ label, value, onChange, readOnly, t }: EditorFieldProps) {
  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <span style={{ fontSize: 12, color: t.textPrimary }}>{label}</span>
      <input
        className="w-full outline-none border px-3"
        style={{
          height: DASHBOARD_BUTTON_HEIGHT,
          backgroundColor: P.ink950,
          borderColor: P.surface600,
          color: t.textPrimary,
          fontSize: 12,
        }}
        value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        readOnly={readOnly}
      />
    </div>
  );
}
interface SRowProps {
  label: string;
  type: "color" | "select";
  value: string;
  disabled?: boolean;
  options?: string[];
  onChange: (value: string) => void;
  onClear: () => void;
  t: AppTheme;
}
function SRow({ label, type, value, disabled, options, onChange, onClear, t }: SRowProps) {
  return (
    <div className="flex items-center px-[14px]" style={{ gap: 12 }}>
      <span style={{ fontSize: 12, color: t.textPrimary, width: 120 }}>{label}</span>
      {type === "color" ? (
        <label
          className="flex items-center justify-center border cursor-pointer"
          style={{
            width: 48,
            height: DASHBOARD_BUTTON_HEIGHT,
            backgroundColor: P.ink950,
            borderColor: P.surface600,
          }}
        >
          <input
            type="color"
            className="h-0 w-0 opacity-0"
            value={value || "#000000"}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
          />
          <span
            style={{
              width: 26,
              height: 26,
              border: "1px solid #4b5563",
              backgroundColor: value || "#000000",
            }}
          />
        </label>
      ) : (
        <select
          className="flex-1 outline-none border px-2"
          style={{
            height: DASHBOARD_BUTTON_HEIGHT,
            backgroundColor: P.ink950,
            borderColor: P.surface600,
            color: t.textPrimary,
            fontSize: 12,
          }}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
        >
          {options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      <button
        className="shrink-0 flex items-center justify-center border hover:opacity-70"
        style={{
          width: 48,
          height: DASHBOARD_BUTTON_HEIGHT,
          backgroundColor: P.surface900,
          borderColor: P.surface600,
          color: "#e84141",
          fontSize: 11,
        }}
        onClick={onClear}
        disabled={disabled}
      >
        Clear
      </button>
    </div>
  );
}
interface ActionBtnProps {
  label: string;
  color: string;
  accent?: boolean;
  accentTone?: "solid" | "soft";
  disabled?: boolean;
  onClick: () => void;
}
function ActionBtn({ label, color, accent, accentTone = "solid", disabled, onClick }: ActionBtnProps) {
  return (
    <button
      className="flex-1 flex items-center justify-center border-r transition-opacity hover:opacity-70"
      style={{
        height: DASHBOARD_BUTTON_HEIGHT,
        backgroundColor: accent
          ? (accentTone === "soft" ? PURPLE_ACCENT_BG_SOFT : PURPLE_ACCENT_BG)
          : P.surface800,
        borderColor: accent ? PURPLE_ACCENT_BORDER : P.surface600,
        color: accent ? PURPLE_ACCENT_TEXT : color,
        fontSize: 12,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
interface CtxMenuProps {
  sx: number;
  sy: number;
  snap: boolean;
  onAddButton: () => void;
  onAddLabel: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  onToggleSnap: () => void;
}
function CtxMenu({
  sx, sy, snap, onAddButton, onAddLabel, onDuplicateSelected, onDeleteSelected, hasSelection, onToggleSnap
}: CtxMenuProps) {
  return (
    <div
      className="absolute z-50 flex flex-col overflow-hidden border"
      style={{
        left: sx,
        top: sy,
        backgroundColor: "#1a2231",
        borderColor: "#3c4350",
        boxShadow: "0 12px 32px rgba(0,0,0,0.38)",
        minWidth: 160,
      }}
      onClick={e => e.stopPropagation()}
    >
      <CtxBtn label="Add Button" onClick={onAddButton} />
      <CtxBtn label="Add Label" onClick={onAddLabel} />
      {hasSelection && (
        <>
          <div style={{ height: 1, backgroundColor: "#364153" }} />
          <div style={{ height: 1, backgroundColor: "#3c4350" }} />
          <CtxBtn label="Duplicate" onClick={onDuplicateSelected} />
          <CtxBtn label="Delete" onClick={onDeleteSelected} color="#e84141" />
        </>
      )}
      <div style={{ height: 1, backgroundColor: "#364153" }} />
      <div style={{ height: 1, backgroundColor: "#3c4350" }} />
      <CtxBtn label={snap ? "Snap: ON" : "Snap: OFF"} onClick={onToggleSnap} />
    </div>
  );
}
interface CtxBtnProps {
  label: string;
  onClick: () => void;
  color?: string;
}
function CtxBtn({ label, onClick, color }: CtxBtnProps) {
  return (
    <button
      className="flex items-center px-3 hover:bg-opacity-70 transition-colors"
      style={{
        height: 32,
        backgroundColor: "transparent",
        color: color || "#f9fafb",
        fontSize: 12,
        textAlign: "left",
      }}
      onClick={onClick}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
    >
      {label}
    </button>
  );
}
interface EditorPanelProps {
  item: CanvasItem;
  onClose: () => void;
  onSaveAndClose: () => void;
  onUpdate: (patch: Partial<CanvasItem>) => void;
  onDelete: () => void;
  onOpenTaskWorkspace: (taskId?: string | null) => void;
  onMoveTask: (direction: "first" | "up" | "down" | "last") => void;
  onDeleteTask: () => void;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  t: AppTheme;
}
function EditorPanel({
  item, onClose, onSaveAndClose, onUpdate, onDelete, onOpenTaskWorkspace, onMoveTask, onDeleteTask,
  selectedTaskId, onSelectTask, t
}: EditorPanelProps) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center p-[18px]"
      style={{ backgroundColor: "rgba(3, 7, 18, 0.84)" }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <div
        className="relative flex min-h-0 flex-col overflow-hidden border"
        style={{
          width: "min(920px, calc(100vw - 36px))",
          height: "min(640px, calc(100vh - 36px))",
          maxWidth: "100%",
          maxHeight: "100%",
          backgroundColor: P.surface900,
          borderColor: P.surface600,
          boxShadow: "0 28px 70px rgba(0,0,0,0.42)",
        }}
      >
        <div
          className="shrink-0 flex items-center border-b"
          style={{
            height: 44,
            paddingLeft: 18,
            paddingRight: 10,
            borderColor: P.surface600,
            backgroundColor: P.surface800,
            color: P.text50,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {item.type === "button" ? "Button" : "Edit Label"}
          </span>
          <button
            className="ml-auto flex items-center justify-center transition-colors rounded hover:bg-red-500/20"
            style={{ width: 28, height: 28, color: "#f9fafb" }}
            onClick={onClose}
            title="Close editor"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-y-auto app-scrollbar p-6" style={{ gap: 16 }}>
            <EditorField label="Name" value={item.label} onChange={v => onUpdate({ label: v })} t={t} />
            
            {item.type === "button" && (
              <div className="flex flex-col" style={{ gap: 8 }}>
                <div style={{ fontSize: 12, color: t.textPrimary }}>Tasks ({item.tasks.length})</div>
                {item.tasks.length === 0 ? (
                  <div
                    className="flex items-center justify-center border text-center p-6"
                    style={{
                      borderColor: P.surface600,
                      color: P.muted500,
                      fontSize: 11,
                      backgroundColor: P.ink950,
                    }}
                  >
                    No tasks yet.
                  </div>
                ) : (
                  <div className="flex flex-col" style={{ gap: 4 }}>
                    {item.tasks.map((task, i) => (
                      <div
                        key={task.id}
                        className="flex items-center border px-3 cursor-pointer"
                        style={{
                          height: 40,
                          borderColor: P.surface600,
                          backgroundColor: P.ink950,
                        }}
                        onClick={() => onSelectTask(task.id)}
                      >
                        <span style={{ fontSize: 12, color: P.text50 }}>
                          {i + 1}. {taskLabel(task)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div
          className="shrink-0 flex items-center justify-between gap-[6px] border-t px-[12px] py-[8px]"
          style={{ borderColor: P.surface600, backgroundColor: P.surface900 }}
        >
          <button
            className="flex items-center justify-center rounded transition-colors hover:bg-[rgba(239,68,68,0.12)] active:bg-[rgba(239,68,68,0.2)] hover:shadow-[0_0_0_1px_#EF4444] focus-visible:shadow-[0_0_0_1px_#EF4444] active:shadow-[0_0_0_1px_#EF4444] focus-visible:outline-none"
            style={{
              height: DASHBOARD_BUTTON_HEIGHT,
              padding: "0 14px",
              backgroundColor: "#111B2E",
              border: "1px solid #324056",
              color: "#E5EAF3",
              fontSize: 12,
            }}
            onClick={onDelete}
          >
            {item.type === "button" ? "Delete" : "Delete Label"}
          </button>
          <div className="flex items-center gap-[6px]">
            {item.type === "button" ? (
              <button
                className="flex items-center justify-center rounded transition-colors hover:bg-[rgba(142,81,255,0.14)] active:bg-[rgba(142,81,255,0.2)] hover:shadow-[0_0_0_1px_#8E51FF] focus-visible:shadow-[0_0_0_1px_#8E51FF] active:shadow-[0_0_0_1px_#8E51FF] focus-visible:outline-none"
                style={{
                  height: DASHBOARD_BUTTON_HEIGHT,
                  padding: "0 14px",
                  backgroundColor: "#111B2E",
                  border: "1px solid #324056",
                  color: "#E5EAF3",
                  fontSize: 12,
                }}
                onClick={() => onOpenTaskWorkspace()}
              >
                Add Task
              </button>
            ) : null}
            <button
              className="flex items-center justify-center rounded transition-colors hover:bg-[rgba(142,81,255,0.14)] active:bg-[rgba(142,81,255,0.2)] hover:shadow-[0_0_0_1px_#8E51FF] focus-visible:shadow-[0_0_0_1px_#8E51FF] active:shadow-[0_0_0_1px_#8E51FF] focus-visible:outline-none"
              style={{
                height: DASHBOARD_BUTTON_HEIGHT,
                padding: "0 14px",
                backgroundColor: "#111B2E",
                border: "1px solid #324056",
                color: "#E5EAF3",
                fontSize: 12,
              }}
              onClick={onSaveAndClose}
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

