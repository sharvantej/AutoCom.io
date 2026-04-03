use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

const TCP_CONNECT_TIMEOUT_MS: u64 = 250;
const TCP_WRITE_TIMEOUT_MS: u64 = 250;

async fn connect(host: &str, port: u16) -> Result<TcpStream, String> {
  timeout(
    std::time::Duration::from_millis(TCP_CONNECT_TIMEOUT_MS),
    TcpStream::connect(format!("{host}:{port}")),
  )
  .await
  .map_err(|_| "TCP connect timeout".to_string())?
  .map_err(|e| format!("TCP connect error: {e}"))
}

async fn write_payload(stream: &mut TcpStream, payload: &[u8]) -> Result<(), String> {
  timeout(
    std::time::Duration::from_millis(TCP_WRITE_TIMEOUT_MS),
    stream.write_all(payload),
  )
  .await
  .map_err(|_| "TCP write timeout".to_string())?
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
