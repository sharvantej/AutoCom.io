/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SHARED TYPES
 *
 * All domain types live here so every layer (services, context, pages)
 * imports from a single source of truth.
 *
 * ── RUST / SERDE ALIGNMENT ───────────────────────────────────────────────────
 * Every Rust struct that crosses the Tauri IPC boundary must have:
 *
 *   #[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
 *   #[serde(rename_all = "camelCase")]
 *
 * This maps Rust snake_case fields (e.g. `project_id`) to the camelCase
 * TypeScript names used here (e.g. `projectId`).
 *
 * Rust numeric types map to TypeScript as follows:
 *   u32, i32, u64  →  number
 *   bool           →  boolean
 *   Option<T>      →  T | null   (with #[serde(default)] if needed)
 *   String         →  string
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Domain models ─────────────────────────────────────────────────────────────
//
// Rust equivalent (with #[serde(rename_all = "camelCase")]):
//   pub struct Connection {
//     pub id:         u32,
//     pub name:       String,
//     pub ip:         String,
//     pub port:       String,
//     pub protocol:   String,   // "TCP API" | "WebSocket" | "OSC" | "HTTP" | "UDP" | "MIDI" | "Other"
//     pub device:     String,   // "vMix" | "OBS Studio" | "Resolume Arena" | "ATEM Mini" | "CasparCG" | …
//     pub path:       String,
//     pub active:     bool,
//     pub project_id: Option<u32>,  // (deprecated) was projectId in JSON
//   }

export type Connection = {
  id:        number;
  name:      string;
  ip:        string;
  port:      string;
  fadeFramerate?: string;
  atemModel?: string;
  atemModelLabel?: string;
  atemMeCount?: number;
  atemUskCount?: number;
  atemDskCount?: number;
  atemMultiviewerCount?: number;
  atemMultiviewerWindowCount?: number;
  atemMediaPlayerCount?: number;
  atemSuperSourceCount?: number;
  atemAuxCount?: number;
  atemInputCount?: number;
  mixEffects?: number;
  upstreamKeyers?: number;
  downstreamKeyers?: number;
  multiviewers?: number;
  mediaPlayers?: number;
  protocol:  string;
  device:    string;
  path:      string;
  username?: string;
  oscPrefix?: string;
  password?: string;
  bonjourHost?: string;
  take?: boolean;
  inputCount?: number;
  outputCount?: number;
  monitoringCount?: number;
  serialCount?: number;
  swp08Matrix?: number;
  swp08LevelCount?: number;
  swp08TallyDump?: boolean;
  swp08AdvancedVariables?: boolean;
  swp08RequestSupportedCommands?: boolean;
  swp08RequestNamesOnConnect?: boolean;
  swp08ExtendedCommands?: boolean;
  swp08RequestNameLength?: number;
  httpBaseUrl?: string;
  httpProxyAddress?: string;
  httpUnauthorizedCertificates?: "reject" | "accept";
  oscTransport?: "udp" | "tcp" | "tcp_raw";
  oscListenForFeedback?: boolean;
  genericTcpTransport?: "tcp" | "udp";
  genericTcpSaveResponse?: boolean;
  companionDeviceId?: string;
  companionColumns?: number;
  companionRows?: number;
  companionBitmapResolution?: "low" | "high";
  rossTalkModel?: "carbonite" | "ultrix" | "acuity" | "opengear";
  rossTalkKeepAlive?: boolean;
  active:    boolean;
};

// Rust equivalent:
//   pub struct LogEntry {
//     pub id:        u64,
//     pub timestamp: u64,    // chrono::Utc::now().timestamp_millis() as u64
//     pub label:     String, // pre-formatted "YY.MM.DD HH:MM:SS"
//     pub source:    String, // e.g. "Instance/Wrapper/vmix"
//     pub message:   String,
//   }

export type LogEntry = {
  id:        number;
  timestamp: number;   // ms since Unix epoch — compatible with new Date(timestamp)
  label:     string;
  source:    string;
  message:   string;
};

// ── Canvas / edit-mode types (used by ProjectDashboard + AddTaskPanel) ────────
//
// These stay entirely in the frontend — no Rust equivalent needed.

export type TaskEntry = {
  id:         string;
  enabled?:   boolean;
  connection: string;
  connectionId?: number;
  mode:       string;
  category:   string;
  funcName:   string;
  input:      string;
  value:      string;
  pause:      string;   // milliseconds as string, e.g. "950"
  label?:     string;
  shortcutId?: string;
  presetId?:  string;   // Legacy alias kept for older saved tasks.
  params?:    Record<string, unknown>;
};

// ── UI / theme ────────────────────────────────────────────────────────────────

export type ThemeMode = "dark" | "light";
export type FontMode  = "mono" | "sans";
