use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::Mutex;

#[derive(Default)]
pub struct RossTalkState {
  sockets: Mutex<HashMap<String, Arc<Mutex<TcpStream>>>>,
}

async fn connect(host: &str, port: u16) -> Result<TcpStream, String> {
  const CONNECT_TIMEOUT_MS: u64 = 350;
  tokio::time::timeout(
    Duration::from_millis(CONNECT_TIMEOUT_MS),
    TcpStream::connect(format!("{host}:{port}")),
  )
  .await
  .map_err(|_| "RossTalk connect timeout".to_string())?
  .map_err(|e| format!("RossTalk connect error: {e}"))
}

pub async fn send(
  state: &RossTalkState,
  host: &str,
  port: u16,
  payload: &str,
  line_end: &str,
  keep_alive: bool,
) -> Result<(), String> {
  if !keep_alive {
    return crate::protocols::tcp::send(host, port, payload, line_end).await;
  }

  let key = format!("{host}:{port}");
  let message = format!("{payload}{line_end}");
  let cached = {
    let sockets = state.sockets.lock().await;
    sockets.get(&key).cloned()
  };

  let socket = if let Some(existing) = cached {
    existing
  } else {
    let created = Arc::new(Mutex::new(connect(host, port).await?));
    let mut sockets = state.sockets.lock().await;
    sockets
      .entry(key.clone())
      .or_insert_with(|| created.clone())
      .clone()
  };

  const WRITE_TIMEOUT_MS: u64 = 250;
  let write_result = {
    let mut stream = socket.lock().await;
    tokio::time::timeout(
      Duration::from_millis(WRITE_TIMEOUT_MS),
      stream.write_all(message.as_bytes()),
    )
    .await
  };

  if matches!(write_result, Ok(Ok(()))) {
    return Ok(());
  }

  let replacement = Arc::new(Mutex::new(connect(host, port).await?));
  {
    let mut stream = replacement.lock().await;
    tokio::time::timeout(
      Duration::from_millis(WRITE_TIMEOUT_MS),
      stream.write_all(message.as_bytes()),
    )
    .await
    .map_err(|_| "RossTalk write timeout".to_string())?
    .map_err(|e| format!("RossTalk write error: {e}"))?;
  }

  let mut sockets = state.sockets.lock().await;
  sockets.insert(key, replacement);
  Ok(())
}
