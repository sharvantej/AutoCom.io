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
  pub(crate) project_store_dir: PathBuf,
  pub(crate) connections_path: PathBuf,
  pub(crate) logs_path: PathBuf,
  pub(crate) show_path: PathBuf,
  pub(crate) show_lock: Mutex<bool>,
  pub(crate) run: Mutex<RunState>,
  pub(crate) device_status: Arc<Mutex<HashMap<String, Value>>>,
  pub(crate) status_check_in_flight: Arc<Mutex<bool>>,
}

#[derive(Clone)]
pub(crate) struct StatusRuntime {
  pub(crate) connections_path: PathBuf,
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
  fs::create_dir_all(path.parent().ok_or("Invalid file path")?).map_err(|e| e.to_string())?;
  fs::write(
    path,
    serde_json::to_string_pretty(data).map_err(|e| e.to_string())?,
  )
  .map_err(|e| e.to_string())
}

fn default_connections() -> Value {
  json!({
    "Resolume Arena": {
      "host":"127.0.0.1",
      "port":7000,
      "type":"resolume",
      "protocol":"osc",
      "enabled":true,
      "healthCheck":{"protocol":"tcp","port":8080}
    },
    "grandMA3": {
      "host":"127.0.0.1",
      "port":8000,
      "type":"grandma3",
      "protocol":"osc",
      "oscPrefix":"/cmd",
      "enabled":true
    },
    "vMix": {
      "host":"127.0.0.1",
      "port":8099,
      "type":"vmix",
      "protocol":"tcp",
      "enabled":true
    },
    "ATEM Switcher": {
      "host":"127.0.0.1",
      "port":9910,
      "type":"atem",
      "protocol":"udp",
      "enabled":true
    },
    "OBS": {
      "host":"127.0.0.1",
      "port":4455,
      "type":"obs",
      "protocol":"ws",
      "enabled":true,
      "password":""
    },
    "HTTP API": {
      "host":"127.0.0.1",
      "port":80,
      "type":"http_api",
      "protocol":"http",
      "path":"/",
      "enabled":true
    },
    "Audio Mixer": {
      "host":"127.0.0.1",
      "port":9000,
      "type":"audio_mixer",
      "protocol":"osc",
      "enabled":true
    },
    "Ross Switcher (RossTalk)": {
      "host":"127.0.0.1",
      "port":7788,
      "type":"ross_talk",
      "protocol":"tcp",
      "enabled":true,
      "model":"carbonite",
      "keepAlive":false
    },
    "Ross XPression": {
      "host":"127.0.0.1",
      "port":7789,
      "type":"ross_xpression",
      "protocol":"tcp",
      "enabled":true
    },
    "Artnet DMX": {
      "host":"127.0.0.1",
      "port":6454,
      "type":"artnet_dmx",
      "protocol":"artnet",
      "enabled":true
    }
  })
}

pub(crate) fn ensure_files(state: &AppState) -> Result<(), String> {
  fs::create_dir_all(&state.project_store_dir).map_err(|e| e.to_string())?;
  if !state.connections_path.exists() {
    write_json(&state.connections_path, &default_connections())?;
  }
  if !state.logs_path.exists() {
    write_json(&state.logs_path, &json!([]))?;
  }
  if !state.show_path.exists() {
    write_json(&state.show_path, &json!({"cues":{}}))?;
  }
  Ok(())
}
