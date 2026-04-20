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
  } catch {
    // Ignore storage write failures
  }
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
  } catch {
    // Ignore storage write failures
  }
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
      migrated[key] = {
        ...DEFAULT_KEY_STYLE,
        ...value,
        bgColor: nextBgColor,
      };
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
  } catch {
    // Ignore storage write failures
  }
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
      out.push({
        page,
        row,
        col,
        key: `${page}/${row}/${col}`,
      });
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
  const [selectedDashboardButtonId, setSelectedDashboardButtonId] = useState<string | null>(null);
  const [selectedDeckKey, setSelectedDeckKey] = useState<string | null>(null);
  const [mappings, setMappings] = useState<MappingRecord>(() => safeReadMappings());
  const [textSizes, setTextSizes] = useState<TextSizeRecord>(() => safeReadTextSizes());
  const [keyStyles, setKeyStyles] = useState<KeyStyleRecord>(() => safeReadKeyStyles());
  const [textSizeInput, setTextSizeInput] = useState("10");
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const [previewHostWidth, setPreviewHostWidth] = useState(0);
  const [previewHostHeight, setPreviewHostHeight] = useState(0);
  const [deckDevices, setDeckDevices] = useState<StreamDeckDevice[]>([]);
  const [selectedDeckSerial, setSelectedDeckSerial] = useState<string>(() => readSelectedSerial());
  const [directSyncEnabled, setDirectSyncEnabled] = useState(() => readDirectSyncEnabled());
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const [syncError, setSyncError] = useState("");
  const selectedDevice = useMemo(
    () => deckDevices.find((device) => device.serialNumber === selectedDeckSerial) ?? null,
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
              next.push({
                id: `${project.id}:${itemId}`,
                projectId: project.id,
                projectName: project.name,
                label,
              });
            });
          } catch {
            // Skip project layouts that fail to load
          }
        }
        next.sort((a, b) => {
          if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
          return a.label.localeCompare(b.label);
        });
        if (!disposed) {
          setButtons(next);
        }
      } finally {
        if (!silent && !disposed) setLoadingButtons(false);
      }
    };
    void fetchButtons(false);
    const refreshTimers = [
      window.setTimeout(() => void fetchButtons(true), 700),
      window.setTimeout(() => void fetchButtons(true), 1700),
    ];
    const onFocus = () => {
      void fetchButtons(true);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      refreshTimers.forEach((timerId) => window.clearTimeout(timerId));
      window.removeEventListener("focus", onFocus);
    };
  }, [projects]);

  const buttonById = useMemo(() => {
    const map = new Map<string, DashboardButtonEntry>();
    buttons.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, [buttons]);
  const mappingOptions = useMemo<DashboardButtonEntry[]>(
    () => [
      {
        id: SPECIAL_MAPPING_PAGE_PREVIOUS,
        projectId: -1,
        projectName: "System",
        label: "Page Previous",
      },
      {
        id: SPECIAL_MAPPING_PAGE_NEXT,
        projectId: -1,
        projectName: "System",
        label: "Page Next",
      },
      {
        id: SPECIAL_MAPPING_NONE,
        projectId: -1,
        projectName: "System",
        label: "None",
      },
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

  useEffect(() => {
    let disposed = false;
    if (!isTauri()) return;
    const loadDevices = async () => {
      try {
        const devices = await listStreamDeckDevices();
        if (disposed) return;
        setDeckDevices(devices);
        const hasSelectedSerial = devices.some((device) => device.serialNumber === selectedDeckSerial);
        if (devices.length > 0 && !hasSelectedSerial) {
          const fallbackSerial = devices[0].serialNumber || "";
          setSelectedDeckSerial(fallbackSerial);
          window.localStorage.setItem(STREAMDECK_SELECTED_SERIAL_KEY, fallbackSerial);
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
    const syncFromTopbar = () => {
      setDirectSyncEnabled(readDirectSyncEnabled());
      setSelectedDeckSerial(readSelectedSerial());
    };
    window.addEventListener("autocom:streamdeck-controls-changed", syncFromTopbar as EventListener);
    window.addEventListener("storage", syncFromTopbar);
    return () => {
      window.removeEventListener("autocom:streamdeck-controls-changed", syncFromTopbar as EventListener);
      window.removeEventListener("storage", syncFromTopbar);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STREAMDECK_ACTIVE_PAGE_KEY, String(activePage));
    window.dispatchEvent(new CustomEvent("autocom:streamdeck-active-page-changed"));
  }, [activePage]);

  useEffect(() => {
    const syncActivePage = () => {
      setActivePage(readActivePage());
    };
    window.addEventListener("autocom:streamdeck-active-page-changed", syncActivePage as EventListener);
    window.addEventListener("storage", syncActivePage);
    return () => {
      window.removeEventListener("autocom:streamdeck-active-page-changed", syncActivePage as EventListener);
      window.removeEventListener("storage", syncActivePage);
    };
  }, []);

  useEffect(() => {
    setActivePage((previous) => Math.min(Math.max(1, totalPages), Math.max(1, previous)));
  }, [totalPages]);

  useEffect(() => {
    if (!selectedDevice) return;
    setRows(selectedDevice.rows);
    setCols(selectedDevice.cols);
  }, [selectedDevice]);

  const totalPerPage = Math.max(1, rows) * Math.max(1, cols);
  const deckKeySize = useMemo(() => {
    const safeCols = Math.max(1, cols);
    const safeRows = Math.max(1, rows);
    if (previewHostWidth <= 0) return 90;
    const gap = 2;
    const reserveForControls = 290;
    const fromWidth = Math.floor((previewHostWidth - (safeCols - 1) * gap) / safeCols);
    const fromHeight =
      previewHostHeight > 0
        ? Math.floor((Math.max(0, previewHostHeight - reserveForControls) - (safeRows - 1) * gap) / safeRows)
        : STREAMDECK_KEY_SIZE;
    const next = Math.min(fromWidth, fromHeight);
    return Math.max(44, Math.min(STREAMDECK_KEY_SIZE, next));
  }, [cols, previewHostHeight, previewHostWidth, rows]);
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

  const selectedDeckMappedButton = selectedDeckKey ? mappings[selectedDeckKey] ?? null : null;
  const selectedStyle = selectedDeckKey ? (keyStyles[selectedDeckKey] ?? DEFAULT_KEY_STYLE) : DEFAULT_KEY_STYLE;
  const canMap = Boolean(selectedDashboardButtonId && selectedDeckKey);

  const updateSelectedStyle = (patch: Partial<KeyStyle>) => {
    if (!selectedDeckKey) return;
    const next: KeyStyleRecord = {
      ...keyStyles,
      [selectedDeckKey]: {
        ...(keyStyles[selectedDeckKey] ?? DEFAULT_KEY_STYLE),
        ...patch,
      },
    };
    setKeyStyles(next);
    safeWriteKeyStyles(next);
  };

  const mapSelected = () => {
    if (!selectedDashboardButtonId || !selectedDeckKey) return;
    const next = { ...mappings };
    if (selectedDashboardButtonId === SPECIAL_MAPPING_NONE) {
      delete next[selectedDeckKey];
    } else {
      next[selectedDeckKey] = selectedDashboardButtonId;
    }
    setMappings(next);
    safeWriteMappings(next);
  };

  const unmapSelectedDeck = () => {
    if (!selectedDeckKey || !mappings[selectedDeckKey]) return;
    const next = { ...mappings };
    delete next[selectedDeckKey];
    setMappings(next);
    safeWriteMappings(next);
  };

  useEffect(() => {
    if (!selectedDeckKey) {
      setTextSizeInput("10");
      return;
    }
    const current = textSizes[selectedDeckKey] ?? 10;
    setTextSizeInput(String(current));
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
    const node = previewHostRef.current;
    if (!node) return;
    const update = () => {
      setPreviewHostWidth(node.clientWidth);
      setPreviewHostHeight(node.clientHeight);
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
        if (isStreamDeckTransientDisconnectError(error)) {
          setSyncState("idle");
          setSyncError("");
          return;
        }
        setSyncState("error");
        setSyncError(error instanceof Error ? error.message : "Failed to sync Stream Deck surface.");
      }
    }, 120);
    return () => window.clearTimeout(timerId);
  }, [directSyncEnabled, selectedDevice, syncKeys]);

  return (
    <div className="button-mapping-page flex h-full w-full page-pop overflow-auto xl:overflow-hidden flex-col xl:flex-row" style={{ background: `linear-gradient(180deg, ${t.bgContent} 0%, ${t.bgOuter} 100%)` }}>
      <div className="flex w-full xl:w-1/2 min-w-0 min-h-0 border-b xl:border-b-0 xl:border-r" style={{ borderColor: t.topbarBorder, backgroundColor: t.bgSidebar }}>
        <div className="grid w-full min-w-0 min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_88px] gap-0">
          <section className="min-w-0 min-h-0 md:border-r flex flex-col" style={{ borderColor: t.topbarBorder }}>
            <div
              className="h-[44px] px-3 flex items-center justify-start border-b"
              style={{ borderColor: t.topbarBorder, color: t.textPrimary, backgroundColor: t.bgContent }}
            >
              <span className="text-[15px] font-semibold tracking-[0.01em]">Dashboard Buttons</span>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto app-scrollbar p-2"
              style={{ backgroundColor: t.bgContent }}
            >
              {loadingButtons ? (
                <div className="text-[12px]" style={{ color: t.textSecondary }}>Loading buttons...</div>
              ) : mappingOptions.length === 0 ? (
                <div className="text-[12px]" style={{ color: t.textSecondary }}>No dashboard buttons found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {mappingOptions.map((entry, index) => {
                    const active = selectedDashboardButtonId === entry.id;
                    return (
                      <button
                        key={entry.id}
                        className="w-full px-2.5 py-2.5 border rounded-[8px] text-left transition-colors"
                        style={{
                          borderColor: active ? "rgba(139, 92, 246, 0.5)" : t.topbarBorder,
                          backgroundColor: active
                            ? t.navActive
                            : index % 2 === 0
                              ? t.bgSidebar
                              : t.rowBg,
                          color: t.textPrimary,
                          fontSize: 12,
                        }}
                        onClick={() => setSelectedDashboardButtonId(entry.id)}
                      >
                        <div className="truncate text-center">{entry.label}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="flex flex-col" style={{ borderColor: t.topbarBorder, backgroundColor: t.bgContent }}>
            <div className="h-[44px] border-b" style={{ borderColor: t.topbarBorder }} />
            <div className="flex flex-row md:flex-col items-center gap-2 p-2">
              <button
              className="w-full h-[36px] border rounded-[8px] px-2 py-2 text-[12px] flex items-center justify-center transition-colors"
              style={{
                  borderColor: canMap ? "rgba(139, 92, 246, 0.5)" : t.topbarBorder,
                  backgroundColor: canMap ? t.navActive : t.bgSidebar,
                  color: canMap ? t.textPrimary : t.textSecondary,
                  cursor: canMap ? "pointer" : "not-allowed",
                }}
                onClick={mapSelected}
                disabled={!canMap}
              >
                Map
              </button>
              <button
              className="w-full h-[36px] border rounded-[8px] px-2 py-2 text-[12px] flex items-center justify-center transition-colors"
              style={{
                  borderColor: selectedDeckMappedButton ? "#ef4444" : "rgba(239,68,68,0.5)",
                  backgroundColor: t.bgSidebar,
                  color: selectedDeckMappedButton ? "#ef4444" : t.textSecondary,
                  cursor: selectedDeckMappedButton ? "pointer" : "not-allowed",
                }}
                onClick={unmapSelectedDeck}
                disabled={!selectedDeckMappedButton}
              >
                Unmap
              </button>
            </div>
          </section>

        </div>
      </div>

      <div className="flex w-full xl:w-1/2 min-w-0 flex-col" style={{ backgroundColor: t.bgContent }}>
        <div className="min-h-[44px] px-4 py-2 border-b flex flex-col md:flex-row md:items-center gap-2 md:gap-0 md:justify-between" style={{ borderColor: t.topbarBorder }}>
          <div className="text-[15px] font-semibold tracking-[0.01em]" style={{ color: t.textPrimary }}>
            Stream Deck Preview
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-[12px]" style={{ color: t.textSecondary }}>
            <label className="flex items-center gap-1 text-center">
              Pages
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={totalPages}
                className="w-[36px] h-[24px] border px-0 py-0 rounded-[4px] text-center outline-none focus:border-[rgba(139,92,246,0.5)] focus:ring-0"
                style={{ backgroundColor: t.bgSidebar, borderColor: t.topbarBorder, color: t.textPrimary }}
                onChange={(event) => setTotalPages(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
              />
            </label>
          </div>
        </div>

        {syncState === "error" && syncError ? (
          <div className="px-4 py-1 text-[11px] border-b" style={{ color: "#ef4444", borderColor: t.topbarBorder }}>
            {syncError}
          </div>
        ) : null}

        <div className="flex-1 min-h-0 overflow-hidden p-2 md:p-4">
          <div ref={previewHostRef} className="flex h-full w-full justify-center min-w-0 min-h-0">
            <div className="flex h-full min-h-0 flex-col" style={{ width: deckGridWidth }}>
              <div
                className="grid items-stretch rounded-[12px] p-[2px]"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, cols)}, ${deckKeySize}px)`,
                  columnGap: "2px",
                  rowGap: "2px",
                  backgroundColor: "rgba(15, 23, 42, 0.35)",
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
                  return (
                    <button
                      key={key}
                      className="size-controlled-button rounded-[12px] border-[2px] px-[6px] py-[4px] overflow-hidden flex flex-col items-stretch text-center"
                      style={{
                        width: deckKeySize,
                        height: deckKeySize,
                        borderColor: isSelected ? "rgba(139, 92, 246, 0.5)" : "#2c3138",
                        backgroundColor: style.bgColor,
                        color: style.textColor,
                        boxShadow: isSelected ? "0 0 0 0.5px rgba(139,92,246,0.35)" : "none",
                      }}
                      title={`${entry.page}/${entry.row}/${entry.col}`}
                      onClick={() => setSelectedDeckKey(key)}
                    >
                      {style.topbarEnabled ? (
                        <span
                          className="block w-full truncate text-[10px] text-center pb-[2px] border-b"
                          style={{ borderColor: "rgba(139, 92, 246, 0.5)", color: "rgba(248, 250, 252, 0.6)" }}
                        >
                          {deckAddress}
                        </span>
                      ) : null}
                      <span
                        className="flex-1 flex items-center break-words line-clamp-4 leading-tight"
                        style={{
                          fontSize: keyTextSize,
                          lineHeight: 1.1,
                          justifyContent:
                            style.textAlign === "left" ? "flex-start" : style.textAlign === "right" ? "flex-end" : "center",
                          textAlign: style.textAlign,
                        }}
                      >
                        {customLabel || mapped?.label || specialLabel || ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                className="mt-2 min-h-[35px] flex flex-col md:flex-row md:items-center gap-2"
                style={{ backgroundColor: "transparent" }}
              >
                <div className="flex items-center gap-2">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: t.textPrimary }}>
                    Button text
                  </div>
                  <input
                    type="text"
                    value={selectedStyle.customLabel}
                    disabled={!selectedDeckKey}
                    className="h-[35px] w-[170px] border rounded-[6px] px-2 text-[12px] outline-none"
                    style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, color: t.textPrimary }}
                    onChange={(event) => updateSelectedStyle({ customLabel: event.target.value })}
                    placeholder="Type label"
                  />
                </div>
                <div className="ml-0 md:ml-auto flex items-center gap-2">
                  <button
                    className="h-[35px] border rounded-[6px] px-3 text-[12px] flex items-center justify-start hover:border-[rgba(139,92,246,0.5)] active:border-[rgba(139,92,246,0.5)]"
                    style={{
                      borderColor: t.inputBorder,
                      color: activePage > 1 ? t.textPrimary : t.textSecondary,
                      backgroundColor: t.rowBg,
                      cursor: activePage > 1 ? "pointer" : "not-allowed",
                    }}
                    disabled={activePage <= 1}
                    onClick={() => setActivePage((previous) => Math.max(1, previous - 1))}
                    aria-label="Previous page"
                  >
                    {"<"}
                  </button>
                  <div className="w-[56px] text-center text-[12px]" style={{ color: t.textSecondary }}>
                    {activePage} / {Math.max(1, totalPages)}
                  </div>
                  <button
                    className="h-[35px] border rounded-[6px] px-3 text-[12px] flex items-center justify-start hover:border-[rgba(139,92,246,0.5)] active:border-[rgba(139,92,246,0.5)]"
                    style={{
                      borderColor: t.inputBorder,
                      color: activePage < Math.max(1, totalPages) ? t.textPrimary : t.textSecondary,
                      backgroundColor: t.rowBg,
                      cursor: activePage < Math.max(1, totalPages) ? "pointer" : "not-allowed",
                    }}
                    disabled={activePage >= Math.max(1, totalPages)}
                    onClick={() => setActivePage((previous) => Math.min(Math.max(1, totalPages), previous + 1))}
                    aria-label="Next page"
                  >
                    {">"}
                  </button>
                </div>
              </div>

              <div className="mt-3 min-h-0 flex-1 flex flex-col gap-3" style={{ backgroundColor: "transparent" }}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <label className="flex flex-col gap-1 p-2 border rounded-[8px] text-[12px]" style={{ color: t.textSecondary, borderColor: t.inputBorder, backgroundColor: t.bgSidebar }}>
                    Font size
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={textSizeInput}
                      disabled={!selectedDeckKey}
                      className="h-[36px] border rounded-[4px] px-2 outline-none"
                      style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, color: t.textPrimary }}
                      onChange={(event) => setTextSizeInput(event.target.value)}
                      onBlur={saveSelectedTextSize}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveSelectedTextSize();
                        }
                      }}
                    />
                  </label>

                  <label className="flex flex-col gap-1 p-2 border rounded-[8px] text-[12px]" style={{ color: t.textSecondary, borderColor: t.inputBorder, backgroundColor: t.rowBg }}>
                    Text
                    <input
                      type="color"
                      value={selectedStyle.textColor}
                      disabled={!selectedDeckKey}
                      className="h-[36px] p-0 rounded-[4px]"
                      style={{ backgroundColor: t.rowBg }}
                      onChange={(event) => updateSelectedStyle({ textColor: event.target.value })}
                    />
                  </label>

                  <label className="flex flex-col gap-1 p-2 border rounded-[8px] text-[12px]" style={{ color: t.textSecondary, borderColor: t.inputBorder, backgroundColor: t.bgSidebar }}>
                    BG
                    <input
                      type="color"
                      value={selectedStyle.bgColor}
                      disabled={!selectedDeckKey}
                      className="h-[36px] p-0 rounded-[4px]"
                      style={{ backgroundColor: t.rowBg }}
                      onChange={(event) => updateSelectedStyle({ bgColor: event.target.value })}
                    />
                  </label>

                  <label className="flex flex-col gap-1 p-2 border rounded-[8px] text-[12px]" style={{ color: t.textSecondary, borderColor: t.inputBorder, backgroundColor: t.rowBg }}>
                    Topbar
                    <select
                      className="h-[36px] border rounded-[4px] px-2 outline-none"
                      style={{ backgroundColor: t.rowBg, borderColor: t.inputBorder, color: t.textSecondary }}
                      value={selectedStyle.topbarEnabled ? "show" : "hide"}
                      onChange={(event) => updateSelectedStyle({ topbarEnabled: event.target.value !== "hide" })}
                      disabled={!selectedDeckKey}
                    >
                      <option value="show">On</option>
                      <option value="hide">Off</option>
                    </select>
                  </label>

                  <div className="flex flex-col gap-1 p-2 border rounded-[8px] text-[12px]" style={{ color: t.textPrimary, borderColor: t.inputBorder, backgroundColor: t.bgSidebar }}>
                    Text align
                    <div className="h-[36px] border rounded-[4px] flex overflow-hidden" style={{ borderColor: t.inputBorder }}>
                      {(["left", "center", "right"] as KeyTextAlign[]).map((align) => (
                        <button
                          key={align}
                          className="flex-1 h-full border-r last:border-r-0 text-[11px]"
                          style={{
                            borderColor: t.inputBorder,
                            backgroundColor: selectedStyle.textAlign === align ? t.navActive : t.rowBg,
                            color: selectedStyle.textAlign === align ? t.textPrimary : t.textSecondary,
                          }}
                          onClick={() => updateSelectedStyle({ textAlign: align })}
                          disabled={!selectedDeckKey}
                        >
                          {align.charAt(0).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
