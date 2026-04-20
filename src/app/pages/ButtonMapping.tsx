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
const SPECIAL_MAPPING_NONE = `${SPECIAL_MAPPING_PREFIX}none`;
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
  } catch {
    return {};
  }
}

function safeWriteMappings(next: MappingRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function safeReadTextSizes(): TextSizeRecord {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as TextSizeRecord;
  } catch {
    return {};
  }
}

function safeWriteTextSizes(next: TextSizeRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, JSON.stringify(next));
  } catch {}
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
      const nextBgColor =
        normalizedBg === "#101828" || normalizedBg === "#1e2939" ? "#020817" : value.bgColor;
      migrated[key] = { ...DEFAULT_KEY_STYLE, ...value, bgColor: nextBgColor };
    });
    return migrated;
  } catch {
    return {};
  }
}

function safeWriteKeyStyles(next: KeyStyleRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_STYLE_STORAGE_KEY, JSON.stringify(next));
  } catch {}
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
  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      out.push({ page, row, col, key: `${page}/${row}/${col}` });
    }
  }
  return out;
}

function getSpecialMappingLabel(mappingId: string | null | undefined): string | null {
  if (!mappingId) return null;
  if (mappingId === SPECIAL_MAPPING_PAGE_NEXT) return "Page Next";
  if (mappingId === SPECIAL_MAPPING_PAGE_PREVIOUS) return "Page Previous";
  if (mappingId === SPECIAL_MAPPING_NONE) return "None";
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

  // Load dashboard buttons from all projects
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

  // All mapping options: system specials first, then project buttons
  const mappingOptions = useMemo<DashboardButtonEntry[]>(
    () => [
      { id: SPECIAL_MAPPING_PAGE_PREVIOUS, projectId: -1, projectName: "System", label: "Page Previous" },
      { id: SPECIAL_MAPPING_PAGE_NEXT,     projectId: -1, projectName: "System", label: "Page Next"     },
      { id: SPECIAL_MAPPING_NONE,          projectId: -1, projectName: "System", label: "None"          },
      ...buttons,
    ],
    [buttons],
  );

  const deckButtons = useMemo(
    () => createDeckAddresses(activePage, Math.max(1, rows), Math.max(1, cols)),
    [activePage, cols, rows],
  );

  const syncDeckButtons = useMemo(
    () =>
      selectedDevice
        ? createDeckAddresses(activePage, Math.max(1, selectedDevice.rows), Math.max(1, selectedDevice.cols))
        : deckButtons,
    [activePage, deckButtons, selectedDevice],
  );

  // Stream Deck device polling
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
    return () => {
      disposed = true;
      window.clearInterval(pollId);
      window.removeEventListener("focus", onFocus);
    };
  }, [selectedDeckSerial]);

  useEffect(() => {
    const sync = () => {
      setDirectSyncEnabled(readDirectSyncEnabled());
      setSelectedDeckSerial(readSelectedSerial());
    };
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

  // Responsive key sizing: fill available grid area
  const deckKeySize = useMemo(() => {
    const safeCols = Math.max(1, cols);
    const safeRows = Math.max(1, rows);
    if (gridHostWidth <= 0) return 90;
    const gap = 2;
    // Reserve ~110px for the inspector strip below
    const availH = gridHostHeight > 110 ? gridHostHeight - 110 : gridHostHeight;
    const fromWidth = Math.floor((gridHostWidth - (safeCols - 1) * gap) / safeCols);
    const fromHeight =
      availH > 0
        ? Math.floor((availH - (safeRows - 1) * gap) / safeRows)
        : STREAMDECK_KEY_SIZE;
    const next = Math.min(fromWidth, fromHeight);
    return Math.max(44, Math.min(STREAMDECK_KEY_SIZE, next));
  }, [cols, gridHostHeight, gridHostWidth, rows]);

  const deckGridWidth = Math.max(1, cols) * deckKeySize + (Math.max(1, cols) - 1) * 2;

  const syncKeys = useMemo(
    () =>
      syncDeckButtons.map((entry) => {
        const mappedId = mappings[entry.key];
        const mapped = mappedId ? buttonById.get(mappedId) : null;
        const specialLabel = getSpecialMappingLabel(mappedId);
        const style = keyStyles[entry.key] ?? DEFAULT_KEY_STYLE;
        const customLabel = style.customLabel.trim();
        const resolvedLabel = customLabel || mapped?.label || specialLabel || "";
        return {
          row: entry.row,
          col: entry.col,
          address: `${entry.page}/${entry.row}/${entry.col}`,
          label: resolvedLabel,
          mapped: resolvedLabel.length > 0,
          selected: selectedDeckKey === entry.key,
          textSize: textSizes[entry.key] ?? 10,
          textColor: hexToRgb(style.textColor),
          bgColor: hexToRgb(style.bgColor),
          textAlign: style.textAlign,
          topbarEnabled: style.topbarEnabled,
        };
      }),
    [buttonById, keyStyles, mappings, selectedDeckKey, syncDeckButtons, textSizes],
  );

  const selectedStyle = selectedDeckKey ? (keyStyles[selectedDeckKey] ?? DEFAULT_KEY_STYLE) : DEFAULT_KEY_STYLE;
  const selectedMappedId = selectedDeckKey ? (mappings[selectedDeckKey] ?? "") : "";

  const updateSelectedStyle = (patch: Partial<KeyStyle>) => {
    if (!selectedDeckKey) return;
    const next: KeyStyleRecord = {
      ...keyStyles,
      [selectedDeckKey]: { ...(keyStyles[selectedDeckKey] ?? DEFAULT_KEY_STYLE), ...patch },
    };
    setKeyStyles(next);
    safeWriteKeyStyles(next);
  };

  // Instant mapping: select changes apply immediately
  const applyMapping = (mappingId: string) => {
    if (!selectedDeckKey) return;
    const next = { ...mappings };
    if (!mappingId || mappingId === SPECIAL_MAPPING_NONE) {
      delete next[selectedDeckKey];
    } else {
      next[selectedDeckKey] = mappingId;
    }
    setMappings(next);
    safeWriteMappings(next);
  };

  const unmapSelectedDeck = () => {
    if (!selectedDeckKey) return;
    const next = { ...mappings };
    delete next[selectedDeckKey];
    setMappings(next);
    safeWriteMappings(next);
  };

  const handleDeckKeyClick = (key: string) => {
    setSelectedDeckKey(key);
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

  // Measure grid host
  useEffect(() => {
    const node = gridHostRef.current;
    if (!node) return;
    const update = () => { setGridHostWidth(node.clientWidth); setGridHostHeight(node.clientHeight); };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Stream Deck sync
  useEffect(() => {
    if (!isTauri()) return;
    if (!directSyncEnabled) return;
    if (!selectedDevice) return;
    const timerId = window.setTimeout(async () => {
      try {
        setSyncState("syncing");
        setSyncError("");
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

  const hasKey = !!selectedDeckKey;
  const hasMappedContent = !!selectedMappedId;

  // Group project buttons by project name for the select
  const projectGroups = useMemo(() => {
    const groups = new Map<string, DashboardButtonEntry[]>();
    buttons.forEach((b) => {
      if (!groups.has(b.projectName)) groups.set(b.projectName, []);
      groups.get(b.projectName)!.push(b);
    });
    return groups;
  }, [buttons]);

  return (
    <div
      className="button-mapping-page flex h-full w-full flex-col page-pop overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${t.bgContent} 0%, ${t.bgOuter} 100%)` }}
    >
      {/* ── TOP HEADER ── */}
      <div
        className="flex h-[44px] shrink-0 items-center gap-4 border-b px-4"
        style={{ borderColor: t.topbarBorder }}
      >
        <span className="text-[15px] font-semibold tracking-[0.01em]" style={{ color: t.textPrimary }}>
          Button Mapping
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
            <button className="h-[24px] border px-2 text-[12px] flex items-center justify-center"
              style={stepBtn(activePage > 1)} disabled={activePage <= 1} onClick={() => stepActivePage(-1)}>{"<"}</button>
            <span className="w-[44px] text-center" style={{ color: t.textPrimary }}>
              {activePage} / {Math.max(1, totalPages)}
            </span>
            <button className="h-[24px] border px-2 text-[12px] flex items-center justify-center"
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

      {/* ── GRID AREA ── */}
      <div ref={gridHostRef} className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4">
        <div
          className="grid p-[2px]"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, cols)}, ${deckKeySize}px)`,
            columnGap: "2px",
            rowGap: "2px",
            backgroundColor: "rgba(15, 23, 42, 0.35)",
            width: deckGridWidth + 4,
          }}
        >
          {deckButtons.map((entry) => {
            const key = entry.key;
            const mappedId = mappings[key];
            const mapped = mappedId ? buttonById.get(mappedId) : null;
            const specialLabel = getSpecialMappingLabel(mappedId);
            const isSelected = selectedDeckKey === key;
            const keyTextSize = textSizes[key] ?? 10;
            const style = keyStyles[key] ?? DEFAULT_KEY_STYLE;
            const customLabel = style.customLabel.trim();
            const deckAddress = `${entry.page}/${entry.row}/${entry.col}`;
            const hasMapped = !!(customLabel || mapped?.label || specialLabel);
            return (
              <button
                key={key}
                className="border overflow-hidden flex flex-col items-stretch transition-colors"
                style={{
                  width: deckKeySize,
                  height: deckKeySize,
                  borderColor: isSelected
                    ? "rgba(139, 92, 246, 0.85)"
                    : hasMapped
                      ? "rgba(139, 92, 246, 0.3)"
                      : "#2c3138",
                  backgroundColor: style.bgColor,
                  color: style.textColor,
                  boxShadow: isSelected ? "0 0 0 1px rgba(139,92,246,0.4)" : "none",
                  padding: "4px 6px",
                }}
                title={deckAddress}
                onClick={() => handleDeckKeyClick(key)}
              >
                {style.topbarEnabled && (
                  <span
                    className="block w-full truncate text-[10px] text-left pb-[2px] border-b"
                    style={{ borderColor: "rgba(139, 92, 246, 0.5)", color: "rgba(248, 250, 252, 0.6)" }}
                  >
                    {deckAddress}
                  </span>
                )}
                <span
                  className="flex-1 flex items-center break-words line-clamp-4 leading-tight"
                  style={{
                    fontSize: keyTextSize,
                    lineHeight: 1.1,
                    justifyContent:
                      style.textAlign === "left" ? "flex-start"
                      : style.textAlign === "right" ? "flex-end"
                      : "center",
                    textAlign: style.textAlign,
                  }}
                >
                  {customLabel || mapped?.label || specialLabel || ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── INSPECTOR STRIP ── */}
      <div
        className="shrink-0 border-t"
        style={{ borderColor: t.topbarBorder, backgroundColor: t.bgSidebar }}
      >
        {/* Row 1: Assign + Unmap */}
        <div
          className="flex items-center gap-2 px-4 py-2 border-b"
          style={{ borderColor: t.topbarBorder, opacity: hasKey ? 1 : 0.45 }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] shrink-0" style={{ color: t.textSecondary }}>
            Assign
          </span>

          {/* Mapping select — changes apply immediately */}
          <select
            className="flex-1 h-[32px] border px-2 text-[12px] outline-none"
            style={{
              backgroundColor: t.rowBg,
              borderColor: t.inputBorder,
              color: t.textPrimary,
              cursor: hasKey ? "pointer" : "not-allowed",
            }}
            disabled={!hasKey}
            value={selectedMappedId}
            onChange={(e) => applyMapping(e.target.value)}
          >
            <option value="">— unassigned —</option>
            <optgroup label="System">
              <option value={SPECIAL_MAPPING_PAGE_PREVIOUS}>Page Previous</option>
              <option value={SPECIAL_MAPPING_PAGE_NEXT}>Page Next</option>
            </optgroup>
            {loadingButtons ? (
              <optgroup label="Buttons">
                <option disabled>Loading…</option>
              </optgroup>
            ) : projectGroups.size > 0 ? (
              Array.from(projectGroups.entries()).map(([projectName, entries]) => (
                <optgroup key={projectName} label={projectName}>
                  {entries.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </optgroup>
              ))
            ) : null}
          </select>

          {/* Label override */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] shrink-0" style={{ color: t.textSecondary }}>
            Label
          </span>
          <input
            type="text"
            value={selectedStyle.customLabel}
            disabled={!hasKey}
            className="h-[32px] w-[140px] shrink-0 border px-2 text-[12px] outline-none"
            style={{
              backgroundColor: hasKey ? t.rowBg : t.bgSidebar,
              borderColor: t.inputBorder,
              color: t.textPrimary,
            }}
            placeholder="Override…"
            onChange={(e) => updateSelectedStyle({ customLabel: e.target.value })}
          />

          {/* Unmap */}
          <button
            className="h-[32px] shrink-0 border px-3 text-[12px] transition-colors ml-auto"
            style={{
              borderColor: hasMappedContent ? "rgba(239,68,68,0.5)" : t.inputBorder,
              backgroundColor: t.bgSidebar,
              color: hasMappedContent ? "#ef4444" : t.textSecondary,
              cursor: hasMappedContent && hasKey ? "pointer" : "not-allowed",
            }}
            disabled={!hasMappedContent || !hasKey}
            onClick={unmapSelectedDeck}
          >
            Unmap
          </button>
        </div>

        {/* Row 2: Style controls */}
        <div
          className="flex items-center gap-2 px-4 py-2 text-[11px]"
          style={{ opacity: hasKey ? 1 : 0.4, pointerEvents: hasKey ? "auto" : "none" }}
        >
          {/* Font size */}
          <span className="font-semibold uppercase tracking-[0.06em] shrink-0" style={{ color: t.textSecondary }}>Size</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={textSizeInput}
            disabled={!hasKey}
            className="h-[30px] w-[46px] shrink-0 border px-2 text-[12px] outline-none"
            style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, color: t.textPrimary }}
            onChange={(e) => setTextSizeInput(e.target.value)}
            onBlur={saveSelectedTextSize}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveSelectedTextSize(); } }}
          />

          {/* Text color */}
          <span className="font-semibold uppercase tracking-[0.06em] shrink-0" style={{ color: t.textSecondary }}>Text</span>
          <input
            type="color"
            value={selectedStyle.textColor}
            disabled={!hasKey}
            className="h-[30px] w-[48px] shrink-0 border p-0"
            style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, cursor: hasKey ? "pointer" : "default" }}
            onChange={(e) => updateSelectedStyle({ textColor: e.target.value })}
          />

          {/* BG color */}
          <span className="font-semibold uppercase tracking-[0.06em] shrink-0" style={{ color: t.textSecondary }}>BG</span>
          <input
            type="color"
            value={selectedStyle.bgColor}
            disabled={!hasKey}
            className="h-[30px] w-[48px] shrink-0 border p-0"
            style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, cursor: hasKey ? "pointer" : "default" }}
            onChange={(e) => updateSelectedStyle({ bgColor: e.target.value })}
          />

          {/* Topbar */}
          <span className="font-semibold uppercase tracking-[0.06em] shrink-0" style={{ color: t.textSecondary }}>Topbar</span>
          <select
            className="h-[30px] border px-2 text-[12px] outline-none shrink-0"
            style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, color: t.textSecondary }}
            value={selectedStyle.topbarEnabled ? "show" : "hide"}
            onChange={(e) => updateSelectedStyle({ topbarEnabled: e.target.value !== "hide" })}
            disabled={!hasKey}
          >
            <option value="show">On</option>
            <option value="hide">Off</option>
          </select>

          {/* Text align */}
          <span className="font-semibold uppercase tracking-[0.06em] shrink-0" style={{ color: t.textSecondary }}>Align</span>
          <div className="h-[30px] border flex overflow-hidden shrink-0" style={{ borderColor: t.inputBorder }}>
            {(["left", "center", "right"] as KeyTextAlign[]).map((align) => (
              <button
                key={align}
                className="w-[30px] h-full border-r last:border-r-0 text-[11px] transition-colors"
                style={{
                  borderColor: t.inputBorder,
                  backgroundColor: selectedStyle.textAlign === align ? t.navActive : t.rowBg,
                  color: selectedStyle.textAlign === align ? t.textPrimary : t.textSecondary,
                }}
                onClick={() => updateSelectedStyle({ textAlign: align })}
                disabled={!hasKey}
              >
                {align.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>

          {selectedDeckKey && (
            <span className="ml-auto text-[11px]" style={{ color: t.textSecondary }}>
              {selectedDeckKey}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
