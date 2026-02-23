const dgram = require("dgram");
const net = require("net");
const osc = require("osc");

const oscPorts = new Map();
const tcpSockets = new Map();

function inferProtocol(connection = {}) {
  if (connection.protocol) return String(connection.protocol).toLowerCase();

  const type = String(connection.type || "").toLowerCase();
  if (
    ["resolume", "grandma3", "lighting", "audio", "audio_mixer"].includes(type)
  ) {
    return "osc";
  }
  if (
    ["vmix", "tcp", "generic_tcp", "ross_carbonite", "ross_xpression"].includes(
      type,
    )
  ) {
    return "tcp";
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
  sendHttp,
  checkConnectionStatus,
};
