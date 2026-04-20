use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use futures_util::SinkExt;
use futures_util::future::BoxFuture;
use futures_util::stream::{self, StreamExt, TryStreamExt};
use serde::Deserialize;
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::Duration;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

use crate::ApiEvent;
use crate::protocols;
use crate::state::now_ms;

pub(crate) type WsCommandState = protocols::ws::WsCommandState;
pub(crate) type RossTalkState = protocols::rosstalk::RossTalkState;

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Protocol {
  Osc,
  Udp,
  Tcp,
  Ws,
  Http,
  Artnet,
  Dmx,
  Rosstalk,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct ProtocolInput {
  pub(crate) protocol: Protocol,
  pub(crate) host: String,
  pub(crate) port: u16,
  pub(crate) address: Option<String>,
  pub(crate) args: Option<Vec<Value>>,
  pub(crate) payload: Option<String>,
}

#[derive(Debug)]
pub(crate) struct ExecError {
  pub(crate) message: String,
  pub(crate) step_id: Option<String>,
}

impl ExecError {
  pub(crate) fn new(msg: impl Into<String>, step_id: Option<String>) -> Self {
    Self {
      message: msg.into(),
      step_id,
    }
  }
}

pub(crate) fn s(v: Option<&Value>) -> String {
  v.and_then(Value::as_str)
    .map(ToString::to_string)
    .unwrap_or_else(|| v.map(ToString::to_string).unwrap_or_default())
}

fn obj(v: &Value) -> Map<String, Value> {
  v.as_object().cloned().unwrap_or_default()
}

fn u16v(v: Option<&Value>, d: u16) -> u16 {
  if let Some(n) = v.and_then(Value::as_u64) {
    if n <= u16::MAX as u64 {
      return n as u16;
    }
  }
  if let Some(raw) = v.and_then(Value::as_str) {
    if let Ok(parsed) = raw.trim().parse::<u16>() {
      return parsed;
    }
  }
  d
}

fn connection_id(v: Option<&Value>) -> Option<u64> {
  if let Some(n) = v.and_then(Value::as_u64) {
    return Some(n);
  }
  if let Some(n) = v.and_then(Value::as_i64) {
    if n >= 0 {
      return Some(n as u64);
    }
  }
  if let Some(raw) = v.and_then(Value::as_str) {
    if let Ok(parsed) = raw.trim().parse::<u64>() {
      return Some(parsed);
    }
  }
  None
}

fn line_end(v: Option<&Value>, d: &str) -> String {
  let raw = s(v);
  let k = raw.trim().to_lowercase();
  if k.is_empty() {
    return d.to_string();
  }
  if ["none", "off", "false", "0"].contains(&k.as_str()) {
    return String::new();
  }
  if k == "lf" || k == "\\n" {
    return "\n".to_string();
  }
  if k == "cr" || k == "\\r" {
    return "\r".to_string();
  }
  if k == "crlf" || k == "\\r\\n" {
    return "\r\n".to_string();
  }
  raw
}

fn protocol_from(s: &str) -> Protocol {
  match s {
    "osc" => Protocol::Osc,
    "udp" => Protocol::Udp,
    "ws" | "wss" => Protocol::Ws,
    "http" | "https" => Protocol::Http,
    "artnet" => Protocol::Artnet,
    "dmx" => Protocol::Dmx,
    "rosstalk" => Protocol::Rosstalk,
    _ => Protocol::Tcp,
  }
}

pub(crate) fn infer_protocol(conn: &Map<String, Value>, task: &Map<String, Value>) -> Protocol {
  if let Some(p) = task
    .get("protocol")
    .and_then(Value::as_str)
    .or_else(|| conn.get("protocol").and_then(Value::as_str))
  {
    return protocol_from(&p.to_lowercase());
  }
  let t = task
    .get("deviceType")
    .and_then(Value::as_str)
    .or_else(|| conn.get("type").and_then(Value::as_str))
    .or_else(|| task.get("device").and_then(Value::as_str))
    .unwrap_or("")
    .to_lowercase();
  if ["resolume", "grandma3", "lighting", "audio", "audio_mixer", "x32"].contains(&t.as_str()) {
    return Protocol::Osc;
  }
  if t == "atem" {
    return Protocol::Udp;
  }
  if t == "obs" {
    return Protocol::Ws;
  }
  if ["artnet", "artnet_dmx", "dmx"].contains(&t.as_str()) {
    return Protocol::Artnet;
  }
  if ["ross_talk", "ross_carbonite", "ross_xpression"].contains(&t.as_str()) {
    return Protocol::Rosstalk;
  }
  if ["http", "https", "http_api"].contains(&t.as_str()) {
    return Protocol::Http;
  }
  Protocol::Tcp
}

fn osc_args(task: &Map<String, Value>) -> Vec<Value> {
  if let Some(a) = task.get("args").and_then(Value::as_array) {
    return a.clone();
  }
  let txt = task.get("argsText").and_then(Value::as_str).unwrap_or("").trim();
  if txt.is_empty() {
    return vec![];
  }
  if let Ok(v) = serde_json::from_str::<Value>(txt) {
    return v.as_array().cloned().unwrap_or_else(|| vec![v]);
  }
  vec![json!(txt)]
}

fn osc_address(task: &Map<String, Value>, p: &Protocol) -> String {
  let mut a = task
    .get("address")
    .or_else(|| task.get("oscAddress"))
    .or_else(|| task.get("path"))
    .and_then(Value::as_str)
    .unwrap_or("")
    .trim()
    .to_string();
  if a.is_empty() {
    let act = task
      .get("action")
      .and_then(Value::as_str)
      .unwrap_or("")
      .to_lowercase();
    let cmd = task.get("command").and_then(Value::as_str).unwrap_or("").trim();
    if (act == "osc" || *p == Protocol::Osc) && cmd.starts_with('/') {
      a = cmd.to_string();
    }
  }
  if a.is_empty() {
    return String::new();
  }
  if a.starts_with('/') { a } else { format!("/{a}") }
}

fn rosstalk_model(conn: &Map<String, Value>) -> String {
  conn
    .get("model")
    .and_then(Value::as_str)
    .unwrap_or("carbonite")
    .trim()
    .to_lowercase()
}

fn parse_positive_i64(v: Option<&Value>, field: &str) -> Result<i64, ExecError> {
  let value = if let Some(number) = v.and_then(Value::as_i64) {
    number
  } else if let Some(text) = v.and_then(Value::as_str) {
    text
      .trim()
      .parse::<i64>()
      .map_err(|_| ExecError::new(format!("RossTalk {field} must be >= 1"), None))?
  } else {
    return Err(ExecError::new(format!("RossTalk {field} must be >= 1"), None));
  };
  if value < 1 {
    return Err(ExecError::new(format!("RossTalk {field} must be >= 1"), None));
  }
  Ok(value)
}

fn parse_non_empty_token(v: Option<&Value>, field: &str) -> Result<String, ExecError> {
  let value = s(v);
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return Err(ExecError::new(format!("RossTalk {field} is required"), None));
  }
  Ok(trimmed.to_string())
}

fn parse_ross_keyer_ref(raw: &str) -> Result<(String, String), ExecError> {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return Err(ExecError::new("RossTalk keyer reference is required", None));
  }
  if let Some((mle, key)) = trimmed.rsplit_once(':') {
    let mle = mle.trim();
    let key = key.trim();
    if !mle.is_empty() && !key.is_empty() {
      return Ok((mle.to_string(), key.to_string()));
    }
  }
  if let Some((mle, key)) = trimmed.split_once('|') {
    let mle = mle.trim();
    let key = key.trim();
    if !mle.is_empty() && !key.is_empty() {
      return Ok((mle.to_string(), key.to_string()));
    }
  }
  Err(ExecError::new(
    "RossTalk keyer reference must look like ME:1:1 or 1:1",
    None,
  ))
}

fn rosstalk(task: &Map<String, Value>, conn: &Map<String, Value>) -> Result<String, ExecError> {
  let action = task
    .get("action")
    .or_else(|| task.get("type"))
    .and_then(Value::as_str)
    .unwrap_or("")
    .trim()
    .to_lowercase();
  let model = rosstalk_model(conn);

  match action.as_str() {
    "gpi" => {
      let gpi = parse_positive_i64(
        task.get("gpi")
          .or_else(|| task.get("number"))
          .or_else(|| task.get("input")),
        "GPI number",
      )?;
      let padded = if gpi <= 9 && ["carbonite", "acuity"].contains(&model.as_str()) {
        format!("0{gpi}")
      } else {
        gpi.to_string()
      };
      return Ok(format!("GPI {padded}"));
    }
    "gpibyname" | "gpi_by_name" => {
      let gpi = parse_non_empty_token(
        task.get("gpiName")
          .or_else(|| task.get("gpi"))
          .or_else(|| task.get("name"))
          .or_else(|| task.get("input")),
        "GPI name",
      )?;
      let parameter = s(task.get("parameter").or_else(|| task.get("value")));
      if parameter.trim().is_empty() {
        return Ok(format!("GPI {gpi}"));
      }
      return Ok(format!("GPI {gpi}:{}", parameter.trim()));
    }
    "cc" => {
      let bank = parse_positive_i64(task.get("bank").or_else(|| task.get("input")), "CC bank")?;
      let cc = parse_positive_i64(task.get("cc").or_else(|| task.get("value")), "CC number")?;
      return Ok(format!("CC {bank}:{cc:02}"));
    }
    "loadset" => {
      let set_name = parse_non_empty_token(task.get("set").or_else(|| task.get("input")), "set name")?;
      if model == "acuity" {
        let location = s(task.get("location").or_else(|| task.get("value")));
        let location = if location.trim().is_empty() { "USB" } else { location.trim() };
        return Ok(format!("LOADSET {location}:{set_name}"));
      }
      return Ok(format!("LOADSET {set_name}"));
    }
    "cut" => {
      let mle = parse_non_empty_token(task.get("mle").or_else(|| task.get("input")), "MLE")?;
      return Ok(format!("MECUT {mle}"));
    }
    "autotrans" | "auto" => {
      let mle = parse_non_empty_token(task.get("mle").or_else(|| task.get("input")), "MLE")?;
      return Ok(format!("MEAUTO {mle}"));
    }
    "xpt" => {
      let destination = parse_non_empty_token(
        task.get("destination").or_else(|| task.get("vidDest")).or_else(|| task.get("input")),
        "destination",
      )?;
      let source = parse_non_empty_token(
        task.get("source").or_else(|| task.get("vidSource")).or_else(|| task.get("value")),
        "source",
      )?;
      return Ok(format!("XPT {destination}:{source}"));
    }
    "transkey" | "transitionkey" | "transition_keyer" => {
      let keyer_ref = parse_non_empty_token(
        task.get("keyerRef").or_else(|| task.get("input")),
        "keyer reference",
      )?;
      let (mle, keyer) = parse_ross_keyer_ref(&keyer_ref)?;
      let transition = s(task.get("transition").or_else(|| task.get("value")))
        .trim()
        .to_uppercase();
      let prefix = match transition.as_str() {
        "" | "TOGGLE" | "CUT" => "KEYCUT",
        "AUTO" => "KEYAUTO",
        "ON" | "CUTON" => "KEYCUTON",
        "OFF" | "CUTOFF" => "KEYCUTOFF",
        "AUTOON" => "KEYAUTOON",
        "AUTOOFF" => "KEYAUTOOFF",
        other => {
          return Err(ExecError::new(
            format!("Unsupported RossTalk transition key mode: {other}"),
            None,
          ));
        }
      };
      return Ok(format!("{prefix} {mle}:{keyer}"));
    }
    "ftb" => return Ok("FTB".to_string()),
    "mem" => {
      let mem_id = parse_non_empty_token(task.get("memId").or_else(|| task.get("input")), "MEM id")?;
      return Ok(format!("MEM {mem_id}"));
    }
    "seqi" => {
      let take_id = parse_non_empty_token(task.get("takeId").or_else(|| task.get("input")), "take ID")?;
      let layer = parse_non_empty_token(task.get("layer").or_else(|| task.get("value")), "layer")?;
      return Ok(format!("SEQI {take_id}:{layer}"));
    }
    "seqo" => {
      let take_id = parse_non_empty_token(task.get("takeId").or_else(|| task.get("input")), "take ID")?;
      return Ok(format!("SEQO {take_id}"));
    }
    "mvbox" => {
      let box_ref = parse_non_empty_token(task.get("mvBox").or_else(|| task.get("input")), "multiviewer and box")?;
      let (mv_id, box_id) = box_ref
        .split_once(':')
        .ok_or_else(|| ExecError::new("RossTalk MVBOX input must look like 1:5", None))?;
      let source = parse_non_empty_token(task.get("source").or_else(|| task.get("value")), "source")?;
      return Ok(format!("MVBOX:{}:{}:{source}", mv_id.trim(), box_id.trim()));
    }
    "timer" => {
      let timer_id = parse_positive_i64(task.get("timerId").or_else(|| task.get("input")), "timer ID")?;
      let timer_action = s(task.get("timerAction").or_else(|| task.get("value")))
        .trim()
        .to_uppercase();
      let timer_action = if timer_action.is_empty() { "RUN" } else { timer_action.as_str() };
      if !["RUN", "PAUSE", "STOP", "END"].contains(&timer_action) {
        return Err(ExecError::new(
          format!("Unsupported RossTalk timer action: {timer_action}"),
          None,
        ));
      }
      return Ok(format!("TIMER {timer_id}:{timer_action}"));
    }
    "custom" | "raw" | "" => {}
    _ => {}
  }

  let mode = task
    .get("rosstalkMode")
    .or_else(|| task.get("mode"))
    .or_else(|| task.get("format"))
    .and_then(Value::as_str)
    .unwrap_or("raw")
    .to_lowercase();
  if ["cc", "cc_grid", "cc_index"].contains(&mode.as_str()) {
    let page = task
      .get("page")
      .and_then(Value::as_i64)
      .ok_or_else(|| ExecError::new("RossTalk page must be >= 1", None))?;
    if page < 1 {
      return Err(ExecError::new("RossTalk page must be >= 1", None));
    }
    if mode == "cc_grid" {
      let r = task
        .get("row")
        .and_then(Value::as_i64)
        .ok_or_else(|| ExecError::new("RossTalk row must be >= 1", None))?;
      let c = task
        .get("column")
        .and_then(Value::as_i64)
        .ok_or_else(|| ExecError::new("RossTalk column must be >= 1", None))?;
      if r < 1 || c < 1 {
        return Err(ExecError::new("RossTalk row/column must be >= 1", None));
      }
      return Ok(format!("CC {page}/{r}/{c}"));
    }
    let b = task
      .get("button")
      .and_then(Value::as_i64)
      .ok_or_else(|| ExecError::new("RossTalk button must be >= 1", None))?;
    if b < 1 {
      return Err(ExecError::new("RossTalk button must be >= 1", None));
    }
    return Ok(format!("CC {page}:{b}"));
  }
  let cmd = task
    .get("command")
    .or_else(|| task.get("payload"))
    .or_else(|| task.get("message"))
    .and_then(Value::as_str)
    .unwrap_or("")
    .trim()
    .to_string();
  if cmd.is_empty() {
    return Err(ExecError::new("RossTalk task missing command", None));
  }
  Ok(cmd)
}

const ATEM_DEFAULT_PORT: u16 = 9910;
const VMIX_DEFAULT_PORT: u16 = 8099;
const ROSSTALK_DEFAULT_PORT: u16 = 7788;
const OBS_CONNECT_TIMEOUT_MS: u64 = 1200;
const EXEC_PARALLEL_LIMIT: usize = 16;

fn parse_positive_u16_token(token: &str, field: &str) -> Result<u16, ExecError> {
  let value = token
    .parse::<u16>()
    .map_err(|_| ExecError::new(format!("ATEM {field} must be a positive integer"), None))?;
  if value == 0 {
    return Err(ExecError::new(
      format!("ATEM {field} must be >= 1"),
      None,
    ));
  }
  Ok(value)
}

fn parse_float_token(token: &str, field: &str) -> Result<f32, ExecError> {
  token
    .parse::<f32>()
    .map_err(|_| ExecError::new(format!("ATEM {field} must be a number"), None))
}

fn validate_atem_command(cmd: &str) -> Result<(), ExecError> {
  let tokens: Vec<&str> = cmd.split_whitespace().collect();
  if tokens.is_empty() {
    return Err(ExecError::new("ATEM task missing command", None));
  }
  match tokens[0] {
    "CUT" | "AUTO" => {
      if tokens.len() != 1 {
        return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
      }
    }
    "PROGRAM" | "PREVIEW" => {
      if tokens.len() != 2 && tokens.len() != 3 {
        return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
      }
      parse_positive_u16_token(tokens[1], "input")?;
      if tokens.len() == 3 {
        parse_positive_u16_token(tokens[2], "me")?;
      }
    }
    "AUX" => {
      if tokens.len() != 3 {
        return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
      }
      parse_positive_u16_token(tokens[1], "bus")?;
      parse_positive_u16_token(tokens[2], "input")?;
    }
    "FTB" => {
      match tokens.len() {
        2 => {
          if !["ON", "OFF", "TOGGLE", "AUTO"].contains(&tokens[1]) {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        3 => {
          parse_positive_u16_token(tokens[1], "me")?;
          if !["ON", "OFF", "TOGGLE", "AUTO"].contains(&tokens[2]) {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        4 => {
          parse_positive_u16_token(tokens[1], "me")?;
          if tokens[2] != "RATE" {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_positive_u16_token(tokens[3], "rate")?;
        }
        _ => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
      }
    }
    "USK1" => {
      if tokens.len() != 2 || !["ON", "OFF", "TOGGLE"].contains(&tokens[1]) {
        return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
      }
    }
    "DSK1" => {
      if tokens.len() != 2 || tokens[1] != "AUTO" {
        return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
      }
    }
    "USK" => {
      match tokens.len() {
        4 => {
          parse_positive_u16_token(tokens[1], "me")?;
          parse_positive_u16_token(tokens[2], "key")?;
          if !["ON", "OFF", "TOGGLE", "AUTO", "TIE", "FLY"].contains(&tokens[3]) {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        5 => {
          parse_positive_u16_token(tokens[1], "me")?;
          parse_positive_u16_token(tokens[2], "key")?;
          match tokens[3] {
            "SOURCE" => {
              parse_positive_u16_token(tokens[4], "input")?;
            }
            "TYPE" => {
              if !["LUMA", "CHROMA", "PATTERN", "DVE"].contains(&tokens[4]) {
                return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
              }
            }
            "FLY" => {
              if !["A", "B", "RUN", "ON", "OFF", "TOGGLE"].contains(&tokens[4]) {
                return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
              }
            }
            _ => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
          }
        }
        6 => {
          parse_positive_u16_token(tokens[1], "me")?;
          parse_positive_u16_token(tokens[2], "key")?;
          if tokens[3] != "SOURCE" {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_positive_u16_token(tokens[4], "fill input")?;
          parse_positive_u16_token(tokens[5], "key input")?;
        }
        8 => {
          parse_positive_u16_token(tokens[1], "me")?;
          parse_positive_u16_token(tokens[2], "key")?;
          if tokens[3] != "MASK" {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_float_token(tokens[4], "top")?;
          parse_float_token(tokens[5], "bottom")?;
          parse_float_token(tokens[6], "left")?;
          parse_float_token(tokens[7], "right")?;
        }
        _ => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
      }
    }
    "DSK" => {
      match tokens.len() {
        3 => {
          parse_positive_u16_token(tokens[1], "key")?;
          if !["ON", "OFF", "TOGGLE", "AUTO", "TIE", "TIED"].contains(&tokens[2]) {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        4 => {
          parse_positive_u16_token(tokens[1], "key")?;
          match tokens[2] {
            "SOURCE" => {
              parse_positive_u16_token(tokens[3], "input")?;
            }
            "RATE" => {
              parse_positive_u16_token(tokens[3], "rate")?;
            }
            "PREMULT" => {
              if !["ON", "OFF", "TOGGLE"].contains(&tokens[3]) {
                return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
              }
            }
            _ => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
          }
        }
        5 => {
          parse_positive_u16_token(tokens[1], "key")?;
          if tokens[2] != "SOURCE" {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_positive_u16_token(tokens[3], "fill input")?;
          parse_positive_u16_token(tokens[4], "key input")?;
        }
        7 => {
          parse_positive_u16_token(tokens[1], "key")?;
          if tokens[2] != "MASK" {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_float_token(tokens[3], "top")?;
          parse_float_token(tokens[4], "bottom")?;
          parse_float_token(tokens[5], "left")?;
          parse_float_token(tokens[6], "right")?;
        }
        _ => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
      }
    }
    "TRANSITION" => {
      if tokens.len() < 4 {
        return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
      }
      parse_positive_u16_token(tokens[1], "me")?;
      match tokens[2] {
        "STYLE" => {
          if tokens.len() != 4 || !["MIX", "DIP", "WIPE", "DVE", "STING"].contains(&tokens[3]) {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        "RATE" => {
          if tokens.len() != 4 {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_positive_u16_token(tokens[3], "rate")?;
        }
        "SELECTION" => {
          if tokens.len() != 4
            || !["BKGD", "KEY1", "KEY2", "KEY3", "KEY4", "DSK1", "DSK2"].contains(&tokens[3])
          {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        "SELECT" => {
          if tokens.len() != 4 || tokens[3].trim().is_empty() {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        "COMPONENT" => {
          if tokens.len() != 5
            || !["BKGD", "KEY1", "KEY2", "KEY3", "KEY4", "DSK1", "DSK2"].contains(&tokens[3])
            || !["ON", "OFF", "TOGGLE"].contains(&tokens[4])
          {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        "PREVIEW" => {
          if tokens.len() != 4 || !["ON", "OFF", "TOGGLE"].contains(&tokens[3]) {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        _ => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
      }
    }
    "MV" => {
      match tokens.len() {
        4 => {
          if tokens[2] != "LAYOUT" {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_positive_u16_token(tokens[1], "multiviewer")?;
          parse_positive_u16_token(tokens[3], "layout")?;
        }
        6 => {
          if tokens[2] != "WINDOW" || tokens[4] != "SOURCE" {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_positive_u16_token(tokens[1], "multiviewer")?;
          parse_positive_u16_token(tokens[3], "window")?;
          parse_positive_u16_token(tokens[5], "source")?;
        }
        _ => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
      }
    }
    "SSRC" => {
      if tokens.len() < 6 || tokens[2] != "BOX" {
        return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
      }
      parse_positive_u16_token(tokens[1], "supersource")?;
      parse_positive_u16_token(tokens[3], "box")?;
      match tokens[4] {
        "SOURCE" => {
          if tokens.len() != 6 {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_positive_u16_token(tokens[5], "source")?;
        }
        "ONAIR" => {
          if tokens.len() != 6 || !["ON", "OFF", "TOGGLE"].contains(&tokens[5]) {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        "GEOM" | "GEOM_OFFSET" => {
          if tokens.len() != 8 {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_float_token(tokens[5], "x")?;
          parse_float_token(tokens[6], "y")?;
          parse_float_token(tokens[7], "size")?;
        }
        _ => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
      }
    }
    "MEDIAPLAYER" => {
      parse_positive_u16_token(tokens[1], "media player")?;
      match tokens.len() {
        3 => {
          if !["NEXT", "PREV"].contains(&tokens[2]) {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
        }
        4 => {
          if !["STILL", "CLIP", "CAPTURE", "DELETE"].contains(&tokens[2]) {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_positive_u16_token(tokens[3], "source")?;
        }
        5 => {
          if tokens[2] != "DELETE" || tokens[3] != "STILL" {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_positive_u16_token(tokens[4], "source")?;
        }
        _ => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
      }
    }
    "STREAMING" | "RECORDING" => {
      if tokens.len() != 2 || !["START", "STOP", "TOGGLE"].contains(&tokens[1]) {
        return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
      }
    }
    "MACRO" => {
      match tokens.len() {
        2 => {
          if tokens[1] != "STOP" && tokens[1] != "CONTINUE" {
            parse_positive_u16_token(tokens[1], "macro")?;
          }
        }
        3 => {
          if !["RUN", "START", "LOOP"].contains(&tokens[1]) {
            return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
          }
          parse_positive_u16_token(tokens[2], "macro")?;
        }
        1 => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
        4 => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
        _ => return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None)),
      }
    }
    "AUDIO" => {
      if tokens.len() != 5 || !["CLASSIC", "FAIRLIGHT"].contains(&tokens[1]) || tokens[2] != "INPUT" {
        return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
      }
      parse_positive_u16_token(tokens[3], "audio input")?;
      if !["ON", "OFF", "TOGGLE", "MUTE", "UNMUTE"].contains(&tokens[4]) {
        return Err(ExecError::new(format!("Invalid ATEM command: {cmd}"), None));
      }
    }
    _ => {
      // Keep unknown commands pass-through to support custom bridge adapters.
    }
  }
  Ok(())
}

fn atem_command(task: &Map<String, Value>) -> Result<String, ExecError> {
  let mut cmd = task
    .get("command")
    .or_else(|| task.get("payload"))
    .or_else(|| task.get("message"))
    .and_then(Value::as_str)
    .unwrap_or("")
    .to_string();
  if cmd.trim().is_empty() {
    let action = task
      .get("action")
      .and_then(Value::as_str)
      .unwrap_or("")
      .trim()
      .to_lowercase();
    cmd = match action.as_str() {
      "cut" => "CUT".to_string(),
      "auto" => "AUTO".to_string(),
      _ => String::new(),
    };
  }
  let normalized = cmd
    .split_whitespace()
    .filter(|t| !t.is_empty())
    .collect::<Vec<_>>()
    .join(" ")
    .to_uppercase();
  if normalized.is_empty() {
    return Err(ExecError::new("ATEM task missing command", None));
  }
  validate_atem_command(&normalized)?;
  Ok(normalized)
}

fn parse_dmx_values(v: &Value) -> Result<Vec<u8>, ExecError> {
  let Some(arr) = v.as_array() else {
    return Err(ExecError::new(
      "DMX values must be an array of 0..255 integers",
      None,
    ));
  };
  if arr.is_empty() {
    return Err(ExecError::new("DMX values array cannot be empty", None));
  }
  if arr.len() > 512 {
    return Err(ExecError::new("DMX values cannot exceed 512 channels", None));
  }
  let mut out = Vec::with_capacity(arr.len());
  for n in arr {
    let raw = n
      .as_u64()
      .ok_or_else(|| ExecError::new("DMX values must be integers", None))?;
    if raw > 255 {
      return Err(ExecError::new("DMX values must be in range 0..255", None));
    }
    out.push(raw as u8);
  }
  Ok(out)
}

fn dmx_frame_from_task(task: &Map<String, Value>) -> Result<(u16, Vec<u8>), ExecError> {
  let universe = task.get("universe").and_then(Value::as_u64).unwrap_or(0);
  if universe > 32767 {
    return Err(ExecError::new("DMX universe must be 0..32767", None));
  }

  if let Some(values) = task.get("values") {
    return Ok((universe as u16, parse_dmx_values(values)?));
  }

  let channel = task.get("channel").and_then(Value::as_u64);
  let value = task.get("value").and_then(Value::as_u64);
  if let (Some(ch), Some(v)) = (channel, value) {
    if ch == 0 || ch > 512 {
      return Err(ExecError::new("DMX channel must be 1..512", None));
    }
    if v > 255 {
      return Err(ExecError::new("DMX value must be 0..255", None));
    }
    let mut data = vec![0u8; ch as usize];
    data[(ch - 1) as usize] = v as u8;
    return Ok((universe as u16, data));
  }

  Err(ExecError::new(
    "Artnet/DMX requires either values[] or channel+value",
    None,
  ))
}

pub(crate) fn dmx_frame_from_input(input: &ProtocolInput) -> Result<(u16, Vec<u8>), String> {
  let mut universe: u16 = input
    .address
    .as_ref()
    .and_then(|x| x.trim().parse::<u16>().ok())
    .unwrap_or(0);
  let mut values: Vec<u8> = Vec::new();

  if let Some(args) = &input.args {
    for arg in args {
      let raw = arg
        .as_u64()
        .ok_or_else(|| "DMX args must be integers".to_string())?;
      if raw > 255 {
        return Err("DMX args values must be 0..255".to_string());
      }
      values.push(raw as u8);
    }
  }

  if let Some(payload) = &input.payload {
    let trimmed = payload.trim();
    if !trimmed.is_empty() {
      if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
        if let Some(u) = parsed.get("universe").and_then(Value::as_u64) {
          if u > 32767 {
            return Err("DMX universe must be 0..32767".to_string());
          }
          universe = u as u16;
        }
        if let Some(v) = parsed.get("values") {
          values = parse_dmx_values(v).map_err(|e| e.message)?;
        } else if let (Some(ch), Some(val)) = (
          parsed.get("channel").and_then(Value::as_u64),
          parsed.get("value").and_then(Value::as_u64),
        ) {
          if ch == 0 || ch > 512 {
            return Err("DMX channel must be 1..512".to_string());
          }
          if val > 255 {
            return Err("DMX value must be 0..255".to_string());
          }
          values = vec![0u8; ch as usize];
          values[(ch - 1) as usize] = val as u8;
        }
      } else {
        return Err(
          "DMX payload must be JSON: {\"universe\":0,\"values\":[...]} or {\"channel\":1,\"value\":255}"
            .to_string(),
        );
      }
    }
  }

  if values.is_empty() {
    return Err("DMX requires args values or JSON payload".to_string());
  }
  Ok((universe, values))
}

pub(crate) fn conn_map(v: &Value) -> HashMap<String, Map<String, Value>> {
  let mut out = HashMap::new();
  if let Some(o) = v.as_object() {
    for (k, cv) in o {
      if let Some(m) = cv.as_object() {
        out.insert(k.clone(), m.clone());
      }
    }
  }
  out
}

fn resolve_connection(
  task: &Map<String, Value>,
  conns: &HashMap<String, Map<String, Value>>,
) -> Map<String, Value> {
  if let Some(c) = task.get("connection").and_then(Value::as_object) {
    return c.clone();
  }
  if let Some(target_id) = connection_id(task.get("connectionId")) {
    for c in conns.values() {
      if connection_id(c.get("id")) == Some(target_id) {
        return c.clone();
      }
    }
  }
  if let Some(n) = task.get("deviceName").and_then(Value::as_str) {
    if let Some(c) = conns.get(n) {
      return c.clone();
    }
  }
  if let Some(n) = task.get("device").and_then(Value::as_str) {
    if let Some(c) = conns.get(n) {
      return c.clone();
    }
  }
  if let Some(device) = task.get("device").and_then(Value::as_str) {
    let w = device.to_lowercase();
    let aliases: Vec<&str> = match w.as_str() {
      "lighting" => vec!["lighting", "grandma3"],
      "grandma3" => vec!["grandma3", "lighting"],
      "audio" => vec!["audio", "audio_mixer"],
      "audio_mixer" => vec!["audio_mixer", "audio"],
      _ => vec![w.as_str()],
    };
    for c in conns.values() {
      let t = c
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_lowercase();
      if aliases.contains(&t.as_str()) {
        return c.clone();
      }
    }
  }
  Map::new()
}

fn emit_log(task: &Map<String, Value>, conn: &Map<String, Value>, msg: String, events: &mut Vec<ApiEvent>) {
  let dev = task
    .get("deviceName")
    .or_else(|| task.get("device"))
    .cloned()
    .or_else(|| conn.get("type").cloned())
    .unwrap_or(json!("device"));
  events.push(ApiEvent {
    name: "deviceLog".to_string(),
    data: json!({"device":dev,"message":msg}),
  });
}

pub(crate) async fn send_osc(host: &str, port: u16, addr: &str, args: &[Value]) -> Result<(), ExecError> {
  protocols::osc::send(host, port, addr, args)
    .await
    .map_err(|e| ExecError::new(e, None))?;
  Ok(())
}

pub(crate) async fn send_tcp(host: &str, port: u16, payload: &str, le: &str) -> Result<(), ExecError> {
  protocols::tcp::send(host, port, payload, le)
    .await
    .map_err(|e| ExecError::new(e, None))?;
  Ok(())
}

pub(crate) async fn send_tcp_capture(
  host: &str,
  port: u16,
  payload: &str,
  le: &str,
  timeout_ms: u64,
) -> Result<Option<String>, ExecError> {
  protocols::tcp::send_capture(host, port, payload, le, timeout_ms)
    .await
    .map_err(|e| ExecError::new(e, None))
}

pub(crate) async fn send_udp(host: &str, port: u16, payload: &str, le: &str) -> Result<(), ExecError> {
  protocols::udp::send(host, port, payload, le)
    .await
    .map_err(|e| ExecError::new(e, None))?;
  Ok(())
}

pub(crate) async fn http_req(
  proto: &str,
  host: &str,
  port: u16,
  method: &str,
  path: &str,
  hdr: Option<&Value>,
  body: Option<&Value>,
  timeout_ms: u64,
) -> Result<(bool, u16), ExecError> {
  protocols::http::request(proto, host, port, method, path, hdr, body, timeout_ms)
    .await
    .map_err(|e| ExecError::new(e, None))
}

fn sha_b64(x: &str) -> String {
  let mut h = Sha256::new();
  h.update(x.as_bytes());
  B64.encode(h.finalize())
}

fn obs_auth(password: &str, salt: &str, challenge: &str) -> String {
  sha_b64(&format!(
    "{}{}",
    sha_b64(&format!("{password}{salt}")),
    challenge
  ))
}

fn obs_req(task: &Map<String, Value>) -> (String, Option<Value>) {
  let mut t = task
    .get("requestType")
    .or_else(|| task.get("command"))
    .or_else(|| task.get("function"))
    .and_then(Value::as_str)
    .unwrap_or("")
    .trim()
    .to_string();
  let mut d = task
    .get("requestData")
    .or_else(|| task.get("payload"))
    .or_else(|| task.get("body"))
    .or_else(|| task.get("data"))
    .cloned();
  if task.get("requestType").is_none() {
    if let Some(cmd) = task.get("command").and_then(Value::as_str) {
      let c = cmd.trim();
      if let Some(i) = c.find(' ') {
        let ty = c[..i].trim();
        let js = c[i + 1..].trim();
        if !ty.is_empty() && js.starts_with('{') {
          t = ty.to_string();
          if d.is_none() {
            d = serde_json::from_str(js).ok();
          }
        }
      }
    }
  }
  if let Some(Value::String(x)) = d.clone() {
    let raw = x.trim().to_string();
    if raw.is_empty() {
      d = None;
    } else if raw.starts_with('{') || raw.starts_with('[') {
      d = serde_json::from_str(&raw).ok();
    }
  }
  (t, d)
}

async fn ws_json(
  socket: &mut tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
  >,
) -> Result<Value, ExecError> {
  let n = tokio::time::timeout(Duration::from_millis(2200), socket.next())
    .await
    .map_err(|_| ExecError::new("OBS WebSocket timeout", None))?;
  let Some(msg) = n else {
    return Err(ExecError::new("OBS WebSocket closed", None));
  };
  let m = msg.map_err(|e| ExecError::new(format!("OBS receive error: {e}"), None))?;
  let txt = match m {
    Message::Text(t) => t.to_string(),
    Message::Binary(b) => String::from_utf8(b.to_vec()).unwrap_or_default(),
    _ => String::new(),
  };
  serde_json::from_str::<Value>(&txt)
    .map_err(|e| ExecError::new(format!("OBS JSON error: {e}"), None))
}

async fn send_obs_request(
  socket: &mut tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
  >,
  request_type: &str,
  request_data: Option<Value>,
) -> Result<Value, ExecError> {
  let req_id = format!("req_{}", now_ms());
  let mut d = json!({"requestType":request_type,"requestId":req_id});
  if let Some(x) = request_data {
    d["requestData"] = x;
  }
  socket
    .send(Message::Text(json!({"op":6,"d":d}).to_string().into()))
    .await
    .map_err(|e| ExecError::new(format!("OBS send error: {e}"), None))?;

  loop {
    let p = ws_json(socket).await?;
    if p.get("op").and_then(Value::as_i64) != Some(7) {
      continue;
    }
    let d = p.get("d").cloned().unwrap_or(json!({}));
    if d.get("requestId").and_then(Value::as_str) != Some(req_id.as_str()) {
      continue;
    }
    if d
      .get("requestStatus")
      .and_then(|x| x.get("result"))
      .and_then(Value::as_bool)
      == Some(false)
    {
      let c = d
        .get("requestStatus")
        .and_then(|x| x.get("comment"))
        .and_then(Value::as_str)
        .unwrap_or("unknown error");
      return Err(ExecError::new(format!("OBS {request_type} failed: {c}"), None));
    }
    return Ok(d);
  }
}

async fn send_obs(
  protocol: &str,
  host: &str,
  port: u16,
  password: &str,
  req_type: &str,
  req_data: Option<Value>,
) -> Result<Value, ExecError> {
  let sch = if protocol.eq_ignore_ascii_case("wss") {
    "wss"
  } else {
    "ws"
  };
  let (mut socket, _) = tokio::time::timeout(
    Duration::from_millis(OBS_CONNECT_TIMEOUT_MS),
    connect_async(format!("{sch}://{host}:{port}")),
  )
  .await
  .map_err(|_| ExecError::new("OBS connect timeout", None))?
  .map_err(|e| ExecError::new(format!("OBS connect error: {e}"), None))?;
  let hello = ws_json(&mut socket).await?;
  let mut identify = json!({"rpcVersion":1});
  if hello.get("op").and_then(Value::as_i64) == Some(0) {
    if let Some(a) = hello
      .get("d")
      .and_then(Value::as_object)
      .and_then(|d| d.get("authentication"))
    {
      let c = a.get("challenge").and_then(Value::as_str).unwrap_or("");
      let s = a.get("salt").and_then(Value::as_str).unwrap_or("");
      if !c.is_empty() && !s.is_empty() {
        identify["authentication"] = json!(obs_auth(password, s, c));
      }
    }
  }
  socket
    .send(Message::Text(json!({"op":1,"d":identify}).to_string().into()))
    .await
    .map_err(|e| ExecError::new(format!("OBS identify error: {e}"), None))?;
  loop {
    if ws_json(&mut socket).await?.get("op").and_then(Value::as_i64) == Some(2) {
      break;
    }
  }
  if req_type == "AUTOCOM_PREVIEW_SCENE_STEP" {
    let direction = req_data
      .as_ref()
      .and_then(|v| v.get("direction"))
      .and_then(Value::as_str)
      .unwrap_or("next")
      .to_lowercase();
    let scenes_resp = send_obs_request(&mut socket, "GetSceneList", None).await?;
    let scenes = scenes_resp
      .get("d")
      .and_then(|d| d.get("responseData"))
      .and_then(|d| d.get("scenes"))
      .and_then(Value::as_array)
      .cloned()
      .unwrap_or_default();
    let names: Vec<String> = scenes
      .iter()
      .filter_map(|item| item.get("sceneName").and_then(Value::as_str))
      .map(|name| name.trim().to_string())
      .filter(|name| !name.is_empty())
      .collect();
    if names.is_empty() {
      return Err(ExecError::new("OBS preview step failed: no scenes available", None));
    }
    let current_preview_resp = send_obs_request(&mut socket, "GetCurrentPreviewScene", None).await?;
    let current_name = current_preview_resp
      .get("d")
      .and_then(|d| d.get("responseData"))
      .and_then(|d| d.get("currentPreviewSceneName"))
      .and_then(Value::as_str)
      .unwrap_or("")
      .trim()
      .to_string();
    let current_index = names.iter().position(|name| *name == current_name).unwrap_or(0);
    let next_index = if direction == "previous" {
      if current_index == 0 { names.len() - 1 } else { current_index - 1 }
    } else {
      (current_index + 1) % names.len()
    };
    return send_obs_request(
      &mut socket,
      "SetCurrentPreviewScene",
      Some(json!({"sceneName": names[next_index]})),
    ).await;
  }
  if req_type == "AUTOCOM_TRANSITION_TYPE_STEP" {
    let direction = req_data
      .as_ref()
      .and_then(|v| v.get("direction"))
      .and_then(Value::as_str)
      .unwrap_or("next")
      .to_lowercase();
    let list_resp = send_obs_request(&mut socket, "GetSceneTransitionList", None).await?;
    let transitions = list_resp
      .get("d")
      .and_then(|d| d.get("responseData"))
      .and_then(|d| d.get("transitions"))
      .and_then(Value::as_array)
      .cloned()
      .unwrap_or_default();
    let names: Vec<String> = transitions
      .iter()
      .filter_map(|item| item.get("transitionName").and_then(Value::as_str))
      .map(|name| name.trim().to_string())
      .filter(|name| !name.is_empty())
      .collect();
    if names.is_empty() {
      return Err(ExecError::new("OBS transition step failed: no transitions available", None));
    }
    let current_resp = send_obs_request(&mut socket, "GetCurrentSceneTransition", None).await?;
    let current_name = current_resp
      .get("d")
      .and_then(|d| d.get("responseData"))
      .and_then(|d| d.get("currentSceneTransitionName"))
      .and_then(Value::as_str)
      .unwrap_or("")
      .trim()
      .to_string();
    let current_index = names.iter().position(|name| *name == current_name).unwrap_or(0);
    let next_index = if direction == "previous" {
      if current_index == 0 { names.len() - 1 } else { current_index - 1 }
    } else {
      (current_index + 1) % names.len()
    };
    return send_obs_request(
      &mut socket,
      "SetCurrentSceneTransition",
      Some(json!({"transitionName": names[next_index]})),
    ).await;
  }
  if req_type == "AUTOCOM_TOGGLE_SCENE_ITEM_ENABLED" {
    let scene_name = req_data
      .as_ref()
      .and_then(|v| v.get("sceneName"))
      .and_then(Value::as_str)
      .unwrap_or("")
      .trim()
      .to_string();
    let scene_item_id = req_data
      .as_ref()
      .and_then(|v| v.get("sceneItemId"))
      .and_then(Value::as_i64)
      .unwrap_or(0);
    if scene_name.is_empty() || scene_item_id <= 0 {
      return Err(ExecError::new("OBS scene item toggle needs sceneName + sceneItemId", None));
    }
    let current_resp = send_obs_request(
      &mut socket,
      "GetSceneItemEnabled",
      Some(json!({"sceneName":scene_name,"sceneItemId":scene_item_id})),
    ).await?;
    let current_enabled = current_resp
      .get("d")
      .and_then(|d| d.get("responseData"))
      .and_then(|d| d.get("sceneItemEnabled"))
      .and_then(Value::as_bool)
      .unwrap_or(false);
    return send_obs_request(
      &mut socket,
      "SetSceneItemEnabled",
      Some(json!({"sceneName":scene_name,"sceneItemId":scene_item_id,"sceneItemEnabled":!current_enabled})),
    ).await;
  }
  if req_type == "AUTOCOM_TOGGLE_FILTER_ENABLED" {
    let source_name = req_data
      .as_ref()
      .and_then(|v| v.get("sourceName"))
      .and_then(Value::as_str)
      .unwrap_or("")
      .trim()
      .to_string();
    let filter_name = req_data
      .as_ref()
      .and_then(|v| v.get("filterName"))
      .and_then(Value::as_str)
      .unwrap_or("")
      .trim()
      .to_string();
    if source_name.is_empty() || filter_name.is_empty() {
      return Err(ExecError::new("OBS filter toggle needs sourceName + filterName", None));
    }
    let list_resp = send_obs_request(
      &mut socket,
      "GetSourceFilterList",
      Some(json!({"sourceName":source_name})),
    ).await?;
    let filters = list_resp
      .get("d")
      .and_then(|d| d.get("responseData"))
      .and_then(|d| d.get("filters"))
      .and_then(Value::as_array)
      .cloned()
      .unwrap_or_default();
    let current_enabled = filters
      .iter()
      .find(|item| item.get("filterName").and_then(Value::as_str).unwrap_or("").trim() == filter_name)
      .and_then(|item| item.get("filterEnabled"))
      .and_then(Value::as_bool)
      .unwrap_or(false);
    return send_obs_request(
      &mut socket,
      "SetSourceFilterEnabled",
      Some(json!({"sourceName":source_name,"filterName":filter_name,"filterEnabled":!current_enabled})),
    ).await;
  }
  if req_type == "AUTOCOM_FADE_INPUT_VOLUME" {
    let input_name = req_data
      .as_ref()
      .and_then(|v| v.get("inputName"))
      .and_then(Value::as_str)
      .unwrap_or("")
      .trim()
      .to_string();
    let target_db = req_data
      .as_ref()
      .and_then(|v| v.get("targetDb"))
      .and_then(Value::as_f64)
      .unwrap_or(0.0);
    if input_name.is_empty() {
      return Err(ExecError::new("OBS fade volume needs inputName", None));
    }
    return send_obs_request(
      &mut socket,
      "SetInputVolume",
      Some(json!({"inputName":input_name,"inputVolumeDb":target_db})),
    ).await;
  }
  send_obs_request(&mut socket, req_type, req_data).await
}

fn task_from_row(row: &Map<String, Value>) -> Value {
  match row.get("kind").and_then(Value::as_str).unwrap_or("") {
    "delay" => json!({"id":row.get("id").cloned().unwrap_or(Value::Null),"action":"delay","ms":row.get("ms").cloned().unwrap_or(json!(0))}),
    "task" => {
      let mut t = row.clone();
      t.insert("id".into(), row.get("id").cloned().unwrap_or(Value::Null));
      t.insert("device".into(), row.get("device").cloned().unwrap_or(Value::Null));
      t.insert(
        "deviceName".into(),
        row
          .get("deviceName")
          .cloned()
          .or_else(|| row.get("device").cloned())
          .unwrap_or(Value::Null),
      );
      t.insert("deviceType".into(), row.get("deviceType").cloned().unwrap_or(Value::Null));
      t.insert("action".into(), row.get("action").cloned().unwrap_or(Value::Null));
      if let Some(p) = row.get("params").and_then(Value::as_object) {
        for (k, v) in p {
          t.insert(k.clone(), v.clone());
        }
      }
      Value::Object(t)
    }
    _ => Value::Object(row.clone()),
  }
}

fn exec_task<'a>(
  task_v: &'a Value,
  conns: &'a HashMap<String, Map<String, Value>>,
  events: &'a mut Vec<ApiEvent>,
  rosstalk_state: &'a RossTalkState,
) -> BoxFuture<'a, Result<Value, ExecError>> {
  Box::pin(async move {
    let task = obj(task_v);
    let action = task
      .get("action")
      .or_else(|| task.get("type"))
      .and_then(Value::as_str)
      .unwrap_or("")
      .to_lowercase();
    if action == "delay" {
      tokio::time::sleep(Duration::from_millis(
        task
          .get("ms")
          .or_else(|| task.get("delayMs"))
          .and_then(Value::as_u64)
          .unwrap_or(0),
      ))
      .await;
      return Ok(json!({"ok":true}));
    }

    let conn = resolve_connection(&task, conns);
    let conn_enabled = conn.get("enabled").and_then(Value::as_bool).unwrap_or(true);
    if !conn_enabled {
      emit_log(
        &task,
        &conn,
        "Connection is disabled; task skipped".to_string(),
        events,
      );
      return Ok(json!({"skipped":true,"reason":"connection_disabled"}));
    }

    let ctype = conn
      .get("type")
      .and_then(Value::as_str)
      .unwrap_or("")
      .to_lowercase();
    let host = conn
      .get("host")
      .or_else(|| conn.get("ip"))
      .and_then(Value::as_str)
      .unwrap_or("127.0.0.1")
      .trim()
      .to_string();
    let port = u16v(task.get("port").or_else(|| conn.get("port")), 0);
    let p = infer_protocol(&conn, &task);

    if p == Protocol::Rosstalk
      || ctype == "ross_talk"
      || ctype == "ross_carbonite"
      || ctype == "ross_xpression"
    {
      let cmd = rosstalk(&task, &conn)?;
      let ross_port = if port == 0 { ROSSTALK_DEFAULT_PORT } else { port };
      let keep_alive = conn.get("keepAlive").and_then(Value::as_bool).unwrap_or(false);
      protocols::rosstalk::send(
        rosstalk_state,
        &host,
        ross_port,
        &cmd,
        &line_end(task.get("lineEnd"), "\r\n"),
        keep_alive,
      )
      .await
      .map_err(|e| ExecError::new(e, None))?;
      emit_log(
        &task,
        &conn,
        format!("RossTalk {}", cmd.chars().take(80).collect::<String>()),
        events,
      );
      return Ok(json!({"ok":true,"port":ross_port,"keepAlive":keep_alive}));
    }

    if p == Protocol::Artnet
      || p == Protocol::Dmx
      || ctype == "artnet"
      || ctype == "artnet_dmx"
    {
      let (universe, data) = dmx_frame_from_task(&task)?;
      let dport = if port == 0 { 6454 } else { port };
      protocols::artnet::send_dmx(&host, dport, universe, &data)
        .await
        .map_err(|e| ExecError::new(e, None))?;
      emit_log(
        &task,
        &conn,
        format!("Artnet DMX universe {universe} ({} channels)", data.len()),
        events,
      );
      return Ok(json!({"ok":true,"universe":universe,"channels":data.len()}));
    }

    if ctype == "atem" {
      let cmd = atem_command(&task)?;
      let atem_port = if port == 0 { ATEM_DEFAULT_PORT } else { port };
      send_udp(&host, atem_port, &cmd, &line_end(task.get("lineEnd"), "")).await?;
      emit_log(
        &task,
        &conn,
        format!("ATEM {}", cmd.chars().take(80).collect::<String>()),
        events,
      );
      return Ok(json!({"ok":true,"port":atem_port}));
    }

    if p == Protocol::Http || ctype == "http_api" {
      let proto = task
        .get("protocol")
        .and_then(Value::as_str)
        .or_else(|| conn.get("protocol").and_then(Value::as_str))
        .unwrap_or("http");
      let method = task.get("method").and_then(Value::as_str).unwrap_or("GET");
      let path = task
        .get("path")
        .and_then(Value::as_str)
        .or_else(|| conn.get("path").and_then(Value::as_str))
        .unwrap_or("/");
      let timeout = task
        .get("timeoutMs")
        .and_then(Value::as_u64)
        .unwrap_or(300);
      let (ok, st) = http_req(
        proto,
        if host.is_empty() {
          conn
            .get("host")
            .or_else(|| conn.get("ip"))
            .and_then(Value::as_str)
            .unwrap_or("127.0.0.1")
        } else {
          &host
        },
        port,
        method,
        path,
        task.get("headers"),
        task.get("body"),
        timeout,
      )
      .await?;
      emit_log(&task, &conn, format!("HTTP {method} {path}"), events);
      if !ok {
        return Err(ExecError::new(format!("HTTP request failed with status {st}"), None));
      }
      return Ok(json!({"ok":true,"status":st}));
    }

    if p == Protocol::Ws || ctype == "obs" {
      let (rt, rd) = obs_req(&task);
      if rt.trim().is_empty() {
        return Err(ExecError::new("OBS task missing requestType/command", None));
      }
      let proto = task
        .get("protocol")
        .and_then(Value::as_str)
        .or_else(|| conn.get("protocol").and_then(Value::as_str))
        .unwrap_or("ws");
      let pwd = task
        .get("password")
        .or_else(|| conn.get("password"))
        .and_then(Value::as_str)
        .unwrap_or("");
      let resp = send_obs(proto, &host, port, pwd, &rt, rd).await?;
      let lbl = rt.split(' ').next().unwrap_or("Request").to_string();
      emit_log(&task, &conn, format!("OBS {lbl}"), events);
      return Ok(json!({"ok":true,"code":resp.get("requestStatus").and_then(|v|v.get("code")).cloned().unwrap_or(Value::Null)}));
    }

    let oa = osc_address(&task, &p);
    let oargs = osc_args(&task);
    let has_oa = !task
      .get("address")
      .or_else(|| task.get("oscAddress"))
      .or_else(|| task.get("path"))
      .and_then(Value::as_str)
      .unwrap_or("")
      .trim()
      .is_empty();
    let wants_osc = p == Protocol::Osc
      || action == "osc"
      || (p == Protocol::Udp && (has_oa || task.get("args").and_then(Value::as_array).is_some()));

    if wants_osc {
      if oa.is_empty() {
        return Err(ExecError::new("OSC task missing address", None));
      }
      send_osc(&host, port, &oa, &oargs).await?;
      emit_log(&task, &conn, format!("OSC {oa}"), events);
      return Ok(json!({"ok":true}));
    }

    if p == Protocol::Udp {
      let payload = task
        .get("command")
        .or_else(|| task.get("payload"))
        .or_else(|| task.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
      if payload.trim().is_empty() {
        return Err(ExecError::new("UDP task missing payload", None));
      }
      send_udp(&host, port, &payload, &line_end(task.get("lineEnd"), "")).await?;
      emit_log(
        &task,
        &conn,
        format!("UDP {}", payload.chars().take(80).collect::<String>()),
        events,
      );
      return Ok(json!({"ok":true}));
    }

    if p == Protocol::Osc {
      return Err(ExecError::new("OSC task missing address", None));
    }

    let raw_payload = s(task.get("command").or_else(|| task.get("payload")).or_else(|| task.get("message")));
    if raw_payload.trim().is_empty() {
      return Err(ExecError::new("TCP task missing payload", None));
    }
    let is_vmix = conn
      .get("type")
      .or_else(|| task.get("deviceType"))
      .and_then(Value::as_str)
      .unwrap_or("")
      .trim()
      .eq_ignore_ascii_case("vmix");
    let tcp_port = if is_vmix && port == 0 {
      VMIX_DEFAULT_PORT
    } else {
      port
    };
    if tcp_port == 0 {
      return Err(ExecError::new("TCP task missing port", None));
    }
    let payload = raw_payload
      .trim_end_matches(|ch| ch == '\r' || ch == '\n')
      .to_string();
    let tcp_line_end = if is_vmix {
      "\r\n".to_string()
    } else {
      line_end(task.get("lineEnd"), "\r\n")
    };
    let save_tcp_response = conn
      .get("saveTcpResponse")
      .and_then(Value::as_bool)
      .unwrap_or(false);
    let tcp_response = if save_tcp_response {
      send_tcp_capture(&host, tcp_port, &payload, &tcp_line_end, 250).await?
    } else {
      send_tcp(&host, tcp_port, &payload, &tcp_line_end).await?;
      None
    };
    emit_log(
      &task,
      &conn,
      format!("TCP {}:{} {}", host, tcp_port, payload.chars().take(80).collect::<String>()),
      events,
    );
    if let Some(resp) = tcp_response {
      emit_log(
        &task,
        &conn,
        format!("TCP response {}", resp.chars().take(120).collect::<String>()),
        events,
      );
      Ok(json!({"ok":true,"port":tcp_port,"response":resp}))
    } else {
      Ok(json!({"ok":true,"port":tcp_port}))
    }
  })
}

fn exec_row<'a>(
  row_v: &'a Value,
  conns: &'a HashMap<String, Map<String, Value>>,
  events: &'a mut Vec<ApiEvent>,
  rosstalk_state: &'a RossTalkState,
) -> BoxFuture<'a, Result<Value, ExecError>> {
  Box::pin(async move {
    let row = obj(row_v);
    if row.is_empty() {
      return Ok(json!({"skipped":true}));
    }
    if row.get("enabled").and_then(Value::as_bool) == Some(false) {
      return Ok(json!({"skipped":true}));
    }
    let sid = row.get("id").map(|v| s(Some(v)));
    let res = async {
      if row.get("kind").and_then(Value::as_str) == Some("parallel") {
        let steps = row
          .get("steps")
          .and_then(Value::as_array)
          .cloned()
          .unwrap_or_default();
        if steps.is_empty() {
          return Err(ExecError::new("Parallel block must contain at least one step", sid.clone()));
        }
        let out = exec_parallel_rows(steps, conns, events, rosstalk_state).await?;
        return Ok(json!({"ok":true,"type":"parallel","results":out}));
      }
      let kind = row.get("kind").and_then(Value::as_str).unwrap_or("");
      if kind == "delay" || kind == "task" {
        return exec_task(&task_from_row(&row), conns, events, rosstalk_state).await;
      }
      if row.get("type").and_then(Value::as_str) == Some("parallel")
        && row.get("steps").and_then(Value::as_array).is_some()
      {
        let steps = row
          .get("steps")
          .and_then(Value::as_array)
          .cloned()
          .unwrap_or_default();
        let out = exec_parallel_rows(steps, conns, events, rosstalk_state).await?;
        return Ok(json!({"ok":true,"type":"parallel","results":out}));
      }
      if row.get("type").and_then(Value::as_str) == Some("delay") {
        return exec_task(
          &json!({"id":row.get("id").cloned().unwrap_or(Value::Null),"action":"delay","ms":row.get("ms").cloned().unwrap_or(json!(0))}),
          conns,
          events,
          rosstalk_state,
        )
        .await;
      }
      exec_task(row_v, conns, events, rosstalk_state).await
    }
    .await;
    match res {
      Ok(v) => Ok(v),
      Err(mut e) => {
        if e.step_id.is_none() {
          e.step_id = sid;
        }
        Err(e)
      }
    }
  })
}

async fn exec_parallel_rows(
  steps: Vec<Value>,
  conns: &HashMap<String, Map<String, Value>>,
  events: &mut Vec<ApiEvent>,
  rosstalk_state: &RossTalkState,
) -> Result<Vec<Value>, ExecError> {
  let results = stream::iter(steps.into_iter().map(|step| async move {
    let mut local_events = Vec::new();
    let value = exec_row(&step, conns, &mut local_events, rosstalk_state).await?;
    Ok::<(Value, Vec<ApiEvent>), ExecError>((value, local_events))
  }))
  .buffered(EXEC_PARALLEL_LIMIT.max(1))
  .try_collect::<Vec<_>>()
  .await?;

  let mut out = Vec::with_capacity(results.len());
  for (value, mut local_events) in results {
    out.push(value);
    events.append(&mut local_events);
  }
  Ok(out)
}

pub(crate) async fn exec_sequence(
  rows: &[Value],
  conns: &HashMap<String, Map<String, Value>>,
  events: &mut Vec<ApiEvent>,
  rosstalk_state: &RossTalkState,
) -> Result<Vec<Value>, ExecError> {
  let mut out = Vec::new();
  for r in rows {
    out.push(exec_row(r, conns, events, rosstalk_state).await?);
  }
  Ok(out)
}

pub(crate) fn run_step<'a>(
  step_v: &'a Value,
  conns: &'a HashMap<String, Map<String, Value>>,
  events: &'a mut Vec<ApiEvent>,
  rosstalk_state: &'a RossTalkState,
) -> BoxFuture<'a, Result<(), ExecError>> {
  Box::pin(async move {
    let st = obj(step_v);
    let t = st
      .get("type")
      .and_then(Value::as_str)
      .unwrap_or("")
      .to_lowercase();
    if t == "parallel" {
      run_parallel_steps(
        st.get("steps")
          .and_then(Value::as_array)
          .cloned()
          .unwrap_or_default(),
        conns,
        events,
        rosstalk_state,
      )
      .await?;
      return Ok(());
    }
    if t == "resolume_clip" {
      exec_task(
        &json!({"device":"resolume","action":"clip","layer":st.get("layer").cloned().unwrap_or(json!(0)),"clip":st.get("clip").cloned().unwrap_or(json!(0))}),
        conns,
        events,
        rosstalk_state,
      )
      .await?;
      return Ok(());
    }
    if t == "lighting_cue" {
      exec_task(
        &json!({"device":"lighting","action":"cue","cue":st.get("cue").cloned().unwrap_or(json!(""))}),
        conns,
        events,
        rosstalk_state,
      )
      .await?;
      return Ok(());
    }
    if t == "audio_track" {
      exec_task(
        &json!({"device":"audio","action":"track","track":st.get("track").cloned().unwrap_or(json!(""))}),
        conns,
        events,
        rosstalk_state,
      )
      .await?;
      return Ok(());
    }
    if t == "delay" {
      exec_task(
        &json!({"action":"delay","ms":st.get("ms").cloned().unwrap_or(json!(0))}),
        conns,
        events,
        rosstalk_state,
      )
      .await?;
      return Ok(());
    }
    exec_task(step_v, conns, events, rosstalk_state).await?;
    Ok(())
  })
}

async fn run_parallel_steps(
  steps: Vec<Value>,
  conns: &HashMap<String, Map<String, Value>>,
  events: &mut Vec<ApiEvent>,
  rosstalk_state: &RossTalkState,
) -> Result<(), ExecError> {
  let results = stream::iter(steps.into_iter().map(|step| async move {
    let mut local_events = Vec::new();
    run_step(&step, conns, &mut local_events, rosstalk_state).await?;
    Ok::<Vec<ApiEvent>, ExecError>(local_events)
  }))
  .buffered(EXEC_PARALLEL_LIMIT.max(1))
  .try_collect::<Vec<_>>()
  .await?;

  for mut local_events in results {
    events.append(&mut local_events);
  }
  Ok(())
}
