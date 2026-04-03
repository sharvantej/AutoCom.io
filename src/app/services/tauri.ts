/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TAURI v2 IPC BRIDGE
 *
 * Uses window.__TAURI_INTERNALS__ — the raw global Tauri v2 injects into
 * every webview — instead of importing @tauri-apps/api/core.
 * This is identical to what the npm package does internally, with zero
 * package imports so this file works in any Vite environment.
 *
 * ── RUST SIDE — register every command in src-tauri/src/lib.rs ───────────────
 *   tauri::Builder::default()
 *     .invoke_handler(tauri::generate_handler![
 *       commands::get_projects,
 *       commands::create_project,
 *       commands::update_project,
 *       commands::delete_project,
 *       commands::get_connections,
 *       commands::create_connection,
 *       commands::update_connection,
 *       commands::delete_connection,
 *       commands::toggle_connection,
 *       commands::get_logs,
 *     ])
 *
 * ── SERDE — add to every struct crossing the IPC boundary ────────────────────
 *   #[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
 *   #[serde(rename_all = "camelCase")]   // project_id → projectId in JSON
 *
 * ── TAURI v2 PERMISSIONS — src-tauri/capabilities/default.json ───────────────
 *   "permissions": ["core:default", "core:window:default", "core:event:default"]
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Extend the Window interface so TypeScript knows about the Tauri v2 global.
declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      transformCallback: (
        callback: (result: unknown) => void,
        once?: boolean,
      ) => number;
    };
    __TAURI__?: unknown; // Tauri v1 marker — kept for isTauri() compatibility
  }
}

/**
 * Typed Tauri invoke wrapper.
 * Normalises Rust String errors to JavaScript Error objects.
 *
 * @example
 *   const projects = await tauriInvoke<Project[]>("get_projects");
 *   const conn = await tauriInvoke<Connection>("create_connection", { name, ip });
 */
export async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const internals = window.__TAURI_INTERNALS__;
  if (!internals) {
    throw new Error(
      `[Tauri] window.__TAURI_INTERNALS__ not found — are you running inside Tauri? Command: ${command}`,
    );
  }
  try {
    return await internals.invoke<T>(command, args);
  } catch (err) {
    const msg = typeof err === "string" ? err : JSON.stringify(err);
    throw new Error(`[Tauri:${command}] ${msg}`);
  }
}

/**
 * Returns true when running inside a Tauri webview (v1 or v2).
 */
export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}
