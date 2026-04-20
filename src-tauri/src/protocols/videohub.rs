use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{Duration, Instant, timeout};

#[derive(Debug, Clone, Serialize)]
pub struct VideohubLabelItem {
  pub id: u32,
  pub label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct VideohubLabelsResult {
  #[serde(rename = "inputLabels")]
  pub input_labels: Vec<VideohubLabelItem>,
  #[serde(rename = "outputLabels")]
  pub output_labels: Vec<VideohubLabelItem>,
}

fn parse_label_block(text: &str, header: &str) -> Vec<VideohubLabelItem> {
  let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
  let lines = normalized.lines().collect::<Vec<_>>();
  let mut items = Vec::<VideohubLabelItem>::new();
  let mut i = 0usize;
  while i < lines.len() {
    if lines[i].trim() != header {
      i += 1;
      continue;
    }
    let mut j = i + 1;
    while j < lines.len() {
      let line = lines[j].trim();
      if line.is_empty() {
        break;
      }
      if line.ends_with(':') {
        break;
      }
      if let Some((index_raw, label_raw)) = line.split_once(' ') {
        if let Ok(index) = index_raw.trim().parse::<u32>() {
          items.push(VideohubLabelItem {
            id: index,
            label: label_raw.trim().to_string(),
          });
        }
      }
      j += 1;
    }
    break;
  }
  items
}

pub async fn fetch_labels(host: &str, port: u16) -> Result<VideohubLabelsResult, String> {
  let mut stream = timeout(
    Duration::from_millis(800),
    TcpStream::connect(format!("{host}:{port}")),
  )
  .await
  .map_err(|_| "VideoHub connect timeout".to_string())?
  .map_err(|e| format!("VideoHub connect error: {e}"))?;

  let query = b"INPUT LABELS:\n\nOUTPUT LABELS:\n\n";
  timeout(Duration::from_millis(400), stream.write_all(query))
    .await
    .map_err(|_| "VideoHub label query write timeout".to_string())?
    .map_err(|e| format!("VideoHub label query write error: {e}"))?;

  let mut bytes = Vec::<u8>::new();
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
        bytes.extend_from_slice(&chunk[..n]);
        last_data = Instant::now();
      }
      Ok(Err(err)) => return Err(format!("VideoHub read error: {err}")),
      Err(_) => {
        if !bytes.is_empty() && last_data.elapsed() > Duration::from_millis(260) {
          break;
        }
      }
    }
  }

  let text = String::from_utf8_lossy(&bytes).to_string();
  let input_labels = parse_label_block(&text, "INPUT LABELS:");
  let output_labels = parse_label_block(&text, "OUTPUT LABELS:");
  if input_labels.is_empty() && output_labels.is_empty() {
    return Err("VideoHub did not return input/output labels.".to_string());
  }

  Ok(VideohubLabelsResult {
    input_labels,
    output_labels,
  })
}

