import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Connection, FontMode, LogEntry, ThemeMode } from "../types";
import {
  loadActiveProject,
  loadConnections,
  loadLogs,
  saveActiveProject,
  saveConnections,
  saveLogs,
} from "../services/runtimeState";
import { isTauri } from "../services/tauri";

export type { Connection, LogEntry, TaskEntry } from "../types";

export type AppTheme = {
  bgOuter:             string;
  bgSidebar:           string;
  bgContent:           string;
  topbarBorder:        string;
  navActive:           string;
  textPrimary:         string;
  textSecondary:       string;
  textMuted:           string;
  rowBg:               string;
  subLine:             string;
  inputBg:             string;
  inputBorder:         string;
  inputBorderFocus:    string;
  divider:             string;
  modalBg:             string;
  modalBorder:         string;
  btnSecondary:        string;
  deleteHover:         string;
  toggleColor:         string;
  dotColor:            string;
  btnToggleActive:     string;
  btnToggleBorder:     string;
  ctxBg:               string;
  ctxBorder:           string;
  branding:            string;
  projectsHeading:     string;
  logTimestamp:        string;
  logSource:           string;
  logEmpty:            string;
  scrollbarTrack:      string;
  scrollbarThumb:      string;
  scrollbarThumbHover: string;
};

export const darkTheme: AppTheme = {
  bgOuter:             "#030712",
  bgSidebar:           "#101828",
  bgContent:           "#030712",
  topbarBorder:        "#1c202a",
  navActive:           "#1E2939",
  textPrimary:         "#f9fafb",
  textSecondary:       "rgba(249,250,251,0.7)",
  textMuted:           "#99a1af",
  rowBg:               "#101828",
  subLine:             "#27303e",
  inputBg:             "#1a2231",
  inputBorder:         "#32353e",
  inputBorderFocus:    "#1E2939",
  divider:             "#1c202a",
  modalBg:             "#0f1729",
  modalBorder:         "rgba(255,255,255,0.08)",
  btnSecondary:        "#1E2939",
  deleteHover:         "#ff6467",
  toggleColor:         "#00c951",
  dotColor:            "#00720d",
  btnToggleActive:     "rgba(30,41,57,0.24)",
  btnToggleBorder:     "#1E2939",
  ctxBg:               "#101828",
  ctxBorder:           "#28303e",
  branding:            "rgba(249,250,251,0.7)",
  projectsHeading:     "rgba(249,250,251,0.55)",
  logTimestamp:        "rgba(249,250,251,0.45)",
  logSource:           "rgba(249,250,251,0.6)",
  logEmpty:            "rgba(249,250,251,0.25)",
  scrollbarTrack:      "#101828",
  scrollbarThumb:      "#32353e",
  scrollbarThumbHover: "#4b5563",
};

export const lightTheme: AppTheme = {
  bgOuter:             "#f1f5f9",
  bgSidebar:           "#e2e8f0",
  bgContent:           "#f8fafc",
  topbarBorder:        "#cbd5e1",
  navActive:           "#1E2939",
  textPrimary:         "#0f172a",
  textSecondary:       "rgba(15,23,42,0.7)",
  textMuted:           "#64748b",
  rowBg:               "#e2e8f0",
  subLine:             "#94a3b8",
  inputBg:             "#f8fafc",
  inputBorder:         "#94a3b8",
  inputBorderFocus:    "#1E2939",
  divider:             "#cbd5e1",
  modalBg:             "#f1f5f9",
  modalBorder:         "rgba(0,0,0,0.12)",
  btnSecondary:        "rgba(30,41,57,0.2)",
  deleteHover:         "#dc2626",
  toggleColor:         "#16a34a",
  dotColor:            "#15803d",
  btnToggleActive:     "rgba(30,41,57,0.2)",
  btnToggleBorder:     "#1E2939",
  ctxBg:               "#f1f5f9",
  ctxBorder:           "#cbd5e1",
  branding:            "rgba(15,23,42,0.7)",
  projectsHeading:     "rgba(15,23,42,0.55)",
  logTimestamp:        "rgba(15,23,42,0.45)",
  logSource:           "rgba(15,23,42,0.6)",
  logEmpty:            "rgba(15,23,42,0.25)",
  scrollbarTrack:      "#e2e8f0",
  scrollbarThumb:      "#94a3b8",
  scrollbarThumbHover: "#64748b",
};

type AppContextValue = {
  connections:      Connection[];
  setConnections:   React.Dispatch<React.SetStateAction<Connection[]>>;
  activeProjectPath:     string | null;
  setActiveProjectPath:  React.Dispatch<React.SetStateAction<string | null>>;
  recentProjectPaths:    string[];
  setRecentProjectPaths: React.Dispatch<React.SetStateAction<string[]>>;
  logs:             LogEntry[];
  setLogs:          React.Dispatch<React.SetStateAction<LogEntry[]>>;
  logsClearedAt:    number;
  setLogsClearedAt: React.Dispatch<React.SetStateAction<number>>;
  theme:            ThemeMode;
  setTheme:         React.Dispatch<React.SetStateAction<ThemeMode>>;
  font:             FontMode;
  setFont:          React.Dispatch<React.SetStateAction<FontMode>>;
  runtimeLoaded:    boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEYS = {
  connections:   "autocom.connections",
  activeProjectPath:  "autocom.activeProjectPath",
  recentProjectPaths: "autocom.recentProjectPaths",
  logs:          "autocom.logs",
  logsClearedAt: "autocom.logsClearedAt",
  theme:         "autocom.theme",
  font:          "autocom.font",
} as const;

const MAX_LOGS = 500;

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStoredValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures (quota/private mode).
  }
}

function computeRecentProjectPaths(current: string[], path: string | null): string[] {
  if (path === null) return current;
  return [path, ...current.filter((existing) => existing !== path)].slice(0, 8);
}

/// Non-Tauri (browser) fallback: connections are scoped per-project, mirroring
/// how the Tauri backend now stores them inside each project's own XML file
/// instead of one shared global file. This browser-mode path is a local dev
/// convenience only — real projects (Tauri mode) live entirely as files on
/// disk the user picks via native dialogs, not in any app-managed storage.
function connectionsStorageKey(projectPath: string | null): string | null {
  return projectPath === null ? null : `${STORAGE_KEYS.connections}.${projectPath}`;
}

function readStoredConnectionsForProject(projectPath: string | null): Connection[] {
  const key = connectionsStorageKey(projectPath);
  if (!key) return [];
  return readStoredValue<Connection[]>(key, []);
}

function writeStoredConnectionsForProject(projectPath: string | null, connections: Connection[]) {
  const key = connectionsStorageKey(projectPath);
  if (!key) return;
  writeStoredValue(key, connections);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const tauriRuntime = isTauri();

  const [activeProjectPath, setActiveProjectPath] = useState<string | null>(() =>
    tauriRuntime
      ? null
      : readStoredValue<string | null>(STORAGE_KEYS.activeProjectPath, null),
  );
  const [connections, setConnections] = useState<Connection[]>(() =>
    tauriRuntime ? [] : readStoredConnectionsForProject(
      readStoredValue<string | null>(STORAGE_KEYS.activeProjectPath, null),
    ),
  );
  const lastConnectionsProjectPathRef = useRef<string | null>(activeProjectPath);
  const [recentProjectPaths, setRecentProjectPaths] = useState<string[]>(() =>
    tauriRuntime
      ? []
      : readStoredValue<string[]>(STORAGE_KEYS.recentProjectPaths, []),
  );
  const [logs, setLogs] = useState<LogEntry[]>(() =>
    tauriRuntime
      ? []
      : readStoredValue<LogEntry[]>(STORAGE_KEYS.logs, []).slice(0, MAX_LOGS),
  );
  const [logsClearedAt, setLogsClearedAt] = useState<number>(() =>
    readStoredValue<number>(STORAGE_KEYS.logsClearedAt, 0),
  );
  const [theme, setTheme] = useState<ThemeMode>(() =>
    readStoredValue<ThemeMode>(STORAGE_KEYS.theme, "dark"),
  );
  const [font, setFont] = useState<FontMode>(() =>
    readStoredValue<FontMode>(STORAGE_KEYS.font, "mono"),
  );
  const [runtimeLoaded, setRuntimeLoaded] = useState<boolean>(() => !tauriRuntime);

  useEffect(() => {
    if (!tauriRuntime) {
      setRuntimeLoaded(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [nextConnections, nextLogs, nextActiveProject] =
          await Promise.all([
            loadConnections(),
            loadLogs(),
            loadActiveProject(),
          ]);
        if (cancelled) return;
        setConnections(nextConnections);
        setLogs(nextLogs.slice(0, MAX_LOGS));
        setActiveProjectPath(nextActiveProject.activeProjectPath);
        setRecentProjectPaths(nextActiveProject.recentProjectPaths);
        lastConnectionsProjectPathRef.current = nextActiveProject.activeProjectPath;
      } catch (error) {
        console.error("Failed to load runtime state from Tauri backend:", error);
        if (cancelled) return;
        const fallbackActiveProjectPath = readStoredValue<string | null>(
          STORAGE_KEYS.activeProjectPath,
          null,
        );
        setConnections(readStoredConnectionsForProject(fallbackActiveProjectPath));
        setLogs(readStoredValue<LogEntry[]>(STORAGE_KEYS.logs, []).slice(0, MAX_LOGS));
        setActiveProjectPath(fallbackActiveProjectPath);
        setRecentProjectPaths(
          readStoredValue<string[]>(STORAGE_KEYS.recentProjectPaths, []),
        );
        lastConnectionsProjectPathRef.current = fallbackActiveProjectPath;
      } finally {
        if (!cancelled) setRuntimeLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tauriRuntime]);

  useEffect(() => {
    if (!runtimeLoaded) return;
    if (!tauriRuntime) {
      writeStoredConnectionsForProject(activeProjectPath, connections);
      return;
    }
    void saveConnections(connections).catch((error) => {
      console.error("Failed to save connections to Tauri backend:", error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, runtimeLoaded, tauriRuntime]);

  // Connections are scoped to whichever project is active (backend resolves
  // `/api/connections` against it transparently; the browser fallback keys
  // localStorage by project path) — reload them whenever the active project
  // changes. Skips the very first run after each load, since the initial
  // Promise.all load (or the fallback branch above) already fetched the
  // right project's connections.
  useEffect(() => {
    if (!runtimeLoaded) return;
    if (lastConnectionsProjectPathRef.current === activeProjectPath) return;
    lastConnectionsProjectPathRef.current = activeProjectPath;
    if (!tauriRuntime) {
      setConnections(readStoredConnectionsForProject(activeProjectPath));
      return;
    }
    void loadConnections()
      .then((next) => setConnections(next))
      .catch((error) => {
        console.error("Failed to load connections for active project:", error);
      });
  }, [activeProjectPath, runtimeLoaded, tauriRuntime]);

  useEffect(() => {
    if (!runtimeLoaded) return;
    if (!tauriRuntime) {
      writeStoredValue(STORAGE_KEYS.activeProjectPath, activeProjectPath);
      setRecentProjectPaths((prev) => {
        const next = computeRecentProjectPaths(prev, activeProjectPath);
        writeStoredValue(STORAGE_KEYS.recentProjectPaths, next);
        return next;
      });
      return;
    }
    void saveActiveProject(activeProjectPath)
      .then((state) => {
        setRecentProjectPaths(state.recentProjectPaths);
      })
      .catch((error) => {
        console.error("Failed to save active project to Tauri backend:", error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectPath, runtimeLoaded, tauriRuntime]);

  useEffect(() => {
    if (!runtimeLoaded) return;
    const nextLogs = logs.slice(0, MAX_LOGS);
    if (nextLogs.length !== logs.length) {
      setLogs(nextLogs);
      return;
    }

    if (!tauriRuntime) {
      writeStoredValue(STORAGE_KEYS.logs, nextLogs);
      return;
    }
    void saveLogs(nextLogs).catch((error) => {
      console.error("Failed to save logs to Tauri backend:", error);
    });
  }, [logs, runtimeLoaded, tauriRuntime]);

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.logsClearedAt, logsClearedAt);
  }, [logsClearedAt]);

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.font, font);
  }, [font]);

  return (
    <AppContext.Provider value={{
      connections,
      setConnections,
      activeProjectPath,
      setActiveProjectPath,
      recentProjectPaths,
      setRecentProjectPaths,
      logs,
      setLogs,
      logsClearedAt,
      setLogsClearedAt,
      theme,
      setTheme,
      font,
      setFont,
      runtimeLoaded,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside <AppProvider>");
  return ctx;
}

export function useTheme(): AppTheme {
  const { theme } = useAppContext();
  return theme === "dark" ? darkTheme : lightTheme;
}

