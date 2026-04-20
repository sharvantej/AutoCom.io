import type { Connection, LogEntry, Project } from "../types";
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

export async function loadProjects(): Promise<Project[]> {
  const response = await requestRuntimeState<unknown>("GET", "/api/projects");
  return asArray<Project>(ensureSuccess(response, "Failed to load projects"));
}

export async function saveProjects(projects: Project[]): Promise<void> {
  const response = await requestRuntimeState<Record<string, unknown>>(
    "POST",
    "/api/projects",
    projects,
  );
  ensureSuccess(response, "Failed to save projects");
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

export async function loadDashboardLayout<T>(projectId: string): Promise<T[]> {
  const response = await requestRuntimeState<unknown>(
    "GET",
    `/api/layout/${projectId}`,
  );
  const body = ensureSuccess(response, "Failed to load dashboard layout");
  const layout =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as DashboardLayout<T>)
      : { items: [] };
  return Array.isArray(layout.items) ? layout.items : [];
}

export async function saveDashboardLayout<T>(
  projectId: string,
  items: T[],
): Promise<void> {
  const response = await requestRuntimeState<Record<string, unknown>>(
    "POST",
    `/api/layout/${projectId}`,
    { items },
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
