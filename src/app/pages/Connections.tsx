import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ToggleRight,
  ToggleLeft,
  Pencil,
  Trash2,
  ChevronDown,
  X,
} from "lucide-react";
import {
  useAppContext,
  useTheme,
  type Connection,
  type AppTheme,
} from "../context/AppContext";
import { saveConnections as persistConnectionsToRuntime } from "../services/runtimeState";
import { isTauri } from "../services/tauri";
import { createNumericId } from "../services/ids";
import {
  ATEM_MODEL_PROFILES,
  DEFAULT_ATEM_MODEL_ID,
  getAtemModelProfile,
  normalizeAtemModelId,
} from "../services/atemModels";
import { APP_THEME_PALETTE } from "../styles/palette";

const P = APP_THEME_PALETTE;

const DEVICE_OPTIONS = [
  "x32",
  "companion_remote",
  "atem",
  "videohub",
  "swp08",
  "http_api",
  "generic_osc",
  "generic_tcp",
  "grandma2",
  "grandma3",
  "obs",
  "resolume",
  "ross_talk",
  "ross_xpression",
  "vmix",
] as const;

const PROTOCOL_OPTIONS = ["udp", "tcp", "http", "ws", "wss"] as const;
const ACCEPTED_PROTOCOLS = ["osc", "udp", "tcp", "http", "https", "ws", "wss"] as const;

type DeviceType = (typeof DEVICE_OPTIONS)[number];
type ProtocolType = (typeof ACCEPTED_PROTOCOLS)[number];

const DEVICE_SET = new Set<string>(DEVICE_OPTIONS);
const PROTOCOL_SET = new Set<string>(ACCEPTED_PROTOCOLS);

const DEVICE_LABELS: Record<DeviceType, string> = {
  x32: "Behringer/Midas: X32/M32",
  companion_remote: "Bitfocus: Companion Remote",
  atem: "Blackmagic Design: ATEM",
  videohub: "Blackmagic Design: Videohub",
  swp08: "Generic: Broadcast Router",
  http_api: "Generic: HTTP Requests",
  generic_osc: "Generic: OSC",
  generic_tcp: "Generic: TCP and UDP Requests",
  grandma2: "MA Lighting: GrandMA2",
  grandma3: "MA Lighting: GrandMA3",
  obs: "OBS: Studio",
  resolume: "Resolume: Arena",
  ross_talk: "Ross Video: Rosstalk",
  ross_xpression: "Ross Video: Xpression",
  vmix: "StudioCoast: vMix",
};

const DEFAULT_PROTOCOL_BY_TYPE: Record<DeviceType, ProtocolType> = {
  x32: "osc",
  companion_remote: "tcp",
  atem: "udp",
  videohub: "tcp",
  swp08: "tcp",
  http_api: "http",
  generic_osc: "osc",
  generic_tcp: "tcp",
  grandma2: "tcp",
  grandma3: "osc",
  obs: "ws",
  resolume: "osc",
  ross_talk: "tcp",
  ross_xpression: "tcp",
  vmix: "tcp",
};

const LEGACY_DEVICE_ALIASES: Record<string, DeviceType> = {
  "grandma 2": "grandma2",
  "grandma 3": "grandma3",
  "behringer/midas: x32/m32": "x32",
  "bitfocus: companion remote": "companion_remote",
  "blackmagic design: atem": "atem",
  "blackmagic design: videohub": "videohub",
  "generic: broadcast router": "swp08",
  "generic: broadcast router sw8": "swp08",
  "generic: broadcast router swp08": "swp08",
  "generic: broadcast router sw-p-08": "swp08",
  "generic sw8": "swp08",
  "generic swp08": "swp08",
  "generic-swp08": "swp08",
  sw8: "swp08",
  swp8: "swp08",
  "sw-p-08": "swp08",
  "sw p 08": "swp08",
  "generic: http requests": "http_api",
  "generic: https requests": "http_api",
  "generic https": "http_api",
  "generic-https": "http_api",
  https_api: "http_api",
  "generic http": "http_api",
  "generic-http": "http_api",
  "generic-http requests": "http_api",
  "generic: http request": "http_api",
  "generic: http": "http_api",
  "generic: osc": "generic_osc",
  "generic: tcp and udp requests": "generic_tcp",
  "ma lighting: grandma2": "grandma2",
  "ma lighting: grandma3": "grandma3",
  "obs: studio": "obs",
  "resolume: arena": "resolume",
  "ross video: rosstalk": "ross_talk",
  "ross video: xpression": "ross_xpression",
  "studiocoast: vmix": "vmix",
  "obs studio": "obs",
  "resolume arena": "resolume",
  "atem mini": "atem",
  "companion remote": "companion_remote",
  "ross talk": "ross_talk",
  "ross carbonite": "ross_talk",
  "ross xpression": "ross_xpression",
  audio_mixer: "generic_osc",
  generic_udp: "generic_tcp",
  casparcg: "generic_tcp",
  wirecast: "generic_tcp",
  other: "generic_tcp",
};

const LEGACY_PROTOCOL_ALIASES: Record<string, ProtocolType> = {
  "tcp api": "tcp",
  websocket: "ws",
  midi: "tcp",
  other: "tcp",
};

const DEFAULT_PORT_BY_TYPE: Partial<Record<DeviceType, string>> = {
  grandma2: "30000",
  grandma3: "8000",
  resolume: "7000",
  vmix: "8099",
  http_api: "80",
  obs: "4455",
  companion_remote: "16622",
  atem: "9910",
  videohub: "9990",
  swp08: "8910",
  generic_tcp: "7000",
  ross_talk: "7788",
  ross_xpression: "7788",
  generic_osc: "8000",
  x32: "10023",
};

function normalizeDeviceType(input: string | undefined): DeviceType {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return "generic_tcp";
  if (DEVICE_SET.has(raw)) return raw as DeviceType;
  return LEGACY_DEVICE_ALIASES[raw] ?? "generic_tcp";
}

function normalizeProtocol(input: string | undefined, type: DeviceType): ProtocolType {
  const raw = String(input ?? "").trim().toLowerCase();
  if (PROTOCOL_SET.has(raw)) return raw as ProtocolType;
  if (LEGACY_PROTOCOL_ALIASES[raw]) return LEGACY_PROTOCOL_ALIASES[raw];
  return DEFAULT_PROTOCOL_BY_TYPE[type];
}

function getDefaultPort(type: DeviceType): string {
  return DEFAULT_PORT_BY_TYPE[type] ?? "";
}

function getConnectionTypeReferenceLabel(device: string): string {
  const normalized = normalizeDeviceType(device);
  const fullLabel = DEVICE_LABELS[normalized] ?? device;
  const splitIndex = fullLabel.indexOf(":");
  if (splitIndex >= 0) {
    return fullLabel.slice(splitIndex + 1).trim();
  }
  return fullLabel.trim() || "Unknown";
}

const VIDEOHUB_COUNT_MAX = 288;
const VIDEOHUB_DEFAULT_INPUT_COUNT = 12;
const VIDEOHUB_DEFAULT_OUTPUT_COUNT = 12;
const VIDEOHUB_DEFAULT_MONITORING_COUNT = 0;
const VIDEOHUB_DEFAULT_SERIAL_COUNT = 0;
const SWP08_DEFAULT_MATRIX = 1;
const SWP08_DEFAULT_LEVELS = 3;
const SWP08_NORMAL_MAX_MATRIX = 1024;
const SWP08_EXTENDED_MAX_MATRIX = 65536;
const SWP08_NORMAL_MAX_LEVELS = 16;
const SWP08_EXTENDED_MAX_LEVELS = 256;
const SWP08_DEFAULT_NAME_LENGTH = 8;
const SWP08_NAME_LENGTH_OPTIONS = [4, 8, 12, 16] as const;
const COMPANION_REMOTE_DEFAULT_COLUMNS = 8;
const COMPANION_REMOTE_DEFAULT_ROWS = 4;
const COMPANION_REMOTE_MIN_GRID = 1;
const COMPANION_REMOTE_MAX_GRID = 32;
const ROSS_TALK_MODEL_OPTIONS = [
  { value: "carbonite", label: "Carbonite/Graphite" },
  { value: "ultrix", label: "Ultrix" },
  { value: "acuity", label: "Acuity/Vision" },
  { value: "opengear", label: "openGear" },
] as const;
const OSC_TRANSPORT_OPTIONS = [
  { value: "udp", label: "UDP (Default)" },
  { value: "tcp", label: "TCP" },
  { value: "tcp_raw", label: "TCP (Raw)" },
] as const;
const GENERIC_TCP_TRANSPORT_OPTIONS = [
  { value: "tcp", label: "TCP" },
  { value: "udp", label: "UDP" },
] as const;

function clampVideohubCount(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(VIDEOHUB_COUNT_MAX, Math.trunc(value)));
}

function toVideohubCountString(value: number | undefined, fallback: number): string {
  if (typeof value !== "number") return String(fallback);
  return String(clampVideohubCount(value, fallback));
}

function parseVideohubCount(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return clampVideohubCount(parsed, fallback);
}

function parseIntegerOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseBonjourHostIp(bonjourHost: string): string {
  const trimmed = bonjourHost.trim();
  if (!trimmed) return "";
  return trimmed.split(":")[0]?.trim() ?? "";
}

type UiFieldKey =
  | "name"
  | "host"
  | "port"
  | "fadeFramerate"
  | "type"
  | "protocol"
  | "path"
  | "username"
  | "oscPrefix"
  | "password";

type FieldUiConfig = {
  title: string;
  labels: Record<UiFieldKey, string>;
  placeholders: Record<UiFieldKey, string>;
  hiddenFields: UiFieldKey[];
  lockedProtocol: "" | ProtocolType;
};

type FieldUiOverrides = {
  title?: string;
  labels?: Partial<Record<UiFieldKey, string>>;
  placeholders?: Partial<Record<UiFieldKey, string>>;
  hiddenFields?: UiFieldKey[];
  lockedProtocol?: ProtocolType;
};

const DEFAULT_FIELD_UI: FieldUiConfig = {
  title: "Connection configuration",
  labels: {
    name: "Name",
    host: "Host / IP",
    port: "Port",
    fadeFramerate: "Framerate for fades",
    type: "Connection",
    protocol: "Protocol",
    path: "Path (optional)",
    username: "Username (optional)",
    oscPrefix: "OSC Prefix (optional)",
    password: "Password (optional)",
  },
  placeholders: {
    name: "Name",
    host: "Host IP",
    port: "Port",
    fadeFramerate: "10",
    type: "",
    protocol: "",
    path: "/api",
    username: "Username",
    oscPrefix: "/cmd",
    password: "Password",
  },
  hiddenFields: [],
  lockedProtocol: "",
};

const TYPE_FIELD_UI: Partial<Record<DeviceType, FieldUiOverrides>> = {
  vmix: {
    title: "vMix configuration",
    labels: {
      host: "Server IP",
      port: "Server TCP Port",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "8099",
    },
    hiddenFields: ["path", "oscPrefix", "password"],
    lockedProtocol: "tcp",
  },
  grandma2: {
    title: "GrandMA2 configuration",
    labels: {
      name: "Label",
      host: "grandMA2 Console IP",
      port: "Console Telnet Port",
      username: "Username",
      password: "Password",
    },
    placeholders: {
      name: "grandma2",
      host: "192.168.0.1",
      port: "30000",
      username: "administrator",
      password: "admin",
    },
    hiddenFields: ["path", "oscPrefix"],
    lockedProtocol: "tcp",
  },
  grandma3: {
    title: "GrandMA3 configuration",
    labels: {
      name: "Label",
      host: "Console IP",
      port: "Console OSC Port",
      oscPrefix: "Console OSC Prefix",
    },
    placeholders: {
      name: "GrandMA3",
      host: "127.0.0.1",
      port: "8000",
      oscPrefix: "/cmd",
    },
    hiddenFields: ["path", "username", "password"],
    lockedProtocol: "osc",
  },
  resolume: {
    title: "Resolume configuration",
    labels: {
      host: "Server IP",
      port: "Server OSC Port",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "7000",
    },
    hiddenFields: ["path", "oscPrefix", "password"],
    lockedProtocol: "osc",
  },
  obs: {
    title: "OBS WebSocket configuration",
    labels: {
      host: "Server IP",
      port: "Server Port",
      password: "Server Password",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "4455",
      password: "Server Password",
    },
    hiddenFields: ["path", "oscPrefix"],
    lockedProtocol: "ws",
  },
  companion_remote: {
    title: "Companion Satellite configuration",
    labels: {
      host: "Target IP/Hostname",
      port: "Target Port",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "16622",
    },
    hiddenFields: ["protocol", "path", "oscPrefix", "password"],
    lockedProtocol: "tcp",
  },
  http_api: {
    title: "Generic HTTP Requests configuration",
    labels: {
      host: "Base URL Host / IP",
      port: "Base URL Port",
      path: "Base URL Path (optional)",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "80",
      path: "/",
    },
    hiddenFields: ["protocol", "username", "oscPrefix", "password"],
    lockedProtocol: "http",
  },
  atem: {
    title: "ATEM configuration",
    labels: {
      host: "Switcher IP",
      port: "Control Port",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "9910",
    },
    hiddenFields: ["protocol", "path", "username", "oscPrefix", "password"],
    lockedProtocol: "udp",
  },
  videohub: {
    title: "BMD Videohub configuration",
    labels: {
      host: "Videohub IP",
    },
    placeholders: {
      host: "192.168.10.150",
    },
    hiddenFields: ["port", "protocol", "path", "username", "oscPrefix", "password"],
    lockedProtocol: "tcp",
  },
  swp08: {
    title: "Generic Broadcast Router configuration",
    labels: {
      host: "Router IP",
      port: "Control Port",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "8910",
    },
    hiddenFields: ["path", "oscPrefix", "password"],
    lockedProtocol: "tcp",
  },
  ross_talk: {
    title: "RossTalk configuration",
    labels: {
      host: "Switcher IP",
      port: "RossTalk Port",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "7788",
    },
    hiddenFields: ["path", "oscPrefix", "password"],
    lockedProtocol: "tcp",
  },
  ross_xpression: {
    title: "XPression configuration",
    labels: {
      host: "XPression IP",
      port: "XPression Port",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "7788",
    },
    hiddenFields: ["protocol", "path", "username", "oscPrefix", "password"],
    lockedProtocol: "tcp",
  },
  generic_osc: {
    title: "Generic OSC configuration",
    labels: {
      host: "Target Hostname or IP",
      port: "Target Port",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "8000",
    },
    hiddenFields: ["protocol", "path", "username", "oscPrefix", "password"],
  },
  generic_tcp: {
    title: "Generic TCP and UDP Requests configuration",
    labels: {
      host: "Target Host name or IP",
      port: "Target Port",
    },
    placeholders: {
      host: "127.0.0.1",
      port: "7000",
    },
    hiddenFields: ["protocol", "path", "username", "oscPrefix", "password"],
  },
  x32: {
    title: "Behringer/Midas X32/M32 configuration",
    labels: {
      host: "Target IP",
      fadeFramerate: "Framerate for fades",
    },
    placeholders: {
      host: "",
      fadeFramerate: "10",
    },
    hiddenFields: ["port", "path", "oscPrefix", "password"],
    lockedProtocol: "osc",
  },
};

function mergeFieldUi(type: DeviceType): FieldUiConfig {
  const override = TYPE_FIELD_UI[type];
  return {
    title: override?.title ?? DEFAULT_FIELD_UI.title,
    labels: {
      ...DEFAULT_FIELD_UI.labels,
      ...(override?.labels ?? {}),
    },
    placeholders: {
      ...DEFAULT_FIELD_UI.placeholders,
      ...(override?.placeholders ?? {}),
    },
    hiddenFields: Array.isArray(override?.hiddenFields)
      ? override.hiddenFields
      : [],
    lockedProtocol: override?.lockedProtocol ?? "",
  };
}

type FormState = {
  name: string;
  ip: string;
  port: string;
  fadeFramerate: string;
  atemModel: string;
  companionDeviceId: string;
  companionColumns: string;
  companionRows: string;
  companionBitmapResolution: "low" | "high";
  device: DeviceType;
  protocol: ProtocolType;
  path: string;
  username: string;
  oscPrefix: string;
  password: string;
  bonjourHost: string;
  take: boolean;
  inputCount: string;
  outputCount: string;
  monitoringCount: string;
  serialCount: string;
  httpBaseUrl: string;
  httpProxyAddress: string;
  httpUnauthorizedCertificates: "reject" | "accept";
  oscTransport: "udp" | "tcp" | "tcp_raw";
  oscListenForFeedback: boolean;
  genericTcpTransport: "tcp" | "udp";
  genericTcpSaveResponse: boolean;
  rossTalkModel: "carbonite" | "ultrix" | "acuity" | "opengear";
  rossTalkKeepAlive: boolean;
  swp08Matrix: string;
  swp08LevelCount: string;
  swp08TallyDump: boolean;
  swp08AdvancedVariables: boolean;
  swp08RequestSupportedCommands: boolean;
  swp08RequestNamesOnConnect: boolean;
  swp08ExtendedCommands: boolean;
  swp08RequestNameLength: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  ip: "",
  port: "",
  fadeFramerate: "",
  atemModel: DEFAULT_ATEM_MODEL_ID,
  companionDeviceId: "",
  companionColumns: String(COMPANION_REMOTE_DEFAULT_COLUMNS),
  companionRows: String(COMPANION_REMOTE_DEFAULT_ROWS),
  companionBitmapResolution: "low",
  device: "generic_tcp",
  protocol: DEFAULT_PROTOCOL_BY_TYPE.generic_tcp,
  path: "",
  username: "",
  oscPrefix: "",
  password: "",
  bonjourHost: "",
  take: false,
  inputCount: String(VIDEOHUB_DEFAULT_INPUT_COUNT),
  outputCount: String(VIDEOHUB_DEFAULT_OUTPUT_COUNT),
  monitoringCount: String(VIDEOHUB_DEFAULT_MONITORING_COUNT),
  serialCount: String(VIDEOHUB_DEFAULT_SERIAL_COUNT),
  httpBaseUrl: "",
  httpProxyAddress: "",
  httpUnauthorizedCertificates: "reject",
  oscTransport: "udp",
  oscListenForFeedback: false,
  genericTcpTransport: "tcp",
  genericTcpSaveResponse: false,
  rossTalkModel: "carbonite",
  rossTalkKeepAlive: false,
  swp08Matrix: String(SWP08_DEFAULT_MATRIX),
  swp08LevelCount: String(SWP08_DEFAULT_LEVELS),
  swp08TallyDump: false,
  swp08AdvancedVariables: false,
  swp08RequestSupportedCommands: true,
  swp08RequestNamesOnConnect: false,
  swp08ExtendedCommands: false,
  swp08RequestNameLength: String(SWP08_DEFAULT_NAME_LENGTH),
};

function buildFormFromConnection(conn: Connection): FormState {
  const rawConn = conn as Connection & Record<string, unknown>;
  const device = normalizeDeviceType(conn.device);
  const atemModel = device === "atem"
    ? normalizeAtemModelId(
      conn.atemModel ??
      (typeof rawConn.atemModel === "string" ? rawConn.atemModel : undefined) ??
      conn.atemModelLabel ??
      (typeof rawConn.model === "string" ? rawConn.model : undefined),
    )
    : DEFAULT_ATEM_MODEL_ID;
  const ui = mergeFieldUi(device);
  const protocol = ui.lockedProtocol || normalizeProtocol(conn.protocol, device);
  const defaultPort = getDefaultPort(device);
  const resolvedPort = device === "ross_xpression" ? "7788" : (conn.port || defaultPort);

  return {
    name: conn.name,
    ip: conn.ip || parseBonjourHostIp(conn.bonjourHost ?? ""),
    port: resolvedPort,
    fadeFramerate: conn.fadeFramerate ?? (device === "x32" ? "10" : ""),
    atemModel,
    companionDeviceId:
      conn.companionDeviceId ??
      (typeof rawConn.deviceId === "string" ? rawConn.deviceId : "") ??
      "",
    companionColumns: String(
      conn.companionColumns ??
      parseIntegerOrUndefined(rawConn.columns) ??
      parseIntegerOrUndefined(rawConn.numberOfColumns) ??
      COMPANION_REMOTE_DEFAULT_COLUMNS,
    ),
    companionRows: String(
      conn.companionRows ??
      parseIntegerOrUndefined(rawConn.rows) ??
      parseIntegerOrUndefined(rawConn.numberOfRows) ??
      COMPANION_REMOTE_DEFAULT_ROWS,
    ),
    companionBitmapResolution:
      String(
        conn.companionBitmapResolution ??
        (typeof rawConn.bitmapResolution === "string" ? rawConn.bitmapResolution : undefined) ??
        (typeof rawConn.resolution === "string" ? rawConn.resolution : undefined) ??
        "low",
      ).trim().toLowerCase() === "high"
        ? "high"
        : "low",
    device,
    protocol,
    path: conn.path ?? "",
    username: conn.username ?? (device === "grandma2" ? "administrator" : ""),
    oscPrefix: conn.oscPrefix ?? "",
    password: conn.password ?? (device === "grandma2" ? "admin" : ""),
    bonjourHost: conn.bonjourHost ?? "",
    take: Boolean(conn.take),
    inputCount: toVideohubCountString(conn.inputCount, VIDEOHUB_DEFAULT_INPUT_COUNT),
    outputCount: toVideohubCountString(conn.outputCount, VIDEOHUB_DEFAULT_OUTPUT_COUNT),
    monitoringCount: toVideohubCountString(conn.monitoringCount, VIDEOHUB_DEFAULT_MONITORING_COUNT),
    serialCount: toVideohubCountString(conn.serialCount, VIDEOHUB_DEFAULT_SERIAL_COUNT),
    httpBaseUrl:
      conn.httpBaseUrl ??
      (typeof rawConn.baseUrl === "string" ? rawConn.baseUrl : "") ??
      "",
    httpProxyAddress:
      conn.httpProxyAddress ??
      (typeof rawConn.proxyAddress === "string" ? rawConn.proxyAddress : "") ??
      "",
    httpUnauthorizedCertificates:
      conn.httpUnauthorizedCertificates ??
      (typeof rawConn.unauthorizedCertificates === "string" &&
        rawConn.unauthorizedCertificates.toLowerCase() === "accept"
        ? "accept"
        : "reject"),
    oscTransport:
      conn.oscTransport ??
      (typeof rawConn.transport === "string"
        ? rawConn.transport.toLowerCase() === "tcp raw" || rawConn.transport.toLowerCase() === "tcp_raw"
          ? "tcp_raw"
          : rawConn.transport.toLowerCase() === "tcp"
            ? "tcp"
            : "udp"
        : "udp"),
    oscListenForFeedback:
      conn.oscListenForFeedback ??
      (typeof rawConn.listenForFeedback === "boolean" ? rawConn.listenForFeedback : false),
    genericTcpTransport:
      conn.genericTcpTransport ??
      (conn.device === "generic_tcp" && String(conn.protocol).toLowerCase() === "udp" ? "udp" : undefined) ??
      (typeof rawConn.connectWith === "string" && rawConn.connectWith.toLowerCase() === "udp" ? "udp" : "tcp"),
    genericTcpSaveResponse:
      conn.genericTcpSaveResponse ??
      (typeof rawConn.saveTcpResponse === "boolean" ? rawConn.saveTcpResponse : false),
    rossTalkModel:
      conn.rossTalkModel ??
      (typeof rawConn.model === "string" &&
        ["carbonite", "ultrix", "acuity", "opengear"].includes(rawConn.model.toLowerCase())
        ? (rawConn.model.toLowerCase() as FormState["rossTalkModel"])
        : "carbonite"),
    rossTalkKeepAlive:
      conn.rossTalkKeepAlive ??
      (typeof rawConn.keepAlive === "boolean" ? rawConn.keepAlive : false),
    swp08Matrix: String(
      conn.swp08Matrix ??
      (typeof rawConn.matrixNumber === "number" ? rawConn.matrixNumber : undefined) ??
      (typeof rawConn.matrix === "number" ? rawConn.matrix : undefined) ??
      SWP08_DEFAULT_MATRIX,
    ),
    swp08LevelCount: String(
      conn.swp08LevelCount ??
      (typeof rawConn.numberOfLevels === "number" ? rawConn.numberOfLevels : undefined) ??
      (typeof rawConn.levels === "number" ? rawConn.levels : undefined) ??
      SWP08_DEFAULT_LEVELS,
    ),
    swp08TallyDump: Boolean(
      conn.swp08TallyDump ??
      (typeof rawConn.tallyDump === "boolean" ? rawConn.tallyDump : undefined) ??
      (typeof rawConn.supportsTallyDump === "boolean" ? rawConn.supportsTallyDump : undefined),
    ),
    swp08AdvancedVariables: Boolean(
      conn.swp08AdvancedVariables ??
      (typeof rawConn.advancedTallyRoutingVariables === "boolean"
        ? rawConn.advancedTallyRoutingVariables
        : undefined),
    ),
    swp08RequestSupportedCommands:
      conn.swp08RequestSupportedCommands !== undefined
        ? Boolean(conn.swp08RequestSupportedCommands)
        : (typeof rawConn.requestSupportedCommandsOnConnection === "boolean"
          ? rawConn.requestSupportedCommandsOnConnection
          : true),
    swp08RequestNamesOnConnect: Boolean(
      conn.swp08RequestNamesOnConnect ??
      (typeof rawConn.requestNamesOnConnection === "boolean" ? rawConn.requestNamesOnConnection : undefined),
    ),
    swp08ExtendedCommands: Boolean(
      conn.swp08ExtendedCommands ??
      (typeof rawConn.useExtendedCommands === "boolean" ? rawConn.useExtendedCommands : undefined),
    ),
    swp08RequestNameLength: String(
      conn.swp08RequestNameLength ??
      (typeof rawConn.requestNameLength === "number" ? rawConn.requestNameLength : undefined) ??
      SWP08_DEFAULT_NAME_LENGTH,
    ),
  };
}

function getRossTalkConnectionFields(form: FormState) {
  if (form.device !== "ross_talk") {
    return {
      rossTalkModel: undefined,
      rossTalkKeepAlive: undefined,
    };
  }
  return {
    rossTalkModel: form.rossTalkModel,
    rossTalkKeepAlive: form.rossTalkKeepAlive,
  };
}

function getVideohubConnectionFields(form: FormState) {
  if (form.device !== "videohub") {
    return {
      bonjourHost: undefined,
      take: undefined,
      inputCount: undefined,
      outputCount: undefined,
      monitoringCount: undefined,
      serialCount: undefined,
    };
  }

  const bonjourHost = form.bonjourHost.trim();
  return {
    bonjourHost: bonjourHost || undefined,
    take: form.take,
    inputCount: parseVideohubCount(form.inputCount, VIDEOHUB_DEFAULT_INPUT_COUNT),
    outputCount: parseVideohubCount(form.outputCount, VIDEOHUB_DEFAULT_OUTPUT_COUNT),
    monitoringCount: parseVideohubCount(form.monitoringCount, VIDEOHUB_DEFAULT_MONITORING_COUNT),
    serialCount: parseVideohubCount(form.serialCount, VIDEOHUB_DEFAULT_SERIAL_COUNT),
  };
}

function getSwp08ConnectionFields(form: FormState) {
  if (form.device !== "swp08") {
    return {
      swp08Matrix: undefined,
      swp08LevelCount: undefined,
      swp08TallyDump: undefined,
      swp08AdvancedVariables: undefined,
      swp08RequestSupportedCommands: undefined,
      swp08RequestNamesOnConnect: undefined,
      swp08ExtendedCommands: undefined,
      swp08RequestNameLength: undefined,
    };
  }

  const parseNumber = (raw: string, fallback: number, min: number, max: number) => {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  };
  const matrixMax = form.swp08ExtendedCommands ? SWP08_EXTENDED_MAX_MATRIX : SWP08_NORMAL_MAX_MATRIX;
  const levelMax = form.swp08ExtendedCommands ? SWP08_EXTENDED_MAX_LEVELS : SWP08_NORMAL_MAX_LEVELS;

  return {
    swp08Matrix: parseNumber(form.swp08Matrix, SWP08_DEFAULT_MATRIX, 1, matrixMax),
    swp08LevelCount: parseNumber(form.swp08LevelCount, SWP08_DEFAULT_LEVELS, 1, levelMax),
    swp08TallyDump: form.swp08TallyDump,
    swp08AdvancedVariables: form.swp08AdvancedVariables,
    swp08RequestSupportedCommands: form.swp08RequestSupportedCommands,
    swp08RequestNamesOnConnect: form.swp08RequestNamesOnConnect,
    swp08ExtendedCommands: form.swp08ExtendedCommands,
    swp08RequestNameLength: parseNumber(form.swp08RequestNameLength, SWP08_DEFAULT_NAME_LENGTH, 1, 64),
  };
}

function getHttpConnectionFields(form: FormState) {
  if (form.device !== "http_api") {
    return {
      httpBaseUrl: undefined,
      httpProxyAddress: undefined,
      httpUnauthorizedCertificates: undefined,
    };
  }
  return {
    httpBaseUrl: form.httpBaseUrl.trim() || undefined,
    httpProxyAddress: form.httpProxyAddress.trim() || undefined,
    httpUnauthorizedCertificates: form.httpUnauthorizedCertificates,
  };
}

function getOscConnectionFields(form: FormState) {
  if (form.device !== "generic_osc") {
    return {
      oscTransport: undefined,
      oscListenForFeedback: undefined,
    };
  }
  return {
    oscTransport: form.oscTransport,
    oscListenForFeedback: form.oscListenForFeedback,
  };
}

function getGenericTcpConnectionFields(form: FormState) {
  if (form.device !== "generic_tcp") {
    return {
      genericTcpTransport: undefined,
      genericTcpSaveResponse: undefined,
    };
  }
  return {
    genericTcpTransport: form.genericTcpTransport,
    genericTcpSaveResponse: form.genericTcpTransport === "tcp" ? form.genericTcpSaveResponse : false,
  };
}

function getCompanionRemoteConnectionFields(form: FormState) {
  if (form.device !== "companion_remote") {
    return {
      companionDeviceId: undefined,
      companionColumns: undefined,
      companionRows: undefined,
      companionBitmapResolution: undefined,
    };
  }

  const parseGrid = (raw: string, fallback: number) => {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(COMPANION_REMOTE_MIN_GRID, Math.min(COMPANION_REMOTE_MAX_GRID, parsed));
  };

  return {
    companionDeviceId: form.companionDeviceId.trim() || undefined,
    companionColumns: parseGrid(form.companionColumns, COMPANION_REMOTE_DEFAULT_COLUMNS),
    companionRows: parseGrid(form.companionRows, COMPANION_REMOTE_DEFAULT_ROWS),
    companionBitmapResolution: form.companionBitmapResolution === "high" ? "high" : "low",
  };
}

function getAtemConnectionFields(form: FormState) {
  if (form.device !== "atem") {
    return {
      atemModel: undefined,
      atemModelLabel: undefined,
      atemMeCount: undefined,
      atemUskCount: undefined,
      atemDskCount: undefined,
      atemMultiviewerCount: undefined,
      atemMultiviewerWindowCount: undefined,
      atemMediaPlayerCount: undefined,
      atemSuperSourceCount: undefined,
      atemAuxCount: undefined,
      atemInputCount: undefined,
      mixEffects: undefined,
      upstreamKeyers: undefined,
      downstreamKeyers: undefined,
      multiviewers: undefined,
      mediaPlayers: undefined,
    };
  }

  const profile = getAtemModelProfile(form.atemModel);
  const multiviewerWindowCount = profile.multiviewers > 0 ? (profile.multiviewerFullGrid ? 16 : 10) : 0;
  return {
    atemModel: profile.id,
    atemModelLabel: profile.label,
    atemMeCount: profile.mixEffects,
    atemUskCount: profile.upstreamKeyers,
    atemDskCount: profile.downstreamKeyers,
    atemMultiviewerCount: profile.multiviewers,
    atemMultiviewerWindowCount: multiviewerWindowCount,
    atemMediaPlayerCount: profile.mediaPlayers,
    atemSuperSourceCount: profile.superSources,
    atemAuxCount: profile.auxOutputs,
    atemInputCount: profile.inputCount,
    mixEffects: profile.mixEffects,
    upstreamKeyers: profile.upstreamKeyers,
    downstreamKeyers: profile.downstreamKeyers,
    multiviewers: profile.multiviewers,
    mediaPlayers: profile.mediaPlayers,
  };
}

function buildConnectionPayloadFromForm(form: FormState, existingId?: number): Connection {
  const resolvedPort = form.device === "ross_xpression"
    ? "7788"
    : (form.port.trim() || getDefaultPort(form.device));
  const resolvedIp = form.ip.trim() || parseBonjourHostIp(form.bonjourHost);
  const trimmedName = form.name.trim();

  if (!trimmedName || !resolvedIp || !resolvedPort) {
    throw new Error("Name, IP, and Port are required.");
  }
  if (trimmedName.length > 10) {
    throw new Error("Connection name must be 10 characters or fewer.");
  }

  const videohubFields = getVideohubConnectionFields(form);
  const rossTalkFields = getRossTalkConnectionFields(form);
  const swp08Fields = getSwp08ConnectionFields(form);
  const httpFields = getHttpConnectionFields(form);
  const oscFields = getOscConnectionFields(form);
  const genericTcpFields = getGenericTcpConnectionFields(form);
  const companionRemoteFields = getCompanionRemoteConnectionFields(form);
  const atemFields = getAtemConnectionFields(form);

  return {
    id: existingId ?? createNumericId(),
    name: trimmedName,
    ip: resolvedIp,
    port: resolvedPort,
    fadeFramerate: form.fadeFramerate.trim() || undefined,
    protocol: form.device === "generic_tcp" ? form.genericTcpTransport : form.protocol,
    device: form.device,
    path: form.path.trim(),
    username: form.username.trim() || undefined,
    oscPrefix: form.oscPrefix.trim() || undefined,
    password: form.password || undefined,
    ...rossTalkFields,
    ...videohubFields,
    ...swp08Fields,
    ...httpFields,
    ...oscFields,
    ...genericTcpFields,
    ...companionRemoteFields,
    ...atemFields,
    active: true,
  };
}

function normalizeConnectionName(value: string): string {
  return value.trim().toLowerCase();
}

function assertUniqueConnectionName(
  connections: Connection[],
  candidateName: string,
  existingId?: number,
) {
  const normalized = normalizeConnectionName(candidateName);
  if (!normalized) return;

  const duplicate = connections.some((entry) => (
    entry.id !== existingId && normalizeConnectionName(entry.name) === normalized
  ));
  if (duplicate) {
    throw new Error(
      `Connection name "${candidateName.trim()}" already exists. Please use a unique name.`,
    );
  }
}

export default function Connections() {
  const { connections, setConnections } = useAppContext();
  const t = useTheme();

  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAdd = () => {
    setSubmitError(null);
    setForm(EMPTY_FORM);
    setModal("add");
  };

  useEffect(() => {
    const handleOpenAdd = () => {
      openAdd();
    };
    window.addEventListener("autocom:open-add-connection", handleOpenAdd as EventListener);
    return () => {
      window.removeEventListener("autocom:open-add-connection", handleOpenAdd as EventListener);
    };
  }, []);

  const openEdit = (conn: Connection) => {
    setSubmitError(null);
    setEditingConnection(conn);
    setForm(buildFormFromConnection(conn));
    setModal("edit");
  };

  const closeModal = () => {
    setSubmitError(null);
    setIsSubmitting(false);
    setModal(null);
    setEditingConnection(null);
    setForm(EMPTY_FORM);
  };

  const commitConnections = useCallback(async (nextConnections: Connection[]) => {
    setIsSubmitting(true);
    try {
      if (isTauri()) {
        await persistConnectionsToRuntime(nextConnections);
      }
      setConnections(nextConnections);
      return true;
    } catch (error) {
      console.error("Failed to persist connections:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save connections.",
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [setConnections]);

  const handleAddConnection = async () => {
    setSubmitError(null);
    try {
      const newConnection = buildConnectionPayloadFromForm(
        form,
        createNumericId(connections),
      );
      assertUniqueConnectionName(connections, newConnection.name);
      const didSave = await commitConnections([...connections, newConnection]);
      if (!didSave) return;
      closeModal();
    } catch (error) {
      console.error("Failed to add connection:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to add connection.",
      );
    }
  };

  const handleSaveConnection = async () => {
    setSubmitError(null);
    if (!editingConnection) return;
    try {
      const updatedPayload = buildConnectionPayloadFromForm(form, editingConnection.id);
      assertUniqueConnectionName(connections, updatedPayload.name, editingConnection.id);
      const nextConnections = connections.map(c =>
        c.id === editingConnection.id ? { ...c, ...updatedPayload, active: c.active } : c,
      );
      const didSave = await commitConnections(nextConnections);
      if (!didSave) return;
      closeModal();
    } catch (error) {
      console.error("Failed to save connection:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save connection.",
      );
    }
  };

  const handleToggle = async (id: number) => {
    setSubmitError(null);
    const nextConnections = connections.map((connection) => (
      connection.id === id ? { ...connection, active: !connection.active } : connection
    ));
    await commitConnections(nextConnections);
  };

  const handleDelete = async (id: number) => {
    setSubmitError(null);
    const nextConnections = connections.filter((connection) => connection.id !== id);
    await commitConnections(nextConnections);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto page-pop" style={{ backgroundColor: t.bgContent }}>
        <div className="px-[16px]" style={{ paddingTop: 16 }}>
          <div className="flex items-center justify-between" style={{ height: 35 }}>
            <motion.button
              className="text-[14px] px-[12px] shrink-0 hover:bg-[var(--btn-hover)] transition-colors"
              style={{ height: 35, backgroundColor: t.btnSecondary, color: t.textPrimary }}
              onClick={openAdd}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.1 }}
            >
              Add Connection
            </motion.button>
          </div>

          <div className="mt-[16px] flex flex-col gap-[2px]">
            {connections.length === 0 && (
              <div className="flex items-center px-[12px] text-[12px]" style={{ height: 35, color: t.textMuted }}>
                No connections found.
              </div>
            )}

            <AnimatePresence initial={false}>
              {connections.map(conn => (
                <motion.div
                  key={conn.id}
                  layout
                  className="flex items-center relative group hover:bg-[var(--row-hover)] transition-colors card-pop"
                  style={{ height: 35, backgroundColor: t.rowBg }}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                >
                  {(() => {
                    const typeLabel = getConnectionTypeReferenceLabel(conn.device);
                    return (
                      <>
                        <div className="flex items-center px-[12px]" style={{ width: 200 }}>
                          <span className="text-[14px] truncate" style={{ color: t.textPrimary }}>
                            {conn.name}
                          </span>
                        </div>
                        <div className="h-[24px] w-px shrink-0" style={{ backgroundColor: t.bgContent }} />

                        <div className="flex items-center px-[12px]" style={{ minWidth: 180 }}>
                          <span className="text-[11px]" style={{ color: t.textMuted }}>
                            IP - {conn.ip}
                            {conn.port ? `:${conn.port}` : ""}
                          </span>
                        </div>
                        <div className="h-[24px] w-px shrink-0" style={{ backgroundColor: t.bgContent }} />

                        <div className="flex items-center px-[12px]" style={{ minWidth: 160 }}>
                          <span className="text-[11px]" style={{ color: t.textMuted }}>
                            Protocol - {conn.protocol}
                          </span>
                        </div>
                        <div className="h-[24px] w-px shrink-0" style={{ backgroundColor: t.bgContent }} />

                        <div className="flex items-center px-[12px]" style={{ minWidth: 190 }}>
                          <span className="text-[11px] truncate" style={{ color: t.textMuted }}>
                            Device - {typeLabel}
                          </span>
                        </div>
                        <div className="h-[24px] w-px shrink-0" style={{ backgroundColor: t.bgContent }} />

                        <div className="flex-1" />

                        <div className="flex items-center gap-[10px] px-[12px]">
                          <motion.button
                            className="flex items-center transition-colors"
                            style={{ color: conn.active ? t.toggleColor : t.textPrimary }}
                            title={conn.active ? "Deactivate" : "Activate"}
                            onClick={() => { void handleToggle(conn.id); }}
                            whileTap={{ scale: 0.88 }}
                            transition={{ duration: 0.1 }}
                          >
                            <motion.span
                              key={conn.active ? "on" : "off"}
                              initial={{ scale: 0.75, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.15, ease: "backOut" }}
                            >
                              {conn.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            </motion.span>
                          </motion.button>

                          <motion.button
                            className="transition-colors"
                            style={{ color: t.textPrimary }}
                            title="Edit"
                            onClick={() => openEdit(conn)}
                            whileTap={{ scale: 0.85 }}
                            transition={{ duration: 0.1 }}
                          >
                            <Pencil size={16} />
                          </motion.button>

                          <motion.button
                            className="transition-colors"
                            style={{ color: t.textPrimary }}
                            title="Delete"
                            onClick={() => { void handleDelete(conn.id); }}
                            onMouseEnter={e => {
                              e.currentTarget.style.color = t.deleteHover;
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.color = t.textPrimary;
                            }}
                            whileTap={{ scale: 0.85 }}
                            transition={{ duration: 0.1 }}
                          >
                            <Trash2 size={16} />
                          </motion.button>
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {modal === "add" && (
          <ConnectionModal
            key="add"
            title="Add Connection"
            form={form}
            setForm={setForm}
            onCancel={closeModal}
            onSubmit={handleAddConnection}
            submitLabel="Add Connection"
            errorMessage={submitError}
            submitting={isSubmitting}
            t={t}
          />
        )}
        {modal === "edit" && editingConnection && (
          <ConnectionModal
            key="edit"
            title="Edit Connection"
            form={form}
            setForm={setForm}
            onCancel={closeModal}
            onSubmit={handleSaveConnection}
            submitLabel="Save Connection"
            errorMessage={submitError}
            submitting={isSubmitting}
            t={t}
          />
        )}
      </AnimatePresence>
    </>
  );
}

type ModalProps = {
  title: string;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  errorMessage?: string | null;
  submitting?: boolean;
  t: AppTheme;
};

function ConnectionModal({
  title,
  form,
  setForm,
  onCancel,
  onSubmit,
  submitLabel,
  errorMessage,
  submitting = false,
  t,
}: ModalProps) {
  const ui = useMemo(() => mergeFieldUi(form.device), [form.device]);
  const hiddenSet = useMemo(() => new Set(ui.hiddenFields), [ui.hiddenFields]);
  const isAdding = title === "Add Connection";
  const [hasSelectedDevice, setHasSelectedDevice] = useState(!isAdding);
  const lockedProtocol: ProtocolType | null = ui.lockedProtocol === "" ? null : ui.lockedProtocol;
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (lockedProtocol && form.protocol !== lockedProtocol) {
      setForm(prev => (prev.protocol === lockedProtocol ? prev : { ...prev, protocol: lockedProtocol }));
    }
  }, [form.protocol, lockedProtocol, setForm]);

  useEffect(() => {
    if (form.device !== "generic_tcp") return;
    if (form.genericTcpTransport !== "udp") return;
    if (!form.genericTcpSaveResponse) return;
    setForm((prev) => ({ ...prev, genericTcpSaveResponse: false }));
  }, [form.device, form.genericTcpSaveResponse, form.genericTcpTransport, setForm]);

  const updateInput =
    (
      field:
        | "name"
        | "ip"
        | "port"
        | "fadeFramerate"
        | "path"
        | "username"
        | "oscPrefix"
        | "password"
        | "inputCount"
        | "outputCount"
        | "monitoringCount"
        | "serialCount"
        | "httpBaseUrl"
        | "httpProxyAddress"
        | "companionDeviceId"
        | "companionColumns"
        | "companionRows"
        | "rossTalkModel"
        | "swp08Matrix"
        | "swp08LevelCount"
        | "swp08RequestNameLength",
    ) =>
      (e: ChangeEvent<HTMLInputElement>) => {
        const nextValue = field === "name" ? e.target.value.slice(0, 10) : e.target.value;
        setForm(prev => ({ ...prev, [field]: nextValue }));
      };

  const updateType = (e: ChangeEvent<HTMLSelectElement>) => {
    const device = normalizeDeviceType(e.target.value);
    const nextUi = mergeFieldUi(device);
    const protocol = nextUi.lockedProtocol || DEFAULT_PROTOCOL_BY_TYPE[device];
    setForm(prev => {
      const previousDefaultPort = getDefaultPort(prev.device);
      const nextDefaultPort = getDefaultPort(device);
      const prevPort = prev.port.trim();
      const shouldUpdatePort = prevPort === "" || prevPort === previousDefaultPort;
      const previousDefaultUsername = prev.device === "grandma2" ? "administrator" : "";
      const nextDefaultUsername = device === "grandma2" ? "administrator" : "";
      const shouldUpdateUsername =
        prev.username.trim() === "" || prev.username.trim() === previousDefaultUsername;
      const previousDefaultPassword = prev.device === "grandma2" ? "admin" : "";
      const nextDefaultPassword = device === "grandma2" ? "admin" : "";
      const shouldUpdatePassword =
        prev.password.trim() === "" || prev.password.trim() === previousDefaultPassword;
      const previousDefaultFadeFramerate = prev.device === "x32" ? "10" : "";
      const nextDefaultFadeFramerate = device === "x32" ? "10" : "";
      const shouldUpdateFadeFramerate =
        prev.fadeFramerate.trim() === "" || prev.fadeFramerate.trim() === previousDefaultFadeFramerate;

      return {
        ...prev,
        device,
        protocol,
        atemModel: device === "atem"
          ? (prev.device === "atem" ? normalizeAtemModelId(prev.atemModel) : DEFAULT_ATEM_MODEL_ID)
          : prev.atemModel,
        port: shouldUpdatePort ? nextDefaultPort : prev.port,
        fadeFramerate: shouldUpdateFadeFramerate ? nextDefaultFadeFramerate : prev.fadeFramerate,
        username: shouldUpdateUsername ? nextDefaultUsername : prev.username,
        password: shouldUpdatePassword ? nextDefaultPassword : prev.password,
        bonjourHost: device === "videohub" && prev.device !== "videohub" ? "" : prev.bonjourHost,
        take: device === "videohub" && prev.device !== "videohub" ? false : prev.take,
        inputCount:
          device === "videohub" && prev.device !== "videohub"
            ? String(VIDEOHUB_DEFAULT_INPUT_COUNT)
            : prev.inputCount,
        outputCount:
          device === "videohub" && prev.device !== "videohub"
            ? String(VIDEOHUB_DEFAULT_OUTPUT_COUNT)
            : prev.outputCount,
        monitoringCount:
          device === "videohub" && prev.device !== "videohub"
            ? String(VIDEOHUB_DEFAULT_MONITORING_COUNT)
            : prev.monitoringCount,
        serialCount:
          device === "videohub" && prev.device !== "videohub"
            ? String(VIDEOHUB_DEFAULT_SERIAL_COUNT)
            : prev.serialCount,
        rossTalkModel: device === "ross_talk" && prev.device !== "ross_talk" ? "carbonite" : prev.rossTalkModel,
        rossTalkKeepAlive:
          device === "ross_talk" && prev.device !== "ross_talk" ? false : prev.rossTalkKeepAlive,
        companionDeviceId:
          device === "companion_remote" && prev.device !== "companion_remote" ? "" : prev.companionDeviceId,
        companionColumns:
          device === "companion_remote" && prev.device !== "companion_remote"
            ? String(COMPANION_REMOTE_DEFAULT_COLUMNS)
            : prev.companionColumns,
        companionRows:
          device === "companion_remote" && prev.device !== "companion_remote"
            ? String(COMPANION_REMOTE_DEFAULT_ROWS)
            : prev.companionRows,
        companionBitmapResolution:
          device === "companion_remote" && prev.device !== "companion_remote"
            ? "low"
            : prev.companionBitmapResolution,
      };
    });
  };

  const updateProtocol = (e: ChangeEvent<HTMLSelectElement>) => {
    const protocol = normalizeProtocol(e.target.value, form.device);
    setForm(prev => {
      if (prev.device !== "http_api") {
        return { ...prev, protocol };
      }
      const currentPort = prev.port.trim();
      const isDefaultHttp = currentPort === "" || currentPort === "80";
      const isDefaultHttps = currentPort === "443";
      let nextPort = prev.port;
      if (protocol === "https" && (isDefaultHttp || isDefaultHttps || currentPort === "")) {
        nextPort = "443";
      } else if (protocol === "http" && (isDefaultHttp || isDefaultHttps || currentPort === "")) {
        nextPort = "80";
      }
      return { ...prev, protocol, port: nextPort };
    });
  };

  const updateVideohubDevice = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = e.target.value;
    setForm(prev => ({
      ...prev,
      bonjourHost: nextValue === "manual" ? "" : nextValue,
      ip:
        nextValue === "manual"
          ? prev.ip
          : prev.ip.trim() || parseBonjourHostIp(nextValue),
    }));
  };

  const inputStyle = {
    height: 32,
    backgroundColor: t.inputBg,
    border: `1px solid ${t.inputBorder}`,
    color: t.textPrimary,
  };
  const sideFieldWidth = 135;

  const protocolLocked = ui.lockedProtocol !== "";
  const showPortField = !hiddenSet.has("port");
  const showProtocolField = !hiddenSet.has("protocol");
  const showUsername = form.device === "grandma2" && !hiddenSet.has("username");
  const isVideohub = form.device === "videohub";
  const showFadeFramerate = form.device === "x32";
  const showInlineFadeFramerate = showFadeFramerate && !isVideohub;
  const isAtem = form.device === "atem";
  const isSwp08 = form.device === "swp08";
  const isSwp08Extended = isSwp08 && form.swp08ExtendedCommands;
  const swp08ModeLabel = isSwp08Extended ? "extended mode" : "normal mode";
  const swp08MatrixMax = isSwp08Extended ? SWP08_EXTENDED_MAX_MATRIX : SWP08_NORMAL_MAX_MATRIX;
  const swp08LevelsMax = isSwp08Extended ? SWP08_EXTENDED_MAX_LEVELS : SWP08_NORMAL_MAX_LEVELS;
  const isHttpApi = form.device === "http_api";
  const isCompanionRemote = form.device === "companion_remote";
  const isGenericOsc = form.device === "generic_osc";
  const isGenericTcp = form.device === "generic_tcp";
  const isGenericTcpUdpSelected = isGenericTcp && form.genericTcpTransport === "udp";
  const isRossTalk = form.device === "ross_talk";
  const isRossXpression = form.device === "ross_xpression";
  const atemProfile = useMemo(() => getAtemModelProfile(form.atemModel), [form.atemModel]);
  const videohubDeviceValue = form.bonjourHost.trim() || "manual";
  const showVideohubIpField = videohubDeviceValue === "manual";
  const modalFixedHeight = isVideohub || isSwp08 ? "88vh" : undefined;
  const resolvedPort = form.port.trim() || getDefaultPort(form.device);
  const resolvedIp = form.ip.trim() || parseBonjourHostIp(form.bonjourHost);
  const hasRequiredFields = Boolean(hasSelectedDevice && form.name.trim() && resolvedIp && resolvedPort);
  const canSubmit = hasRequiredFields && !submitting && hasSelectedDevice;
  const showRequiredValidation = submitAttempted || (!hasRequiredFields && Boolean(errorMessage));
  const nameInvalid = showRequiredValidation && !form.name.trim();
  const hostInvalid = showRequiredValidation && !resolvedIp;
  const portInvalid = showRequiredValidation && !resolvedPort && showPortField;
  const missingRequiredLabels = [
    nameInvalid ? "Name" : null,
    hostInvalid ? ui.labels.host : null,
    portInvalid ? ui.labels.port : null,
  ].filter(Boolean) as string[];

  const withValidationStyle = (invalid: boolean) => ({
    ...inputStyle,
    border: `1px solid ${invalid ? P.muted500 : t.inputBorder}`,
    boxShadow: invalid ? "0 0 0 1px rgba(153,161,175,0.3)" : undefined,
  });

  const handleSubmitClick = () => {
    setSubmitAttempted(true);
    if (!hasRequiredFields || submitting) return;
    void onSubmit();
  };

  useEffect(() => {
    if (!isRossXpression || form.port.trim() === "7788") return;
    setForm((prev) => (
      prev.device === "ross_xpression" && prev.port.trim() !== "7788"
        ? { ...prev, port: "7788" }
        : prev
    ));
  }, [form.port, isRossXpression, setForm]);

  useEffect(() => {
    if (!isSwp08) return;
    const matrix = Number.parseInt(form.swp08Matrix, 10);
    const levels = Number.parseInt(form.swp08LevelCount, 10);
    const clampedMatrix = Number.isFinite(matrix)
      ? Math.max(1, Math.min(swp08MatrixMax, matrix))
      : SWP08_DEFAULT_MATRIX;
    const clampedLevels = Number.isFinite(levels)
      ? Math.max(1, Math.min(swp08LevelsMax, levels))
      : SWP08_DEFAULT_LEVELS;
    const nextMatrix = String(clampedMatrix);
    const nextLevels = String(clampedLevels);
    if (nextMatrix === form.swp08Matrix && nextLevels === form.swp08LevelCount) return;
    setForm((prev) => (
      prev.device === "swp08"
        ? { ...prev, swp08Matrix: nextMatrix, swp08LevelCount: nextLevels }
        : prev
    ));
  }, [
    form.swp08LevelCount,
    form.swp08Matrix,
    isSwp08,
    setForm,
    swp08LevelsMax,
    swp08MatrixMax,
  ]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={onCancel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="relative border card-pop flex flex-col"
        style={{
          width: 460,
          maxWidth: "calc(100vw - 32px)",
          height: modalFixedHeight,
          maxHeight: modalFixedHeight,
          backgroundColor: t.modalBg,
          borderColor: t.modalBorder,
        }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="flex items-start justify-between px-[24px] pt-[22px] pb-[6px]">
          <div>
            <p className="text-[14px]" style={{ color: t.textPrimary }}>
              {title}
            </p>
            <p className="text-[11px] mt-[3px]" style={{ color: t.textMuted }}>
              {hasSelectedDevice ? ui.title : "Select a connection to begin setup"}
            </p>
          </div>
          <motion.button
            className="transition-colors mt-[2px]"
            style={{ color: t.textMuted }}
            onClick={onCancel}
            whileTap={{ scale: 0.85 }}
            transition={{ duration: 0.1 }}
          >
            <X size={14} />
          </motion.button>
        </div>

        <div className="px-[24px] pb-[24px] flex flex-col gap-[14px] mt-[10px] flex-1 overflow-y-auto app-scrollbar">
          <div className="flex gap-[10px] items-start">
            <div className="flex flex-col gap-[6px] flex-1">
              <label className="text-[12px]" style={{ color: t.textPrimary }}>
                {ui.labels.type}
              </label>
              <div className="relative">
                <select
                  className="w-full text-[12px] px-[11px] pr-[28px] outline-none appearance-none cursor-pointer"
                  style={{ ...inputStyle, color: hasSelectedDevice ? t.textPrimary : t.textMuted }}
                  value={hasSelectedDevice ? form.device : "none"}
                  onChange={(e) => {
                    setHasSelectedDevice(true);
                    updateType(e);
                  }}
                >
                  {!hasSelectedDevice && (
                    <option value="none" disabled hidden style={{ backgroundColor: t.inputBg }}>
                      Select a Connection Type...
                    </option>
                  )}
                  {DEVICE_OPTIONS.map((option) => (
                    <option key={option} value={option} style={{ backgroundColor: t.inputBg }}>
                      {DEVICE_LABELS[option]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-[8px] top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: t.textMuted }}
                />
              </div>
            </div>
            {hasSelectedDevice && showProtocolField && (
              <div className="flex flex-col gap-[6px] shrink-0" style={{ width: sideFieldWidth }}>
                <label className="text-[12px]" style={{ color: t.textPrimary }}>
                  {ui.labels.protocol}
                </label>
                <select
                  className="w-full text-[12px] px-[11px] outline-none appearance-none cursor-pointer"
                  style={{ ...inputStyle, color: t.textPrimary }}
                  value={form.protocol}
                  onChange={updateProtocol}
                  disabled={protocolLocked}
                >
                  {PROTOCOL_OPTIONS.map((option) => (
                    <option key={option} value={option} style={{ backgroundColor: t.inputBg }}>
                      {option}
                    </option>
                  ))}
                </select>
                {protocolLocked && (
                  <span className="text-[10px]" style={{ color: t.textMuted }}>
                    Locked for {DEVICE_LABELS[form.device]}
                  </span>
                )}
              </div>
            )}
          </div>

          {hasSelectedDevice && (
            <>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px]" style={{ color: t.textPrimary }}>
                  {ui.labels.name} <span style={{ color: P.text300 }}>*</span>
                </label>
                <input
                  autoFocus
                  className="w-full text-[12px] px-[11px] outline-none"
                  style={withValidationStyle(nameInvalid)}
                  placeholder={ui.placeholders.name}
                  value={form.name}
                  maxLength={10}
                  onChange={updateInput("name")}
                />
              </div>

              {isAtem && (
                <>
                  <div className="text-[12px]" style={{ color: t.textSecondary }}>
                    Works with all Blackmagic Design ATEM switchers. Select a model to set M/E, keyer, multiviewer,
                    SuperSource, aux, and input limits for tasks.
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Model
                    </label>
                    <div className="relative">
                      <select
                        className="w-full text-[12px] px-[11px] pr-[30px] outline-none appearance-none cursor-pointer"
                        style={{ ...inputStyle, color: t.textPrimary }}
                        value={form.atemModel}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            atemModel: normalizeAtemModelId(e.target.value),
                          }))
                        }
                      >
                        {ATEM_MODEL_PROFILES.map((model) => (
                          <option key={model.id} value={model.id} style={{ backgroundColor: t.inputBg }}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2"
                        style={{ color: t.textMuted }}
                      />
                    </div>
                  </div>
                  <div
                    className="rounded-sm px-[10px] py-[8px] text-[11px] grid grid-cols-2 gap-x-[10px] gap-y-[4px]"
                    style={{ border: `1px solid ${t.inputBorder}`, backgroundColor: t.inputBg, color: t.textSecondary }}
                  >
                    <span>M/E: {atemProfile.mixEffects}</span>
                    <span>USK: {atemProfile.upstreamKeyers}</span>
                    <span>DSK: {atemProfile.downstreamKeyers}</span>
                    <span>Multiviewer: {atemProfile.multiviewers}</span>
                    <span>SuperSource: {atemProfile.superSources}</span>
                    <span>Media Players: {atemProfile.mediaPlayers}</span>
                    <span>Aux Outputs: {atemProfile.auxOutputs}</span>
                    <span>Inputs: {atemProfile.inputCount}</span>
                  </div>
                </>
              )}

              {isVideohub && (
                <div className="text-[12px]" style={{ color: t.textSecondary }}>
                  This module will connect to any Blackmagic Design VideoHub Device.
                </div>
              )}
              {isSwp08 && (
                <div className="text-[12px]" style={{ color: t.textSecondary }}>
                  This module will allow you to control broadcast routers which implement the SW-P-08 standard protocol.
                </div>
              )}
              {isHttpApi && (
                <div className="text-[12px]" style={{ color: t.textSecondary }}>
                  Define a base URL for request commands. You can also configure proxy and certificate handling.
                </div>
              )}
              {isCompanionRemote && (
                <div className="text-[12px]" style={{ color: t.textSecondary }}>
                  Connect one Companion instance to another using Satellite API and configure grid size for button events.
                </div>
              )}
              {isGenericOsc && (
                <div className="text-[12px]" style={{ color: t.textSecondary }}>
                  Configure OSC target transport and optionally listen for feedback events.
                </div>
              )}
              {isGenericTcp && (
                <div className="text-[12px]" style={{ color: t.textSecondary }}>
                  Choose transport protocol and optionally store TCP responses.
                </div>
              )}
              {isRossTalk && (
                <div className="flex flex-col gap-[8px] text-[12px]" style={{ color: t.textSecondary }}>
                  <span>
                    RossTalk supports Carbonite/Graphite, Ultrix, Acuity/Vision, and openGear command sets.
                  </span>
                  <span>
                    XPression is not handled here. Keep using the dedicated XPression connection type for that device family.
                  </span>
                </div>
              )}

              {isVideohub ? (
                <div className="flex gap-[10px] items-start">
                  <div className="flex flex-col gap-[6px] flex-1">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Device
                    </label>
                    <div className="relative">
                      <select
                        className="w-full text-[12px] px-[11px] pr-[28px] outline-none appearance-none cursor-pointer"
                        style={{ ...inputStyle, color: t.textPrimary }}
                        value={videohubDeviceValue}
                        onChange={updateVideohubDevice}
                      >
                        <option value="manual" style={{ backgroundColor: t.inputBg }}>
                          Manual
                        </option>
                        {videohubDeviceValue !== "manual" && (
                          <option value={videohubDeviceValue} style={{ backgroundColor: t.inputBg }}>
                            {videohubDeviceValue}
                          </option>
                        )}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-[8px] top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: t.textMuted }}
                      />
                    </div>
                  </div>
                  {showVideohubIpField && (
                    <div className="flex flex-col gap-[6px] flex-1">
                      <label className="text-[12px]" style={{ color: t.textPrimary }}>
                        {ui.labels.host} <span style={{ color: P.text300 }}>*</span>
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={withValidationStyle(hostInvalid)}
                        placeholder={ui.placeholders.host}
                        value={form.ip}
                        onChange={updateInput("ip")}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-[10px] items-start">
                  <div className="flex flex-col gap-[6px] flex-1">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      {ui.labels.host} <span style={{ color: P.text300 }}>*</span>
                    </label>
                    <input
                      className="w-full text-[12px] px-[11px] outline-none"
                      style={withValidationStyle(hostInvalid)}
                      placeholder={ui.placeholders.host}
                      value={form.ip}
                      onChange={updateInput("ip")}
                    />
                  </div>
                  {showInlineFadeFramerate && (
                    <div className="flex flex-col gap-[6px] shrink-0" style={{ width: "40%" }}>
                      <label className="text-[12px] whitespace-nowrap" style={{ color: t.textPrimary }}>
                        {ui.labels.fadeFramerate}
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={inputStyle}
                        placeholder={ui.placeholders.fadeFramerate}
                        type="number"
                        min={1}
                        value={form.fadeFramerate}
                        onChange={updateInput("fadeFramerate")}
                      />
                    </div>
                  )}
                  {showPortField && (
                    <div className="flex flex-col gap-[6px] shrink-0" style={{ width: sideFieldWidth }}>
                      <label className="text-[12px] whitespace-nowrap" style={{ color: t.textPrimary }}>
                        {ui.labels.port} <span style={{ color: P.text300 }}>*</span>
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={withValidationStyle(portInvalid)}
                        placeholder={ui.placeholders.port}
                        type="number"
                        value={form.port}
                        onChange={updateInput("port")}
                        disabled={isRossXpression}
                      />
                    </div>
                  )}
                </div>
              )}

              {isVideohub && (
                <>
                  <div className="flex items-center justify-between rounded-sm px-[10px] py-[6px]" style={{ border: `1px solid ${t.inputBorder}`, backgroundColor: t.inputBg }}>
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Enable Take? (XY only)
                    </label>
                    <button
                      type="button"
                      className="transition-colors"
                      style={{ color: form.take ? t.toggleColor : t.textMuted }}
                      onClick={() => setForm(prev => ({ ...prev, take: !prev.take }))}
                    >
                      {form.take ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </div>
                  <div className="text-[12px]" style={{ color: t.textSecondary }}>
                    The counts below will automatically populate from the device upon connection, however, they can be set manually for offline programming.
                  </div>
                  <div className="grid grid-cols-2 gap-[10px]">
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[12px]" style={{ color: t.textPrimary }}>
                        Input Count
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={inputStyle}
                        type="number"
                        min={0}
                        max={VIDEOHUB_COUNT_MAX}
                        value={form.inputCount}
                        onChange={updateInput("inputCount")}
                      />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[12px]" style={{ color: t.textPrimary }}>
                        Output Count
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={inputStyle}
                        type="number"
                        min={0}
                        max={VIDEOHUB_COUNT_MAX}
                        value={form.outputCount}
                        onChange={updateInput("outputCount")}
                      />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[12px]" style={{ color: t.textPrimary }}>
                        Monitoring Output Count (when present)
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={inputStyle}
                        type="number"
                        min={0}
                        max={VIDEOHUB_COUNT_MAX}
                        value={form.monitoringCount}
                        onChange={updateInput("monitoringCount")}
                      />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[12px]" style={{ color: t.textPrimary }}>
                        Serial Port Count (when present)
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={inputStyle}
                        type="number"
                        min={0}
                        max={VIDEOHUB_COUNT_MAX}
                        value={form.serialCount}
                        onChange={updateInput("serialCount")}
                      />
                    </div>
                  </div>
                </>
              )}

              {isSwp08 && (
                <>
                  <div className="grid grid-cols-2 gap-[10px]">
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[12px]" style={{ color: t.textPrimary }}>
                        {`Matrix Number (Default 1) (${swp08ModeLabel})`}
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={inputStyle}
                        type="number"
                        min={1}
                        max={swp08MatrixMax}
                        value={form.swp08Matrix}
                        onChange={updateInput("swp08Matrix")}
                      />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[12px]" style={{ color: t.textPrimary }}>
                        {`Number of levels defined in router (${swp08ModeLabel})`}
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={inputStyle}
                        type="number"
                        min={1}
                        max={swp08LevelsMax}
                        value={form.swp08LevelCount}
                        onChange={updateInput("swp08LevelCount")}
                      />
                    </div>
                  </div>

                  {[
                    {
                      key: "swp08TallyDump" as const,
                      title: "My router supports tally dump, and sends tally updates",
                      help: "If enabled, the module will request a tally dump on connection and then use tally updates.",
                    },
                    {
                      key: "swp08AdvancedVariables" as const,
                      title: "Advanced tally/routing variables",
                      help: "Generate variables for each destination on each level. Enable only when needed.",
                    },
                    {
                      key: "swp08RequestSupportedCommands" as const,
                      title: "Request supported commands on connection",
                      help: "Not supported by all router controllers. Disable if you encounter issues.",
                    },
                    {
                      key: "swp08RequestNamesOnConnect" as const,
                      title: "Request names on connection",
                      help: "Not supported by all router controllers.",
                    },
                    {
                      key: "swp08ExtendedCommands" as const,
                      title: "Router has more than 1024 sources/destinations or more than 16 levels",
                      help: "Use extended command set. Not supported by all router controllers.",
                    },
                  ].map((toggle) => (
                    <div
                      key={toggle.key}
                      className="flex items-center justify-between rounded-sm px-[10px] py-[6px]"
                      style={{ border: `1px solid ${t.inputBorder}`, backgroundColor: t.inputBg }}
                    >
                      <div className="pr-[12px]">
                        <label className="text-[12px] block" style={{ color: t.textPrimary }}>
                          {toggle.title}
                        </label>
                        <span className="text-[11px]" style={{ color: t.textSecondary }}>
                          {toggle.help}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="transition-colors shrink-0"
                        style={{ color: form[toggle.key] ? t.toggleColor : t.textMuted }}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, [toggle.key]: !prev[toggle.key] }))
                        }
                      >
                        {form[toggle.key] ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>
                    </div>
                  ))}

                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Request name length
                    </label>
                    <select
                      className="w-full text-[12px] px-[11px] outline-none appearance-none cursor-pointer"
                      style={{ ...inputStyle, color: t.textPrimary }}
                      value={form.swp08RequestNameLength}
                      onChange={(e) => setForm((prev) => ({ ...prev, swp08RequestNameLength: e.target.value }))}
                    >
                      {SWP08_NAME_LENGTH_OPTIONS.map((option) => (
                        <option key={option} value={String(option)} style={{ backgroundColor: t.inputBg }}>
                          {option} characters
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {isHttpApi && (
                <>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Base URL
                    </label>
                    <input
                      className="w-full text-[12px] px-[11px] outline-none"
                      style={inputStyle}
                      placeholder={form.protocol === "https" ? "https://server.url/path/" : "http://server.url/path/"}
                      value={form.httpBaseUrl}
                      onChange={updateInput("httpBaseUrl")}
                    />
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Proxy Address (optional)
                    </label>
                    <input
                      className="w-full text-[12px] px-[11px] outline-none"
                      style={inputStyle}
                      placeholder="http://proxy:8080"
                      value={form.httpProxyAddress}
                      onChange={updateInput("httpProxyAddress")}
                    />
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Unauthorized Certificates
                    </label>
                    <select
                      className="w-full text-[12px] px-[11px] outline-none appearance-none cursor-pointer"
                      style={{ ...inputStyle, color: t.textPrimary }}
                      value={form.httpUnauthorizedCertificates}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          httpUnauthorizedCertificates: e.target.value === "accept" ? "accept" : "reject",
                        }))
                      }
                    >
                      <option value="reject" style={{ backgroundColor: t.inputBg }}>Reject</option>
                      <option value="accept" style={{ backgroundColor: t.inputBg }}>Accept</option>
                    </select>
                  </div>
                </>
              )}

              {isCompanionRemote && (
                <>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Device ID (optional)
                    </label>
                    <input
                      className="w-full text-[12px] px-[11px] outline-none"
                      style={inputStyle}
                      placeholder="satellite-panel-1"
                      value={form.companionDeviceId}
                      onChange={updateInput("companionDeviceId")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-[10px]">
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[12px]" style={{ color: t.textPrimary }}>
                        Number of Columns
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={inputStyle}
                        type="number"
                        min={COMPANION_REMOTE_MIN_GRID}
                        max={COMPANION_REMOTE_MAX_GRID}
                        value={form.companionColumns}
                        onChange={updateInput("companionColumns")}
                      />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[12px]" style={{ color: t.textPrimary }}>
                        Number of Rows
                      </label>
                      <input
                        className="w-full text-[12px] px-[11px] outline-none"
                        style={inputStyle}
                        type="number"
                        min={COMPANION_REMOTE_MIN_GRID}
                        max={COMPANION_REMOTE_MAX_GRID}
                        value={form.companionRows}
                        onChange={updateInput("companionRows")}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Bitmap Resolution
                    </label>
                    <div className="relative">
                      <select
                        className="w-full text-[12px] px-[11px] pr-[30px] outline-none appearance-none cursor-pointer"
                        style={{ ...inputStyle, color: t.textPrimary }}
                        value={form.companionBitmapResolution}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            companionBitmapResolution: e.target.value === "high" ? "high" : "low",
                          }))
                        }
                      >
                        <option value="low" style={{ backgroundColor: t.inputBg }}>Low (Default)</option>
                        <option value="high" style={{ backgroundColor: t.inputBg }}>High</option>
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2"
                        style={{ color: t.textMuted }}
                      />
                    </div>
                  </div>
                </>
              )}

              {isGenericOsc && (
                <div className="grid grid-cols-2 gap-[10px] items-end">
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Protocol
                    </label>
                    <select
                      className="w-full text-[12px] px-[11px] outline-none appearance-none cursor-pointer"
                      style={{ ...inputStyle, color: t.textPrimary }}
                      value={form.oscTransport}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          oscTransport: e.target.value === "tcp_raw"
                            ? "tcp_raw"
                            : e.target.value === "tcp"
                              ? "tcp"
                              : "udp",
                        }))
                      }
                    >
                      {OSC_TRANSPORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} style={{ backgroundColor: t.inputBg }}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between rounded-sm px-[10px] py-[6px]" style={{ border: `1px solid ${t.inputBorder}`, backgroundColor: t.inputBg }}>
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Listen for Feedback
                    </label>
                    <button
                      type="button"
                      className="transition-colors"
                      style={{ color: form.oscListenForFeedback ? t.toggleColor : t.textMuted }}
                      onClick={() =>
                        setForm((prev) => ({ ...prev, oscListenForFeedback: !prev.oscListenForFeedback }))
                      }
                    >
                      {form.oscListenForFeedback ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </div>
                </div>
              )}

              {isGenericTcp && (
                <div className={`grid gap-[10px] items-end ${isGenericTcpUdpSelected ? "grid-cols-1" : "grid-cols-2"}`}>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Connect with TCP / UDP
                    </label>
                    <div className="relative">
                      <select
                        className="w-full text-[12px] px-[11px] pr-[30px] outline-none appearance-none cursor-pointer"
                        style={{ ...inputStyle, color: t.textPrimary }}
                        value={form.genericTcpTransport}
                        onChange={(e) =>
                          setForm((prev) => {
                            const nextTransport = e.target.value === "udp" ? "udp" : "tcp";
                            return {
                              ...prev,
                              genericTcpTransport: nextTransport,
                              genericTcpSaveResponse:
                                nextTransport === "udp" ? false : prev.genericTcpSaveResponse,
                            };
                          })
                        }
                      >
                        {GENERIC_TCP_TRANSPORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} style={{ backgroundColor: t.inputBg }}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2"
                        style={{ color: t.textMuted }}
                      />
                    </div>
                  </div>
                  {!isGenericTcpUdpSelected && (
                    <div className="flex items-center justify-between rounded-sm px-[10px] py-[6px]" style={{ border: `1px solid ${t.inputBorder}`, backgroundColor: t.inputBg }}>
                      <label className="text-[12px]" style={{ color: t.textPrimary }}>
                        Save TCP Response
                      </label>
                      <button
                        type="button"
                        className="transition-colors"
                        style={{ color: form.genericTcpSaveResponse ? t.toggleColor : t.textMuted }}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, genericTcpSaveResponse: !prev.genericTcpSaveResponse }))
                        }
                      >
                        {form.genericTcpSaveResponse ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isRossTalk && (
                <>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px]" style={{ color: t.textPrimary }}>
                      Model
                    </label>
                    <select
                      className="w-full text-[12px] px-[11px] outline-none appearance-none cursor-pointer"
                      style={{ ...inputStyle, color: t.textPrimary }}
                      value={form.rossTalkModel}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          rossTalkModel: e.target.value as FormState["rossTalkModel"],
                        }))
                      }
                    >
                      {ROSS_TALK_MODEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} style={{ backgroundColor: t.inputBg }}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className="flex items-center justify-between rounded-sm px-[10px] py-[6px]"
                    style={{ border: `1px solid ${t.inputBorder}`, backgroundColor: t.inputBg }}
                  >
                    <div className="pr-[12px]">
                      <label className="text-[12px] block" style={{ color: t.textPrimary }}>
                        TCP Keep Alive
                      </label>
                      <span className="text-[11px]" style={{ color: t.textSecondary }}>
                        Keep one RossTalk TCP socket open instead of reconnecting for every command.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="transition-colors shrink-0"
                      style={{ color: form.rossTalkKeepAlive ? t.toggleColor : t.textMuted }}
                      onClick={() =>
                        setForm((prev) => ({ ...prev, rossTalkKeepAlive: !prev.rossTalkKeepAlive }))
                      }
                    >
                      {form.rossTalkKeepAlive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </div>
                </>
              )}

              {showFadeFramerate && !showInlineFadeFramerate && (
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12px]" style={{ color: t.textPrimary }}>
                    {ui.labels.fadeFramerate}
                  </label>
                  <input
                    className="w-full text-[12px] px-[11px] outline-none"
                    style={inputStyle}
                    placeholder={ui.placeholders.fadeFramerate}
                    type="number"
                    min={1}
                    value={form.fadeFramerate}
                    onChange={updateInput("fadeFramerate")}
                  />
                </div>
              )}

              {!hiddenSet.has("path") && (
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12px]" style={{ color: t.textPrimary }}>
                    {ui.labels.path}
                  </label>
                  <input
                    className="w-full text-[12px] px-[11px] outline-none"
                    style={inputStyle}
                    placeholder={ui.placeholders.path}
                    value={form.path}
                    onChange={updateInput("path")}
                  />
                </div>
              )}

              {showUsername && (
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12px]" style={{ color: t.textPrimary }}>
                    {ui.labels.username}
                  </label>
                  <input
                    className="w-full text-[12px] px-[11px] outline-none"
                    style={inputStyle}
                    placeholder={ui.placeholders.username}
                    value={form.username}
                    onChange={updateInput("username")}
                  />
                </div>
              )}

              {!hiddenSet.has("oscPrefix") && (
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12px]" style={{ color: t.textPrimary }}>
                    {ui.labels.oscPrefix}
                  </label>
                  <input
                    className="w-full text-[12px] px-[11px] outline-none"
                    style={inputStyle}
                    placeholder={ui.placeholders.oscPrefix}
                    value={form.oscPrefix}
                    onChange={updateInput("oscPrefix")}
                  />
                </div>
              )}

              {!hiddenSet.has("password") && (
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12px]" style={{ color: t.textPrimary }}>
                    {ui.labels.password}
                  </label>
                  <input
                    className="w-full text-[12px] px-[11px] outline-none"
                    style={inputStyle}
                    type="password"
                    placeholder={ui.placeholders.password}
                    value={form.password}
                    onChange={updateInput("password")}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleSubmitClick();
                      if (e.key === "Escape") onCancel();
                    }}
                  />
                </div>
              )}
            </>
          )}

          {missingRequiredLabels.length > 0 ? (
            <div
              className="rounded-sm px-[10px] py-[8px] text-[12px]"
              style={{
                color: P.text200,
                backgroundColor: "rgba(30,41,57,0.65)",
                border: "1px solid rgba(106,114,130,0.55)",
              }}
            >
              Required fields: {missingRequiredLabels.join(", ")}
            </div>
          ) : null}

          {errorMessage ? (
            <div
              className="rounded-sm px-[10px] py-[8px] text-[12px]"
              style={{
                color: P.text200,
                backgroundColor: "rgba(30,41,57,0.72)",
                border: "1px solid rgba(106,114,130,0.6)",
              }}
            >
              {errorMessage}
            </div>
          ) : null}

          <div className="flex items-center gap-[10px] mt-[4px]">
            <motion.button
              className="flex-1 text-[14px] border transition-colors hover:bg-[var(--btn-hover)]"
              style={{
                height: 35,
                color: t.textPrimary,
                backgroundColor: "transparent",
                borderColor: t.inputBorder,
              }}
              onClick={onCancel}
              disabled={submitting}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.1 }}
            >
              Cancel
            </motion.button>
            <motion.button
              className="flex-1 text-[14px] border transition-colors"
              style={{
                height: 35,
                backgroundColor: hasRequiredFields ? P.surface700 : P.surface600,
                color: P.text50,
                borderColor: t.inputBorder,
                cursor: hasRequiredFields && !submitting ? "pointer" : "not-allowed",
              }}
              onClick={handleSubmitClick}
              disabled={submitting}
              onMouseEnter={e => {
                if (!hasRequiredFields || submitting) return;
                e.currentTarget.style.backgroundColor = P.surface600;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = hasRequiredFields ? P.surface700 : P.surface600;
              }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.1 }}
            >
              {submitting ? "Saving..." : submitLabel}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
