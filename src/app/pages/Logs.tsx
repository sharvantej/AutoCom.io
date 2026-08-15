import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download } from "lucide-react";
import { motion } from "motion/react";
import { useAppContext, useTheme } from "../context/AppContext";

function escapeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export default function Logs() {
  const { logs, logsClearedAt, setLogsClearedAt } = useAppContext();
  const t = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [topBarRightSlot, setTopBarRightSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTopBarRightSlot(document.getElementById("layout-topbar-right-slot"));
  }, []);

  const visibleLogs = logs.filter(l => l.timestamp > logsClearedAt);
  const filteredLogs = query.trim()
    ? visibleLogs.filter((entry) => {
        const haystack = `${entry.label} ${entry.source} ${entry.message}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      })
    : visibleLogs;
  const orderedLogs = [...filteredLogs].sort((a, b) => b.timestamp - a.timestamp); // newest first

  const handleClear = () => setLogsClearedAt(Date.now());

  const handleExport = () => {
    const header = "id,timestamp,label,source,message\n";
    const rows = logs.map(l => [
      l.id,
      l.timestamp,
      escapeCsvCell(l.label),
      escapeCsvCell(l.source),
      escapeCsvCell(l.message),
    ].join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs_export_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const onFocusSearch = () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    const onClearLogs = () => {
      handleClear();
    };
    window.addEventListener("autocom:focus-log-search", onFocusSearch as EventListener);
    window.addEventListener("autocom:clear-logs", onClearLogs as EventListener);
    return () => {
      window.removeEventListener("autocom:focus-log-search", onFocusSearch as EventListener);
      window.removeEventListener("autocom:clear-logs", onClearLogs as EventListener);
    };
  }, [setLogsClearedAt]);

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden page-pop"
      style={{ backgroundColor: t.bgContent, paddingTop: 16 }}
    >
      {topBarRightSlot
        ? createPortal(
            <div className="flex items-center gap-3 text-[12px]" style={{ color: t.textPrimary }}>
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder="Search logs"
                className="outline-none"
                style={{
                  height: 24,
                  width: 160,
                  padding: "0 8px",
                  backgroundColor: t.bgSidebar,
                  border: `1px solid ${t.topbarBorder}`,
                  color: t.textPrimary,
                }}
                onChange={(event) => setQuery(event.target.value)}
              />
              <motion.button
                className="flex items-center justify-center transition-colors hover:bg-[var(--row-hover)]"
                style={{ height: 24, padding: "0 10px", border: `1px solid ${t.topbarBorder}`, backgroundColor: t.bgSidebar, color: t.deleteHover }}
                onClick={handleClear}
                whileTap={{ scale: 0.96 }} transition={{ duration: 0.1 }}
              >
                Clear Logs
              </motion.button>
              <motion.button
                className="flex items-center justify-center gap-[6px] transition-colors hover:bg-[var(--row-hover)]"
                style={{ height: 24, padding: "0 10px", border: `1px solid ${t.topbarBorder}`, backgroundColor: t.bgSidebar, color: t.textPrimary }}
                onClick={handleExport}
                whileTap={{ scale: 0.96 }} transition={{ duration: 0.1 }}
              >
                <Download size={13} />
                <span>Export Logs</span>
              </motion.button>
            </div>,
            topBarRightSlot,
          )
        : null}

      {/* ── Log area ─────────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto mx-[16px] mb-[16px] app-scrollbar card-pop"
        style={{ backgroundColor: t.rowBg }}
      >
        {orderedLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[14px]" style={{ color: t.logEmpty }}>
              No log entries to display.
            </span>
          </div>
        ) : (
          <div className="px-[16px] py-[15px]">
            {orderedLogs.map(entry => (
              <div key={entry.id} className="text-[14px] whitespace-nowrap" style={{ lineHeight: "30px" }}>
                <span style={{ color: t.logTimestamp }}>{entry.label} </span>
                <span style={{ color: t.logSource }}>{entry.source}: </span>
                <span style={{ color: t.textPrimary }}>{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
