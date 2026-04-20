use quick_xml::de::from_str as from_xml_str;
use quick_xml::se::to_string as to_xml_string;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::{ApiEvent, ApiResponse};
use crate::protocols;
use crate::show::{
  Protocol, ProtocolInput, RossTalkState, WsCommandState, conn_map, dmx_frame_from_input,
  exec_sequence, http_req, run_step, s, send_osc, send_tcp, send_udp,
};
use crate::state::{AppState, ensure_files, now_ms, read_json, write_json};
use crate::state::status::{refresh_status_for_request, status_body};

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
  id: i64,
  name: String,
  #[serde(rename = "layoutItemsJson", default)]
  layout_items_json: String,
}

fn default_project_layout() -> Value {
  json!({ "items": [] })
}

fn parse_project_id(value: &Value) -> Option<i64> {
  if let Some(id) = value.as_i64() {
    return Some(id);
  }
  if let Some(id) = value.as_u64() {
    return i64::try_from(id).ok();
  }
  value.as_str().and_then(|raw| raw.trim().parse::<i64>().ok())
}

fn project_file_path(project_store_dir: &PathBuf, project_id: i64) -> PathBuf {
  project_store_dir.join(format!("{project_id}.xml"))
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
  fs::write(path, xml).map_err(|e| e.to_string())
}

fn list_project_xml_files(project_store_dir: &PathBuf) -> Result<Vec<(PathBuf, ProjectXmlFile)>, String> {
  if !project_store_dir.exists() {
    return Ok(Vec::new());
  }
  let mut items: Vec<(PathBuf, ProjectXmlFile)> = Vec::new();
  for entry in fs::read_dir(project_store_dir).map_err(|e| e.to_string())? {
    let Ok(entry) = entry else { continue };
    let path = entry.path();
    let is_xml = path
      .extension()
      .and_then(|ext| ext.to_str())
      .map(|ext| ext.eq_ignore_ascii_case("xml"))
      .unwrap_or(false);
    if !is_xml {
      continue;
    }
    if let Some(project) = read_project_xml_file(&path) {
      items.push((path, project));
    }
  }
  items.sort_by(|(_, a), (_, b)| a.id.cmp(&b.id));
  Ok(items)
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

fn load_project_layout(state: &AppState, project_id: i64) -> Value {
  let file_path = project_file_path(&state.project_store_dir, project_id);
  let Some(project) = read_project_xml_file(&file_path) else {
    return default_project_layout();
  };
  json!({ "items": decode_layout_items_from_text(&project.layout_items_json) })
}

fn save_project_layout(state: &AppState, project_id: i64, layout: Value) -> Result<(), String> {
  let file_path = project_file_path(&state.project_store_dir, project_id);
  let mut project = read_project_xml_file(&file_path).unwrap_or(ProjectXmlFile {
    id: project_id,
    name: format!("Project {project_id}"),
    layout_items_json: "[]".to_string(),
  });
  project.layout_items_json = encode_layout_items_to_text(&layout);
  write_project_xml_file(&file_path, &project)
}

fn projects_from_payload(body: Option<Value>) -> Vec<(i64, String)> {
  let Some(Value::Array(entries)) = body else {
    return Vec::new();
  };
  let mut projects = Vec::new();
  for entry in entries {
    let Some(obj) = entry.as_object() else { continue };
    let Some(id_value) = obj.get("id") else { continue };
    let Some(id) = parse_project_id(id_value) else { continue };
    let Some(name) = obj.get("name").and_then(Value::as_str) else { continue };
    projects.push((id, name.to_string()));
  }
  projects
}

fn sync_projects_xml_files(state: &AppState, projects: Vec<(i64, String)>) -> Result<(), String> {
  fs::create_dir_all(&state.project_store_dir).map_err(|e| e.to_string())?;
  let existing = list_project_xml_files(&state.project_store_dir)?;
  let mut existing_layout_by_id: HashMap<i64, String> = HashMap::new();
  let mut existing_path_by_id: HashMap<i64, PathBuf> = HashMap::new();
  for (path, project) in existing {
    existing_layout_by_id.insert(project.id, project.layout_items_json);
    existing_path_by_id.insert(project.id, path);
  }

  let mut keep_ids: HashSet<i64> = HashSet::new();
  for (id, name) in projects {
    keep_ids.insert(id);
    let layout_items_json = existing_layout_by_id
      .remove(&id)
      .unwrap_or_else(|| "[]".to_string());
    let file_path = project_file_path(&state.project_store_dir, id);
    let project = ProjectXmlFile {
      id,
      name,
      layout_items_json,
    };
    write_project_xml_file(&file_path, &project)?;
  }

  for (id, path) in existing_path_by_id {
    if !keep_ids.contains(&id) {
      let _ = fs::remove_file(path);
    }
  }
  Ok(())
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

fn find_button_by_id(state: &AppState, button_id: &str) -> Option<Value> {
  let files = list_project_xml_files(&state.project_store_dir).ok()?;
  for (_, project) in files {
    let layout = json!({ "items": decode_layout_items_from_text(&project.layout_items_json) });
    if let Some(button) = find_button_by_id_in_layout(&layout, button_id) {
      return Some(button);
    }
  }
  None
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
  if m == "GET" && path == "/api/projects" {
    let files = list_project_xml_files(&state.project_store_dir)?;
    let projects = files
      .into_iter()
      .map(|(_, project)| json!({ "id": project.id, "name": project.name }))
      .collect::<Vec<Value>>();
    return Ok(ApiResponse {
      status: 200,
      body: Value::Array(projects),
      events,
    });
  }
  if m == "POST" && path == "/api/projects" {
    let projects = projects_from_payload(body);
    sync_projects_xml_files(&state, projects)?;
    return Ok(ApiResponse {
      status: 200,
      body: json!({"success":true}),
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
    write_json(&state.logs_path, &body.unwrap_or_else(|| json!([])))?;
    return Ok(ApiResponse {
      status: 200,
      body: json!({"success":true}),
      events,
    });
  }
  if m == "GET" && path == "/api/layout" {
    let files = list_project_xml_files(&state.project_store_dir)?;
    let fallback = files
      .into_iter()
      .next()
      .map(|(_, project)| json!({ "items": decode_layout_items_from_text(&project.layout_items_json) }))
      .unwrap_or_else(default_project_layout);
    return Ok(ApiResponse {
      status: 200,
      body: fallback,
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
    return Ok(ApiResponse {
      status: 200,
      body: json!({"success":true}),
      events,
    });
  }
  if m == "GET" && parts.len() == 3 && parts[0] == "api" && parts[1] == "layout" {
    let project_id = parts[2].parse::<i64>().unwrap_or(0);
    return Ok(ApiResponse {
      status: 200,
      body: load_project_layout(&state, project_id),
      events,
    });
  }
  if m == "POST" && parts.len() == 3 && parts[0] == "api" && parts[1] == "layout" {
    if *state.show_lock.lock().map_err(|e| e.to_string())? {
      return Ok(ApiResponse {
        status: 403,
        body: json!({"error":"Show is locked. Cannot save layout."}),
        events,
      });
    }
    let project_id = parts[2].parse::<i64>().unwrap_or(0);
    save_project_layout(&state, project_id, body.unwrap_or_else(default_project_layout))?;
    return Ok(ApiResponse {
      status: 200,
      body: json!({"success":true}),
      events,
    });
  }
  if m == "GET" && path == "/api/connections" {
    return Ok(ApiResponse {
      status: 200,
      body: read_json(&state.connections_path, json!({})),
      events,
    });
  }
  if m == "POST" && path == "/api/connections" {
    write_json(&state.connections_path, &body.unwrap_or_else(|| json!({})))?;
    refresh_status_for_request(&state, Some(&mut events)).await;
    return Ok(ApiResponse {
      status: 200,
      body: json!({"success":true}),
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
    let conns = conn_map(&read_json(&state.connections_path, json!({})));
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
    let conns = conn_map(&read_json(&state.connections_path, json!({})));
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
    let conns = conn_map(&read_json(&state.connections_path, json!({})));
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
