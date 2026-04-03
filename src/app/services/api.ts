import type { Connection, LogEntry, Project } from "../types";
import {
  loadConnections,
  loadLogs,
  loadProjects,
  saveConnections,
  saveLogs,
  saveProjects,
} from "./runtimeState";

export const USE_MOCK_DATA = false;

export async function fetchProjects(): Promise<Project[]> {
  return loadProjects();
}

export async function createProject(name: string): Promise<Project> {
  const projects = await loadProjects();
  const project = { id: Date.now(), name };
  await saveProjects([...projects, project]);
  return project;
}

export async function updateProject(id: number, name: string): Promise<Project> {
  const projects = await loadProjects();
  const project = { id, name };
  await saveProjects(projects.map((entry) => (entry.id === id ? project : entry)));
  return project;
}

export async function deleteProject(id: number): Promise<void> {
  const projects = await loadProjects();
  await saveProjects(projects.filter((entry) => entry.id !== id));
}

export async function fetchConnections(): Promise<Connection[]> {
  return loadConnections();
}

export async function createConnection(
  data: Omit<Connection, "id">,
): Promise<Connection> {
  const connections = await loadConnections();
  const connection = { ...data, id: Date.now() };
  await saveConnections([...connections, connection]);
  return connection;
}

export async function updateConnection(
  id: number,
  data: Partial<Omit<Connection, "id">>,
): Promise<Connection> {
  const connections = await loadConnections();
  const current = connections.find((entry) => entry.id === id);
  if (!current) {
    throw new Error(`Connection ${id} not found`);
  }
  const nextConnection = { ...current, ...data };
  await saveConnections(
    connections.map((entry) => (entry.id === id ? nextConnection : entry)),
  );
  return nextConnection;
}

export async function deleteConnection(id: number): Promise<void> {
  const connections = await loadConnections();
  await saveConnections(connections.filter((entry) => entry.id !== id));
}

export async function toggleConnection(id: number, active: boolean): Promise<void> {
  const connections = await loadConnections();
  await saveConnections(
    connections.map((entry) => (
      entry.id === id
        ? { ...entry, active }
        : entry
    )),
  );
}

export async function fetchLogs(): Promise<LogEntry[]> {
  return loadLogs();
}

export function buildLogsCsv(logs: LogEntry[]): string {
  const header = "id,timestamp,label,source,message\n";
  const rows = logs
    .map((log) =>
      [
        log.id,
        log.timestamp,
        `"${log.label}"`,
        `"${log.source}"`,
        `"${log.message.replace(/"/g, "\"\"")}"`,
      ].join(","),
    )
    .join("\n");
  return header + rows;
}

export async function replaceLogs(logs: LogEntry[]): Promise<void> {
  await saveLogs(logs);
}
