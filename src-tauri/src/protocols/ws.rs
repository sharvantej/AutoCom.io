use futures_util::SinkExt;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::MaybeTlsStream;
use tokio_tungstenite::WebSocketStream;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

#[derive(Default)]
pub struct WsCommandState {
  pub sessions: Mutex<HashMap<String, Arc<Mutex<WsStream>>>>,
}

fn ws_url(host: &str, port: u16, path: Option<&str>) -> String {
  let raw = path.unwrap_or("").trim();
  if raw.is_empty() {
    format!("ws://{host}:{port}")
  } else if raw.starts_with('/') {
    format!("ws://{host}:{port}{raw}")
  } else {
    format!("ws://{host}:{port}/{raw}")
  }
}

async fn connect(url: &str) -> Result<WsStream, String> {
  const WS_CONNECT_TIMEOUT_MS: u64 = 350;
  let (stream, _) = tokio::time::timeout(
    Duration::from_millis(WS_CONNECT_TIMEOUT_MS),
    connect_async(url),
  )
  .await
  .map_err(|_| "WS connect timeout".to_string())?
  .map_err(|e| format!("WS connect error: {e}"))?;
  Ok(stream)
}

pub async fn send_text(
  state: &WsCommandState,
  host: &str,
  port: u16,
  path: Option<&str>,
  payload: &str,
) -> Result<(), String> {
  let url = ws_url(host, port, path);
  let message = Message::Text(payload.to_string().into());

  let cached = {
    let sessions = state.sessions.lock().await;
    sessions.get(&url).cloned()
  };

  let session = if let Some(existing) = cached {
    existing
  } else {
    let created = Arc::new(Mutex::new(connect(&url).await?));
    let mut sessions = state.sessions.lock().await;
    sessions
      .entry(url.clone())
      .or_insert_with(|| created.clone())
      .clone()
  };

  {
    let mut stream = session.lock().await;
    if stream.send(message.clone()).await.is_ok() {
      return Ok(());
    }
  }

  // Reconnect once if the cached socket was closed or became invalid.
  let mut stream = connect(&url).await?;
  stream
    .send(message)
    .await
    .map_err(|e| format!("WS send error: {e}"))?;
  let mut sessions = state.sessions.lock().await;
  sessions.insert(url, Arc::new(Mutex::new(stream)));
  Ok(())
}
