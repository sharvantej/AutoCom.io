/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONNECTION UTILITIES
 *
 * Helpers that transform frontend Connection objects into the shape expected
 * by the Tauri / Rust backend.
 *
 * Extracted from AppContext so the context file only holds state and setters.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Connection } from "../types";

// ── Default ports ─────────────────────────────────────────────────────────────

const PORT_MAP: Record<string, number> = {
  // ATEM
  "atem":                             9910,
  "atem mini":                        9910,
  "blackmagic design: atem":          9910,
  // RossTalk
  "ross_talk":                        7788,
  "ross talk":                        7788,
  "ross carbonite":                   7788,
  "ross video: rosstalk":             7788,
  // SWP-08 / Broadcast Router
  "swp08":                            8910,
  "sw8":                              8910,
  "swp8":                             8910,
  "sw-p-08":                          8910,
  "generic-swp08":                    8910,
  "generic: broadcast router":        8910,
  "generic: broadcast router sw8":    8910,
  "generic: broadcast router swp08":  8910,
  "generic: broadcast router sw-p-08":8910,
  // HTTP
  "http_api":                         80,
  "generic-http":                     80,
  "generic http":                     80,
  "generic-http requests":            80,
  "generic: http":                    80,
  "generic: http request":            80,
  "generic: http requests":           80,
  // HTTPS
  "https_api":                        443,
  "generic https":                    443,
  "generic-https":                    443,
  "generic: https requests":          443,
};

export function defaultPortForDevice(device: string): number | null {
  const key = String(device ?? "").trim().toLowerCase();
  return PORT_MAP[key] ?? null;
}

// ── Backend payload builder ───────────────────────────────────────────────────

/**
 * Converts the frontend Connection array into a keyed object suitable for
 * the Rust `api_request POST /api/connections` command.
 */
export function buildBackendConnectionsPayload(
  connections: Connection[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const connection of connections) {
    const key = connection.name.trim() || `Connection-${connection.id}`;
    const parsedPort = Number.parseInt(connection.port, 10);
    const fallbackPort = defaultPortForDevice(connection.device);
    const resolvedPort =
      Number.isFinite(parsedPort) && parsedPort > 0
        ? parsedPort
        : (fallbackPort ?? connection.port);

    const entry: Record<string, unknown> = {
      id:       connection.id,
      name:     connection.name,
      host:     connection.ip.trim(),
      port:     resolvedPort,
      type:     connection.device,
      protocol: connection.protocol,
      enabled:  connection.active,
      projectId: connection.projectId,
    };

    const deviceType = String(connection.device ?? "").trim().toLowerCase();

    if (connection.fadeFramerate?.trim()) {
      const parsed = Number.parseInt(connection.fadeFramerate, 10);
      entry.framerateForFades =
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : connection.fadeFramerate.trim();
    }
    if (connection.path?.trim())         entry.path       = connection.path.trim();
    if (connection.httpBaseUrl?.trim())  entry.baseUrl    = connection.httpBaseUrl.trim();
    if (connection.httpProxyAddress?.trim()) entry.proxyAddress = connection.httpProxyAddress.trim();
    if (connection.httpUnauthorizedCertificates) {
      entry.unauthorizedCertificates = connection.httpUnauthorizedCertificates;
      entry.rejectUnauthorized = connection.httpUnauthorizedCertificates !== "accept";
    }
    if (connection.oscTransport) {
      entry.transport    = connection.oscTransport;
      entry.oscTransport = connection.oscTransport;
    }
    if (typeof connection.oscListenForFeedback === "boolean") {
      entry.listenForFeedback = connection.oscListenForFeedback;
    }
    if (connection.genericTcpTransport) {
      entry.connectWith = connection.genericTcpTransport.toUpperCase();
      entry.protocol    = connection.genericTcpTransport;
    }
    if (typeof connection.genericTcpSaveResponse === "boolean") {
      entry.saveTcpResponse = connection.genericTcpSaveResponse;
    }
    if (connection.companionDeviceId?.trim()) {
      entry.deviceId = connection.companionDeviceId.trim();
      entry.satelliteDeviceId = connection.companionDeviceId.trim();
    }
    if (typeof connection.companionColumns === "number" && Number.isFinite(connection.companionColumns)) {
      entry.columns = connection.companionColumns;
      entry.numberOfColumns = connection.companionColumns;
    }
    if (typeof connection.companionRows === "number" && Number.isFinite(connection.companionRows)) {
      entry.rows = connection.companionRows;
      entry.numberOfRows = connection.companionRows;
    }
    if (connection.companionBitmapResolution) {
      entry.bitmapResolution = connection.companionBitmapResolution;
      entry.resolution = connection.companionBitmapResolution;
    }
    if (connection.username?.trim())  entry.username   = connection.username.trim();
    if (connection.oscPrefix?.trim()) entry.oscPrefix  = connection.oscPrefix.trim();
    if (connection.password)          entry.password   = connection.password;
    if (connection.bonjourHost?.trim()) entry.bonjourHost = connection.bonjourHost.trim();
    if (typeof connection.take === "boolean") entry.take = connection.take;

    if (typeof connection.inputCount === "number" && Number.isFinite(connection.inputCount))
      entry.inputCount = connection.inputCount;
    if (typeof connection.outputCount === "number" && Number.isFinite(connection.outputCount))
      entry.outputCount = connection.outputCount;
    if (typeof connection.monitoringCount === "number" && Number.isFinite(connection.monitoringCount))
      entry.monitoringCount = connection.monitoringCount;
    if (typeof connection.serialCount === "number" && Number.isFinite(connection.serialCount))
      entry.serialCount = connection.serialCount;

    // SWP-08 fields
    if (typeof connection.swp08Matrix === "number" && Number.isFinite(connection.swp08Matrix))
      entry.matrix = connection.swp08Matrix;
    if (typeof connection.swp08LevelCount === "number" && Number.isFinite(connection.swp08LevelCount))
      entry.levels = connection.swp08LevelCount;
    if (typeof connection.swp08TallyDump === "boolean")
      entry.tallyDump = connection.swp08TallyDump;
    if (typeof connection.swp08AdvancedVariables === "boolean")
      entry.advancedTallyRoutingVariables = connection.swp08AdvancedVariables;
    if (typeof connection.swp08RequestSupportedCommands === "boolean")
      entry.requestSupportedCommandsOnConnection = connection.swp08RequestSupportedCommands;
    if (typeof connection.swp08RequestNamesOnConnect === "boolean")
      entry.requestNamesOnConnection = connection.swp08RequestNamesOnConnect;
    if (typeof connection.swp08ExtendedCommands === "boolean")
      entry.useExtendedCommands = connection.swp08ExtendedCommands;
    if (typeof connection.swp08RequestNameLength === "number" && Number.isFinite(connection.swp08RequestNameLength))
      entry.requestNameLength = connection.swp08RequestNameLength;

    // SWP-08 Companion compatibility aliases
    if (deviceType === "swp08") {
      if (typeof connection.swp08Matrix === "number" && Number.isFinite(connection.swp08Matrix))
        entry.matrixNumber = connection.swp08Matrix;
      if (typeof connection.swp08LevelCount === "number" && Number.isFinite(connection.swp08LevelCount))
        entry.numberOfLevels = connection.swp08LevelCount;
      if (typeof connection.swp08TallyDump === "boolean")
        entry.supportsTallyDump = connection.swp08TallyDump;
      if (typeof connection.swp08RequestSupportedCommands === "boolean")
        entry.requestSupportedCommands = connection.swp08RequestSupportedCommands;
      if (typeof connection.swp08RequestNamesOnConnect === "boolean")
        entry.requestNames = connection.swp08RequestNamesOnConnect;
      if (typeof connection.swp08ExtendedCommands === "boolean")
        entry.useExtendedCommandSet = connection.swp08ExtendedCommands;
      if (typeof connection.swp08RequestNameLength === "number" && Number.isFinite(connection.swp08RequestNameLength))
        entry.nameLength = connection.swp08RequestNameLength;
    }

    if (deviceType === "resolume") {
      entry.healthCheck = { protocol: "tcp", port: 8080 };
    }

    if (deviceType === "atem") {
      if (connection.atemModel) entry.atemModel = connection.atemModel;
      if (connection.atemModelLabel) entry.model = connection.atemModelLabel;
      if (typeof connection.atemMeCount === "number" && Number.isFinite(connection.atemMeCount)) {
        entry.atemMeCount = connection.atemMeCount;
        entry.mixEffects = connection.atemMeCount;
      }
      if (typeof connection.atemUskCount === "number" && Number.isFinite(connection.atemUskCount)) {
        entry.atemUskCount = connection.atemUskCount;
        entry.upstreamKeyers = connection.atemUskCount;
      }
      if (typeof connection.atemDskCount === "number" && Number.isFinite(connection.atemDskCount)) {
        entry.atemDskCount = connection.atemDskCount;
        entry.downstreamKeyers = connection.atemDskCount;
      }
      if (typeof connection.atemMultiviewerCount === "number" && Number.isFinite(connection.atemMultiviewerCount)) {
        entry.atemMultiviewerCount = connection.atemMultiviewerCount;
        entry.multiviewers = connection.atemMultiviewerCount;
      }
      if (typeof connection.atemMultiviewerWindowCount === "number" && Number.isFinite(connection.atemMultiviewerWindowCount)) {
        entry.atemMultiviewerWindowCount = connection.atemMultiviewerWindowCount;
      }
      if (typeof connection.atemMediaPlayerCount === "number" && Number.isFinite(connection.atemMediaPlayerCount)) {
        entry.atemMediaPlayerCount = connection.atemMediaPlayerCount;
        entry.mediaPlayers = connection.atemMediaPlayerCount;
      }
      if (typeof connection.atemSuperSourceCount === "number" && Number.isFinite(connection.atemSuperSourceCount)) {
        entry.atemSuperSourceCount = connection.atemSuperSourceCount;
        entry.superSources = connection.atemSuperSourceCount;
      }
      if (typeof connection.atemAuxCount === "number" && Number.isFinite(connection.atemAuxCount)) {
        entry.atemAuxCount = connection.atemAuxCount;
        entry.outputCount = connection.atemAuxCount;
      }
      if (typeof connection.atemInputCount === "number" && Number.isFinite(connection.atemInputCount)) {
        entry.atemInputCount = connection.atemInputCount;
        entry.inputCount = connection.atemInputCount;
      }
    }

    if (deviceType === "ross_talk") {
      entry.model     = connection.rossTalkModel ?? "carbonite";
      entry.keepAlive = Boolean(connection.rossTalkKeepAlive);
    }

    payload[key] = entry;
  }

  return payload;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toBooleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeOscTransport(
  value: unknown,
): Connection["oscTransport"] | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "udp" || normalized === "tcp" || normalized === "tcp_raw") {
    return normalized as Connection["oscTransport"];
  }
  return undefined;
}

function normalizeGenericTcpTransport(
  value: unknown,
): Connection["genericTcpTransport"] | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "tcp" || normalized === "udp") {
    return normalized as Connection["genericTcpTransport"];
  }
  return undefined;
}

function normalizeRossTalkModel(
  value: unknown,
): Connection["rossTalkModel"] | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "carbonite" ||
    normalized === "ultrix" ||
    normalized === "acuity" ||
    normalized === "opengear"
  ) {
    return normalized as Connection["rossTalkModel"];
  }
  return undefined;
}

function normalizeUnauthorizedCertificates(
  value: unknown,
  rejectUnauthorized: unknown,
): Connection["httpUnauthorizedCertificates"] | undefined {
  if (value === "accept" || rejectUnauthorized === false) return "accept";
  if (value === "reject") return "reject";
  return undefined;
}

function toConnectionPort(value: unknown, device: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value);
  }
  const trimmed = toOptionalString(value);
  if (trimmed) return trimmed;
  const fallbackPort = defaultPortForDevice(device);
  return fallbackPort ? String(fallbackPort) : "";
}

export function parseBackendConnectionsPayload(raw: unknown): Connection[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }

  return Object.entries(raw as Record<string, unknown>)
    .map(([fallbackName, value], index) => {
      const entry =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      const device =
        toOptionalString(entry.type) ??
        toOptionalString(entry.device) ??
        "generic_tcp";
      const protocol = toOptionalString(entry.protocol) ?? "tcp";
      const projectIdValue = toNumberOrUndefined(entry.projectId);
      const httpUnauthorizedCertificates = normalizeUnauthorizedCertificates(
        entry.unauthorizedCertificates,
        entry.rejectUnauthorized,
      );

      return {
        id: toNumberOrUndefined(entry.id) ?? index + 1,
        name: toOptionalString(entry.name) ?? fallbackName,
        ip: toOptionalString(entry.host) ?? toOptionalString(entry.ip) ?? "",
        port: toConnectionPort(entry.port, device),
        fadeFramerate:
          toOptionalString(entry.fadeFramerate) ??
          toOptionalString(entry.framerateForFades),
        atemModel: toOptionalString(entry.atemModel),
        atemModelLabel: toOptionalString(entry.atemModelLabel) ?? toOptionalString(entry.model),
        atemMeCount:
          toNumberOrUndefined(entry.atemMeCount) ??
          toNumberOrUndefined(entry.mixEffects),
        atemUskCount:
          toNumberOrUndefined(entry.atemUskCount) ??
          toNumberOrUndefined(entry.upstreamKeyers),
        atemDskCount:
          toNumberOrUndefined(entry.atemDskCount) ??
          toNumberOrUndefined(entry.downstreamKeyers),
        atemMultiviewerCount:
          toNumberOrUndefined(entry.atemMultiviewerCount) ??
          toNumberOrUndefined(entry.multiviewers),
        atemMultiviewerWindowCount: toNumberOrUndefined(entry.atemMultiviewerWindowCount),
        atemMediaPlayerCount:
          toNumberOrUndefined(entry.atemMediaPlayerCount) ??
          toNumberOrUndefined(entry.mediaPlayers),
        atemSuperSourceCount:
          toNumberOrUndefined(entry.atemSuperSourceCount) ??
          toNumberOrUndefined(entry.superSources),
        atemAuxCount:
          toNumberOrUndefined(entry.atemAuxCount) ??
          toNumberOrUndefined(entry.outputCount),
        atemInputCount:
          toNumberOrUndefined(entry.atemInputCount) ??
          toNumberOrUndefined(entry.inputCount),
        mixEffects: toNumberOrUndefined(entry.mixEffects),
        upstreamKeyers: toNumberOrUndefined(entry.upstreamKeyers),
        downstreamKeyers: toNumberOrUndefined(entry.downstreamKeyers),
        multiviewers: toNumberOrUndefined(entry.multiviewers),
        mediaPlayers: toNumberOrUndefined(entry.mediaPlayers),
        protocol,
        device,
        path: toOptionalString(entry.path) ?? "",
        username: toOptionalString(entry.username),
        oscPrefix: toOptionalString(entry.oscPrefix),
        password: toOptionalString(entry.password),
        bonjourHost: toOptionalString(entry.bonjourHost),
        take: toBooleanOrUndefined(entry.take),
        inputCount: toNumberOrUndefined(entry.inputCount),
        outputCount: toNumberOrUndefined(entry.outputCount),
        monitoringCount: toNumberOrUndefined(entry.monitoringCount),
        serialCount: toNumberOrUndefined(entry.serialCount),
        swp08Matrix:
          toNumberOrUndefined(entry.swp08Matrix) ??
          toNumberOrUndefined(entry.matrixNumber) ??
          toNumberOrUndefined(entry.matrix),
        swp08LevelCount:
          toNumberOrUndefined(entry.swp08LevelCount) ??
          toNumberOrUndefined(entry.numberOfLevels) ??
          toNumberOrUndefined(entry.levels),
        swp08TallyDump:
          toBooleanOrUndefined(entry.swp08TallyDump) ??
          toBooleanOrUndefined(entry.tallyDump) ??
          toBooleanOrUndefined(entry.supportsTallyDump),
        swp08AdvancedVariables:
          toBooleanOrUndefined(entry.swp08AdvancedVariables) ??
          toBooleanOrUndefined(entry.advancedTallyRoutingVariables),
        swp08RequestSupportedCommands:
          toBooleanOrUndefined(entry.swp08RequestSupportedCommands) ??
          toBooleanOrUndefined(entry.requestSupportedCommandsOnConnection) ??
          toBooleanOrUndefined(entry.requestSupportedCommands),
        swp08RequestNamesOnConnect:
          toBooleanOrUndefined(entry.swp08RequestNamesOnConnect) ??
          toBooleanOrUndefined(entry.requestNamesOnConnection) ??
          toBooleanOrUndefined(entry.requestNames),
        swp08ExtendedCommands:
          toBooleanOrUndefined(entry.swp08ExtendedCommands) ??
          toBooleanOrUndefined(entry.useExtendedCommands) ??
          toBooleanOrUndefined(entry.useExtendedCommandSet),
        swp08RequestNameLength:
          toNumberOrUndefined(entry.swp08RequestNameLength) ??
          toNumberOrUndefined(entry.requestNameLength) ??
          toNumberOrUndefined(entry.nameLength),
        httpBaseUrl:
          toOptionalString(entry.httpBaseUrl) ??
          toOptionalString(entry.baseUrl),
        httpProxyAddress:
          toOptionalString(entry.httpProxyAddress) ??
          toOptionalString(entry.proxyAddress),
        httpUnauthorizedCertificates,
        oscTransport:
          normalizeOscTransport(entry.oscTransport) ??
          normalizeOscTransport(entry.transport),
        oscListenForFeedback:
          toBooleanOrUndefined(entry.oscListenForFeedback) ??
          toBooleanOrUndefined(entry.listenForFeedback),
        genericTcpTransport:
          normalizeGenericTcpTransport(entry.genericTcpTransport) ??
          normalizeGenericTcpTransport(entry.connectWith) ??
          (device === "generic_tcp"
            ? normalizeGenericTcpTransport(protocol)
            : undefined),
        genericTcpSaveResponse:
          toBooleanOrUndefined(entry.genericTcpSaveResponse) ??
          toBooleanOrUndefined(entry.saveTcpResponse),
        companionDeviceId:
          toOptionalString(entry.companionDeviceId) ??
          toOptionalString(entry.deviceId) ??
          toOptionalString(entry.satelliteDeviceId),
        companionColumns:
          toNumberOrUndefined(entry.companionColumns) ??
          toNumberOrUndefined(entry.columns) ??
          toNumberOrUndefined(entry.numberOfColumns) ??
          toNumberOrUndefined(entry.columnCount),
        companionRows:
          toNumberOrUndefined(entry.companionRows) ??
          toNumberOrUndefined(entry.rows) ??
          toNumberOrUndefined(entry.numberOfRows) ??
          toNumberOrUndefined(entry.rowCount),
        companionBitmapResolution:
          String(
            toOptionalString(entry.companionBitmapResolution) ??
            toOptionalString(entry.bitmapResolution) ??
            toOptionalString(entry.resolution) ??
            "",
          ).trim().toLowerCase() === "high"
            ? "high"
            : String(
              toOptionalString(entry.companionBitmapResolution) ??
              toOptionalString(entry.bitmapResolution) ??
              toOptionalString(entry.resolution) ??
              "",
            ).trim().toLowerCase() === "low"
              ? "low"
              : undefined,
        rossTalkModel:
          normalizeRossTalkModel(entry.rossTalkModel) ??
          normalizeRossTalkModel(entry.model),
        rossTalkKeepAlive:
          toBooleanOrUndefined(entry.rossTalkKeepAlive) ??
          toBooleanOrUndefined(entry.keepAlive),
        active:
          toBooleanOrUndefined(entry.active) ??
          toBooleanOrUndefined(entry.enabled) ??
          false,
        projectId: projectIdValue ?? null,
      };
    })
    .sort((a, b) => a.id - b.id);
}
