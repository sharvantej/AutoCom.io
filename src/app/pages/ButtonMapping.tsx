import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext, useTheme } from "../context/AppContext";
import { loadDashboardLayout } from "../services/runtimeState";
import { isTauri } from "../services/tauri";
import { listStreamDeckDevices, syncStreamDeckSurface, type StreamDeckDevice } from "../services/streamdeck";

type DashboardButtonEntry = {
  id: string;
  projectId: number;
  projectName: string;
  label: string;
};

type DeckAddress = {
  page: number;
  row: number;
  col: number;
  key: string;
};

type MappingRecord = Record<string, string>;
type TextSizeRecord = Record<string, number>;
type KeyTextAlign = "left" | "center" | "right";
type KeyStyle = {
  textColor: string;
  bgColor: string;
  topbarEnabled: boolean;
  textAlign: KeyTextAlign;
  customLabel: string;
};
type KeyStyleRecord = Record<string, KeyStyle>;

const MAPPING_STORAGE_KEY = "autocom.button-mapping.v1";
const TEXT_SIZE_STORAGE_KEY = "autocom.button-text-size.v1";
const KEY_STYLE_STORAGE_KEY = "autocom.button-style.v1";
const STREAMDECK_DIRECT_SYNC_KEY = "autocom.streamdeck.directSync.v1";
const STREAMDECK_SELECTED_SERIAL_KEY = "autocom.streamdeck.selectedSerial.v1";
const STREAMDECK_ACTIVE_PAGE_KEY = "autocom.streamdeck.activePage.v1";
const STREAMDECK_KEY_SIZE = 120;
const SPECIAL_MAPPING_PREFIX = "__special__:";
const SPECIAL_MAPPING_PAGE_NEXT = `${SPECIAL_MAPPING_PREFIX}page_next`;
const SPECIAL_MAPPING_PAGE_PREVIOUS = `${SPECIAL_MAPPING_PREFIX}page_previous`;
const DEFAULT_KEY_STYLE: KeyStyle = {
  textColor: "#f8fafc",
  bgColor: "#020817",
  topbarEnabled: true,
  textAlign: "center",
  customLabel: "",
};

function safeReadMappings(): MappingRecord {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MAPPING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as MappingRecord;
  } catch { return {}; }
}
function safeWriteMappings(next: MappingRecord): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(next)); } catch {}
}
function safeReadTextSizes(): TextSizeRecord {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as TextSizeRecord;
  } catch { return {}; }
}
function safeWriteTextSizes(next: TextSizeRecord): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, JSON.stringify(next)); } catch {}
}
function safeReadKeyStyles(): KeyStyleRecord {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY_STYLE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const migrated: KeyStyleRecord = {};
    Object.entries(parsed as Record<string, KeyStyle>).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      const normalizedBg = typeof value.bgColor === "string" ? value.bgColor.toLowerCase() : "";
      const nextBgColor = normalizedBg === "#101828" || normalizedBg === "#1e2939" ? "#020817" : value.bgColor;
      migrated[key] = { ...DEFAULT_KEY_STYLE, ...value, bgColor: nextBgColor };
    });
    return migrated;
  } catch { return {}; }
}
function safeWriteKeyStyles(next: KeyStyleRecord): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY_STYLE_STORAGE_KEY, JSON.stringify(next)); } catch {}
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length !== 6) return [255, 255, 255];
  const value = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(value)) return [255, 255, 255];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
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
function createDeckAddresses(page: number, rows: number, cols: number): DeckAddress[] {
  const out: DeckAddress[] = [];
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      out.push({ page, row, col, key: `${page}/${row}/${col}` });
    }
  }
  return out;
}
function getSpecialMappingLabel(mappingId: string | null | undefined): string | null {
  if (!mappingId) return null;
  if (mappingId === SPECIAL_MAPPING_PAGE_NEXT) return "Page Next";
  if (mappingId === SPECIAL_MAPPING_PAGE_PREVIOUS) return "Page Previous";
  return null;
}
function normalizeButtonLabel(label: unknown, fallback: string): string {
  if (typeof label === "string" && label.trim()) return label.trim();
  return fallback;
}
function isStreamDeckTransientDisconnectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("getoverlappedresult") ||
    normalized.includes("i/o operation has been aborted") ||
    normalized.includes("device not connected") ||
    normalized.includes("no stream deck devices found")
  );
}

export default function ButtonMapping() {
  const t = useTheme();
  const { projects } = useAppContext();
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [activePage, setActivePage] = useState(() => readActivePage());
  const [buttons, setButtons] = useState<DashboardButtonEntry[]>([]);
  const [loadingButtons, setLoadingButtons] = useState(false);
  const [selectedDeckKey, setSelectedDeckKey] = useState<string | null>(null);
  const [mappings, setMappings] = useState<MappingRecord>(() => safeReadMappings());
  const [textSizes, setTextSizes] = useState<TextSizeRecord>(() => safeReadTextSizes());
  const [keyStyles, setKeyStyles] = useState<KeyStyleRecord>(() => safeReadKeyStyles());
  const [textSizeInput, setTextSizeInput] = useState("10");
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const gridHostRef = useRef<HTMLDivElement | null>(null);
  const [gridHostWidth, setGridHostWidth] = useState(0);
  const [gridHostHeight, setGridHostHeight] = useState(0);
  const [deckDevices, setDeckDevices] = useState<StreamDeckDevice[]>([]);
  const [selectedDeckSerial, setSelectedDeckSerial] = useState<string>(() => readSelectedSerial());
  const [directSyncEnabled, setDirectSyncEnabled] = useState(() => readDirectSyncEnabled());
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const [syncError, setSyncError] = useState("");

  const selectedDevice = useMemo(
    () => deckDevices.find((d) => d.serialNumber === selectedDeckSerial) ?? null,
    [deckDevices, selectedDeckSerial],
  );

  useEffect(() => {
    let disposed = false;
    const fetchButtons = async (silent = false) => {
      if (!silent) setLoadingButtons(true);
      try {
        const next: DashboardButtonEntry[] = [];
        for (const project of projects) {
          try {
            const layout = await loadDashboardLayout<Record<string, unknown>>(String(project.id));
            layout.forEach((item, index) => {
              const type = typeof item?.type === "string" ? item.type.toLowerCase() : "";
              if (type !== "button") return;
              const itemId = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `btn-${index + 1}`;
              const label = normalizeButtonLabel(item.label, `Button ${index + 1}`);
              next.push({ id: `${project.id}:${itemId}`, projectId: project.id, projectName: project.name, label });
            });
          } catch {}
        }
        next.sort((a, b) => {
          if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
          return a.label.localeCompare(b.label);
        });
        if (!disposed) setButtons(next);
      } finally {
        if (!silent && !disposed) setLoadingButtons(false);
      }
    };
    void fetchButtons(false);
    const refreshTimers = [
      window.setTimeout(() => void fetchButtons(true), 700),
      window.setTimeout(() => void fetchButtons(true), 1700),
    ];
    const onFocus = () => void fetchButtons(true);
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      refreshTimers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("focus", onFocus);
    };
  }, [projects]);

  const buttonById = useMemo(() => {
    const map = new Map<string, DashboardButtonEntry>();
    buttons.forEach((e) => map.set(e.id, e));
    return map;
  }, [buttons]);

  const deckButtons = useMemo(
    () => createDeckAddresses(activePage, Math.max(1, rows), Math.max(1, cols)),
    [activePage, cols, rows],
  );
  const syncDeckButtons = useMemo(
    () => selectedDevice
      ? createDeckAddresses(activePage, Math.max(1, selectedDevice.rows), Math.max(1, selectedDevice.cols))
      : deckButtons,
    [activePage, deckButtons, selectedDevice],
  );

  useEffect(() => {
    let disposed = false;
    if (!isTauri()) return;
    const loadDevices = async () => {
      try {
        const devices = await listStreamDeckDevices();
        if (disposed) return;
        setDeckDevices(devices);
        const hasSerial = devices.some((d) => d.serialNumber === selectedDeckSerial);
        if (devices.length > 0 && !hasSerial) {
          const fallback = devices[0].serialNumber || "";
          setSelectedDeckSerial(fallback);
          window.localStorage.setItem(STREAMDECK_SELECTED_SERIAL_KEY, fallback);
          window.dispatchEvent(new CustomEvent("autocom:streamdeck-controls-changed"));
        }
      } catch (error) {
        if (disposed) return;
        setDeckDevices([]);
        setSyncState("error");
        setSyncError(error instanceof Error ? error.message : "Failed to detect Stream Deck devices.");
      }
    };
    void loadDevices();
    const pollId = window.setInterval(() => void loadDevices(), 2000);
    const onFocus = () => void loadDevices();
    window.addEventListener("focus", onFocus);
    return () => { disposed = true; window.clearInterval(pollId); window.removeEventListener("focus", onFocus); };
  }, [selectedDeckSerial]);

  useEffect(() => {
    const sync = () => { setDirectSyncEnabled(readDirectSyncEnabled()); setSelectedDeckSerial(readSelectedSerial()); };
    window.addEventListener("autocom:streamdeck-controls-changed", sync as EventListener);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("autocom:streamdeck-controls-changed", sync as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STREAMDECK_ACTIVE_PAGE_KEY, String(activePage));
    window.dispatchEvent(new CustomEvent("autocom:streamdeck-active-page-changed"));
  }, [activePage]);

  useEffect(() => {
    const syncPage = () => setActivePage(readActivePage());
    window.addEventListener("autocom:streamdeck-active-page-changed", syncPage as EventListener);
    window.addEventListener("storage", syncPage);
    return () => {
      window.removeEventListener("autocom:streamdeck-active-page-changed", syncPage as EventListener);
      window.removeEventListener("storage", syncPage);
    };
  }, []);

  useEffect(() => {
    setActivePage((prev) => Math.min(Math.max(1, totalPages), Math.max(1, prev)));
  }, [totalPages]);

  useEffect(() => {
    if (!selectedDevice) return;
    setRows(selectedDevice.rows);
    setCols(selectedDevice.cols);
  }, [selectedDevice]);

  // Responsive key sizing
  const deckKeySize = useMemo(() => {
    const safeCols = Math.max(1, cols);
    const safeRows = Math.max(1, rows);
    if (gridHostWidth <= 0) return 90;
    const gap = 3;
    const inspectorH = selectedDeckKey ? 84 : 0;
    const availH = gridHostHeight > inspectorH ? gridHostHeight - inspectorH : gridHostHeight;
    const fromWidth = Math.floor((gridHostWidth - (safeCols - 1) * gap) / safeCols);
    const fromHeight = availH > 0
      ? Math.floor((availH - (safeRows - 1) * gap) / safeRows)
      : STREAMDECK_KEY_SIZE;
    return Math.max(52, Math.min(STREAMDECK_KEY_SIZE, Math.min(fromWidth, fromHeight)));
  }, [cols, gridHostHeight, gridHostWidth, rows, selectedDeckKey]);

  const deckGridWidth = Math.max(1, cols) * deckKeySize + (Math.max(1, cols) - 1) * 3;

  const syncKeys = useMemo(
    () => syncDeckButtons.map((entry) => {
      const mappedId = mappings[entry.key];
      const mapped = mappedId ? buttonById.get(mappedId) : null;
      const specialLabel = getSpecialMappingLabel(mappedId);
      const style = keyStyles[entry.key] ?? DEFAULT_KEY_STYLE;
      const customLabel = style.customLabel.trim();
      const resolvedLabel = customLabel || mapped?.label || specialLabel || "";
      return {
        row: entry.row, col: entry.col,
        address: `${entry.page}/${entry.row}/${entry.col}`,
        label: resolvedLabel, mapped: resolvedLabel.length > 0,
        selected: selectedDeckKey === entry.key,
        textSize: textSizes[entry.key] ?? 10,
        textColor: hexToRgb(style.textColor), bgColor: hexToRgb(style.bgColor),
        textAlign: style.textAlign, topbarEnabled: style.topbarEnabled,
      };
    }),
    [buttonById, keyStyles, mappings, selectedDeckKey, syncDeckButtons, textSizes],
  );

  const selectedStyle = selectedDeckKey ? (keyStyles[selectedDeckKey] ?? DEFAULT_KEY_STYLE) : DEFAULT_KEY_STYLE;

  const updateSelectedStyle = (patch: Partial<KeyStyle>) => {
    if (!selectedDeckKey) return;
    const next: KeyStyleRecord = {
      ...keyStyles,
      [selectedDeckKey]: { ...(keyStyles[selectedDeckKey] ?? DEFAULT_KEY_STYLE), ...patch },
    };
    setKeyStyles(next);
    safeWriteKeyStyles(next);
  };

  const unmapKey = (key: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = { ...mappings };
    delete next[key];
    setMappings(next);
    safeWriteMappings(next);
    if (selectedDeckKey === key) setSelectedDeckKey(null);
  };

  const applyDrop = (key: string, buttonId: string) => {
    const next = { ...mappings, [key]: buttonId };
    setMappings(next);
    safeWriteMappings(next);
    setSelectedDeckKey(key);
  };

  // Drag handlers for button chips
  const handleDragStart = (e: React.DragEvent, buttonId: string) => {
    e.dataTransfer.setData("text/plain", buttonId);
    e.dataTransfer.effectAllowed = "copy";
    setDraggingId(buttonId);
  };
  const handleDragEnd = () => setDraggingId(null);

  // Drop handlers for deck keys
  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverKey(key);
  };
  const handleDragLeave = () => setDragOverKey(null);
  const handleDrop = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    setDragOverKey(null);
    const buttonId = e.dataTransfer.getData("text/plain");
    if (buttonId) applyDrop(key, buttonId);
  };

  useEffect(() => {
    if (!selectedDeckKey) { setTextSizeInput("10"); return; }
    setTextSizeInput(String(textSizes[selectedDeckKey] ?? 10));
  }, [selectedDeckKey, textSizes]);

  const saveSelectedTextSize = () => {
    if (!selectedDeckKey) return;
    const parsed = Number.parseInt(textSizeInput, 10);
    const clamped = Math.max(8, Math.min(72, Number.isFinite(parsed) ? parsed : 10));
    const next = { ...textSizes, [selectedDeckKey]: clamped };
    setTextSizes(next);
    setTextSizeInput(String(clamped));
    safeWriteTextSizes(next);
  };

  useEffect(() => {
    const node = gridHostRef.current;
    if (!node) return;
    const update = () => { setGridHostWidth(node.clientWidth); setGridHostHeight(node.clientHeight); };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isTauri() || !directSyncEnabled || !selectedDevice) return;
    const timerId = window.setTimeout(async () => {
      try {
        setSyncState("syncing"); setSyncError("");
        await syncStreamDeckSurface({
          serialNumber: selectedDevice.serialNumber || undefined,
          cols: Math.max(1, selectedDevice.cols),
          keys: syncKeys,
        });
        setSyncState("ok");
      } catch (error) {
        if (isStreamDeckTransientDisconnectError(error)) { setSyncState("idle"); setSyncError(""); return; }
        setSyncState("error");
        setSyncError(error instanceof Error ? error.message : "Failed to sync Stream Deck surface.");
      }
    }, 120);
    return () => window.clearTimeout(timerId);
  }, [directSyncEnabled, selectedDevice, syncKeys]);

  const stepPages = (delta: number) => setTotalPages((p) => Math.max(1, p + delta));
  const stepActivePage = (delta: number) =>
    setActivePage((p) => Math.max(1, Math.min(Math.max(1, totalPages), p + delta)));
  const stepBtn = (enabled: boolean): React.CSSProperties => ({
    borderColor: t.inputBorder,
    backgroundColor: t.bgSidebar,
    color: enabled ? t.textPrimary : t.textSecondary,
    cursor: enabled ? "pointer" : "not-allowed",
  });

  // Group project buttons by project for the left panel
  const projectGroups = useMemo(() => {
    const groups = new Map<string, DashboardButtonEntry[]>();
    buttons.forEach((b) => {
      if (!groups.has(b.projectName)) groups.set(b.projectName, []);
      groups.get(b.projectName)!.push(b);
    });
    return groups;
  }, [buttons]);

  const systemButtons: DashboardButtonEntry[] = [
    { id: SPECIAL_MAPPING_PAGE_PREVIOUS, projectId: -1, projectName: "System", label: "Page Previous" },
    { id: SPECIAL_MAPPING_PAGE_NEXT,     projectId: -1, projectName: "System", label: "Page Next"     },
  ];

  return (
    <div
      className="button-mapping-page flex h-full w-full page-pop overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${t.bgContent} 0%, ${t.bgOuter} 100%)` }}
    >
      {/* ── LEFT PANEL: Draggable button library ── */}
      <div
        className="flex w-[200px] shrink-0 flex-col border-r h-full"
        style={{ borderColor: t.topbarBorder, backgroundColor: t.bgContent }}
      >
        {/* Header */}
        <div
          className="h-[44px] shrink-0 flex items-center px-3 border-b"
          style={{ borderColor: t.topbarBorder, backgroundColor: t.bgContent }}
        >
          <span className="text-[13px] font-semibold" style={{ color: t.textPrimary }}>Buttons</span>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar p-2 flex flex-col gap-3">
          {/* System */}
          <div>
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.08em] px-1 mb-1"
              style={{ color: t.textSecondary, opacity: 0.6 }}
            >
              System
            </div>
            <div className="flex flex-col gap-1">
              {systemButtons.map((btn) => (
                <DraggableChip
                  key={btn.id}
                  btn={btn}
                  isDragging={draggingId === btn.id}
                  t={t}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </div>

          {/* Project buttons */}
          {loadingButtons ? (
            <div className="text-[11px] px-1" style={{ color: t.textSecondary }}>Loading…</div>
          ) : projectGroups.size === 0 ? (
            <div className="text-[11px] px-1 leading-relaxed" style={{ color: t.textSecondary, opacity: 0.6 }}>
              No dashboard buttons. Create a project and add button widgets.
            </div>
          ) : (
            Array.from(projectGroups.entries()).map(([projectName, entries]) => (
              <div key={projectName}>
                <div
                  className="text-[10px] font-semibold uppercase tracking-[0.08em] px-1 mb-1 truncate"
                  style={{ color: t.textSecondary, opacity: 0.6 }}
                >
                  {projectName}
                </div>
                <div className="flex flex-col gap-1">
                  {entries.map((btn) => (
                    <DraggableChip
                      key={btn.id}
                      btn={btn}
                      isDragging={draggingId === btn.id}
                      t={t}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT AREA: Grid + Inspector ── */}
      <div className="flex flex-1 min-w-0 flex-col h-full">

        {/* Top header */}
        <div
          className="flex h-[44px] shrink-0 items-center gap-4 border-b px-4"
          style={{ borderColor: t.topbarBorder }}
        >
          <span className="text-[15px] font-semibold tracking-[0.01em]" style={{ color: t.textPrimary }}>
            Stream Deck
          </span>
          <div className="ml-auto flex items-center gap-4 text-[12px]" style={{ color: t.textSecondary }}>
            {/* Pages stepper */}
            <div className="flex items-center gap-1">
              <span>Pages</span>
              <button className="w-[22px] h-[24px] border flex items-center justify-center text-[13px]"
                style={stepBtn(totalPages > 1)} disabled={totalPages <= 1} onClick={() => stepPages(-1)}>−</button>
              <span className="w-[20px] text-center" style={{ color: t.textPrimary }}>{totalPages}</span>
              <button className="w-[22px] h-[24px] border flex items-center justify-center text-[13px]"
                style={stepBtn(totalPages < 32)} disabled={totalPages >= 32} onClick={() => stepPages(1)}>+</button>
            </div>
            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button className="h-[24px] border px-2 flex items-center justify-center"
                style={stepBtn(activePage > 1)} disabled={activePage <= 1} onClick={() => stepActivePage(-1)}>{"<"}</button>
              <span className="w-[44px] text-center" style={{ color: t.textPrimary }}>
                {activePage} / {Math.max(1, totalPages)}
              </span>
              <button className="h-[24px] border px-2 flex items-center justify-center"
                style={stepBtn(activePage < Math.max(1, totalPages))}
                disabled={activePage >= Math.max(1, totalPages)} onClick={() => stepActivePage(1)}>{">"}</button>
            </div>
          </div>
        </div>

        {/* Sync error */}
        {syncState === "error" && syncError && (
          <div className="px-4 py-1 shrink-0 text-[11px] border-b" style={{ color: "#ef4444", borderColor: t.topbarBorder }}>
            {syncError}
          </div>
        )}

        {/* Grid */}
        <div
          ref={gridHostRef}
          className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedDeckKey(null);
          }}
        >
          <div
            className="grid p-[2px]"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, cols)}, ${deckKeySize}px)`,
              columnGap: "3px",
              rowGap: "3px",
              backgroundColor: "rgba(15, 23, 42, 0.4)",
              width: deckGridWidth + 4,
            }}
          >
            {deckButtons.map((entry) => {
              const key = entry.key;
              const mappedId = mappings[key];
              const mapped = mappedId ? buttonById.get(mappedId) : null;
              const specialLabel = getSpecialMappingLabel(mappedId);
              const isSelected = selectedDeckKey === key;
              const isDragTarget = dragOverKey === key;
              const keyTextSize = textSizes[key] ?? 10;
              const style = keyStyles[key] ?? DEFAULT_KEY_STYLE;
              const customLabel = style.customLabel.trim();
              const displayLabel = customLabel || mapped?.label || specialLabel || "";
              const isMapped = !!displayLabel;
              const deckAddress = `${entry.page}/${entry.row}/${entry.col}`;

              return (
                <div
                  key={key}
                  className="relative border overflow-hidden flex flex-col items-stretch transition-all select-none"
                  style={{
                    width: deckKeySize,
                    height: deckKeySize,
                    borderColor: isDragTarget
                      ? "rgba(139, 92, 246, 1)"
                      : isSelected
                        ? "rgba(139, 92, 246, 0.85)"
                        : isMapped
                          ? "rgba(139, 92, 246, 0.3)"
                          : "#2c3138",
                    backgroundColor: isDragTarget
                      ? "rgba(139, 92, 246, 0.15)"
                      : style.bgColor,
                    boxShadow: isDragTarget
                      ? "inset 0 0 0 1px rgba(139,92,246,0.5)"
                      : isSelected
                        ? "0 0 0 1px rgba(139,92,246,0.35)"
                        : "none",
                    cursor: "pointer",
                    padding: "4px 6px",
                  }}
                  title={deckAddress}
                  onClick={() => setSelectedDeckKey(isSelected ? null : key)}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, key)}
                >
                  {/* Topbar: address left, × right */}
                  {style.topbarEnabled && (
                    <div
                      className="flex items-center justify-between w-full border-b pb-[2px] mb-[2px] shrink-0"
                      style={{ borderColor: "rgba(139, 92, 246, 0.4)" }}
                    >
                      <span
                        className="truncate text-[9px] text-left leading-none"
                        style={{ color: "rgba(248, 250, 252, 0.55)" }}
                      >
                        {deckAddress}
                      </span>
                      {isMapped && (
                        <button
                          className="shrink-0 flex items-center justify-center leading-none transition-opacity"
                          style={{
                            width: 12,
                            height: 12,
                            fontSize: 10,
                            color: "rgba(248,250,252,0.5)",
                            marginLeft: 2,
                          }}
                          title="Remove"
                          onClick={(e) => unmapKey(key, e)}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(248,250,252,0.5)"; }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}

                  {/* If topbar hidden but mapped, show floating × */}
                  {!style.topbarEnabled && isMapped && (
                    <button
                      className="absolute top-[3px] right-[4px] flex items-center justify-center leading-none z-10 transition-opacity"
                      style={{
                        width: 13,
                        height: 13,
                        fontSize: 11,
                        color: "rgba(248,250,252,0.45)",
                      }}
                      title="Remove"
                      onClick={(e) => unmapKey(key, e)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(248,250,252,0.45)"; }}
                    >
                      ×
                    </button>
                  )}

                  {/* Drop hint when no label */}
                  {!isMapped && !isDragTarget && (
                    <div className="flex-1 flex items-center justify-center">
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.1)" }}>drop here</span>
                    </div>
                  )}

                  {/* Drop active indicator */}
                  {isDragTarget && (
                    <div className="flex-1 flex items-center justify-center">
                      <span style={{ fontSize: 10, color: "rgba(139,92,246,0.7)", fontWeight: 600 }}>+</span>
                    </div>
                  )}

                  {/* Label */}
                  {isMapped && !isDragTarget && (
                    <span
                      className="flex-1 flex items-center break-words line-clamp-4 leading-tight"
                      style={{
                        fontSize: keyTextSize,
                        lineHeight: 1.1,
                        color: style.textColor,
                        justifyContent:
                          style.textAlign === "left" ? "flex-start"
                          : style.textAlign === "right" ? "flex-end"
                          : "center",
                        textAlign: style.textAlign,
                      }}
                    >
                      {displayLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── INSPECTOR STRIP (only when key selected) ── */}
        {selectedDeckKey && (
          <div
            className="shrink-0 border-t flex flex-col"
            style={{ borderColor: t.topbarBorder, backgroundColor: t.bgSidebar }}
          >
            {/* Row 1: Label override */}
            <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: t.topbarBorder }}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] shrink-0" style={{ color: t.textSecondary }}>
                Label
              </span>
              <input
                type="text"
                value={selectedStyle.customLabel}
                className="h-[30px] w-[200px] border px-2 text-[12px] outline-none"
                style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, color: t.textPrimary }}
                placeholder="Override button label…"
                onChange={(e) => updateSelectedStyle({ customLabel: e.target.value })}
              />
              <span className="ml-auto text-[11px]" style={{ color: t.textSecondary, opacity: 0.5 }}>
                {selectedDeckKey}
              </span>
            </div>

            {/* Row 2: Style controls */}
            <div className="flex items-center gap-3 px-4 py-2 text-[11px]" style={{ color: t.textSecondary }}>
              <span className="font-semibold uppercase tracking-[0.06em] shrink-0">Size</span>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={textSizeInput}
                className="h-[28px] w-[44px] shrink-0 border px-2 text-[12px] outline-none"
                style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, color: t.textPrimary }}
                onChange={(e) => setTextSizeInput(e.target.value)}
                onBlur={saveSelectedTextSize}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveSelectedTextSize(); } }}
              />

              <span className="font-semibold uppercase tracking-[0.06em] shrink-0">Text</span>
              <input type="color" value={selectedStyle.textColor}
                className="h-[28px] w-[44px] shrink-0 border p-0"
                style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, cursor: "pointer" }}
                onChange={(e) => updateSelectedStyle({ textColor: e.target.value })}
              />

              <span className="font-semibold uppercase tracking-[0.06em] shrink-0">BG</span>
              <input type="color" value={selectedStyle.bgColor}
                className="h-[28px] w-[44px] shrink-0 border p-0"
                style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, cursor: "pointer" }}
                onChange={(e) => updateSelectedStyle({ bgColor: e.target.value })}
              />

              <span className="font-semibold uppercase tracking-[0.06em] shrink-0">Topbar</span>
              <select
                className="h-[28px] border px-2 text-[12px] outline-none shrink-0"
                style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, color: t.textSecondary }}
                value={selectedStyle.topbarEnabled ? "show" : "hide"}
                onChange={(e) => updateSelectedStyle({ topbarEnabled: e.target.value !== "hide" })}
              >
                <option value="show">On</option>
                <option value="hide">Off</option>
              </select>

              <span className="font-semibold uppercase tracking-[0.06em] shrink-0">Align</span>
              <div className="h-[28px] border flex overflow-hidden shrink-0" style={{ borderColor: t.inputBorder }}>
                {(["left", "center", "right"] as KeyTextAlign[]).map((align) => (
                  <button
                    key={align}
                    className="w-[28px] h-full border-r last:border-r-0 transition-colors"
                    style={{
                      borderColor: t.inputBorder,
                      backgroundColor: selectedStyle.textAlign === align ? t.navActive : t.rowBg,
                      color: selectedStyle.textAlign === align ? t.textPrimary : t.textSecondary,
                      fontSize: 11,
                    }}
                    onClick={() => updateSelectedStyle({ textAlign: align })}
                  >
                    {align.charAt(0).toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable button chip ──────────────────────────────────────────────────────
function DraggableChip({
  btn,
  isDragging,
  t,
  onDragStart,
  onDragEnd,
}: {
  btn: DashboardButtonEntry;
  isDragging: boolean;
  t: ReturnType<typeof useTheme>;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, btn.id)}
      onDragEnd={onDragEnd}
      className="px-2 py-1.5 border text-[12px] truncate select-none transition-all"
      style={{
        borderColor: isDragging ? "rgba(139,92,246,0.7)" : t.inputBorder,
        backgroundColor: isDragging ? t.navActive : t.bgContent,
        color: isDragging ? t.textPrimary : t.textSecondary,
        cursor: "grab",
        opacity: isDragging ? 0.5 : 1,
        userSelect: "none",
      }}
      title={btn.label}
    >
      {btn.label}
    </div>
  );
}
