import React, { createContext, useContext, useEffect, useState } from "react";
import type { Connection, FontMode, LogEntry, Project, ThemeMode } from "../types";
import {
  loadConnections,
  loadLogs,
  loadProjects,
  saveConnections,
  saveLogs,
  saveProjects,
} from "../services/runtimeState";
import { isTauri } from "../services/tauri";

export type { Connection, LogEntry, Project, TaskEntry } from "../types";

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
  projects:         Project[];
  setProjects:      React.Dispatch<React.SetStateAction<Project[]>>;
  connections:      Connection[];
  setConnections:   React.Dispatch<React.SetStateAction<Connection[]>>;
  logs:             LogEntry[];
  setLogs:          React.Dispatch<React.SetStateAction<LogEntry[]>>;
  logsClearedAt:    number;
  setLogsClearedAt: React.Dispatch<React.SetStateAction<number>>;
  theme:            ThemeMode;
  setTheme:         React.Dispatch<React.SetStateAction<ThemeMode>>;
  font:             FontMode;
  setFont:          React.Dispatch<React.SetStateAction<FontMode>>;
  sidebarOpen:      boolean;
  setSidebarOpen:   React.Dispatch<React.SetStateAction<boolean>>;
};

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEYS = {
  projects:      "autocom.projects",
  connections:   "autocom.connections",
  logs:          "autocom.logs",
  logsClearedAt: "autocom.logsClearedAt",
  theme:         "autocom.theme",
  font:          "autocom.font",
  sidebarOpen:   "autocom.sidebarOpen",
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const tauriRuntime = isTauri();

  const [projects, setProjects] = useState<Project[]>(() =>
    tauriRuntime
      ? []
      : readStoredValue<Project[]>(STORAGE_KEYS.projects, []),
  );
  const [connections, setConnections] = useState<Connection[]>(() =>
    tauriRuntime
      ? []
      : readStoredValue<Connection[]>(STORAGE_KEYS.connections, []),
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
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    readStoredValue<boolean>(STORAGE_KEYS.sidebarOpen, true),
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
        const [nextProjects, nextConnections, nextLogs] = await Promise.all([
          loadProjects(),
          loadConnections(),
          loadLogs(),
        ]);
        if (cancelled) return;
        setProjects(nextProjects);
        setConnections(nextConnections);
        setLogs(nextLogs.slice(0, MAX_LOGS));
      } catch (error) {
        console.error("Failed to load runtime state from Tauri backend:", error);
        if (cancelled) return;
        setProjects(readStoredValue<Project[]>(STORAGE_KEYS.projects, []));
        setConnections(readStoredValue<Connection[]>(STORAGE_KEYS.connections, []));
        setLogs(readStoredValue<LogEntry[]>(STORAGE_KEYS.logs, []).slice(0, MAX_LOGS));
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
      writeStoredValue(STORAGE_KEYS.projects, projects);
      return;
    }
    void saveProjects(projects).catch((error) => {
      console.error("Failed to save projects to Tauri backend:", error);
    });
  }, [projects, runtimeLoaded, tauriRuntime]);

  useEffect(() => {
    if (!runtimeLoaded) return;
    if (!tauriRuntime) {
      writeStoredValue(STORAGE_KEYS.connections, connections);
      return;
    }
    void saveConnections(connections).catch((error) => {
      console.error("Failed to save connections to Tauri backend:", error);
    });
  }, [connections, runtimeLoaded, tauriRuntime]);

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

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.sidebarOpen, sidebarOpen);
  }, [sidebarOpen]);

  return (
    <AppContext.Provider value={{
      projects,
      setProjects,
      connections,
      setConnections,
      logs,
      setLogs,
      logsClearedAt,
      setLogsClearedAt,
      theme,
      setTheme,
      font,
      setFont,
      sidebarOpen,
      setSidebarOpen,
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

