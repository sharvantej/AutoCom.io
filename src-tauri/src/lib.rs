mod api;
mod protocols;
mod show;
mod state;

use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;

use crate::api::{api_request, healthcheck, send_protocol};
use crate::show::RossTalkState;
use crate::protocols::ws::WsCommandState;
use crate::state::{AppState, RunState, StatusRuntime, ensure_files};
use crate::state::status::start_status_loop;

#[derive(Debug, Serialize)]
pub(crate) struct ApiEvent {
  pub(crate) name: String,
  pub(crate) data: Value,
}

#[derive(Debug, Serialize)]
pub(crate) struct ApiResponse {
  pub(crate) status: u16,
  pub(crate) body: Value,
  pub(crate) events: Vec<ApiEvent>,
}

fn migrate_project_store_dir(old_dir: &PathBuf, new_dir: &PathBuf) -> Result<(), String> {
  if !old_dir.exists() || !new_dir.exists() {
    return Ok(());
  }
  let new_has_files = fs::read_dir(new_dir)
    .map_err(|e| e.to_string())?
    .any(|entry| entry.is_ok());
  if new_has_files {
    return Ok(());
  }
  for entry in fs::read_dir(old_dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let src = entry.path();
    if !src.is_file() {
      continue;
    }
    let name = src
      .file_name()
      .ok_or("Invalid project file name")?
      .to_owned();
    let dst = new_dir.join(name);
    fs::copy(src, dst).map_err(|e| e.to_string())?;
  }
  Ok(())
}

fn remove_legacy_project_json_files(runtime_data_dir: &PathBuf) {
  let _ = fs::remove_file(runtime_data_dir.join("projects.json"));
  let _ = fs::remove_file(runtime_data_dir.join("layout.json"));
}

pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let w = app
        .get_webview_window("main")
        .expect("main window missing");
      w.set_title("Autocom").ok();
      let runtime_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("show");
      let project_store_dir = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("AutoCom.io");
      let legacy_project_store_dir = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("AutoCom");
      fs::create_dir_all(&runtime_data_dir).map_err(|e| e.to_string())?;
      fs::create_dir_all(&project_store_dir).map_err(|e| e.to_string())?;
      migrate_project_store_dir(&legacy_project_store_dir, &project_store_dir)?;
      remove_legacy_project_json_files(&runtime_data_dir);
      let status_cache = Arc::new(Mutex::new(HashMap::new()));
      let status_in_flight = Arc::new(Mutex::new(false));
      let state = AppState {
        project_store_dir,
        connections_path: runtime_data_dir.join("connections.json"),
        logs_path: runtime_data_dir.join("logs.json"),
        show_path: runtime_data_dir.join("show.json"),
        show_lock: Mutex::new(false),
        run: Mutex::new(RunState::default()),
        device_status: status_cache.clone(),
        status_check_in_flight: status_in_flight.clone(),
      };
      ensure_files(&state).map_err(|e| e.to_string())?;
      let runtime = StatusRuntime {
        connections_path: state.connections_path.clone(),
        device_status: status_cache,
        status_check_in_flight: status_in_flight,
      };
      start_status_loop(app.handle().clone(), runtime);
      app.manage(state);
      app.manage(WsCommandState::default());
      app.manage(RossTalkState::default());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      healthcheck,
      send_protocol,
      api_request
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
