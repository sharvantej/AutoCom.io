/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOCK / SEED DATA
 * This file contains all hardcoded placeholder data used while
 * USE_MOCK_DATA = true in services/api.ts.
 *
 * TO REMOVE MOCK DATA: set USE_MOCK_DATA = false in services/api.ts
 * and implement the real fetch calls there.  Nothing else needs to change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Connection, LogEntry, Project } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtLabel(d: Date): string {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}:${ss}`;
}

function makeLogs(): LogEntry[] {
  const entries: LogEntry[] = [];
  const base = new Date("2026-02-28T12:46:46");
  const sources = [
    { src: "Instance/Wrapper/vmix",     msg: "Function Socket err: connect ECONNREFUSED 127.0.0.1:8099" },
    { src: "Instance/Wrapper/obs",      msg: "WebSocket connected to 192.168.2.175:4455" },
    { src: "Instance/Wrapper/resolume", msg: "OSC listener bound on 192.168.2.195:7000" },
    { src: "Instance/Wrapper/vmix",     msg: "Function Socket err: connect ECONNREFUSED 127.0.0.1:8099" },
    { src: "Instance/Wrapper/obs",      msg: "Heartbeat received: scene=Main" },
    { src: "Instance/Wrapper/vmix",     msg: "Reconnecting attempt 3 of 5..." },
    { src: "Instance/Wrapper/resolume", msg: "Clip triggered: /composition/columns/1/connect" },
    { src: "Instance/Wrapper/vmix",     msg: "Function Socket err: connect ECONNREFUSED 127.0.0.1:8099" },
  ];
  for (let i = 0; i < 32; i++) {
    const d = new Date(base.getTime() + i * 2000);
    const s = sources[i % sources.length];
    entries.push({ id: i + 1, timestamp: d.getTime(), label: fmtLabel(d), source: s.src, message: s.msg });
  }
  return entries;
}

// ── Mock datasets ─────────────────────────────────────────────────────────────

export const MOCK_PROJECTS: Project[] = [
  { id: 1, name: "BGIS 2026" },
  { id: 2, name: "BGIS 2024" },
  { id: 3, name: "VCT CN 2026" },
];

export const MOCK_CONNECTIONS: Connection[] = [
  { id: 1, name: "vMix",           ip: "192.168.2.150", port: "8099", protocol: "TCP API",   device: "vMix",           path: "", active: true,  projectId: 1 },
  { id: 2, name: "OBS Studio",     ip: "192.168.2.175", port: "4455", protocol: "WebSocket", device: "OBS Studio",     path: "", active: true,  projectId: 1 },
  { id: 3, name: "Resolume Arena", ip: "192.168.2.195", port: "7000", protocol: "OSC",       device: "Resolume Arena", path: "", active: true,  projectId: 1 },
];

export const MOCK_LOGS: LogEntry[] = makeLogs();
