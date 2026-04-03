use tokio::net::UdpSocket;

pub async fn send(host: &str, port: u16, payload: &str, line_end: &str) -> Result<(), String> {
  let socket = UdpSocket::bind("0.0.0.0:0")
    .await
    .map_err(|e| format!("UDP bind error: {e}"))?;
  socket
    .send_to(
      format!("{payload}{line_end}").as_bytes(),
      format!("{host}:{port}"),
    )
    .await
    .map_err(|e| format!("UDP send error: {e}"))?;
  Ok(())
}
