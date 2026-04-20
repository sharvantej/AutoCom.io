use elgato_streamdeck::{info::Kind, list_devices, new_hidapi, StreamDeck, StreamDeckInput};
use font8x8::UnicodeFonts;
use image::{DynamicImage, ImageBuffer, Rgba};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StreamDeckDeviceSummary {
  serial_number: String,
  product_name: String,
  key_count: u8,
  rows: u8,
  cols: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StreamDeckSyncRequest {
  serial_number: Option<String>,
  cols: u8,
  keys: Vec<StreamDeckSyncKey>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StreamDeckPollRequest {
  serial_number: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StreamDeckSyncKey {
  row: u8,
  col: u8,
  address: Option<String>,
  label: Option<String>,
  mapped: bool,
  selected: Option<bool>,
  text_size: Option<u8>,
  text_color: Option<[u8; 3]>,
  bg_color: Option<[u8; 3]>,
  topbar_color: Option<[u8; 3]>,
  text_align: Option<String>,
  topbar_enabled: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StreamDeckButtonEvent {
  row: u8,
  col: u8,
  pressed: bool,
}

static PREVIOUS_BUTTON_STATES: OnceLock<Mutex<HashMap<String, Vec<bool>>>> = OnceLock::new();

fn put_pixel_safe(image: &mut ImageBuffer<Rgba<u8>, Vec<u8>>, x: i32, y: i32, color: Rgba<u8>) {
  if x < 0 || y < 0 {
    return;
  }
  let x_u = x as u32;
  let y_u = y as u32;
  if x_u >= image.width() || y_u >= image.height() {
    return;
  }
  image.put_pixel(x_u, y_u, color);
}

fn draw_glyph_scaled(
  image: &mut ImageBuffer<Rgba<u8>, Vec<u8>>,
  ch: char,
  x: i32,
  y: i32,
  scale: u32,
  color: Rgba<u8>,
) {
  let fallback = font8x8::BASIC_FONTS.get('?').unwrap_or([0; 8]);
  let glyph = font8x8::BASIC_FONTS.get(ch).unwrap_or(fallback);
  for (row, bits) in glyph.iter().enumerate() {
    for col in 0..8 {
      if (bits >> col) & 1 == 1 {
        for sy in 0..scale {
          for sx in 0..scale {
            put_pixel_safe(
              image,
              x + (col as i32 * scale as i32) + sx as i32,
              y + (row as i32 * scale as i32) + sy as i32,
              color,
            );
          }
        }
      }
    }
  }
}

fn wrap_label(label: &str, max_chars_per_line: usize, max_lines: usize) -> Vec<String> {
  let safe_chars = max_chars_per_line.max(1);
  let safe_lines = max_lines.max(1);
  let mut lines: Vec<String> = Vec::new();
  let mut current = String::new();

  for word in label.split_whitespace() {
    if current.is_empty() {
      current.push_str(word);
      continue;
    }
    if current.len() + 1 + word.len() <= safe_chars {
      current.push(' ');
      current.push_str(word);
      continue;
    }
    lines.push(current);
    current = word.to_string();
    if lines.len() >= safe_lines {
      break;
    }
  }

  if lines.len() < safe_lines && !current.is_empty() {
    lines.push(current);
  }

  if lines.is_empty() {
    lines.push(String::new());
  }
  lines.truncate(safe_lines);
  lines
}

fn draw_label(
  image: &mut ImageBuffer<Rgba<u8>, Vec<u8>>,
  label: &str,
  color: Rgba<u8>,
  text_size: u8,
  text_align: &str,
) {
  let scale = ((text_size.max(8) as u32) / 8).clamp(1, 4);
  let glyph_w = 8 * scale;
  let glyph_h = 8 * scale;
  let line_gap = scale.max(1);
  let usable_w = image.width().saturating_sub(10);
  let usable_h = image.height().saturating_sub(14);
  let chars_per_line = (usable_w / glyph_w).max(1) as usize;
  let max_lines = (usable_h / (glyph_h + line_gap)).max(1) as usize;
  let lines = wrap_label(label, chars_per_line, max_lines);
  let total_h = (lines.len() as u32 * glyph_h) + ((lines.len().saturating_sub(1) as u32) * line_gap);
  let y_start = ((image.height().saturating_sub(total_h)) / 2).max(8);

  for (line_idx, line) in lines.iter().enumerate() {
    let line_w = line.chars().count() as u32 * glyph_w;
    let x_start = match text_align {
      "left" => 5,
      "right" => image.width().saturating_sub(line_w + 5),
      _ => image.width().saturating_sub(line_w) / 2,
    };
    let y = y_start + (line_idx as u32 * (glyph_h + line_gap));
    for (char_idx, ch) in line.chars().enumerate() {
      draw_glyph_scaled(
        image,
        ch,
        (x_start + (char_idx as u32 * glyph_w)) as i32,
        y as i32,
        scale,
        color,
      );
    }
  }
}

fn build_key_image(kind: Kind, key: &StreamDeckSyncKey) -> DynamicImage {
  let (w, h) = kind.key_image_format().size;
  let bg = key.bg_color.unwrap_or([30, 41, 57]);
  let text = key.text_color.unwrap_or([248, 250, 252]);
  let topbar = key.topbar_color.unwrap_or(if key.selected.unwrap_or(false) {
    [0, 222, 120]
  } else {
    [139, 92, 246]
  });
  let text_size = key.text_size.unwrap_or(10);
  let text_align = key.text_align.clone().unwrap_or_else(|| "center".to_string());
  let label = key.label.clone().unwrap_or_default();

  let mut image = ImageBuffer::from_pixel(w as u32, h as u32, Rgba([bg[0], bg[1], bg[2], 255]));
  if key.topbar_enabled.unwrap_or(true) {
    for y in 0..10u32 {
      for x in 0..image.width() {
        image.put_pixel(x, y, Rgba([topbar[0], topbar[1], topbar[2], 255]));
      }
    }
    let addr = key.address.clone().unwrap_or_else(|| format!("1/{}/{}", key.row, key.col));
    for (char_idx, ch) in addr.chars().enumerate() {
      draw_glyph_scaled(
        &mut image,
        ch,
        2 + (char_idx as i32 * 6),
        1,
        1,
        Rgba([250, 204, 21, 255]),
      );
    }
  }

  if key.selected.unwrap_or(false) {
    let border = Rgba([topbar[0], topbar[1], topbar[2], 255]);
    for x in 0..image.width() {
      image.put_pixel(x, 0, border);
      image.put_pixel(x, image.height().saturating_sub(1), border);
    }
    for y in 0..image.height() {
      image.put_pixel(0, y, border);
      image.put_pixel(image.width().saturating_sub(1), y, border);
    }
  }

  draw_label(
    &mut image,
    &label,
    Rgba([text[0], text[1], text[2], 255]),
    text_size,
    &text_align,
  );

  DynamicImage::ImageRgba8(image)
}

fn key_index(row: u8, col: u8, cols: u8) -> Option<u8> {
  if row == 0 || col == 0 || cols == 0 {
    return None;
  }
  let row_offset = row.checked_sub(1)?;
  let col_offset = col.checked_sub(1)?;
  row_offset
    .checked_mul(cols)?
    .checked_add(col_offset)
}

fn index_to_row_col(index: usize, cols: u8) -> Option<(u8, u8)> {
  if cols == 0 {
    return None;
  }
  let cols_usize = cols as usize;
  let row = (index / cols_usize).checked_add(1)?;
  let col = (index % cols_usize).checked_add(1)?;
  Some((u8::try_from(row).ok()?, u8::try_from(col).ok()?))
}

fn kind_name(kind: Kind) -> &'static str {
  match kind {
    Kind::Original => "Stream Deck Original",
    Kind::OriginalV2 => "Stream Deck Original V2",
    Kind::Mini => "Stream Deck Mini",
    Kind::Xl => "Stream Deck XL",
    Kind::XlV2 => "Stream Deck XL V2",
    Kind::Mk2 => "Stream Deck MK2",
    Kind::Mk2Scissor => "Stream Deck MK2 Scissor",
    Kind::MiniMk2 => "Stream Deck Mini MK2",
    Kind::MiniDiscord => "Stream Deck Mini Discord",
    Kind::Neo => "Stream Deck Neo",
    Kind::Pedal => "Stream Deck Pedal",
    Kind::Plus => "Stream Deck Plus",
    Kind::MiniMk2Module => "Stream Deck Mini MK2 Module",
    Kind::Mk2Module => "Stream Deck MK2 Module",
    Kind::XlV2Module => "Stream Deck XL V2 Module",
  }
}

#[tauri::command]
pub(crate) fn streamdeck_list_devices() -> Result<Vec<StreamDeckDeviceSummary>, String> {
  let hid = new_hidapi().map_err(|e| e.to_string())?;
  let devices = list_devices(&hid)
    .into_iter()
    .map(|(kind, serial_number)| {
      StreamDeckDeviceSummary {
        serial_number,
        product_name: kind_name(kind).to_string(),
        key_count: kind.key_count(),
        rows: kind.row_count(),
        cols: kind.column_count(),
      }
    })
    .collect::<Vec<StreamDeckDeviceSummary>>();
  Ok(devices)
}

#[tauri::command]
pub(crate) fn streamdeck_sync_surface(payload: StreamDeckSyncRequest) -> Result<(), String> {
  let hid = new_hidapi().map_err(|e| e.to_string())?;
  let devices = list_devices(&hid);
  let Some((kind, serial)) = (if let Some(serial) = payload.serial_number.as_deref() {
    devices
      .into_iter()
      .find(|(_, detected_serial)| detected_serial == serial)
  } else {
    devices.into_iter().next()
  }) else {
    return Err("No Stream Deck devices found".to_string());
  };
  let deck = StreamDeck::connect(&hid, kind, &serial).map_err(|e| e.to_string())?;
  let key_count = deck.kind().key_count();

  for index in 0..key_count {
    deck.clear_button_image(index).map_err(|e| e.to_string())?;
  }

  for key in payload.keys {
    let Some(index) = key_index(key.row, key.col, payload.cols) else {
      continue;
    };
    if index >= key_count {
      continue;
    }
    let img = build_key_image(kind, &key);
    deck
      .set_button_image(index, img)
      .map_err(|e| e.to_string())?;
  }

  Ok(())
}

#[tauri::command]
pub(crate) fn streamdeck_poll_button_events(
  payload: StreamDeckPollRequest,
) -> Result<Vec<StreamDeckButtonEvent>, String> {
  let hid = new_hidapi().map_err(|e| e.to_string())?;
  let devices = list_devices(&hid);
  let Some((kind, serial)) = (if let Some(serial) = payload.serial_number.as_deref() {
    devices
      .into_iter()
      .find(|(_, detected_serial)| detected_serial == serial)
  } else {
    devices.into_iter().next()
  }) else {
    return Ok(Vec::new());
  };
  let deck = StreamDeck::connect(&hid, kind, &serial).map_err(|e| e.to_string())?;
  let input = deck
    .read_input(Some(Duration::from_millis(1)))
    .map_err(|e| e.to_string())?;
  let StreamDeckInput::ButtonStateChange(next_states) = input else {
    return Ok(Vec::new());
  };

  let previous_states_store = PREVIOUS_BUTTON_STATES.get_or_init(|| Mutex::new(HashMap::new()));
  let mut previous_states = previous_states_store.lock().map_err(|e| e.to_string())?;
  let previous = previous_states
    .entry(serial.clone())
    .or_insert_with(|| vec![false; next_states.len()]);

  if previous.len() != next_states.len() {
    *previous = vec![false; next_states.len()];
  }

  let mut events = Vec::new();
  for (index, now_pressed) in next_states.iter().enumerate() {
    let was_pressed = previous[index];
    if was_pressed == *now_pressed {
      continue;
    }
    if let Some((row, col)) = index_to_row_col(index, kind.column_count()) {
      events.push(StreamDeckButtonEvent {
        row,
        col,
        pressed: *now_pressed,
      });
    }
  }
  *previous = next_states;
  Ok(events)
}
