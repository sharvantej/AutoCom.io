const osc = require("osc");
const fs = require("fs");
const path = require("path");

// Get config from show/connections.json
function getConfig() {
  const connectionsPath = path.join(
    __dirname,
    "..",
    "show",
    "connections.json",
  );
  try {
    if (fs.existsSync(connectionsPath)) {
      const connections = JSON.parse(fs.readFileSync(connectionsPath, "utf-8"));
      // Find device by type
      for (const name in connections) {
        if (connections[name].type === "resolume") {
          return { ip: connections[name].host, port: connections[name].port };
        }
      }
    }
  } catch (e) {}
  return { ip: "127.0.0.1", port: 7000 }; // fallback
}

const config = getConfig();

let udpPort = null;
let isStarted = false;

// --------------------------------------------------
// 🚀 Start OSC (call once from server.js)
// --------------------------------------------------
function start() {
  if (isStarted) return;

  udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 9001, // ✅ SAFE custom port (NOT 57121)
    remoteAddress: config.resolume.ip,
    remotePort: config.resolume.port,
  });

  udpPort.open();

  udpPort.on("ready", () => {
    console.log("✅ Resolume OSC ready");
  });

  udpPort.on("error", (err) => {
    console.error("❌ Resolume OSC error:", err.message);
  });

  isStarted = true;
}

// --------------------------------------------------
// 🎬 Trigger clip
// --------------------------------------------------
function triggerClip(layer, clip) {
  if (!udpPort) {
    console.warn("⚠️ OSC not started yet");
    return;
  }

  udpPort.send({
    address: `/composition/layers/${layer}/clips/${clip}/connect`,
    args: [{ type: "i", value: 1 }],
  });

  console.log(`🎬 Resolume Layer ${layer} Clip ${clip}`);
}

module.exports = {
  start,
  triggerClip,
};
