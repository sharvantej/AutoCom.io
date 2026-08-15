import type { Connection, LogEntry } from "../types";
import {
  buildBackendConnectionsPayload,
  parseBackendConnectionsPayload,
} from "./connections";
import { isTauri, tauriInvoke } from "./tauri";

type RuntimeApiEvent = {
  name: string;
  data: unknown;
};

export type RuntimeApiResponse<T = unknown> = {
  status: number;
  body: T;
  events: RuntimeApiEvent[];
};

type DashboardLayout<T> = {
  items: T[];
};

type Swp08RouterName = {
  id: number;
  label: string;
};

type Swp08RouterNamesResponse = {
  sourceNames?: Swp08RouterName[];
  destinationNames?: Swp08RouterName[];
};

type VideohubRouterLabel = {
  id: number;
  label: string;
};

type VideohubRouterLabelsResponse = {
  inputLabels?: VideohubRouterLabel[];
  outputLabels?: VideohubRouterLabel[];
};

async function requestRuntimeState<T>(
  method: string,
  path: string,
  body?: unknown,
  timeout: number = 5000,
): Promise<RuntimeApiResponse<T>> {
  if (!isTauri()) {
    throw new Error(`Runtime state request requires Tauri: ${method} ${path}`);
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timeout: ${method} ${path}`)), timeout)
  );

  return Promise.race([
    tauriInvoke<RuntimeApiResponse<T>>("api_request", {
      method,
      path,
      body,
    }),
    timeoutPromise,
  ]);
}

function ensureSuccess<T>(
  response: RuntimeApiResponse<T>,
  fallbackMessage: string,
): T {
  if (response.status < 400) {
    return response.body;
  }

  const body =
    response.body && typeof response.body === "object"
      ? (response.body as Record<string, unknown>)
      : null;
  const errorMessage =
    typeof body?.error === "string" ? body.error : fallbackMessage;
  throw new Error(errorMessage);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function loadConnections(): Promise<Connection[]> {
  const response = await requestRuntimeState<unknown>("GET", "/api/connections");
  return parseBackendConnectionsPayload(
    ensureSuccess(response, "Failed to load connections"),
  );
}

export async function saveConnections(
  connections: Connection[],
): Promise<void> {
  const response = await requestRuntimeState<Record<string, unknown>>(
    "POST",
    "/api/connections",
    buildBackendConnectionsPayload(connections),
  );
  ensureSuccess(response, "Failed to save connections");
}

/** Read-only, explicit-path variant of `loadConnections` — for reading a
 *  specific (possibly non-active) project's connections. Needed by Stream
 *  Deck button execution, whose mappings reference whichever project they
 *  were created in, not necessarily whatever's active right now. */
export async function loadConnectionsForProject(projectPath: string): Promise<Connection[]> {
  const response = await requestRuntimeState<unknown>("GET", "/api/connections", { path: projectPath });
  return parseBackendConnectionsPayload(
    ensureSuccess(response, "Failed to load project connections"),
  );
}

export type ActiveProjectState = {
  activeProjectPath: string | null;
  recentProjectPaths: string[];
};

function asActiveProjectState(value: unknown): ActiveProjectState {
  const body =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const activeProjectPath =
    typeof body.activeProjectPath === "string" ? body.activeProjectPath : null;
  const recentProjectPaths = Array.isArray(body.recentProjectPaths)
    ? body.recentProjectPaths.filter((p): p is string => typeof p === "string")
    : [];
  return { activeProjectPath, recentProjectPaths };
}

export async function loadActiveProject(): Promise<ActiveProjectState> {
  const response = await requestRuntimeState<unknown>("GET", "/api/active-project");
  return asActiveProjectState(ensureSuccess(response, "Failed to load active project"));
}

export async function saveActiveProject(
  activeProjectPath: string | null,
): Promise<ActiveProjectState> {
  const response = await requestRuntimeState<unknown>(
    "POST",
    "/api/active-project",
    { activeProjectPath },
  );
  return asActiveProjectState(ensureSuccess(response, "Failed to save active project"));
}

/** Native "Open" file dialog for choosing a project file directly off disk —
 *  returns the chosen absolute path, or null if the dialog was cancelled. */
export async function pickOpenProjectFile(): Promise<string | null> {
  return tauriInvoke<string | null>("pick_open_project_file");
}

/** Native "Save As" dialog for choosing where a new project file should
 *  live; the backend writes a blank project there immediately. Returns the
 *  chosen absolute path, or null if the dialog was cancelled. */
export async function pickNewProjectFile(): Promise<string | null> {
  return tauriInvoke<string | null>("pick_new_project_file");
}

/** Native "Save As" dialog — copies the currently active project's file to
 *  a new location (backend-driven, so it can't race with in-memory
 *  frontend state). Returns the new path, or null if cancelled. */
export async function pickSaveProjectAs(): Promise<string | null> {
  return tauriInvoke<string | null>("pick_save_project_as");
}

export async function loadLogs(): Promise<LogEntry[]> {
  const response = await requestRuntimeState<unknown>("GET", "/api/logs");
  return asArray<LogEntry>(ensureSuccess(response, "Failed to load logs"));
}

export async function saveLogs(logs: LogEntry[]): Promise<void> {
  const response = await requestRuntimeState<Record<string, unknown>>(
    "POST",
    "/api/logs",
    logs,
  );
  ensureSuccess(response, "Failed to save logs");
}

export async function loadDashboardLayout<T>(projectPath: string): Promise<T[]> {
  const response = await requestRuntimeState<unknown>(
    "GET",
    "/api/layout",
    { path: projectPath },
  );
  const body = ensureSuccess(response, "Failed to load dashboard layout");
  const layout =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as DashboardLayout<T>)
      : { items: [] };
  return Array.isArray(layout.items) ? layout.items : [];
}

export async function saveDashboardLayout<T>(
  projectPath: string,
  items: T[],
): Promise<void> {
  const response = await requestRuntimeState<Record<string, unknown>>(
    "POST",
    "/api/layout",
    { path: projectPath, items },
  );
  ensureSuccess(response, "Failed to save dashboard layout");
}

export async function loadSwp08RouterNames(payload: {
  host: string;
  port?: number;
  matrix?: number;
  matrixExt?: number;
  extendedSupport?: boolean;
  nameChars?: number;
}): Promise<{
  sourceNames: Swp08RouterName[];
  destinationNames: Swp08RouterName[];
}> {
  const response = await requestRuntimeState<Swp08RouterNamesResponse>(
    "POST",
    "/api/swp08/names",
    payload,
  );
  const body = ensureSuccess(response, "Failed to load SWP08 names");
  return {
    sourceNames: Array.isArray(body?.sourceNames) ? body.sourceNames : [],
    destinationNames: Array.isArray(body?.destinationNames) ? body.destinationNames : [],
  };
}

export async function loadVideohubRouterLabels(payload: {
  host: string;
  port?: number;
}): Promise<{
  inputLabels: VideohubRouterLabel[];
  outputLabels: VideohubRouterLabel[];
}> {
  const response = await requestRuntimeState<VideohubRouterLabelsResponse>(
    "POST",
    "/api/videohub/labels",
    payload,
  );
  const body = ensureSuccess(response, "Failed to load VideoHub labels");
  return {
    inputLabels: Array.isArray(body?.inputLabels) ? body.inputLabels : [],
    outputLabels: Array.isArray(body?.outputLabels) ? body.outputLabels : [],
  };
}
