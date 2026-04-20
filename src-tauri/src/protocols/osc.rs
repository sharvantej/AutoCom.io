use rosc::{OscMessage, OscPacket, OscType, encoder};
use serde_json::Value;
use tokio::net::UdpSocket;

fn to_osc(v: &Value) -> OscType {
  match v {
    Value::Null => OscType::String(String::new()),
    Value::Bool(b) => OscType::Bool(*b),
    Value::Number(n) => {
      if let Some(i) = n.as_i64() {
        OscType::Long(i)
      } else if let Some(u) = n.as_u64() {
        OscType::Long(u as i64)
      } else {
        OscType::Double(n.as_f64().unwrap_or(0.0))
      }
    }
    Value::String(x) => OscType::String(x.clone()),
    _ => OscType::String(v.to_string()),
  }
}

pub async fn send(host: &str, port: u16, address: &str, args: &[Value]) -> Result<(), String> {
  let packet = OscPacket::Message(OscMessage {
    addr: address.to_string(),
    args: args.iter().map(to_osc).collect(),
  });

  let bytes = encoder::encode(&packet).map_err(|e| format!("OSC encode error: {e}"))?;
  let socket = UdpSocket::bind("0.0.0.0:0")
    .await
    .map_err(|e| format!("OSC bind error: {e}"))?;
  socket
    .send_to(&bytes, format!("{host}:{port}"))
    .await
    .map_err(|e| format!("OSC send error: {e}"))?;
  Ok(())
}
