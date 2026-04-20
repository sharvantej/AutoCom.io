import { useRef, useEffect, useState } from "react";
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
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0 px-[16px]" style={{ marginBottom: 12 }}>
        <span className="text-[16px]" style={{ color: t.textPrimary }}>Live logs</span>

        <div className="flex items-center" style={{ gap: 15 }}>
          <input
            ref={searchRef}
            type="text"
            value={query}
            placeholder="Search logs"
            className="px-[10px] text-[14px] outline-none"
            style={{
              height: 35,
              width: 200,
              backgroundColor: t.rowBg,
              border: `1px solid ${t.topbarBorder}`,
              color: t.textPrimary,
            }}
            onChange={(event) => setQuery(event.target.value)}
          />
          <motion.button
            className="flex items-center justify-center text-[14px] hover:bg-[var(--row-hover)] transition-colors"
            style={{ height: 35, width: 116, backgroundColor: t.rowBg, color: t.deleteHover }}
            onClick={handleClear}
            whileTap={{ scale: 0.96 }} transition={{ duration: 0.1 }}
          >
            Clear Logs
          </motion.button>

          <motion.button
            className="flex items-center justify-center gap-[8px] text-[14px] hover:bg-[var(--row-hover)] transition-colors"
            style={{ height: 35, width: 141, backgroundColor: t.rowBg, color: t.textPrimary }}
            onClick={handleExport}
            whileTap={{ scale: 0.96 }} transition={{ duration: 0.1 }}
          >
            <Download size={16} />
            <span>Export Logs</span>
          </motion.button>
        </div>
      </div>

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
