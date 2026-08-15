use quick_xml::de::from_str as from_xml_str;
use quick_xml::se::to_string as to_xml_string;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::{ApiEvent, ApiResponse};
use crate::protocols;
use crate::show::{
  Protocol, ProtocolInput, RossTalkState, WsCommandState, conn_map, dmx_frame_from_input,
  exec_sequence, http_req, run_step, s, send_osc, send_tcp, send_udp,
};
use crate::state::{AppState, ensure_files, now_ms, read_json, write_atomic, write_json};
use crate::state::status::{refresh_status_for_request, status_body};

/// Caps logs.json so a long-running show can't grow it unbounded; oldest entries drop first.
const MAX_LOG_ENTRIES: usize = 2000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Swp08NamesRequest {
  host: String,
  port: Option<u16>,
  matrix: Option<u32>,
  matrix_ext: Option<u32>,
  extended_support: Option<bool>,
  name_chars: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideohubLabelsRequest {
  host: String,
  port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename = "autocomProject")]
struct ProjectXmlFile {
  name: String,
  #[serde(rename = "layoutItemsJson", default)]
  layout_items_json: String,
  #[serde(rename = "connectionsJson", default)]
  connections_json: String,
}

fn default_project_layout() -> Value {
  json!({ "items": [] })
}

/// Display title for a project file when none is stored yet — derived from
/// the file's stem so a freshly-picked path always has a sensible name.
fn project_name_from_path(path: &PathBuf) -> String {
  path
    .file_stem()
    .and_then(|s| s.to_str())
    .map(|s| s.to_string())
    .unwrap_or_else(|| "Untitled Project".to_string())
}

fn read_project_xml_file(path: &PathBuf) -> Option<ProjectXmlFile> {
  let xml = fs::read_to_string(path).ok()?;
  from_xml_str::<ProjectXmlFile>(&xml).ok()
}

fn write_project_xml_file(path: &PathBuf, project: &ProjectXmlFile) -> Result<(), String> {
  fs::create_dir_all(path.parent().ok_or("Invalid project file path")?)
    .map_err(|e| e.to_string())?;
  let xml_body = to_xml_string(project).map_err(|e| e.to_string())?;
  let xml = format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n{xml_body}\n");
  write_atomic(path, xml.as_bytes())
}

/// Writes a blank project file at `path` — called right when the user picks
/// a location via the "New Project" native save dialog, so the file is
/// valid to open again the instant it's created.
pub(crate) fn create_blank_project_file(path: &PathBuf) -> Result<(), String> {
  let project = ProjectXmlFile {
    name: project_name_from_path(path),
    layout_items_json: "[]".to_string(),
    connections_json: "{}".to_string(),
  };
  write_project_xml_file(path, &project)
}

fn decode_layout_items_from_text(text: &str) -> Vec<Value> {
  if text.trim().is_empty() {
    return Vec::new();
  }
  serde_json::from_str::<Vec<Value>>(text).unwrap_or_default()
}

fn encode_layout_items_to_text(layout_body: &Value) -> String {
  let items = layout_body
    .get("items")
    .and_then(Value::as_array)
    .cloned()
    .unwrap_or_default();
  serde_json::to_string(&items).unwrap_or_else(|_| "[]".to_string())
}

fn decode_connections_from_text(text: &str) -> Value {
  if text.trim().is_empty() {
    return json!({});
  }
  serde_json::from_str::<Value>(text).unwrap_or_else(|_| json!({}))
}

fn encode_connections_to_text(connections: &Value) -> String {
  serde_json::to_string(connections).unwrap_or_else(|_| "{}".to_string())
}

/// Resolves whichever project is currently open (single-active-project model,
/// tracked in `active_project.json` via the `/api/active-project` routes).
pub(crate) fn resolve_active_project_path(state: &AppState) -> Option<PathBuf> {
  resolve_active_project_path_from(&state.active_project_path)
}

fn resolve_active_project_path_from(active_project_path: &PathBuf) -> Option<PathBuf> {
  let current = read_json(
    active_project_path,
    json!({"activeProjectPath": null, "recentProjectPaths": []}),
  );
  current
    .get("activeProjectPath")
    .and_then(Value::as_str)
    .filter(|s| !s.trim().is_empty())
    .map(PathBuf::from)
}

/// Reads or defaults a project's XML file at `path`, filling in whichever
/// existing content (name/layout/connections) is already there.
fn read_or_default_project(path: &PathBuf) -> ProjectXmlFile {
  read_project_xml_file(path).unwrap_or_else(|| ProjectXmlFile {
    name: project_name_from_path(path),
    layout_items_json: "[]".to_string(),
    connections_json: "{}".to_string(),
  })
}

fn load_project_connections_at_path(path: &PathBuf) -> Value {
  let Some(project) = read_project_xml_file(path) else {
    return json!({});
  };
  decode_connections_from_text(&project.connections_json)
}

fn save_project_connections_at_path(path: &PathBuf, connections: Value) -> Result<(), String> {
  let mut project = read_or_default_project(path);
  project.connections_json = encode_connections_to_text(&connections);
  write_project_xml_file(path, &project)
}

/// Loads the connections of whichever project is currently active. With no
/// active project there is no meaningful connections context, so this
/// returns an empty set rather than falling back to any global file.
fn load_active_connections(state: &AppState) -> Value {
  load_connections_for_paths(&state.active_project_path)
}

/// Raw-path variant of `load_active_connections`, reusable from the
/// background status-polling loop (`state::status::StatusRuntime`), which
/// only carries a cloned `PathBuf` rather than a full `&AppState`.
pub(crate) fn load_connections_for_paths(active_project_path: &PathBuf) -> Value {
  match resolve_active_project_path_from(active_project_path) {
    Some(project_path) => load_project_connections_at_path(&project_path),
    None => json!({}),
  }
}

fn load_project_layout_at_path(path: &PathBuf) -> Value {
  let Some(project) = read_project_xml_file(path) else {
    return default_project_layout();
  };
  json!({ "items": decode_layout_items_from_text(&project.layout_items_json) })
}

fn save_project_layout_at_path(path: &PathBuf, layout: Value) -> Result<(), String> {
  let mut project = read_or_default_project(path);
  project.layout_items_json = encode_layout_items_to_text(&layout);
  write_project_xml_file(path, &project)
}

fn is_button_item(item: &Value) -> bool {
  item
    .get("type")
    .and_then(Value::as_str)
    .map(|kind| kind == "button")
    .unwrap_or(true)
}

fn find_button_by_id_in_layout(layout: &Value, button_id: &str) -> Option<Value> {
  let matches_button = |item: &Value| {
    item
      .get("id")
      .map(|value| s(Some(value)))
      .unwrap_or_default()
      == button_id
      && is_button_item(item)
  };

  if let Some(button) = layout
    .get("buttons")
    .and_then(Value::as_array)
    .and_then(|items| items.iter().find(|item| matches_button(item)))
  {
    return Some(button.clone());
  }

  if let Some(button) = layout
    .get("items")
    .and_then(Value::as_array)
    .and_then(|items| items.iter().find(|item| matches_button(item)))
  {
    return Some(button.clone());
  }

  None
}

/// Looks up a button within whichever project is currently active — there's
/// no registry of other projects to search across anymore, so this only
/// ever matches a button belonging to the open project.
fn find_button_by_id(state: &AppState, button_id: &str) -> Option<Value> {
  let project_path = resolve_active_project_path(state)?;
  let layout = load_project_layout_at_path(&project_path);
  find_button_by_id_in_layout(&layout, button_id)
}

#[tauri::command]
pub(crate) async fn send_protocol(
  input: ProtocolInput,
  ws_state: State<'_, WsCommandState>,
) -> Result<String, String> {
  match input.protocol {
    Protocol::Osc => {
      send_osc(
        &input.host,
        input.port,
        &input.address.clone().unwrap_or_else(|| "/".to_string()),
        &input.args.clone().unwrap_or_default(),
      )
      .await
      .map_err(|e| e.message)?;
    }
    Protocol::Udp => {
      send_udp(&input.host, input.port, &input.payload.clone().unwrap_or_default(), "")
        .await
        .map_err(|e| e.message)?;
    }
    Protocol::Tcp => {
      send_tcp(
        &input.host,
        input.port,
        &input.payload.clone().unwrap_or_default(),
        "\r\n",
      )
      .await
      .map_err(|e| e.message)?;
    }
    Protocol::Ws => {
      protocols::ws::send_text(
        ws_state.inner(),
        &input.host,
        input.port,
        input.address.as_deref(),
        &input.payload.clone().unwrap_or_default(),
      )
      .await?;
    }
    Protocol::Http => {
      let path = input.address.clone().unwrap_or_else(|| "/".to_string());
      let b = input.payload.clone().unwrap_or_default();
      let body = if b.trim().is_empty() {
        None
      } else if let Ok(v) = serde_json::from_str::<Value>(&b) {
        Some(v)
      } else {
        Some(Value::String(b))
      };
      let (ok, st) = http_req(
        "http",
        &input.host,
        input.port,
        if body.is_some() { "POST" } else { "GET" },
        &path,
        None,
        body.as_ref(),
        100,
      )
      .await
      .map_err(|e| e.message)?;
      if !ok {
        return Err(format!("HTTP request failed with status {st}"));
      }
    }
    Protocol::Artnet | Protocol::Dmx => {
      let (universe, values) = dmx_frame_from_input(&input)?;
      let port = if input.port == 0 { 6454 } else { input.port };
      protocols::artnet::send_dmx(&input.host, port, universe, &values).await?;
    }
    Protocol::Rosstalk => {
      let cmd = input.payload.clone().unwrap_or_default();
      if cmd.trim().is_empty() {
        return Err("RossTalk payload cannot be empty".to_string());
      }
      send_tcp(&input.host, input.port, &cmd, "\r\n")
        .await
        .map_err(|e| e.message)?;
    }
  }
  Ok("ok".to_string())
}

#[tauri::command]
pub(crate) fn healthcheck() -> &'static str {
  "ok"
}

#[tauri::command]
pub(crate) async fn api_request(
  method: String,
  path: String,
  body: Option<Value>,
  state: State<'_, AppState>,
  rosstalk_state: State<'_, RossTalkState>,
) -> Result<ApiResponse, String> {
  let result = api_request_inner(method.clone(), path.clone(), body, state, rosstalk_state).await;
  match &result {
    Err(e) => log::error!("api_request {method} {path} failed: {e}"),
    Ok(res) if res.status >= 400 => {
      log::warn!("api_request {method} {path} returned status {}", res.status)
    }
    Ok(_) => {}
  }
  result
}

async fn api_request_inner(
  method: String,
  path: String,
  body: Option<Value>,
  state: State<'_, AppState>,
  rosstalk_state: State<'_, RossTalkState>,
) -> Result<ApiResponse, String> {
  ensure_files(&state)?;
  let m = method.to_uppercase();
  let parts = path.trim_matches('/').split('/').collect::<Vec<_>>();
  let mut events = Vec::new();

  if m == "GET" && path == "/api/health" {
    return Ok(ApiResponse {
      status: 200,
      body: json!({"status":"ok","time":now_ms()}),
      events,
    });
  }
  if m == "GET" && path == "/api/logs" {
    return Ok(ApiResponse {
      status: 200,
      body: read_json(&state.logs_path, json!([])),
      events,
    });
  }
  if m == "POST" && path == "/api/logs" {
    let mut entries = match body.unwrap_or_else(|| json!([])) {
      Value::Array(entries) => entries,
      _ => Vec::new(),
    };
    if entries.len() > MAX_LOG_ENTRIES {
      let drop_count = entries.len() - MAX_LOG_ENTRIES;
      entries.drain(0..drop_count);
    }
    write_json(&state.logs_path, &Value::Array(entries))?;
    return Ok(ApiResponse {
      status: 200,
      body: json!({"success":true}),
      events,
    });
  }
  if m == "GET" && path == "/api/layout" {
    // Path travels in the request body (not the URL) since a real
    // filesystem path is full of `/` and would break the `parts.split('/')`
    // route matcher used everywhere else in this handler.
    let Some(project_path) = body
      .as_ref()
      .and_then(|b| b.get("path"))
      .and_then(Value::as_str)
      .filter(|s| !s.trim().is_empty())
      .map(PathBuf::from)
    else {
      return Ok(ApiResponse {
        status: 400,
        body: json!({"error":"Missing project path"}),
        events,
      });
    };
    return Ok(ApiResponse {
      status: 200,
      body: load_project_layout_at_path(&project_path),
      events,
    });
  }
  if m == "POST" && path == "/api/layout" {
    if *state.show_lock.lock().map_err(|e| e.to_string())? {
      return Ok(ApiResponse {
        status: 403,
        body: json!({"error":"Show is locked. Cannot save layout."}),
        events,
      });
    }
    let payload = body.unwrap_or_else(|| json!({}));
    let Some(project_path) = payload
      .get("path")
      .and_then(Value::as_str)
      .filter(|s| !s.trim().is_empty())
      .map(PathBuf::from)
    else {
      return Ok(ApiResponse {
        status: 400,
        body: json!({"error":"Missing project path"}),
        events,
      });
    };
    let layout = payload.get("items").cloned().map(|items| json!({"items": items}))
      .unwrap_or_else(default_project_layout);
    save_project_layout_at_path(&project_path, layout)?;
    return Ok(ApiResponse {
      status: 200,
      body: json!({"success":true}),
      events,
    });
  }
  if m == "GET" && path == "/api/connections" {
    // An explicit path in the body reads a specific (possibly non-active)
    // project's connections — needed by Stream Deck button execution, whose
    // mappings reference whichever project they were created in, not
    // necessarily whatever's active right now. Omitting it resolves the
    // active project, same as before.
    let explicit_path = body
      .as_ref()
      .and_then(|b| b.get("path"))
      .and_then(Value::as_str)
      .filter(|s| !s.trim().is_empty())
      .map(PathBuf::from);
    let body = match explicit_path {
      Some(project_path) => load_project_connections_at_path(&project_path),
      None => load_active_connections(&state),
    };
    return Ok(ApiResponse {
      status: 200,
      body,
      events,
    });
  }
  if m == "POST" && path == "/api/connections" {
    let Some(project_path) = resolve_active_project_path(&state) else {
      return Ok(ApiResponse {
        status: 400,
        body: json!({"error":"No active project to save connections into."}),
        events,
      });
    };
    save_project_connections_at_path(&project_path, body.unwrap_or_else(|| json!({})))?;
    refresh_status_for_request(&state, Some(&mut events)).await;
    return Ok(ApiResponse {
      status: 200,
      body: json!({"success":true}),
      events,
    });
  }
  if m == "GET" && path == "/api/active-project" {
    return Ok(ApiResponse {
      status: 200,
      body: read_json(
        &state.active_project_path,
        json!({"activeProjectPath": null, "recentProjectPaths": []}),
      ),
      events,
    });
  }
  if m == "POST" && path == "/api/active-project" {
    let payload = body.unwrap_or_else(|| json!({}));
    let project_path = payload.get("activeProjectPath").cloned().unwrap_or(Value::Null);
    let current = read_json(
      &state.active_project_path,
      json!({"activeProjectPath": null, "recentProjectPaths": []}),
    );
    let mut recent: Vec<Value> = current
      .get("recentProjectPaths")
      .and_then(|v| v.as_array())
      .cloned()
      .unwrap_or_default();
    if let Some(p) = project_path.as_str().filter(|s| !s.trim().is_empty()) {
      recent.retain(|v| v.as_str() != Some(p));
      recent.insert(0, json!(p));
      recent.truncate(8);
    }
    let next = json!({"activeProjectPath": project_path, "recentProjectPaths": recent});
    write_json(&state.active_project_path, &next)?;
    return Ok(ApiResponse {
      status: 200,
      body: next,
      events,
    });
  }
  if m == "POST" && path == "/api/swp08/names" {
    let Some(payload) = body else {
      return Ok(ApiResponse {
        status: 400,
        body: json!({"error":"Missing request body"}),
        events,
      });
    };
    let req = match serde_json::from_value::<Swp08NamesRequest>(payload) {
      Ok(value) => value,
      Err(err) => {
        return Ok(ApiResponse {
          status: 400,
          body: json!({"error": format!("Invalid request body: {err}")}),
          events,
        });
      }
    };
    let host = req.host.trim().to_string();
    if host.is_empty() {
      return Ok(ApiResponse {
        status: 400,
        body: json!({"error":"Host is required"}),
        events,
      });
    }
    let result = protocols::swp08::fetch_names(
      &host,
      req.port.unwrap_or(8910),
      req.matrix.unwrap_or(1).max(1),
      req.matrix_ext.unwrap_or(req.matrix.unwrap_or(1)).max(1),
      req.extended_support.unwrap_or(false),
      req.name_chars.unwrap_or(8),
    )
    .await;
    match result {
      Ok(names) => {
        return Ok(ApiResponse {
          status: 200,
          body: json!({
            "sourceNames": names.source_names,
            "destinationNames": names.destination_names,
          }),
          events,
        });
      }
      Err(message) => {
        return Ok(ApiResponse {
          status: 500,
          body: json!({"error": message}),
          events,
        });
      }
    }
  }
  if m == "POST" && path == "/api/videohub/labels" {
    let Some(payload) = body else {
      return Ok(ApiResponse {
        status: 400,
        body: json!({"error":"Missing request body"}),
        events,
      });
    };
    let req = match serde_json::from_value::<VideohubLabelsRequest>(payload) {
      Ok(value) => value,
      Err(err) => {
        return Ok(ApiResponse {
          status: 400,
          body: json!({"error": format!("Invalid request body: {err}")}),
          events,
        });
      }
    };
    let host = req.host.trim().to_string();
    if host.is_empty() {
      return Ok(ApiResponse {
        status: 400,
        body: json!({"error":"Host is required"}),
        events,
      });
    }
    let result = protocols::videohub::fetch_labels(
      &host,
      req.port.unwrap_or(9990),
    )
    .await;
    match result {
      Ok(labels) => {
        return Ok(ApiResponse {
          status: 200,
          body: json!({
            "inputLabels": labels.input_labels,
            "outputLabels": labels.output_labels,
          }),
          events,
        });
      }
      Err(message) => {
        return Ok(ApiResponse {
          status: 500,
          body: json!({"error": message}),
          events,
        });
      }
    }
  }
  if m == "GET" && path == "/api/cues" {
    let sh = read_json(&state.show_path, json!({"cues":{}}));
    let cues = sh
      .get("cues")
      .and_then(Value::as_object)
      .map(|o| o.keys().cloned().collect::<Vec<_>>())
      .unwrap_or_default();
    return Ok(ApiResponse {
      status: 200,
      body: json!(cues),
      events,
    });
  }
  if m == "GET" && path == "/api/status" {
    refresh_status_for_request(&state, None).await;
    let lock = *state.show_lock.lock().map_err(|e| e.to_string())?;
    return Ok(ApiResponse {
      status: 200,
      body: status_body(&state, lock),
      events,
    });
  }
  if m == "GET" && path == "/api/show-lock" {
    let lock = *state.show_lock.lock().map_err(|e| e.to_string())?;
    return Ok(ApiResponse {
      status: 200,
      body: json!({"showLock":lock}),
      events,
    });
  }
  if m == "POST" && path == "/api/show-lock" {
    let lock = body
      .as_ref()
      .and_then(|v| v.get("lock"))
      .and_then(Value::as_bool)
      .unwrap_or(false);
    *state.show_lock.lock().map_err(|e| e.to_string())? = lock;
    events.push(ApiEvent {
      name: "showLockUpdate".into(),
      data: json!(lock),
    });
    return Ok(ApiResponse {
      status: 200,
      body: json!({"success":true,"showLock":lock}),
      events,
    });
  }

  if m == "POST" && path == "/api/execute" {
    let rows = match body {
      Some(Value::Array(rows)) => rows,
      Some(Value::Object(map)) => map
        .get("rows")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default(),
      Some(other) => vec![other],
      None => Vec::new(),
    };
    if rows.is_empty() {
      return Ok(ApiResponse {
        status: 400,
        body: json!({"success":false,"error":"No executable rows supplied"}),
        events,
      });
    }
    let conns = conn_map(&load_active_connections(&state));
    match exec_sequence(&rows, &conns, &mut events, rosstalk_state.inner()).await {
      Ok(results) => {
        return Ok(ApiResponse {
          status: 200,
          body: json!({"success":true,"results":results}),
          events,
        });
      }
      Err(e) => {
        return Ok(ApiResponse {
          status: 500,
          body: json!({"success":false,"error":e.message,"failedStepId":e.step_id}),
          events,
        });
      }
    }
  }

  if m == "POST" && parts.len() == 3 && parts[0] == "api" && parts[1] == "button" {
    if *state.show_lock.lock().map_err(|e| e.to_string())? {
      return Ok(ApiResponse {
        status: 403,
        body: json!({"error":"Show is locked. Cannot trigger buttons."}),
        events,
      });
    }
    let id = parts[2];
    let conns = conn_map(&load_active_connections(&state));
    let btn = find_button_by_id(&state, id);
    let Some(btn) = btn else {
      return Ok(ApiResponse {
        status: 404,
        body: json!({"error":"Button not found"}),
        events,
      });
    };
    let rows = btn
      .get("tasks")
      .and_then(Value::as_array)
      .cloned()
      .unwrap_or_default();
    match exec_sequence(&rows, &conns, &mut events, rosstalk_state.inner()).await {
      Ok(results) => {
        events.push(ApiEvent {
          name: "buttonTriggered".into(),
          data: json!({"id":btn.get("id").cloned().unwrap_or(json!(id)),"label":btn.get("label").cloned().unwrap_or(json!("Button")),"time":now_ms()}),
        });
        return Ok(ApiResponse {
          status: 200,
          body: json!({"success":true,"results":results}),
          events,
        });
      }
      Err(e) => {
        return Ok(ApiResponse {
          status: 500,
          body: json!({"success":false,"error":e.message,"failedStepId":e.step_id}),
          events,
        });
      }
    }
  }

  if m == "POST" && parts.len() == 3 && parts[0] == "api" && parts[1] == "cue" {
    if *state.show_lock.lock().map_err(|e| e.to_string())? {
      return Ok(ApiResponse {
        status: 403,
        body: json!({"error":"Show is locked. Cannot trigger cues."}),
        events,
      });
    }
    let cue_id = parts[2];
    {
      let mut r = state.run.lock().map_err(|e| e.to_string())?;
      if r.running {
        return Ok(ApiResponse {
          status: 200,
          body: json!({"rejected":true,"reason":"busy"}),
          events,
        });
      }
      r.running = true;
      r.current_cue = Some(cue_id.to_string());
      r.started_at = Some(now_ms());
    }
    let show = read_json(&state.show_path, json!({"cues":{}}));
    let conns = conn_map(&load_active_connections(&state));
    let res = if let Some(tl) = show
      .get("cues")
      .and_then(Value::as_object)
      .and_then(|c| c.get(cue_id))
      .and_then(Value::as_array)
      .cloned()
    {
      let mut err = None;
      for st in tl {
        if let Err(e) = run_step(&st, &conns, &mut events, rosstalk_state.inner()).await {
          err = Some(e);
          break;
        }
      }
      if let Some(e) = err {
        ApiResponse {
          status: 200,
          body: json!({"error":e.message}),
          events,
        }
      } else {
        events.push(ApiEvent {
          name: "cueTriggered".into(),
          data: json!({"cue":cue_id,"time":now_ms()}),
        });
        ApiResponse {
          status: 200,
          body: json!({"executed":cue_id}),
          events,
        }
      }
    } else {
      ApiResponse {
        status: 200,
        body: json!({"warning":"Unknown cue"}),
        events,
      }
    };
    {
      let mut r = state.run.lock().map_err(|e| e.to_string())?;
      r.running = false;
      r.current_cue = None;
      r.started_at = None;
    }
    return Ok(res);
  }

  Ok(ApiResponse {
    status: 404,
    body: json!({"error":"Not found"}),
    events,
  })
}
