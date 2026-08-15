use serde_json::{Value, json};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) mod status;

#[derive(Default)]
pub(crate) struct RunState {
  pub(crate) running: bool,
  pub(crate) current_cue: Option<String>,
  pub(crate) started_at: Option<u128>,
}

pub(crate) struct AppState {
  /// Default starting folder for the native New/Open project dialogs —
  /// no longer an enforced storage location now that projects are plain
  /// files the user picks/saves anywhere via the OS file picker.
  pub(crate) project_store_dir: PathBuf,
  pub(crate) logs_path: PathBuf,
  pub(crate) show_path: PathBuf,
  pub(crate) active_project_path: PathBuf,
  pub(crate) show_lock: Mutex<bool>,
  pub(crate) run: Mutex<RunState>,
  pub(crate) device_status: Arc<Mutex<HashMap<String, Value>>>,
  pub(crate) status_check_in_flight: Arc<Mutex<bool>>,
}

#[derive(Clone)]
pub(crate) struct StatusRuntime {
  pub(crate) active_project_path: PathBuf,
  pub(crate) device_status: Arc<Mutex<HashMap<String, Value>>>,
  pub(crate) status_check_in_flight: Arc<Mutex<bool>>,
}

pub(crate) fn now_ms() -> u128 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0)
}

pub(crate) fn read_json(path: &PathBuf, fallback: Value) -> Value {
  fs::read_to_string(path)
    .ok()
    .and_then(|t| serde_json::from_str(&t).ok())
    .unwrap_or(fallback)
}

pub(crate) fn write_json(path: &PathBuf, data: &Value) -> Result<(), String> {
  let dir = path.parent().ok_or("Invalid file path")?;
  fs::create_dir_all(dir).map_err(|e| e.to_string())?;
  let body = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
  write_atomic(path, body.as_bytes())
}

/// Writes to a sibling temp file and renames it into place, so a crash or power
/// loss mid-write can't leave `path` truncated or partially written.
pub(crate) fn write_atomic(path: &PathBuf, bytes: &[u8]) -> Result<(), String> {
  let dir = path.parent().ok_or("Invalid file path")?;
  let file_name = path
    .file_name()
    .and_then(|n| n.to_str())
    .ok_or("Invalid file name")?;
  let tmp_path = dir.join(format!(".{}.{}.tmp", file_name, now_ms()));
  fs::write(&tmp_path, bytes).map_err(|e| e.to_string())?;
  let result = fs::rename(&tmp_path, path).map_err(|e| e.to_string());
  if result.is_err() {
    let _ = fs::remove_file(&tmp_path);
  }
  result
}

pub(crate) fn ensure_files(state: &AppState) -> Result<(), String> {
  fs::create_dir_all(&state.project_store_dir).map_err(|e| e.to_string())?;
  if !state.logs_path.exists() {
    write_json(&state.logs_path, &json!([]))?;
  }
  if !state.show_path.exists() {
    write_json(&state.show_path, &json!({"cues":{}}))?;
  }
  if !state.active_project_path.exists() {
    write_json(
      &state.active_project_path,
      &json!({"activeProjectPath": null, "recentProjectPaths": []}),
    )?;
  }
  Ok(())
}
