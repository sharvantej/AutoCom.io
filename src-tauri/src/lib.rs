mod api;
mod protocols;
mod show;
mod state;
mod streamdeck;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State, WindowEvent};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_dialog::DialogExt;

use crate::api::{api_request, create_blank_project_file, healthcheck, resolve_active_project_path, send_protocol};
use crate::show::RossTalkState;
use crate::protocols::ws::WsCommandState;
use crate::state::{AppState, RunState, StatusRuntime, ensure_files};
use crate::state::status::start_status_loop;
use crate::streamdeck::{streamdeck_list_devices, streamdeck_poll_button_events, streamdeck_sync_surface};

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

const TRAY_TOGGLE_ID: &str = "tray_toggle_window";
const TRAY_QUIT_ID: &str = "tray_quit";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
struct NativeDesktopPrefs {
  close_to_tray: bool,
  start_minimized: bool,
  window_x: Option<i32>,
  window_y: Option<i32>,
  window_width: Option<u32>,
  window_height: Option<u32>,
}

impl Default for NativeDesktopPrefs {
  fn default() -> Self {
    Self {
      close_to_tray: true,
      start_minimized: false,
      window_x: None,
      window_y: None,
      window_width: None,
      window_height: None,
    }
  }
}

struct AppLifecycleState {
  is_quitting: AtomicBool,
  close_to_tray: AtomicBool,
  start_minimized: AtomicBool,
  window_x: AtomicI32, // Using i32::MIN as sentinel for "not set"
  window_y: AtomicI32, // Using i32::MIN as sentinel for "not set"
  window_width: AtomicU32, // Using 0 as sentinel for "not set" (valid window size can't be 0)
  window_height: AtomicU32, // Using 0 as sentinel for "not set"
  prefs_path: PathBuf,
}

impl AppLifecycleState {
  fn new(prefs_path: PathBuf, prefs: &NativeDesktopPrefs) -> Self {
    // Initialize window position atoms with sentinel values
    let window_x = AtomicI32::new(prefs.window_x.unwrap_or(i32::MIN));
    let window_y = AtomicI32::new(prefs.window_y.unwrap_or(i32::MIN));
    let window_width = AtomicU32::new(prefs.window_width.unwrap_or(0));
    let window_height = AtomicU32::new(prefs.window_height.unwrap_or(0));
    
    Self {
      is_quitting: AtomicBool::new(false),
      close_to_tray: AtomicBool::new(prefs.close_to_tray),
      start_minimized: AtomicBool::new(prefs.start_minimized),
      window_x,
      window_y,
      window_width,
      window_height,
      prefs_path,
    }
  }
}

fn load_desktop_prefs(path: &PathBuf) -> NativeDesktopPrefs {
  let raw = match fs::read_to_string(path) {
    Ok(v) => v,
    Err(_) => return NativeDesktopPrefs::default(),
  };
  serde_json::from_str::<NativeDesktopPrefs>(&raw).unwrap_or_default()
}

fn persist_desktop_prefs(state: &AppLifecycleState) -> Result<(), String> {
  let prefs = NativeDesktopPrefs {
    close_to_tray: state.close_to_tray.load(Ordering::Relaxed),
    start_minimized: state.start_minimized.load(Ordering::Relaxed),
    window_x: {
      let x = state.window_x.load(Ordering::Relaxed);
      if x == i32::MIN { None } else { Some(x) }
    },
    window_y: {
      let y = state.window_y.load(Ordering::Relaxed);
      if y == i32::MIN { None } else { Some(y) }
    },
    window_width: {
      let width = state.window_width.load(Ordering::Relaxed);
      if width == 0 { None } else { Some(width) }
    },
    window_height: {
      let height = state.window_height.load(Ordering::Relaxed);
      if height == 0 { None } else { Some(height) }
    },
  };
  let body = serde_json::to_string_pretty(&prefs).map_err(|e| e.to_string())?;
  fs::write(&state.prefs_path, body).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_close_to_tray(state: State<'_, AppLifecycleState>) -> bool {
  state.close_to_tray.load(Ordering::Relaxed)
}

#[tauri::command]
fn set_close_to_tray(enabled: bool, state: State<'_, AppLifecycleState>) -> Result<(), String> {
  state.close_to_tray.store(enabled, Ordering::Relaxed);
  persist_desktop_prefs(&state)
}

#[tauri::command]
fn get_start_minimized(state: State<'_, AppLifecycleState>) -> bool {
  state.start_minimized.load(Ordering::Relaxed)
}

#[tauri::command]
fn set_start_minimized(enabled: bool, state: State<'_, AppLifecycleState>) -> Result<(), String> {
  state.start_minimized.store(enabled, Ordering::Relaxed);
  persist_desktop_prefs(&state)
}

#[tauri::command]
fn get_launch_at_login(app: AppHandle) -> Result<bool, String> {
  app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_window_position(state: State<'_, AppLifecycleState>) -> Result<(Option<i32>, Option<i32>), String> {
  let x = state.window_x.load(Ordering::Relaxed);
  let y = state.window_y.load(Ordering::Relaxed);
  Ok((
    if x == i32::MIN { None } else { Some(x) },
    if y == i32::MIN { None } else { Some(y) }
  ))
}

#[tauri::command]
fn set_window_position(x: i32, y: i32, state: State<'_, AppLifecycleState>) -> Result<(), String> {
  state.window_x.store(x, Ordering::Relaxed);
  state.window_y.store(y, Ordering::Relaxed);
  persist_desktop_prefs(&state)
}

#[tauri::command]
fn get_window_size(state: State<'_, AppLifecycleState>) -> Result<(Option<u32>, Option<u32>), String> {
  let width = state.window_width.load(Ordering::Relaxed);
  let height = state.window_height.load(Ordering::Relaxed);
  Ok((
    if width == 0 { None } else { Some(width) },
    if height == 0 { None } else { Some(height) }
  ))
}

#[tauri::command]
fn set_window_size(width: u32, height: u32, state: State<'_, AppLifecycleState>) -> Result<(), String> {
  state.window_width.store(width, Ordering::Relaxed);
  state.window_height.store(height, Ordering::Relaxed);
  persist_desktop_prefs(&state)
}

#[tauri::command]
fn set_launch_at_login(enabled: bool, app: AppHandle) -> Result<(), String> {
  if enabled {
    app.autolaunch().enable().map_err(|e| e.to_string())
  } else {
    app.autolaunch().disable().map_err(|e| e.to_string())
  }
}

#[tauri::command]
fn get_log_dir(app: AppHandle) -> Result<String, String> {
  app
    .path()
    .app_log_dir()
    .map(|p| p.to_string_lossy().to_string())
    .map_err(|e| e.to_string())
}

/// Native "Open" dialog for choosing a project file directly off disk —
/// projects are no longer tracked in an app-managed registry, so opening
/// one is just picking a file, like any other desktop app.
#[tauri::command]
fn pick_open_project_file(app: AppHandle, state: State<'_, AppState>) -> Result<Option<String>, String> {
  let mut builder = app.dialog().file().add_filter("AutoCom Project", &["xml"]);
  if state.project_store_dir.exists() {
    builder = builder.set_directory(&state.project_store_dir);
  }
  let Some(picked) = builder.blocking_pick_file() else {
    return Ok(None);
  };
  let path = picked.into_path().map_err(|e| e.to_string())?;
  Ok(Some(path.to_string_lossy().to_string()))
}

/// Native "Save As" dialog for choosing where a new project file should
/// live; writes a blank project there immediately so the file is valid the
/// instant it's created.
#[tauri::command]
fn pick_new_project_file(app: AppHandle, state: State<'_, AppState>) -> Result<Option<String>, String> {
  let mut builder = app
    .dialog()
    .file()
    .add_filter("AutoCom Project", &["xml"])
    .set_file_name("Untitled Project.xml");
  if state.project_store_dir.exists() {
    builder = builder.set_directory(&state.project_store_dir);
  }
  let Some(picked) = builder.blocking_save_file() else {
    return Ok(None);
  };
  let path = picked.into_path().map_err(|e| e.to_string())?;
  create_blank_project_file(&path)?;
  Ok(Some(path.to_string_lossy().to_string()))
}

/// Native "Save As" dialog — copies the currently active project's file
/// content to a new location and switches to it. A plain filesystem copy
/// rather than reconstructing the file from in-memory frontend state, so it
/// can't race with (or lag behind) whatever's actually on disk.
#[tauri::command]
fn pick_save_project_as(app: AppHandle, state: State<'_, AppState>) -> Result<Option<String>, String> {
  let Some(active_path) = resolve_active_project_path(&state) else {
    return Err("No active project to save.".to_string());
  };
  let suggested_name = active_path
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("Untitled Project.xml");
  let mut builder = app
    .dialog()
    .file()
    .add_filter("AutoCom Project", &["xml"])
    .set_file_name(suggested_name);
  if let Some(dir) = active_path.parent() {
    builder = builder.set_directory(dir);
  }
  let Some(picked) = builder.blocking_save_file() else {
    return Ok(None);
  };
  let new_path = picked.into_path().map_err(|e| e.to_string())?;
  fs::copy(&active_path, &new_path).map_err(|e| e.to_string())?;
  Ok(Some(new_path.to_string_lossy().to_string()))
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

fn focus_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}

fn toggle_main_window_visibility(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let is_visible = window.is_visible().unwrap_or(true);
    if is_visible {
      let _ = window.hide();
      return;
    }
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
  let toggle_item = MenuItem::with_id(app, TRAY_TOGGLE_ID, "Show / Hide", true, None::<&str>)?;
  let quit_item = MenuItem::with_id(app, TRAY_QUIT_ID, "Quit", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&toggle_item, &quit_item])?;

  let mut tray_builder = TrayIconBuilder::new()
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id().as_ref() {
      TRAY_TOGGLE_ID => toggle_main_window_visibility(app),
      TRAY_QUIT_ID => {
        app
          .state::<AppLifecycleState>()
          .is_quitting
          .store(true, Ordering::Relaxed);
        app.exit(0);
      }
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        toggle_main_window_visibility(&tray.app_handle());
      }
    });

  if let Some(icon) = app.default_window_icon() {
    tray_builder = tray_builder.icon(icon.clone());
  }

  let _tray = tray_builder.build(app)?;
  Ok(())
}

pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::new()
        .target(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
          file_name: None,
        }))
        .target(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout))
        .level(log::LevelFilter::Info)
        .max_file_size(5_000_000)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
        .build(),
    )
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      None::<Vec<&str>>,
    ))
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      focus_main_window(app);
    }))
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        if let Some(state) = window.try_state::<AppLifecycleState>() {
          if state.is_quitting.load(Ordering::Relaxed) {
            return;
          }
          if !state.close_to_tray.load(Ordering::Relaxed) {
            return;
          }
        }
        api.prevent_close();
        let _ = window.hide();
      }
    })
    .setup(|app| {
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
      let desktop_prefs_path = runtime_data_dir.join("desktop_prefs.json");
      let desktop_prefs = load_desktop_prefs(&desktop_prefs_path);
      app.manage(AppLifecycleState::new(desktop_prefs_path, &desktop_prefs));
      build_tray(&app.handle()).map_err(|e| e.to_string())?;
      let w = app
          .get_webview_window("main")
          .ok_or("main window missing")?;
      w.set_title("Autocom").ok();
      
      let status_cache = Arc::new(Mutex::new(HashMap::new()));
      let status_in_flight = Arc::new(Mutex::new(false));
      let state = AppState {
          project_store_dir,
          logs_path: runtime_data_dir.join("logs.json"),
          show_path: runtime_data_dir.join("show.json"),
          active_project_path: runtime_data_dir.join("active_project.json"),
          show_lock: Mutex::new(false),
          run: Mutex::new(RunState::default()),
          device_status: status_cache.clone(),
          status_check_in_flight: status_in_flight.clone(),
      };
      ensure_files(&state).map_err(|e| e.to_string())?;
      let runtime = StatusRuntime {
          active_project_path: state.active_project_path.clone(),
          device_status: status_cache,
          status_check_in_flight: status_in_flight,
      };
      start_status_loop(app.handle().clone(), runtime);
      app.manage(state);
      app.manage(WsCommandState::default());
      app.manage(RossTalkState::default());
      log::info!(
        "Autocom v{} started (platform: {})",
        app.package_info().version,
        std::env::consts::OS
      );

      // Set window position and size from preferences, or center if not set
      let app_state = app.state::<AppLifecycleState>();
      let x = app_state.window_x.load(Ordering::Relaxed);
      let y = app_state.window_y.load(Ordering::Relaxed);
      let width = app_state.window_width.load(Ordering::Relaxed);
      let height = app_state.window_height.load(Ordering::Relaxed);
      
      if x != i32::MIN && y != i32::MIN && width != 0 && height != 0 {
          // We have saved position and size
          use tauri::{LogicalPosition, LogicalSize, Position, Size};
          let _ = w.set_position(Position::Logical(LogicalPosition::new(x as f64, y as f64)));
          let _ = w.set_size(Size::Logical(LogicalSize::new(width as f64, height as f64)));
      } else {
          // Center the window on first run
          let _ = w.center();
      }
      
      if desktop_prefs.start_minimized {
          let _ = w.hide();
      }
      
      // Save window position/size when they change, debounced so a drag or resize
      // gesture (which fires dozens of these events per second) doesn't hit disk
      // on every pixel and stutter the window on the main thread.
      let prefs_write_gen = Arc::new(AtomicU64::new(0));

      fn schedule_prefs_write(app_handle: &AppHandle, gen_counter: &Arc<AtomicU64>) {
        let gen = gen_counter.fetch_add(1, Ordering::SeqCst) + 1;
        let gen_counter = gen_counter.clone();
        let app_handle = app_handle.clone();
        tauri::async_runtime::spawn(async move {
          tokio::time::sleep(std::time::Duration::from_millis(400)).await;
          if gen_counter.load(Ordering::SeqCst) == gen {
            let app_state = app_handle.state::<AppLifecycleState>();
            let _ = persist_desktop_prefs(&app_state);
          }
        });
      }

      let app_handle_clone = app.handle().clone();
      let prefs_write_gen_moved = prefs_write_gen.clone();
      let _ = w.on_window_event(move |event| {
          if let tauri::WindowEvent::Moved(pos) = event {
              let app_state = app_handle_clone.state::<AppLifecycleState>();
              app_state.window_x.store(pos.x, Ordering::Relaxed);
              app_state.window_y.store(pos.y, Ordering::Relaxed);
              schedule_prefs_write(&app_handle_clone, &prefs_write_gen_moved);
          }
      });

      let app_handle_clone = app.handle().clone();
      let prefs_write_gen_resized = prefs_write_gen.clone();
      let _ = w.on_window_event(move |event| {
          if let tauri::WindowEvent::Resized(size) = event {
              let app_state = app_handle_clone.state::<AppLifecycleState>();
              app_state.window_width.store(size.width, Ordering::Relaxed);
              app_state.window_height.store(size.height, Ordering::Relaxed);
              schedule_prefs_write(&app_handle_clone, &prefs_write_gen_resized);
          }
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_close_to_tray,
      set_close_to_tray,
      get_start_minimized,
      set_start_minimized,
      get_launch_at_login,
      set_launch_at_login,
      get_window_position,
      set_window_position,
      get_window_size,
      set_window_size,
      get_log_dir,
      pick_open_project_file,
      pick_new_project_file,
      pick_save_project_as,
      healthcheck,
      send_protocol,
      api_request,
      streamdeck_list_devices,
      streamdeck_sync_surface,
      streamdeck_poll_button_events
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
