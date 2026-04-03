/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TAURI v2 REAL-TIME EVENT SUBSCRIPTIONS
 *
 * Uses window.__TAURI_INTERNALS__ directly — the same low-level API that
 * @tauri-apps/api/event wraps — so this file has zero package imports and
 * works in any Vite environment without resolver errors.
 *
 * ── HOW IT WORKS INTERNALLY ──────────────────────────────────────────────────
 *   1. transformCallback() registers a one-shot JS callback and returns a
 *      numeric handler ID that Tauri's Rust side can reference.
 *   2. invoke("plugin:event|listen", { event, target, handler }) tells the
 *      Rust event system to call that handler for every matching event.
 *   3. invoke("plugin:event|unlisten", { event, eventId }) removes it.
 *
 * ── RUST SIDE — emit events from any command / async task ────────────────────
 *
 *   // New log line from a protocol wrapper (TCP / WS / OSC / UDP …):
 *   app_handle.emit("log-entry", LogEntry {
 *     id: next_id,
 *     timestamp: chrono::Utc::now().timestamp_millis() as u64,
 *     label: label.clone(),
 *     source: "Instance/Wrapper/obs".into(),
 *     message: line.clone(),
 *   })?;
 *
 *   // Connection active state confirmed at transport layer:
 *   app_handle.emit("connection-status", ConnectionStatus { id, active })?;
 *
 * ── RUST STRUCTS ─────────────────────────────────────────────────────────────
 *
 *   #[derive(serde::Serialize, Clone)]
 *   pub struct LogEntry {
 *     pub id: u64, pub timestamp: u64,
 *     pub label: String, pub source: String, pub message: String,
 *   }
 *
 *   #[derive(serde::Serialize, Clone)]
 *   pub struct ConnectionStatus { pub id: u32, pub active: bool }
 *
 * ── PERMISSION — src-tauri/capabilities/default.json ─────────────────────────
 *   "core:event:default"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { LogEntry } from "../types";
import { isTauri, tauriInvoke } from "./tauri";

type ConnectionStatusPayload = { id: number; active: boolean };
export type DeviceStatusPayload = {
  status?: string;
  type?: string;
  protocol?: string;
  enabled?: boolean;
  host?: string;
  port?: string | number;
  lastError?: string | null;
  lastSeen?: number | null;
  httpStatus?: number | null;
};
type RuntimeStatusResponse = {
  status: number;
  body?: unknown;
  events?: unknown[];
};

// ── Internal event bridge ─────────────────────────────────────────────────────

/**
 * Low-level event listener using window.__TAURI_INTERNALS__.
 * Returns a Promise that resolves to an unlisten function.
 * Falls back to a no-op when not running inside Tauri
 * (browser dev environment, mock mode, etc.).
 */
async function tauriListen<T>(
  event: string,
  callback: (payload: T) => void,
): Promise<() => void> {
  const internals = window.__TAURI_INTERNALS__;
  if (!internals) {
    // Not in Tauri (browser / Figma Make preview) — silently no-op.
    return () => {};
  }

  // Register the JS callback and get a numeric handler ID.
  const handlerId = internals.transformCallback((raw: unknown) => {
    const payload =
      raw && typeof raw === "object" && "payload" in (raw as Record<string, unknown>)
        ? (raw as { payload: T }).payload
        : (raw as T);
    callback(payload);
  });

  // Tell the Rust event system to call our handler for this event.
  const eventId = await internals.invoke<number>("plugin:event|listen", {
    event,
    target: { kind: "Any" },
    handler: handlerId,
  });

  // Return the unlisten function.
  return async () => {
    await internals.invoke("plugin:event|unlisten", {
      event,
      eventId,
    });
  };
}

// ── Public subscription helpers ───────────────────────────────────────────────

/**
 * Subscribe to live log entries from the Rust backend.
 * Returns a Promise<UnlistenFn> — resolve it in useEffect cleanup.
 *
 * @example
 * useEffect(() => {
 *   const unlisten = subscribeToLogs(entry =>
 *     setLogs(prev => [entry, ...prev].slice(0, 500))
 *   );
 *   return () => { unlisten.then(fn => fn()); };
 * }, [setLogs]);
 */
export function subscribeToLogs(
  callback: (entry: LogEntry) => void,
): Promise<() => void> {
  return tauriListen<LogEntry>("log-entry", callback);
}

/**
 * Subscribe to connection status changes from Rust.
 * Returns a Promise<UnlistenFn>.
 *
 * @example
 * useEffect(() => {
 *   const unlisten = subscribeToConnectionStatus(({ id, active }) =>
 *     setConnections(prev => prev.map(c => c.id === id ? { ...c, active } : c))
 *   );
 *   return () => { unlisten.then(fn => fn()); };
 * }, [setConnections]);
 */
export function subscribeToConnectionStatus(
  callback: (status: ConnectionStatusPayload) => void,
): Promise<() => void> {
  return tauriListen<ConnectionStatusPayload>("connection-status", callback);
}

/**
 * Subscribe to the backend's device status map.
 * Event name is emitted by src-tauri/src/state/status.rs as "deviceStatusUpdate".
 */
export function subscribeToDeviceStatusUpdate(
  callback: (statuses: Record<string, DeviceStatusPayload>) => void,
): Promise<() => void> {
  return tauriListen<Record<string, DeviceStatusPayload>>(
    "deviceStatusUpdate",
    callback,
  );
}

export async function fetchDeviceStatusSnapshot(): Promise<Record<string, DeviceStatusPayload>> {
  if (!isTauri()) return {};
  try {
    const response = await tauriInvoke<RuntimeStatusResponse>("api_request", {
      method: "GET",
      path: "/api/status",
    });
    if (response.status >= 400) return {};
    const body =
      response.body && typeof response.body === "object" && !Array.isArray(response.body)
        ? (response.body as Record<string, unknown>)
        : {};
    const devices = body.devices;
    if (!devices || typeof devices !== "object" || Array.isArray(devices)) {
      return {};
    }
    return devices as Record<string, DeviceStatusPayload>;
  } catch {
    return {};
  }
}
