const express = require("express");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Server } = require("socket.io");

const cueEngine = require("./engine/cueEngine");
const { inferProtocol, checkConnectionStatus } = require("./engine/transports");

try {
  require("electron-reloader")(module);
} catch {}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.AUTO_OSC_BIND_HOST || "127.0.0.1";
const allowedSocketOrigins = new Set([
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
]);
if (HOST !== "127.0.0.1" && HOST !== "localhost") {
  allowedSocketOrigins.add(`http://${HOST}:${PORT}`);
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin || allowedSocketOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
  },
});
global.io = io;
const bundledShowDir = path.join(__dirname, "show");
const showDir = process.env.AUTO_OSC_SHOW_DIR
  ? path.resolve(process.env.AUTO_OSC_SHOW_DIR)
  : bundledShowDir;
const layoutPath = path.join(showDir, "layout.json");
const connectionsPath = path.join(showDir, "connections.json");
const showPath = path.join(showDir, "show.json");

let showLock = false;
let deviceStatus = {};
let statusCheckInFlight = false;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function writeJsonFile(filePath, data) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return port;
}

function ensureLayout() {
  if (!fs.existsSync(showDir)) {
    fs.mkdirSync(showDir, { recursive: true });
  }
  if (!fs.existsSync(layoutPath)) {
    writeJsonFile(layoutPath, { buttons: [] });
  }
}

function defaultConnections() {
  return {
    "Resolume Arena": {
      host: "127.0.0.1",
      port: 7000,
      type: "resolume",
      protocol: "osc",
      enabled: true,
      healthCheck: {
        protocol: "tcp",
        port: 8080,
      },
    },
    grandMA3: {
      host: "127.0.0.1",
      port: 8000,
      type: "grandma3",
      protocol: "osc",
      oscPrefix: "/cmd",
      enabled: true,
    },
    vMix: {
      host: "127.0.0.1",
      port: 8099,
      type: "vmix",
      protocol: "tcp",
      enabled: true,
    },
    "ATEM Switcher": {
      host: "127.0.0.1",
      port: 9993,
      type: "atem",
      protocol: "udp",
      enabled: true,
    },
    OBS: {
      host: "127.0.0.1",
      port: 4455,
      type: "obs",
      protocol: "ws",
      enabled: true,
      password: "",
    },
    "HTTP API": {
      host: "127.0.0.1",
      port: 80,
      type: "http_api",
      protocol: "http",
      path: "/",
      enabled: true,
    },
    "Audio Mixer": {
      host: "127.0.0.1",
      port: 9000,
      type: "audio_mixer",
      protocol: "osc",
      enabled: true,
    },
    "Ross Switcher (RossTalk)": {
      host: "127.0.0.1",
      port: 7788,
      type: "ross_talk",
      protocol: "tcp",
      enabled: true,
    },
    "Ross XPression": {
      host: "127.0.0.1",
      port: 7789,
      type: "ross_xpression",
      protocol: "tcp",
      enabled: true,
    },
  };
}

function ensureConnections() {
  if (!fs.existsSync(showDir)) {
    fs.mkdirSync(showDir, { recursive: true });
  }
  if (!fs.existsSync(connectionsPath)) {
    writeJsonFile(connectionsPath, defaultConnections());
  }
}

function ensureShowFile() {
  if (!fs.existsSync(showDir)) {
    fs.mkdirSync(showDir, { recursive: true });
  }
  if (!fs.existsSync(showPath)) {
    const bundledShowPath = path.join(bundledShowDir, "show.json");
    if (fs.existsSync(bundledShowPath)) {
      fs.copyFileSync(bundledShowPath, showPath);
    } else {
      writeJsonFile(showPath, { cues: {} });
    }
  }
}

function loadLayout() {
  ensureLayout();
  return JSON.parse(fs.readFileSync(layoutPath, "utf-8"));
}

function loadConnections() {
  ensureConnections();
  return JSON.parse(fs.readFileSync(connectionsPath, "utf-8"));
}

function hasStatusChanged(prev, next) {
  return JSON.stringify(prev) !== JSON.stringify(next);
}

async function checkAllDeviceStatuses() {
  if (statusCheckInFlight) return;
  statusCheckInFlight = true;

  try {
    const connections = loadConnections();
    const entries = Object.entries(connections);
    const updated = {};

    await Promise.all(
      entries.map(async ([name, connection]) => {
        const host = connection?.host || connection?.ip;
        const port = Number(connection?.port);
        const type = connection?.type || "unknown";
        const protocol = inferProtocol(connection);
        const enabled = connection?.enabled !== false;

        if (!enabled) {
          updated[name] = {
            status: "inactive",
            type,
            protocol,
            host: host || "N/A",
            port: port || "N/A",
            enabled: false,
            lastError: "disabled by user",
            lastSeen: null,
          };
          return;
        }

        if (!host || !port) {
          updated[name] = {
            status: "misconfigured",
            type,
            protocol,
            enabled: true,
            host: host || "N/A",
            port: port || "N/A",
          };
          return;
        }

        const result = await checkConnectionStatus({
          ...connection,
          host,
          port,
          protocol,
        });
        updated[name] = {
          status: result.status || "unknown",
          type,
          protocol,
          enabled: true,
          host,
          port,
          lastError: result.lastError || null,
          lastSeen:
            result.status === "online" ? new Date().toISOString() : null,
        };
      }),
    );

    if (hasStatusChanged(deviceStatus, updated)) {
      deviceStatus = updated;
      io.emit("deviceStatusUpdate", deviceStatus);
    }
  } catch (err) {
    console.warn("[status] failed:", err.message);
  } finally {
    statusCheckInFlight = false;
  }
}

function normalizeConnectionPayload(input) {
  if (!isPlainObject(input)) {
    throw new Error("Connections payload must be an object.");
  }

  const out = {};
  const seenNames = new Set();
  for (const [name, raw] of Object.entries(input || {})) {
    if (!isPlainObject(raw)) continue;

    const normalizedName = String(name || "").trim();
    if (!normalizedName) continue;
    const canonicalName = normalizedName.toLowerCase();
    if (seenNames.has(canonicalName)) {
      throw new Error(`Duplicate connection name "${normalizedName}".`);
    }
    seenNames.add(canonicalName);

    const host = String(raw.host || raw.ip || "").trim();
    const port = normalizePort(raw.port);
    const type = String(raw.type || "generic_tcp")
      .trim()
      .toLowerCase();
    const protocol = inferProtocol({ ...raw, type, protocol: raw.protocol });

    out[normalizedName] = {
      ...raw,
      host,
      port,
      type,
      protocol,
      enabled: raw.enabled !== false,
    };
  }
  return out;
}

function normalizeLayoutPayload(input) {
  if (!isPlainObject(input)) {
    throw new Error("Layout payload must be an object.");
  }

  const next = { ...input };
  next.buttons = Array.isArray(input.buttons) ? input.buttons : [];
  if (typeof next.backgroundColor !== "string") {
    delete next.backgroundColor;
  }
  return next;
}

ensureLayout();
ensureConnections();
ensureShowFile();
setTimeout(checkAllDeviceStatuses, 800);
setInterval(checkAllDeviceStatuses, 5000);

app.post("/api/cue/:id", async (req, res) => {
  try {
    if (showLock) {
      return res
        .status(403)
        .json({ error: "Show is locked. Cannot trigger cues." });
    }

    const cueId = req.params.id;
    const result = await cueEngine.triggerCue(cueId);
    io.emit("cueTriggered", { cue: cueId, time: Date.now() });
    res.json({ success: true, cue: cueId, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/button/:id", async (req, res) => {
  try {
    if (showLock) {
      return res
        .status(403)
        .json({ error: "Show is locked. Cannot trigger buttons." });
    }

    const layout = loadLayout();
    const connections = loadConnections();
    const btn = layout.buttons.find(
      (b) => String(b.id) === String(req.params.id),
    );
    if (!btn) return res.status(404).json({ error: "Button not found" });

    const results = await cueEngine.executeSequence(btn.tasks || [], {
      connections,
    });

    io.emit("buttonTriggered", {
      id: btn.id,
      label: btn.label,
      time: Date.now(),
    });
    res.json({ success: true, results });
  } catch (err) {
    console.error("button execution failed:", err);
    res.status(500).json({
      success: false,
      error: err.message,
      failedStepId: err.stepId || null,
    });
  }
});

app.get("/api/cues", (req, res) => {
  try {
    ensureShowFile();
    const show = JSON.parse(fs.readFileSync(showPath, "utf-8"));
    res.json(Object.keys(show.cues || {}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/status", (req, res) => {
  try {
    const cueStatus = cueEngine.getStatus?.() || {};
    res.json({
      ...cueStatus,
      showLock,
      devices: deviceStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/show-lock", (req, res) => {
  res.json({ showLock });
});

app.post("/api/show-lock", (req, res) => {
  const { lock } = req.body || {};
  if (typeof lock !== "boolean") {
    return res
      .status(400)
      .json({ error: "Invalid request body. Expected { lock: boolean }" });
  }
  showLock = lock;
  io.emit("showLockUpdate", showLock);
  res.json({ success: true, showLock });
});

app.get("/api/layout", (req, res) => {
  try {
    res.json(loadLayout());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/layout", (req, res) => {
  try {
    if (showLock) {
      return res
        .status(403)
        .json({ error: "Show is locked. Cannot save layout." });
    }
    const normalizedLayout = normalizeLayoutPayload(req.body);
    ensureLayout();
    writeJsonFile(layoutPath, normalizedLayout);
    res.json({ success: true });
  } catch (err) {
    const message = String(err?.message || "Failed to save layout.");
    const status = /payload/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/connections", (req, res) => {
  try {
    res.json(loadConnections());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/connections", (req, res) => {
  try {
    const normalized = normalizeConnectionPayload(req.body);
    for (const [name, conn] of Object.entries(normalized)) {
      if (!name || !conn.host || !conn.port) {
        return res.status(400).json({ error: `Invalid connection "${name}"` });
      }
    }

    writeJsonFile(connectionsPath, normalized);
    setTimeout(checkAllDeviceStatuses, 200);
    res.json({ success: true });
  } catch (err) {
    const message = String(err?.message || "Failed to save connections.");
    const status = /payload|duplicate|invalid/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

io.on("connection", (socket) => {
  socket.emit("deviceStatusUpdate", deviceStatus);
});

function lanIPv4List() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const netIf of Object.values(interfaces)) {
    for (const addr of netIf || []) {
      if (addr.family === "IPv4" && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
}

server.listen(PORT, HOST, () => {
  console.log("AUTO OSC SERVER RUNNING");
  console.log(`Bind:   ${HOST}`);
  console.log(`Local:  http://localhost:${PORT}`);
  if (HOST === "0.0.0.0" || HOST === "::") {
    for (const ip of lanIPv4List()) {
      console.log(`LAN:    http://${ip}:${PORT}`);
    }
  }
});

