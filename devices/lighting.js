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
      for (const name in connections) {
        if (connections[name].type === "lighting") {
          return { ip: connections[name].host, port: connections[name].port };
        }
      }
    }
  } catch (e) {}
  return { ip: "127.0.0.1", port: 8000 }; // fallback
}

const config = getConfig();

let udpPort = null;
let isStarted = false;

function start() {
  if (isStarted) return;

  udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 9002, // ✅ unique port
    remoteAddress: config.lighting.ip,
    remotePort: config.lighting.port,
  });

  udpPort.open();

  udpPort.on("ready", () => {
    console.log("✅ Lighting OSC ready");
  });

  udpPort.on("error", (err) => {
    console.error("❌ Lighting OSC error:", err.message);
  });

  isStarted = true;
}

function goCue(cue) {
  if (!udpPort) {
    console.warn("⚠️ Lighting OSC not started");
    return;
  }

  udpPort.send({
    address: `/cue/${cue}/go`,
    args: [],
  });

  console.log(`💡 Lighting cue ${cue}`);
}

module.exports = {
  start,
  goCue,
};
