use tokio::net::UdpSocket;

fn artnet_dmx_packet(universe: u16, data: &[u8]) -> Result<Vec<u8>, String> {
  if data.is_empty() {
    return Err("Artnet DMX payload must have at least 1 channel value".to_string());
  }
  if data.len() > 512 {
    return Err("Artnet DMX payload cannot exceed 512 channels".to_string());
  }

  // ArtDMX requires an even data length.
  let mut dmx = data.to_vec();
  if dmx.len() % 2 != 0 {
    dmx.push(0);
  }

  let mut packet = Vec::with_capacity(18 + dmx.len());
  packet.extend_from_slice(b"Art-Net\0");
  packet.extend_from_slice(&[0x00, 0x50]); // OpCode ArtDMX (little-endian 0x5000)
  packet.extend_from_slice(&[0x00, 0x0E]); // Protocol version 14
  packet.push(0x00); // Sequence
  packet.push(0x00); // Physical
  packet.push((universe & 0xFF) as u8); // SubUni
  packet.push(((universe >> 8) & 0x7F) as u8); // Net
  packet.push(((dmx.len() >> 8) & 0xFF) as u8); // LengthHi
  packet.push((dmx.len() & 0xFF) as u8); // LengthLo
  packet.extend_from_slice(&dmx);
  Ok(packet)
}

pub async fn send_dmx(host: &str, port: u16, universe: u16, data: &[u8]) -> Result<(), String> {
  let packet = artnet_dmx_packet(universe, data)?;
  let socket = UdpSocket::bind("0.0.0.0:0")
    .await
    .map_err(|e| format!("Artnet bind error: {e}"))?;
  socket
    .send_to(&packet, format!("{host}:{port}"))
    .await
    .map_err(|e| format!("Artnet send error: {e}"))?;
  Ok(())
}
