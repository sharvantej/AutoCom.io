const fs = require("fs");
const path = require("path");
const { inferProtocol, sendOsc, sendTcp, sendHttp } = require("./transports");

const bundledShowDir = path.join(__dirname, "..", "show");
const showDir = process.env.AUTO_OSC_SHOW_DIR
  ? path.resolve(process.env.AUTO_OSC_SHOW_DIR)
  : bundledShowDir;
const showPath = path.join(showDir, "show.json");
const connectionsPath = path.join(showDir, "connections.json");

let isRunning = false;
let currentCue = null;
let startedAt = null;

function wait(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, Number(ms) || 0)),
  );
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function loadShow() {
  return readJson(showPath, { cues: {} });
}

function loadConnections() {
  return readJson(connectionsPath, {});
}

function resolveConnection(task, connections) {
  if (task.connection && typeof task.connection === "object") {
    return task.connection;
  }

  if (task.deviceName && connections[task.deviceName]) {
    return connections[task.deviceName];
  }

  if (task.device && connections[task.device]) {
    return connections[task.device];
  }

  if (task.device) {
    const wanted = String(task.device).toLowerCase();
    const aliases = {
      lighting: ["lighting", "grandma3"],
      grandma3: ["grandma3", "lighting"],
      audio: ["audio", "audio_mixer"],
      audio_mixer: ["audio_mixer", "audio"],
    };
    const accepted = aliases[wanted] || [wanted];
    return (
      Object.values(connections).find((conn) =>
        accepted.includes(String(conn?.type || "").toLowerCase()),
      ) || null
    );
  }

  return null;
}

function emitDeviceLog(task, connection, message) {
  const label = task.deviceName || task.device || connection?.type || "device";
  global.io?.emit("deviceLog", {
    device: label,
    message,
  });
}

async function executeTask(task, options = {}) {
  const action = String(task.action || task.type || "").toLowerCase();

  if (action === "delay") {
    await wait(task.ms || task.delayMs || task.delay);
    return { ok: true };
  }

  const connections = options.connections || loadConnections();
  const connection = resolveConnection(task, connections) || {};
  if (connection.enabled === false) {
    throw new Error(
      `Connection "${task.device || task.deviceName || connection.type || "unknown"}" is inactive`,
    );
  }
  const connectionType = String(
    task.deviceType || connection.type || task.device || "",
  ).toLowerCase();
  const protocol = inferProtocol({
    ...connection,
    type: connectionType,
    protocol: task.protocol || connection.protocol,
  });

  if (!connection.host && protocol !== "http" && protocol !== "https") {
    throw new Error(
      `No connection found for task device "${task.device || task.deviceName || "unknown"}"`,
    );
  }

  if (connectionType === "resolume" && action === "clip") {
    await sendOsc(connection, {
      address: `/composition/layers/${task.layer}/clips/${task.clip}/connect`,
      args: [1],
    });
    emitDeviceLog(task, connection, `Resolume L${task.layer} C${task.clip}`);
    return { ok: true };
  }

  if (
    (connectionType === "grandma3" || connectionType === "lighting") &&
    (action === "cue" || action === "command")
  ) {
    const command =
      action === "cue" ? `Go+ Cue ${task.cue}` : String(task.command || "");
    if (!command) throw new Error("grandMA3 task missing command");
    await sendOsc(connection, { address: "/cmd", args: [command] });
    emitDeviceLog(task, connection, `grandMA3 ${command}`);
    return { ok: true };
  }

  if (
    (connectionType === "audio" || connectionType === "audio_mixer") &&
    (action === "track" || action === "play")
  ) {
    const track = task.track || task.name || "";
    await sendOsc(connection, { address: `/play/${track}`, args: [] });
    emitDeviceLog(task, connection, `Audio ${track}`);
    return { ok: true };
  }

  if (
    connectionType === "vmix" &&
    (action === "shortcut" || action === "command" || action === "function")
  ) {
    const command = task.command || task.shortcut || task.function;
    if (!command) throw new Error("vMix task missing command");
    await sendTcp(connection, command, { lineEnd: "\r\n" });
    emitDeviceLog(task, connection, `vMix ${command}`);
    return { ok: true };
  }

  if (
    protocol === "http" ||
    protocol === "https" ||
    connectionType === "http_api"
  ) {
    const result = await sendHttp(
      { ...connection, protocol },
      {
        method: task.method || "GET",
        path: task.path || connection.path || "/",
        headers: task.headers,
        body: task.body,
      },
    );
    emitDeviceLog(
      task,
      connection,
      `HTTP ${task.method || "GET"} ${task.path || connection.path || "/"}`,
    );
    if (!result.ok) {
      throw new Error(`HTTP request failed with status ${result.status}`);
    }
    return { ok: result.ok, status: result.status };
  }

  if (protocol === "osc" || protocol === "udp") {
    const address = task.address || task.oscAddress || task.path;
    if (!address) throw new Error("OSC task missing address");
    await sendOsc(connection, { address, args: task.args || [] });
    emitDeviceLog(task, connection, `OSC ${address}`);
    return { ok: true };
  }

  const tcpPayload = task.command || task.payload || task.message;
  if (!tcpPayload) throw new Error("TCP task missing payload");
  await sendTcp(connection, tcpPayload, { lineEnd: task.lineEnd ?? "\r\n" });
  emitDeviceLog(task, connection, `TCP ${String(tcpPayload).slice(0, 80)}`);
  return { ok: true };
}

function buildTaskFromRow(row = {}) {
  if (row.kind === "delay") {
    return {
      id: row.id,
      action: "delay",
      ms: row.ms,
    };
  }

  if (row.kind === "task") {
    const params =
      row.params && typeof row.params === "object" ? row.params : {};
    return {
      id: row.id,
      device: row.device,
      deviceName: row.device,
      deviceType: row.deviceType,
      action: row.action,
      ...params,
    };
  }

  return row;
}

function createStepError(err, stepId) {
  const next =
    err instanceof Error ? err : new Error(typeof err === "string" ? err : "Step failed");
  if (!next.stepId) {
    next.stepId = stepId || null;
  }
  return next;
}

async function executeRow(row, options = {}) {
  if (!row || typeof row !== "object") {
    return { skipped: true };
  }

  if (row.enabled === false) {
    return { skipped: true };
  }

  const stepId = row.id || null;

  try {
    if (row.kind === "parallel") {
      const steps = Array.isArray(row.steps) ? row.steps : [];
      if (!steps.length) {
        throw new Error("Parallel block must contain at least one step");
      }
      const results = await Promise.all(steps.map((item) => executeRow(item, options)));
      return { ok: true, type: "parallel", results };
    }

    if (row.kind === "delay" || row.kind === "task") {
      return executeTask(buildTaskFromRow(row), options);
    }

    if (row.type === "parallel" && Array.isArray(row.steps)) {
      const results = await Promise.all(
        row.steps.map((item) => executeRow(item, options)),
      );
      return { ok: true, type: "parallel", results };
    }

    if (row.type === "delay") {
      return executeTask(
        {
          id: stepId,
          action: "delay",
          ms: row.ms,
        },
        options,
      );
    }

    return executeTask(row, options);
  } catch (err) {
    throw createStepError(err, stepId);
  }
}

async function executeSequence(rows, options = {}) {
  if (!Array.isArray(rows)) {
    return [];
  }

  const results = [];
  for (const row of rows) {
    const result = await executeRow(row, options);
    results.push(result);
  }
  return results;
}

async function runStep(step, options = {}) {
  const stepType = String(step.type || "").toLowerCase();

  if (stepType === "parallel" && Array.isArray(step.steps)) {
    await Promise.all(step.steps.map((item) => runStep(item, options)));
    return;
  }

  if (stepType === "resolume_clip") {
    await executeTask(
      {
        device: "resolume",
        action: "clip",
        layer: step.layer,
        clip: step.clip,
      },
      options,
    );
    return;
  }

  if (stepType === "lighting_cue") {
    await executeTask(
      {
        device: "lighting",
        action: "cue",
        cue: step.cue,
      },
      options,
    );
    return;
  }

  if (stepType === "audio_track") {
    await executeTask(
      {
        device: "audio",
        action: "track",
        track: step.track,
      },
      options,
    );
    return;
  }

  if (stepType === "delay") {
    await executeTask({ action: "delay", ms: step.ms }, options);
    return;
  }

  await executeTask(step, options);
}

async function triggerCue(cueId) {
  if (isRunning) {
    return { rejected: true, reason: "busy" };
  }

  const show = loadShow();
  const timeline = show?.cues?.[cueId];
  if (!Array.isArray(timeline)) {
    return { warning: "Unknown cue" };
  }

  const connections = loadConnections();

  try {
    isRunning = true;
    currentCue = cueId;
    startedAt = Date.now();

    for (const step of timeline) {
      await runStep(step, { connections });
    }

    return { executed: cueId };
  } catch (err) {
    return { error: err.message };
  } finally {
    isRunning = false;
    currentCue = null;
    startedAt = null;
  }
}

function getStatus() {
  return {
    running: isRunning,
    currentCue,
    startedAt,
  };
}

module.exports = {
  triggerCue,
  getStatus,
  executeTask,
  executeSequence,
};

