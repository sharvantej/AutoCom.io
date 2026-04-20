use reqwest::Method;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;

fn value_to_string(v: &Value) -> String {
  v.as_str()
    .map(ToString::to_string)
    .unwrap_or_else(|| v.to_string())
}

fn headers(v: Option<&Value>) -> HeaderMap {
  let mut map = HeaderMap::new();
  if let Some(obj) = v.and_then(Value::as_object) {
    for (k, vv) in obj {
      if let Ok(name) = HeaderName::from_bytes(k.as_bytes()) {
        if let Ok(value) = HeaderValue::from_str(&value_to_string(vv)) {
          map.insert(name, value);
        }
      }
    }
  }
  map
}

fn shared_client() -> Result<&'static reqwest::Client, String> {
  static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
  match CLIENT.get_or_init(|| {
    reqwest::Client::builder()
      .pool_max_idle_per_host(8)
      .tcp_keepalive(Some(Duration::from_secs(30)))
      .build()
      .map_err(|e| format!("HTTP client error: {e}"))
  }) {
    Ok(client) => Ok(client),
    Err(err) => Err(err.clone()),
  }
}

pub async fn request(
  protocol: &str,
  host: &str,
  port: u16,
  method: &str,
  path: &str,
  header_value: Option<&Value>,
  body: Option<&Value>,
  timeout_ms: u64,
) -> Result<(bool, u16), String> {
  let scheme = if protocol.eq_ignore_ascii_case("https") {
    "https"
  } else {
    "http"
  };
  let resolved_path = if path.starts_with('/') {
    path.to_string()
  } else {
    format!("/{path}")
  };
  let url = format!("{scheme}://{host}:{port}{resolved_path}");

  let client = shared_client()?;

  let mut req = client.request(
    Method::from_bytes(method.as_bytes()).unwrap_or(Method::GET),
    url,
  );
  req = req.timeout(Duration::from_millis(timeout_ms.max(1)));

  let request_headers = headers(header_value);
  if !request_headers.is_empty() {
    req = req.headers(request_headers);
  }

  if let Some(b) = body {
    if b.is_object() || b.is_array() {
      req = req.json(b);
    } else if let Some(text) = b.as_str() {
      req = req.body(text.to_string());
    } else {
      req = req.body(b.to_string());
    }
  }

  let response = req
    .send()
    .await
    .map_err(|e| format!("HTTP request error: {e}"))?;
  Ok((response.status().is_success(), response.status().as_u16()))
}
