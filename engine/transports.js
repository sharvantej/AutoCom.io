const dgram = require("dgram");
const net = require("net");
const osc = require("osc");
const crypto = require("crypto");

const oscPorts = new Map();
const tcpSockets = new Map();
const obsClients = new Map();

function inferProtocol(connection = {}) {
  if (connection.protocol) return String(connection.protocol).toLowerCase();

  const type = String(connection.type || "").toLowerCase();
  if (
    ["resolume", "grandma3", "lighting", "audio", "audio_mixer", "x32"].includes(type)
  ) {
    return "osc";
  }
  if (["atem"].includes(type)) {
    return "udp";
  }
  if (
    [
      "vmix",
      "tcp",
      "generic_tcp",
      "videohub",
      "swp08",
      "ross_talk",
      "ross_carbonite",
      "ross_xpression",
    ].includes(
      type,
    )
  ) {
    return "tcp";
  }
  if (["obs"].includes(type)) {
    return "ws";
  }
  if (["http", "https", "http_api"].includes(type)) {
    return "http";
  }
  return "tcp";
}

function oscArgs(args = []) {
  return args.map((value) => {
    if (typeof value === "number" && Number.isInteger(value)) {
      return { type: "i", value };
    }
    if (typeof value === "number") {
      return { type: "f", value };
    }
    return { type: "s", value: String(value) };
  });
}

function getOscPort(host, port) {
  const key = `${host}:${port}`;
  const existing = oscPorts.get(key);
  if (existing) {
    return existing.ready;
  }

  const udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 0,
    remoteAddress: host,
    remotePort: Number(port),
  });

  const ready = new Promise((resolve, reject) => {
    udpPort.once("ready", () => resolve(udpPort));
    udpPort.once("error", reject);
  });

  oscPorts.set(key, { udpPort, ready });
  udpPort.open();

  return ready;
}

async function sendOsc(connection, message) {
  const host = connection.host || connection.ip;
  const port = Number(connection.port);

  if (!host || !port) {
    throw new Error("OSC connection missing host/port");
  }

  const udpPort = await getOscPort(host, port);
  const address = message.address || "/";
  const args = oscArgs(message.args || []);

  udpPort.send({ address, args });
}

function tcpKey(connection) {
  return `${connection.host}:${connection.port}`;
}

function createTcpSocket(connection, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (err) => {
      if (done) return;
      done = true;
      if (err) reject(err);
      else resolve(socket);
    };

    socket.setNoDelay(true);
    socket.setKeepAlive(true, 2000);
    socket.setTimeout(timeoutMs, () => finish(new Error("TCP timeout")));
    socket.once("error", finish);
    socket.connect(Number(connection.port), connection.host, () => {
      socket.removeListener("error", finish);
      finish();
    });
  });
}

async function getTcpSocket(connection) {
  const key = tcpKey(connection);
  const existing = tcpSockets.get(key);
  if (existing && !existing.socket.destroyed) {
    return existing.socket;
  }

  const socket = await createTcpSocket(connection);
  socket.on("close", () => {
    const current = tcpSockets.get(key);
    if (current?.socket === socket) {
      tcpSockets.delete(key);
    }
  });
  socket.on("error", () => {
    const current = tcpSockets.get(key);
    if (current?.socket === socket) {
      tcpSockets.delete(key);
    }
  });

  tcpSockets.set(key, { socket });
  return socket;
}

async function sendTcp(connection, payload, options = {}) {
  const host = connection.host || connection.ip;
  const port = Number(connection.port);
  if (!host || !port) {
    throw new Error("TCP connection missing host/port");
  }

  const socket = await getTcpSocket({ host, port });
  const lineEnd = options.lineEnd ?? "\r\n";
  const message =
    typeof payload === "string" ? payload : JSON.stringify(payload);
  socket.write(`${message}${lineEnd}`);
}

function udpSocketTypeForHost(host) {
  return net.isIP(String(host || "")) === 6 ? "udp6" : "udp4";
}

async function sendUdp(connection, payload, options = {}) {
  const host = connection.host || connection.ip;
  const port = Number(connection.port);
  if (!host || !port) {
    throw new Error("UDP connection missing host/port");
  }

  const lineEnd = options.lineEnd ?? "";
  const body =
    Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(
          `${typeof payload === "string" ? payload : JSON.stringify(payload)}${lineEnd}`,
        );

  await new Promise((resolve, reject) => {
    const socket = dgram.createSocket(udpSocketTypeForHost(host));
    socket.send(body, port, host, (err) => {
      socket.close();
      if (err) reject(err);
      else resolve();
    });
  });
}

async function sendHttp(connection, req = {}) {
  const protocol =
    String(connection.protocol || "").toLowerCase() === "https"
      ? "https"
      : "http";
  const host = connection.host || connection.ip;
  const port = connection.port ? `:${connection.port}` : "";
  const path = req.path || connection.path || "/";
  const url = req.url || `${protocol}://${host}${port}${path}`;
  const method = (req.method || "GET").toUpperCase();

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(req.timeoutMs || 1200),
  );
  try {
    const response = await fetch(url, {
      method,
      headers: req.headers || connection.headers || {},
      body: req.body
        ? typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body)
        : undefined,
      signal: controller.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sha256Base64(input) {
  return crypto.createHash("sha256").update(String(input || "")).digest("base64");
}

function obsAuthToken(password, salt, challenge) {
  const secret = sha256Base64(`${password || ""}${salt || ""}`);
  return sha256Base64(`${secret}${challenge || ""}`);
}

function obsKey(connection) {
  const host = connection.host || connection.ip || "";
  const port = Number(connection.port || 0);
  const protocol =
    String(connection.protocol || "").toLowerCase() === "wss" ? "wss" : "ws";
  const password = String(connection.password || "");
  return `${protocol}://${host}:${port}|${password}`;
}

function obsUrl(connection) {
  const host = connection.host || connection.ip;
  const port = Number(connection.port);
  const protocol =
    String(connection.protocol || "").toLowerCase() === "wss" ? "wss" : "ws";
  return `${protocol}://${host}:${port}`;
}

function normalizeObsRequest(request = {}) {
  let requestType = String(
    request.requestType || request.command || request.function || "",
  ).trim();
  let requestData =
    request.requestData ?? request.payload ?? request.body ?? undefined;

  if (!request.requestType && typeof request.command === "string") {
    const text = request.command.trim();
    const splitAt = text.indexOf(" ");
    if (splitAt > 0) {
      const maybeType = text.slice(0, splitAt).trim();
      const maybeJson = text.slice(splitAt + 1).trim();
      if (maybeType && maybeJson.startsWith("{")) {
        requestType = maybeType;
        if (requestData == null) {
          try {
            requestData = JSON.parse(maybeJson);
          } catch {}
        }
      }
    }
  }

  if (typeof requestData === "string") {
    const raw = requestData.trim();
    if (!raw) {
      requestData = undefined;
    } else if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        requestData = JSON.parse(raw);
      } catch {}
    }
  }

  return { requestType, requestData };
}

function createObsClient(connection, timeoutMs = 1800) {
  return new Promise((resolve, reject) => {
    const WS = globalThis.WebSocket;
    if (!WS) {
      reject(new Error("WebSocket client API is unavailable in this runtime"));
      return;
    }

    const host = connection.host || connection.ip;
    const port = Number(connection.port);
    if (!host || !port) {
      reject(new Error("OBS connection missing host/port"));
      return;
    }

    const ws = new WS(obsUrl(connection));
    const pending = new Map();
    let settled = false;
    let nextRequestId = 1;

    const finish = (err, client) => {
      if (settled) return;
      settled = true;
      clearTimeout(handshakeTimer);
      if (err) reject(err);
      else resolve(client);
    };

    const rejectPending = (message) => {
      for (const [id, state] of pending.entries()) {
        pending.delete(id);
        clearTimeout(state.timer);
        state.reject(new Error(message || `OBS request ${id} failed`));
      }
    };

    const handshakeTimer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      finish(new Error("OBS WebSocket handshake timeout"));
    }, timeoutMs);

    const onMessage = (event) => {
      let payload = event?.data;
      if (typeof payload !== "string") {
        if (payload == null) return;
        payload = String(payload);
      }

      let packet;
      try {
        packet = JSON.parse(payload);
      } catch {
        return;
      }

      const op = Number(packet?.op);
      const d = packet?.d || {};

      if (op === 0) {
        const identify = { rpcVersion: 1 };
        const auth = d.authentication;
        if (auth && auth.challenge && auth.salt) {
          identify.authentication = obsAuthToken(
            connection.password,
            auth.salt,
            auth.challenge,
          );
        }
        try {
          ws.send(JSON.stringify({ op: 1, d: identify }));
        } catch (err) {
          finish(new Error(`OBS identify failed: ${err.message}`));
        }
        return;
      }

      if (op === 2) {
        const client = {
          ws,
          async request(requestType, requestData, reqTimeoutMs = 1800) {
            if (ws.readyState !== WS.OPEN) {
              throw new Error("OBS socket is not open");
            }
            if (!String(requestType || "").trim()) {
              throw new Error("OBS requestType is required");
            }

            const requestId = `req_${Date.now()}_${nextRequestId++}`;
            return new Promise((resolveReq, rejectReq) => {
              const timer = setTimeout(() => {
                pending.delete(requestId);
                rejectReq(new Error(`OBS request timeout: ${requestType}`));
              }, Number(reqTimeoutMs || 1800));

              pending.set(requestId, {
                resolve: resolveReq,
                reject: rejectReq,
                timer,
              });

              const requestPacket = {
                op: 6,
                d: {
                  requestType: String(requestType),
                  requestId,
                },
              };
              if (
                requestData &&
                typeof requestData === "object" &&
                !Array.isArray(requestData)
              ) {
                requestPacket.d.requestData = requestData;
              }

              try {
                ws.send(JSON.stringify(requestPacket));
              } catch (err) {
                pending.delete(requestId);
                clearTimeout(timer);
                rejectReq(new Error(`OBS send failed: ${err.message}`));
              }
            });
          },
        };
        finish(null, client);
        return;
      }

      if (op === 7) {
        const requestId = d.requestId;
        const wait = requestId ? pending.get(requestId) : null;
        if (!wait) return;
        pending.delete(requestId);
        clearTimeout(wait.timer);
        wait.resolve(d);
      }
    };

    const onClose = () => {
      rejectPending("OBS socket closed");
      if (!settled) {
        finish(new Error("OBS socket closed before identify"));
      }
    };

    const onError = (event) => {
      const message =
        event?.message || event?.error?.message || "OBS socket error";
      rejectPending(message);
      if (!settled) {
        finish(new Error(message));
      }
    };

    ws.addEventListener("message", onMessage);
    ws.addEventListener("close", onClose);
    ws.addEventListener("error", onError);
  });
}

async function getObsClient(connection) {
  const key = obsKey(connection);
  const existing = obsClients.get(key);
  if (existing?.client && existing.client.ws?.readyState === 1) {
    return existing.client;
  }
  if (existing?.ready) {
    return existing.ready;
  }

  const ready = createObsClient(connection);
  obsClients.set(key, { ready });

  ready
    .then((client) => {
      const current = obsClients.get(key);
      if (!current || current.ready !== ready) return;
      obsClients.set(key, { ready, client });

      const forget = () => {
        const latest = obsClients.get(key);
        if (latest?.client === client) {
          obsClients.delete(key);
        }
      };

      client.ws.addEventListener("close", forget);
      client.ws.addEventListener("error", forget);
    })
    .catch(() => {
      const current = obsClients.get(key);
      if (current?.ready === ready) {
        obsClients.delete(key);
      }
    });

  return ready;
}

async function sendObs(connection, request = {}) {
  const host = connection.host || connection.ip;
  const port = Number(connection.port);
  if (!host || !port) {
    throw new Error("OBS connection missing host/port");
  }

  const { requestType, requestData } = normalizeObsRequest(request);
  if (!requestType) {
    throw new Error("OBS task missing requestType");
  }

  const client = await getObsClient(connection);
  const result = await client.request(requestType, requestData);
  const status = result?.requestStatus || {};
  if (status.result === false) {
    throw new Error(
      `OBS ${requestType} failed: ${status.comment || status.code || "unknown error"}`,
    );
  }
  return result;
}

function checkTcpStatus(connection) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (status, extra = {}) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ status, ...extra });
    };

    socket.setTimeout(900, () => finish("offline", { lastError: "timeout" }));
    socket.once("error", (err) =>
      finish("offline", { lastError: err.message }),
    );
    socket.connect(Number(connection.port), connection.host, () =>
      finish("online"),
    );
  });
}

function checkOscStatus(connection) {
  return new Promise((resolve) => {
    const udp = dgram.createSocket("udp4");
    udp.send(
      Buffer.from("/ping\0"),
      Number(connection.port),
      connection.host,
      (err) => {
        udp.close();
        if (err) {
          resolve({ status: "offline", lastError: err.message });
        } else {
          resolve({ status: "online" });
        }
      },
    );
  });
}

async function checkHttpStatus(connection) {
  try {
    const result = await sendHttp(connection, {
      method: "GET",
      timeoutMs: 1000,
    });
    return {
      // Any HTTP response means the service is reachable.
      status: typeof result.status === "number" ? "online" : "offline",
      httpStatus: result.status,
    };
  } catch (err) {
    return {
      status: "offline",
      lastError: err.message,
    };
  }
}

function resolveStatusProbe(connection = {}) {
  const type = String(connection.type || "").toLowerCase();
  const host = connection.host || connection.ip;
  const port = Number(connection.port);

  if (!host || !port) return null;

  if (connection.healthCheck && typeof connection.healthCheck === "object") {
    const hc = connection.healthCheck;
    return {
      ...connection,
      host: String(hc.host || host),
      ip: String(hc.host || host),
      port: Number(hc.port || port),
      protocol: String(hc.protocol || connection.protocol || "").toLowerCase(),
      path: hc.path || connection.path,
    };
  }

  return connection;
}

async function checkConnectionStatus(connection = {}) {
  if (!connection.host && !connection.ip) {
    return { status: "misconfigured", lastError: "missing host" };
  }

  const type = String(connection.type || "").toLowerCase();
  const probe = resolveStatusProbe(connection) || connection;
  const protocol = inferProtocol(probe);
  if (protocol === "http" || protocol === "https") {
    return checkHttpStatus(probe);
  }
  if (protocol === "ws" || protocol === "wss") {
    return checkTcpStatus(probe);
  }
  if (protocol === "osc" || protocol === "udp") {
    if (type === "resolume") {
      return { status: "online" };
    }
    // UDP send does not confirm receiver availability.
    return {
      status: "unknown",
      lastError:
        "UDP/OSC probe is unverified. Configure healthCheck for active detection.",
    };
  }
  return checkTcpStatus(probe);
}

module.exports = {
  inferProtocol,
  sendOsc,
  sendTcp,
  sendUdp,
  sendHttp,
  sendObs,
  checkConnectionStatus,
};
