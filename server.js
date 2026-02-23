const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const cueEngine = require("./engine/cueEngine");
const { inferProtocol, checkConnectionStatus } = require("./engine/transports");

try {
  require("electron-reloader")(module);
} catch {}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
global.io = io;

const PORT = process.env.PORT || 3000;
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

function ensureLayout() {
  if (!fs.existsSync(showDir)) {
    fs.mkdirSync(showDir, { recursive: true });
  }
  if (!fs.existsSync(layoutPath)) {
    fs.writeFileSync(layoutPath, JSON.stringify({ buttons: [] }, null, 2));
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
      enabled: true,
    },
    vMix: {
      host: "127.0.0.1",
      port: 8099,
      type: "vmix",
      protocol: "tcp",
      enabled: true,
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
    "Ross Carbonite": {
      host: "127.0.0.1",
      port: 7788,
      type: "ross_carbonite",
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
    fs.writeFileSync(
      connectionsPath,
      JSON.stringify(defaultConnections(), null, 2),
    );
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
      fs.writeFileSync(showPath, JSON.stringify({ cues: {} }, null, 2), "utf-8");
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
  const out = {};
  for (const [name, raw] of Object.entries(input || {})) {
    if (!raw || typeof raw !== "object") continue;

    const host = String(raw.host || "").trim();
    const port = Number(raw.port);
    const type = String(raw.type || "generic_tcp")
      .trim()
      .toLowerCase();
    const protocol = inferProtocol({ ...raw, type, protocol: raw.protocol });

    out[name] = {
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
    ensureLayout();
    fs.writeFileSync(layoutPath, JSON.stringify(req.body, null, 2), "utf-8");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    fs.writeFileSync(
      connectionsPath,
      JSON.stringify(normalized, null, 2),
      "utf-8",
    );
    setTimeout(checkAllDeviceStatuses, 200);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on("connection", (socket) => {
  socket.emit("deviceStatusUpdate", deviceStatus);
});

server.listen(PORT, () => {
  console.log("AUTO OSC SERVER RUNNING");
  console.log(`http://localhost:${PORT}`);
});

