use futures_util::stream::{self, StreamExt};
use reqwest::Method;
use serde_json::{Map, Value, json};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::Emitter;
use tokio::net::{TcpStream, UdpSocket};

use crate::ApiEvent;
use crate::show::{Protocol, conn_map, infer_protocol};
use crate::state::{AppState, StatusRuntime, read_json};

const TCP_PROBE_TIMEOUT_MS: u64 = 180;
const HTTP_PROBE_TIMEOUT_MS: u64 = 220;
const STATUS_BOOTSTRAP_DELAY_MS: u64 = 120;
const STATUS_POLL_INTERVAL_MS: u64 = 1000;
const STATUS_MAX_PARALLEL_PROBES: usize = 24;
const ATEM_DEFAULT_PORT: u16 = 9910;
const SWP08_DEFAULT_PORT: u16 = 8910;

fn status_http_client() -> Result<&'static reqwest::Client, String> {
  static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
  match CLIENT.get_or_init(|| {
    reqwest::Client::builder()
      .pool_max_idle_per_host(4)
      .tcp_keepalive(Some(Duration::from_secs(15)))
      .build()
      .map_err(|e| e.to_string())
  }) {
    Ok(client) => Ok(client),
    Err(err) => Err(err.clone()),
  }
}

fn conn_host(conn: &Map<String, Value>) -> String {
  conn
    .get("host")
    .or_else(|| conn.get("ip"))
    .and_then(Value::as_str)
    .unwrap_or("")
    .trim()
    .to_string()
}

fn parse_port(v: Option<&Value>) -> Option<u16> {
  if let Some(n) = v.and_then(Value::as_u64) {
    if n > 0 && n <= 65535 {
      return Some(n as u16);
    }
  }
  if let Some(sv) = v.and_then(Value::as_str) {
    if let Ok(n) = sv.trim().parse::<u16>() {
      if n > 0 {
        return Some(n);
      }
    }
  }
  None
}

fn effective_port(conn: &Map<String, Value>, v: Option<&Value>) -> Option<u16> {
  if let Some(port) = parse_port(v) {
    return Some(port);
  }
  let ctype = conn
    .get("type")
    .and_then(Value::as_str)
    .unwrap_or("")
    .trim()
    .to_lowercase();
  if ctype == "atem" {
    return Some(ATEM_DEFAULT_PORT);
  }
  if ["swp08", "sw8", "swp8", "sw-p-08", "generic-swp08"].contains(&ctype.as_str()) {
    return Some(SWP08_DEFAULT_PORT);
  }
  None
}

fn protocol_label(conn: &Map<String, Value>) -> String {
  if let Some(p) = conn.get("protocol").and_then(Value::as_str) {
    let x = p.trim().to_lowercase();
    if !x.is_empty() {
      return x;
    }
  }
  match infer_protocol(conn, &Map::new()) {
    Protocol::Osc => "osc".to_string(),
    Protocol::Udp => "udp".to_string(),
    Protocol::Tcp => "tcp".to_string(),
    Protocol::Ws => "ws".to_string(),
    Protocol::Http => "http".to_string(),
    Protocol::Artnet => "artnet".to_string(),
    Protocol::Dmx => "dmx".to_string(),
    Protocol::Rosstalk => "rosstalk".to_string(),
  }
}

fn status_probe(conn: &Map<String, Value>) -> (String, Option<u16>, String, String) {
  let mut host = conn_host(conn);
  let mut port = effective_port(conn, conn.get("port"));
  let mut protocol = protocol_label(conn);
  let mut path = conn
    .get("path")
    .and_then(Value::as_str)
    .unwrap_or("/")
    .to_string();

  if let Some(hc) = conn.get("healthCheck").and_then(Value::as_object) {
    let hc_host = hc
      .get("host")
      .and_then(Value::as_str)
      .map(str::trim)
      .unwrap_or("");
    if !hc_host.is_empty() {
      host = hc_host.to_string();
    }
    let hc_port = parse_port(hc.get("port"));
    if hc_port.is_some() {
      port = hc_port;
    }
    if let Some(hc_proto) = hc.get("protocol").and_then(Value::as_str) {
      let p = hc_proto.trim().to_lowercase();
      if !p.is_empty() {
        protocol = p;
      }
    }
    if let Some(hc_path) = hc.get("path").and_then(Value::as_str) {
      let p = hc_path.trim();
      if !p.is_empty() {
        path = p.to_string();
      }
    }
  }

  (host, port, protocol, path)
}

async fn check_tcp_status(host: &str, port: u16) -> (String, Option<String>, Option<u16>) {
  for _ in 0..3 {
    let fut = TcpStream::connect(format!("{host}:{port}"));
    match tokio::time::timeout(Duration::from_millis(TCP_PROBE_TIMEOUT_MS), fut).await {
      Ok(Ok(_)) => return ("online".to_string(), None, None),
      Ok(Err(_)) => continue,
      Err(_) => continue,
    }
  }
  ("offline".to_string(), Some("timeout after retries".to_string()), None)
}

async fn check_osc_status(host: &str, port: u16) -> (String, Option<String>, Option<u16>) {
  for _ in 0..3 {
    match UdpSocket::bind("0.0.0.0:0").await {
      Ok(sock) => {
        let payload = b"/ping\0";
        match sock.send_to(payload, format!("{host}:{port}")).await {
          Ok(_) => return ("online".to_string(), None, None),
          Err(_) => continue,
        }
      }
      Err(_) => continue,
    }
  }
  ("offline".to_string(), Some("failed after retries".to_string()), None)
}
}

async fn check_http_status(
  protocol: &str,
  host: &str,
  port: u16,
  path: &str,
) -> (String, Option<String>, Option<u16>) {
  let sch = if protocol.eq_ignore_ascii_case("https") {
    "https"
  } else {
    "http"
  };
  let p = if path.starts_with('/') {
    path.to_string()
  } else {
    format!("/{path}")
  };
  let url = format!("{sch}://{host}:{port}{p}");
  let client = match status_http_client() {
    Ok(c) => c,
    Err(err) => return ("offline".to_string(), Some(err.to_string()), None),
  };
  for _ in 0..3 {
    match client
      .request(Method::GET, url.clone())
      .timeout(Duration::from_millis(HTTP_PROBE_TIMEOUT_MS))
      .send()
      .await
    {
      Ok(resp) => return ("online".to_string(), None, Some(resp.status().as_u16())),
      Err(_) => continue,
    }
  }
  ("offline".to_string(), Some("failed after retries".to_string()), None)
}

fn misconfigured_status(ctype: String, protocol: String, host: String, port: Option<u16>) -> Value {
  json!({
    "status":"misconfigured",
    "type":ctype,
    "protocol":protocol,
    "enabled":true,
    "host": if host.is_empty() {"N/A".to_string()} else {host},
    "port": port.map(|p| json!(p)).unwrap_or_else(|| json!("N/A"))
  })
}

async fn check_connection_status(conn: &Map<String, Value>) -> Value {
  let enabled = conn.get("enabled").and_then(Value::as_bool).unwrap_or(true);
  let ctype = conn
    .get("type")
    .and_then(Value::as_str)
    .unwrap_or("unknown")
    .to_lowercase();
  let protocol = protocol_label(conn);
  let host = conn_host(conn);
  let port = effective_port(conn, conn.get("port"));

  if !enabled {
    return json!({
      "status":"inactive",
      "type":ctype,
      "protocol":protocol,
      "host": if host.is_empty() {"N/A".to_string()} else {host},
      "port": port.map(|p| json!(p)).unwrap_or_else(|| json!("N/A")),
      "enabled":false,
      "lastError":"disabled by user",
      "lastSeen": Value::Null
    });
  }

  if host.is_empty() || port.is_none() {
    return misconfigured_status(ctype.to_string(), protocol, host, port);
  }

  let (probe_host, probe_port_opt, probe_protocol, probe_path) = status_probe(conn);
  if probe_host.is_empty() || probe_port_opt.is_none() {
    return misconfigured_status(ctype.to_string(), protocol, host, port);
  }
  let probe_port = probe_port_opt.unwrap_or(0);

  let (status, last_error, http_status) = if probe_protocol == "http" || probe_protocol == "https" {
    check_http_status(&probe_protocol, &probe_host, probe_port, &probe_path).await
  } else if probe_protocol == "ws" || probe_protocol == "wss" {
    check_tcp_status(&probe_host, probe_port).await
  } else if probe_protocol == "osc"
    || probe_protocol == "udp"
    || probe_protocol == "artnet"
    || probe_protocol == "dmx"
  {
    // UDP send success does not guarantee the target app is alive.
    // For Resolume, use TCP health probe on 8080 unless an explicit
    // healthCheck object is provided by config.
    if ctype == "resolume" && conn.get("healthCheck").is_none() {
      check_tcp_status(&probe_host, 8080).await
    } else {
      check_osc_status(&probe_host, probe_port).await
    }
  } else {
    check_tcp_status(&probe_host, probe_port).await
  };

  json!({
    "status":status,
    "type":ctype,
    "protocol":protocol,
    "enabled":true,
    "host": if host.is_empty() {"N/A".to_string()} else {host},
    "port": port.unwrap_or(0),
    "lastError": last_error,
    // Keep this stable so unchanged "online" devices don't emit update events
    // every poll and trigger unnecessary UI re-renders.
    "lastSeen": Value::Null,
    "httpStatus": http_status
  })
}

async fn collect_device_statuses(connections_path: &PathBuf) -> HashMap<String, Value> {
  let raw = read_json(connections_path, json!({}));
  let conns = conn_map(&raw);
  let mut out = HashMap::new();
  let mut jobs = stream::iter(
    conns
      .into_iter()
      .map(|(name, conn)| async move { (name, check_connection_status(&conn).await) }),
  )
  .buffer_unordered(STATUS_MAX_PARALLEL_PROBES.max(1));

  while let Some((name, status)) = jobs.next().await {
    out.insert(name, status);
  }
  out
}

async fn refresh_status_cache(
  connections_path: &PathBuf,
  cache: &Arc<Mutex<HashMap<String, Value>>>,
  in_flight: &Arc<Mutex<bool>>,
) -> Option<HashMap<String, Value>> {
  match in_flight.lock() {
    Ok(mut flag) => {
      if *flag {
        return None;
      }
      *flag = true;
    }
    Err(_) => return None,
  };

  let updated = collect_device_statuses(connections_path).await;
  let changed = match cache.lock() {
    Ok(mut status) => {
      let changed = *status != updated;
      *status = updated.clone();
      changed
    }
    Err(_) => false,
  };

  if let Ok(mut flag) = in_flight.lock() {
    *flag = false;
  }

  if changed { Some(updated) } else { None }
}

fn current_statuses(cache: &Arc<Mutex<HashMap<String, Value>>>) -> HashMap<String, Value> {
  cache
    .lock()
    .ok()
    .map(|m| m.clone())
    .unwrap_or_default()
}

fn emit_status_event(events: &mut Vec<ApiEvent>, statuses: HashMap<String, Value>) {
  events.push(ApiEvent {
    name: "deviceStatusUpdate".into(),
    data: json!(statuses),
  });
}

pub(crate) async fn refresh_status_for_request(state: &AppState, events: Option<&mut Vec<ApiEvent>>) {
  let changed = refresh_status_cache(
    &state.connections_path,
    &state.device_status,
    &state.status_check_in_flight,
  )
  .await;

  if let Some(event_list) = events {
    if let Some(statuses) = changed {
      emit_status_event(event_list, statuses);
    } else {
      emit_status_event(event_list, current_statuses(&state.device_status));
    }
  }
}

pub(crate) fn start_status_loop(app: tauri::AppHandle, runtime: StatusRuntime) {
  tauri::async_runtime::spawn(async move {
    tokio::time::sleep(Duration::from_millis(STATUS_BOOTSTRAP_DELAY_MS)).await;
    loop {
      if let Some(statuses) = refresh_status_cache(
        &runtime.connections_path,
        &runtime.device_status,
        &runtime.status_check_in_flight,
      )
      .await
      {
        app.emit("deviceStatusUpdate", statuses).ok();
      }
      tokio::time::sleep(Duration::from_millis(STATUS_POLL_INTERVAL_MS)).await;
    }
  });
}

pub(crate) fn status_body(state: &AppState, lock: bool) -> Value {
  let r = state.run.lock().ok();
  let devices = state
    .device_status
    .lock()
    .ok()
    .map(|v| v.clone())
    .unwrap_or_default();
  json!({"running":r.as_ref().map(|x|x.running).unwrap_or(false),"currentCue":r.as_ref().and_then(|x|x.current_cue.clone()),"startedAt":r.as_ref().and_then(|x|x.started_at),"showLock":lock,"devices":devices})
}
