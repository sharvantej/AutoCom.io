use serde::Serialize;
use std::collections::BTreeMap;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{Duration, Instant, timeout};

const DLE: u8 = 0x10;
const STX: u8 = 0x02;
const ETX: u8 = 0x03;
const ACK: u8 = 0x06;
const NAK: u8 = 0x15;

const CMD_GET_SOURCE_NAMES: u8 = 0x64;
const CMD_GET_DEST_NAMES: u8 = 0x66;
const CMD_EXT_GET_SOURCE_NAMES: u8 = 0xE4;
const CMD_EXT_GET_DEST_NAMES: u8 = 0xE6;
const CMD_SOURCE_NAMES_RESPONSE: u8 = 0x6A;
const CMD_DEST_NAMES_RESPONSE: u8 = 0x6B;
const CMD_EXT_SOURCE_NAMES_RESPONSE: u8 = 0xEA;
const CMD_EXT_DEST_NAMES_RESPONSE: u8 = 0xEB;

#[derive(Debug, Clone, Serialize)]
pub struct Swp08NameItem {
  pub id: u32,
  pub label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Swp08NamesResult {
  #[serde(rename = "sourceNames")]
  pub source_names: Vec<Swp08NameItem>,
  #[serde(rename = "destinationNames")]
  pub destination_names: Vec<Swp08NameItem>,
}

fn twos_complement_checksum(sum: u8) -> u8 {
  (!sum).wrapping_add(1)
}

fn stuff_dle(input: &[u8]) -> Vec<u8> {
  let mut out = Vec::with_capacity(input.len() + 4);
  for byte in input {
    out.push(*byte);
    if *byte == DLE {
      out.push(DLE);
    }
  }
  out
}

fn build_packet(data: &[u8]) -> Vec<u8> {
  let mut sum: u8 = 0;
  for byte in data {
    sum = sum.wrapping_add(*byte);
  }
  let btc = data.len().min(255) as u8;
  sum = sum.wrapping_add(btc);
  let chk = twos_complement_checksum(sum);

  let mut packet = Vec::with_capacity(data.len() + 8);
  packet.push(DLE);
  packet.push(STX);
  packet.extend(stuff_dle(data));
  packet.extend(stuff_dle(&[btc, chk]));
  packet.push(DLE);
  packet.push(ETX);
  packet
}

fn char_length(code: u8) -> usize {
  match code {
    0 => 4,
    1 => 8,
    _ => 12,
  }
}

fn parse_frame_payload(frame: &[u8]) -> Option<Vec<u8>> {
  if frame.len() < 4 || frame[0] != DLE || frame[1] != STX {
    return None;
  }
  if frame[frame.len() - 2] != DLE || frame[frame.len() - 1] != ETX {
    return None;
  }
  let mut raw = Vec::new();
  let mut i = 2usize;
  while i < frame.len().saturating_sub(2) {
    let byte = frame[i];
    if byte == DLE && i + 1 < frame.len().saturating_sub(2) && frame[i + 1] == DLE {
      raw.push(DLE);
      i += 2;
      continue;
    }
    raw.push(byte);
    i += 1;
  }
  if raw.len() < 3 {
    return None;
  }
  let btc = raw[raw.len() - 2] as usize;
  let chk = raw[raw.len() - 1];
  let data = &raw[..raw.len() - 2];
  if data.len() != btc {
    return None;
  }
  let mut sum: u8 = 0;
  for byte in data {
    sum = sum.wrapping_add(*byte);
  }
  sum = sum.wrapping_add(raw[raw.len() - 2]);
  let expected_chk = twos_complement_checksum(sum);
  if chk != expected_chk {
    return None;
  }
  Some(data.to_vec())
}

fn parse_label_response(
  payload: &[u8],
  matrix: u32,
  matrix_ext: u32,
  source_labels: &mut BTreeMap<u32, String>,
  dest_labels: &mut BTreeMap<u32, String>,
) {
  if payload.is_empty() {
    return;
  }
  let cmd = payload[0];
  let extended = cmd == CMD_EXT_SOURCE_NAMES_RESPONSE || cmd == CMD_EXT_DEST_NAMES_RESPONSE;
  let is_source = cmd == CMD_SOURCE_NAMES_RESPONSE || cmd == CMD_EXT_SOURCE_NAMES_RESPONSE;
  let is_dest = cmd == CMD_DEST_NAMES_RESPONSE || cmd == CMD_EXT_DEST_NAMES_RESPONSE;
  if !is_source && !is_dest {
    return;
  }

  let mut idx = 1usize;
  if !extended {
    if payload.len() < 6 {
      return;
    }
    let matrix_value = (payload[idx] & 0xF0) >> 4;
    if matrix_value as u32 != matrix.saturating_sub(1) {
      return;
    }
    idx += 1;
  } else {
    if payload.len() < 7 {
      return;
    }
    let matrix_value = payload[idx];
    if matrix_value as u32 != matrix_ext.saturating_sub(1) {
      return;
    }
    idx += 1;
    if is_source {
      idx += 1; // level
    }
  }

  if idx + 3 >= payload.len() {
    return;
  }
  let label_len = char_length(payload[idx]);
  idx += 1;
  let label_start = ((payload[idx] as u32) << 8) | payload[idx + 1] as u32;
  idx += 2;
  let labels_in_part = payload[idx] as usize;
  idx += 1;

  for part in 0..labels_in_part {
    let start = idx + part * label_len;
    let end = start + label_len;
    if end > payload.len() {
      break;
    }
    let raw = &payload[start..end];
    let label = String::from_utf8_lossy(raw).replace('\0', "").trim().to_string();
    let id = label_start + part as u32 + 1;
    if is_source {
      source_labels.insert(id, label);
    } else if is_dest {
      dest_labels.insert(id, label);
    }
  }
}

fn drain_frames(buffer: &mut Vec<u8>) -> Vec<Vec<u8>> {
  let mut frames = Vec::new();
  loop {
    if buffer.len() < 2 {
      break;
    }
    if buffer[0] != DLE {
      buffer.remove(0);
      continue;
    }
    if buffer.len() >= 2 && (buffer[1] == ACK || buffer[1] == NAK) {
      buffer.drain(0..2);
      continue;
    }
    if buffer.len() < 4 || buffer[1] != STX {
      buffer.remove(0);
      continue;
    }
    let mut end_idx: Option<usize> = None;
    let mut i = 2usize;
    while i + 1 < buffer.len() {
      if buffer[i] == DLE && buffer[i + 1] == ETX {
        end_idx = Some(i + 2);
        break;
      }
      i += 1;
    }
    let Some(end) = end_idx else {
      break;
    };
    let frame = buffer.drain(0..end).collect::<Vec<u8>>();
    frames.push(frame);
  }
  frames
}

fn parse_name_char_code(name_length: u32) -> u8 {
  if name_length <= 4 {
    0
  } else if name_length <= 8 {
    1
  } else {
    2
  }
}

pub async fn fetch_names(
  host: &str,
  port: u16,
  matrix: u32,
  matrix_ext: u32,
  extended_support: bool,
  name_length: u32,
) -> Result<Swp08NamesResult, String> {
  let mut stream = timeout(
    Duration::from_millis(600),
    TcpStream::connect(format!("{host}:{port}")),
  )
  .await
  .map_err(|_| "SWP08 connect timeout".to_string())?
  .map_err(|e| format!("SWP08 connect error: {e}"))?;

  let name_chars = parse_name_char_code(name_length);
  let source_query = if extended_support {
    vec![
      CMD_EXT_GET_SOURCE_NAMES,
      matrix_ext.saturating_sub(1).min(255) as u8,
      0,
      name_chars,
    ]
  } else {
    vec![
      CMD_GET_SOURCE_NAMES,
      ((matrix.saturating_sub(1).min(15) as u8) << 4),
      name_chars,
    ]
  };
  let dest_query = if extended_support {
    vec![
      CMD_EXT_GET_DEST_NAMES,
      matrix_ext.saturating_sub(1).min(255) as u8,
      name_chars,
    ]
  } else {
    vec![
      CMD_GET_DEST_NAMES,
      ((matrix.saturating_sub(1).min(15) as u8) << 4),
      name_chars,
    ]
  };

  let source_packet = build_packet(&source_query);
  let dest_packet = build_packet(&dest_query);
  timeout(Duration::from_millis(300), stream.write_all(&source_packet))
    .await
    .map_err(|_| "SWP08 source-name write timeout".to_string())?
    .map_err(|e| format!("SWP08 source-name write error: {e}"))?;
  timeout(Duration::from_millis(300), stream.write_all(&dest_packet))
    .await
    .map_err(|_| "SWP08 destination-name write timeout".to_string())?
    .map_err(|e| format!("SWP08 destination-name write error: {e}"))?;

  let mut source_labels: BTreeMap<u32, String> = BTreeMap::new();
  let mut dest_labels: BTreeMap<u32, String> = BTreeMap::new();
  let mut buffer = Vec::<u8>::new();
  let started = Instant::now();
  let mut last_data = Instant::now();
  while started.elapsed() < Duration::from_millis(2200) {
    let mut chunk = vec![0_u8; 4096];
    match timeout(Duration::from_millis(180), stream.read(&mut chunk)).await {
      Ok(Ok(0)) => break,
      Ok(Ok(n)) => {
        if n == 0 {
          break;
        }
        last_data = Instant::now();
        buffer.extend_from_slice(&chunk[..n]);
        let frames = drain_frames(&mut buffer);
        for frame in frames {
          if let Some(payload) = parse_frame_payload(&frame) {
            parse_label_response(
              &payload,
              matrix.max(1),
              matrix_ext.max(1),
              &mut source_labels,
              &mut dest_labels,
            );
            let _ = stream.write_all(&[DLE, ACK]).await;
          }
        }
      }
      Ok(Err(err)) => return Err(format!("SWP08 read error: {err}")),
      Err(_) => {
        if !source_labels.is_empty() || !dest_labels.is_empty() {
          if last_data.elapsed() > Duration::from_millis(300) {
            break;
          }
        }
      }
    }
  }

  let source_names = source_labels
    .into_iter()
    .map(|(id, label)| Swp08NameItem { id, label })
    .collect::<Vec<_>>();
  let destination_names = dest_labels
    .into_iter()
    .map(|(id, label)| Swp08NameItem { id, label })
    .collect::<Vec<_>>();

  Ok(Swp08NamesResult {
    source_names,
    destination_names,
  })
}
