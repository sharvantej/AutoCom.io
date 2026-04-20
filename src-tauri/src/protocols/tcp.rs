use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

// 250ms is often too aggressive (VMs, Wi-Fi, or cold TCP handshakes). Keep these
// bounded, but long enough to be reliable for common control surfaces like vMix.
const TCP_CONNECT_TIMEOUT_MS: u64 = 2000;
const TCP_WRITE_TIMEOUT_MS: u64 = 2000;
const TCP_CONNECT_RETRIES_ON_TIMEOUT: u8 = 1;

async fn connect(host: &str, port: u16) -> Result<TcpStream, String> {
  let addr = format!("{host}:{port}");

  let max_attempts = (TCP_CONNECT_RETRIES_ON_TIMEOUT.saturating_add(1)).max(1);
  for attempt in 1..=max_attempts {
    let res = timeout(
      std::time::Duration::from_millis(TCP_CONNECT_TIMEOUT_MS.max(1)),
      TcpStream::connect(&addr),
    )
    .await;

    match res {
      Ok(Ok(stream)) => {
        let _ = stream.set_nodelay(true);
        return Ok(stream);
      }
      Ok(Err(e)) => return Err(format!("TCP connect error ({addr}): {e}")),
      Err(_) if attempt < max_attempts => continue,
      Err(_) => {
        return Err(format!(
          "TCP connect timeout ({addr}, {}ms)",
          TCP_CONNECT_TIMEOUT_MS
        ))
      }
    }
  }

  Err(format!(
    "TCP connect timeout ({addr}, {}ms)",
    TCP_CONNECT_TIMEOUT_MS
  ))
}

async fn write_payload(stream: &mut TcpStream, payload: &[u8]) -> Result<(), String> {
  timeout(
    std::time::Duration::from_millis(TCP_WRITE_TIMEOUT_MS.max(1)),
    stream.write_all(payload),
  )
  .await
  .map_err(|_| format!("TCP write timeout ({}ms, {} bytes)", TCP_WRITE_TIMEOUT_MS, payload.len()))?
  .map_err(|e| format!("TCP write error: {e}"))
}

pub async fn send(host: &str, port: u16, payload: &str, line_end: &str) -> Result<(), String> {
  let mut stream = connect(host, port).await?;
  write_payload(&mut stream, format!("{payload}{line_end}").as_bytes()).await?;
  Ok(())
}

pub async fn send_capture(
  host: &str,
  port: u16,
  payload: &str,
  line_end: &str,
  timeout_ms: u64,
) -> Result<Option<String>, String> {
  let mut stream = connect(host, port).await?;
  write_payload(&mut stream, format!("{payload}{line_end}").as_bytes()).await?;

  let mut buf = vec![0_u8; 4096];
  match timeout(
    std::time::Duration::from_millis(timeout_ms.max(1)),
    stream.read(&mut buf),
  )
  .await
  {
    Ok(Ok(0)) => Ok(None),
    Ok(Ok(n)) => {
      let text = String::from_utf8_lossy(&buf[..n]).trim().to_string();
      if text.is_empty() {
        Ok(None)
      } else {
        Ok(Some(text))
      }
    }
    Ok(Err(e)) => Err(format!("TCP read error: {e}")),
    Err(_) => Ok(None),
  }
}
