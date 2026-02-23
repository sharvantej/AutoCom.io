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
        if (connections[name].type === "audio") {
          return { ip: connections[name].host, port: connections[name].port };
        }
      }
    }
  } catch (e) {}
  return { ip: "127.0.0.1", port: 9000 }; // fallback
}

const config = getConfig();

let udpPort = null;
let isStarted = false;

function start() {
  if (isStarted) return;

  udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 9003, // ✅ unique port
    remoteAddress: config.audio.ip,
    remotePort: config.audio.port,
  });

  udpPort.open();

  udpPort.on("ready", () => {
    console.log("✅ Audio OSC ready");
  });

  udpPort.on("error", (err) => {
    console.error("❌ Audio OSC error:", err.message);
  });

  isStarted = true;
}

function playTrack(track) {
  if (!udpPort) {
    console.warn("⚠️ Audio OSC not started");
    return;
  }

  udpPort.send({
    address: `/play/${track}`,
    args: [],
  });

  console.log(`🎧 Audio play ${track}`);
}

module.exports = {
  start,
  playTrack,
};
