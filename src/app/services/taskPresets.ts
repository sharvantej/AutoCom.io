import type { Connection, TaskEntry } from "../types";
import { createEntityId } from "./ids";

type RawShortcutDefinition = {
  id: string;
  label: string;
  action?: string;
  protocol?: string;
  params?: Record<string, unknown>;
};

type RawShortcutModule = {
  id: string;
  name: string;
  connectionType?: string;
  protocol?: string;
  shortcuts: RawShortcutDefinition[];
};

export type TaskShortcut = {
  id: string;
  label: string;
  moduleId: string;
  moduleName: string;
  connectionType?: string;
  protocol?: string;
  action?: string;
  params: Record<string, unknown>;
};

const EXTRA_SHORTCUT_MODULES: RawShortcutModule[] = [
  {
    id: "vmix-builtins",
    name: "vMix",
    connectionType: "vmix",
    protocol: "tcp",
    shortcuts: [
      { id: "cut_direct", label: "Cut Direct", action: "command", params: { command: "FUNCTION CutDirect", lineEnd: "crlf" } },
      { id: "fade", label: "Fade", action: "command", params: { command: "FUNCTION Fade", lineEnd: "crlf" } },
      { id: "overlay_in", label: "Overlay 1 In", action: "command", params: { command: "FUNCTION OverlayInput1In Input=1", lineEnd: "crlf" } },
      { id: "overlay_out", label: "Overlay 1 Out", action: "command", params: { command: "FUNCTION OverlayInput1Out", lineEnd: "crlf" } },
      { id: "record_start", label: "Start Recording", action: "command", params: { command: "FUNCTION StartRecording", lineEnd: "crlf" } },
      { id: "record_stop", label: "Stop Recording", action: "command", params: { command: "FUNCTION StopRecording", lineEnd: "crlf" } },
      { id: "stream_start", label: "Start Streaming", action: "command", params: { command: "FUNCTION StartStreaming", lineEnd: "crlf" } },
      { id: "stream_stop", label: "Stop Streaming", action: "command", params: { command: "FUNCTION StopStreaming", lineEnd: "crlf" } },
      { id: "audio_on_1", label: "Audio On Input 1", action: "command", params: { command: "FUNCTION AudioOn Input=1", lineEnd: "crlf" } },
      { id: "audio_off_1", label: "Audio Off Input 1", action: "command", params: { command: "FUNCTION AudioOff Input=1", lineEnd: "crlf" } },
    ],
  },
  {
    id: "malighting-grandma2",
    name: "MA Lighting grandMA2",
    connectionType: "grandma2",
    protocol: "tcp",
    shortcuts: [
      {
        id: "button_press_release",
        label: "Button Press/Release",
        action: "command",
        params: { command: "Button 11 press", lineEnd: "crlf", definitionId: "button", options: { button: 11, dir: "true" } },
      },
      {
        id: "encoder_press_release",
        label: "Encoder Press/Release",
        action: "command",
        params: { command: "Encoder 1 Press/Release", lineEnd: "crlf", definitionId: "encoder_p", options: { encoder_from_variable: false, enc: 1, encoder_variable: 1 } },
      },
      {
        id: "move_wheel_up_down",
        label: "Move wheel up/down",
        action: "command",
        params: { command: "Wheel 1", lineEnd: "crlf", definitionId: "wheel", options: { steps: 1 } },
      },
      {
        id: "rotate_encoder",
        label: "Rotate Encoder",
        action: "command",
        params: { command: "Encoder 1 Rotate 1", lineEnd: "crlf", definitionId: "encoder", options: { encoder_from_variable: false, enc: 1, encoder_variable: 1, steps: 1 } },
      },
      {
        id: "run_custom_command",
        label: "Run Custom Command",
        action: "command",
        params: { command: "Go+", lineEnd: "crlf", definitionId: "command", options: {} },
      },
    ],
  },
  {
    id: "malighting-grandma3-companion",
    name: "MA Lighting grandMA3 (Companion fields)",
    connectionType: "grandma3",
    protocol: "osc",
    shortcuts: [
      { id: "at_menu", label: "At Menu", action: "command", params: { command: "At Full", definitionId: "atmenu", options: { atmenu: "At Full" } } },
      { id: "call_macro_name", label: "Call Macro via name", action: "command", params: { command: "Macro \"Cool Macro 456\"", definitionId: "macro_name", options: { macro: "Cool Macro 456" } } },
      { id: "call_macro_number", label: "Call Macro via number", action: "command", params: { command: "Macro 1", definitionId: "macro", options: { macro: 1 } } },
      { id: "call_plugin_name", label: "Call Plugin via name", action: "command", params: { command: "Plugin \"Cool Plugin 123\"", definitionId: "plugin_name", options: { plugin: "Cool Plugin 123" } } },
      { id: "call_plugin_number", label: "Call Plugin via number", action: "command", params: { command: "Plugin 1", definitionId: "plugin", options: { plugin: 1 } } },
      { id: "executor_button", label: "Executor Button", action: "command", params: { command: "Page 1; ExecutorButton 201 push", definitionId: "exec_button", options: { page: 1, current_page: false, button_number: 201, button_state: "push" } } },
      { id: "run_command", label: "Run Command", action: "command", params: { command: "SelectFixtures Group 1", definitionId: "command", options: { command: "SelectFixtures Group 1" } } },
      { id: "select_group_name", label: "Select Group via name", action: "command", params: { command: "Group \"Front Lights\"", definitionId: "group_name", options: { group: "Front Lights" } } },
      { id: "select_group_number", label: "Select Group via number", action: "command", params: { command: "Group 1", definitionId: "group", options: { group: 1 } } },
      { id: "select_matrick_name", label: "Select MAtrick via name", action: "command", params: { command: "MAtricks \"Odd\"", definitionId: "matrick_name", options: { matrick: "Odd" } } },
      { id: "select_matrick_number", label: "Select MAtrick via number", action: "command", params: { command: "MAtricks 1", definitionId: "matrick", options: { matrick: 1 } } },
      { id: "select_quickey_name", label: "Select Quickey via name", action: "command", params: { command: "Quickey \"OOPS\"", definitionId: "quickey_name", options: { quickey: "OOPS" } } },
      { id: "select_quickey_number", label: "Select Quickey via number", action: "command", params: { command: "Quickey 1", definitionId: "quickey", options: { quickey: 1 } } },
      { id: "select_sequence_name", label: "Select Sequence via name", action: "command", params: { command: "Sequence \"Random Strobe\"", definitionId: "sequence_name", options: { sequence: "Random Strobe" } } },
      { id: "select_sequence_number", label: "Select Sequence via number", action: "command", params: { command: "Sequence 1", definitionId: "sequence", options: { sequence: 1 } } },
    ],
  },
  {
    id: "bitfocus-companion-remote",
    name: "Bitfocus Companion Remote",
    connectionType: "companion_remote",
    protocol: "tcp",
    shortcuts: [
      { id: "press_1_1", label: "Press 1:1", action: "command", params: { command: "PRESS 1 1", lineEnd: "lf" } },
      { id: "release_1_1", label: "Release 1:1", action: "command", params: { command: "RELEASE 1 1", lineEnd: "lf" } },
      { id: "press_1_2", label: "Press 1:2", action: "command", params: { command: "PRESS 1 2", lineEnd: "lf" } },
      { id: "release_1_2", label: "Release 1:2", action: "command", params: { command: "RELEASE 1 2", lineEnd: "lf" } },
      { id: "page_1", label: "Set Page 1", action: "command", params: { command: "PAGE-SET 1", lineEnd: "lf" } },
      { id: "page_2", label: "Set Page 2", action: "command", params: { command: "PAGE-SET 2", lineEnd: "lf" } },
      { id: "bank_1", label: "Set Bank 1", action: "command", params: { command: "BANK-SET 1", lineEnd: "lf" } },
      { id: "bank_2", label: "Set Bank 2", action: "command", params: { command: "BANK-SET 2", lineEnd: "lf" } },
      { id: "ping", label: "Ping", action: "command", params: { command: "PING", lineEnd: "lf" } },
      { id: "reset", label: "Reset", action: "command", params: { command: "RESET", lineEnd: "lf" } },
    ],
  },
];

let shortcutModulesPromise: Promise<RawShortcutModule[]> | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sanitizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeParams(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  return record ? JSON.parse(JSON.stringify(record)) as Record<string, unknown> : {};
}

function sanitizeShortcutDefinition(value: unknown): RawShortcutDefinition | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = sanitizeString(record.id);
  const label = sanitizeString(record.label) || id;
  if (!id || !label) return null;
  return {
    id,
    label,
    action: sanitizeString(record.action) || undefined,
    protocol: sanitizeString(record.protocol) || undefined,
    params: sanitizeParams(record.params),
  };
}

function sanitizeShortcutModule(value: unknown): RawShortcutModule | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = sanitizeString(record.id);
  const name = sanitizeString(record.name) || id;
  if (!id || !name) return null;
  const shortcuts = Array.isArray(record.shortcuts)
    ? record.shortcuts
        .map(sanitizeShortcutDefinition)
        .filter((item): item is RawShortcutDefinition => item !== null)
    : [];
  if (!shortcuts.length) return null;
  return {
    id,
    name,
    connectionType: sanitizeString(record.connectionType) || undefined,
    protocol: sanitizeString(record.protocol) || undefined,
    shortcuts,
  };
}

async function fetchShortcutModules(): Promise<RawShortcutModule[]> {
  for (const url of ["/shortcuts.json"]) {
    try {
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) continue;
      const raw = await response.json() as unknown;
      const modules = Array.isArray(asRecord(raw)?.modules)
        ? (asRecord(raw)?.modules as unknown[])
        : [];
      return modules
        .map(sanitizeShortcutModule)
        .filter((module): module is RawShortcutModule => module !== null);
    } catch {
      // Try the next catalog alias.
    }
  }
  return [];
}

export async function loadTaskShortcutModules(): Promise<RawShortcutModule[]> {
  if (!shortcutModulesPromise) {
    shortcutModulesPromise = fetchShortcutModules().then((modules) => [
      ...modules,
      ...EXTRA_SHORTCUT_MODULES,
    ]);
  }
  return shortcutModulesPromise;
}

function ensureLeadingSlash(value: string): string {
  if (!value) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

function defaultOscPrefix(connection: Connection): string {
  const prefix = sanitizeString(connection.oscPrefix);
  return ensureLeadingSlash(prefix || "/cmd");
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function normalizeOscArgs(params: Record<string, unknown>): unknown[] {
  const fromArgs = params.args;
  if (Array.isArray(fromArgs)) return fromArgs;
  const parsed = parseJsonValue(params.argsText);
  if (Array.isArray(parsed)) return parsed;
  if (parsed === undefined) return [];
  return [parsed];
}

function normalizeHttpBody(params: Record<string, unknown>): unknown {
  return parseJsonValue(params.body ?? params.bodyText);
}

function normalizeHttpHeaders(params: Record<string, unknown>): unknown {
  return parseJsonValue(params.headers ?? params.headersText);
}

function normalizeShortcutParams(
  connection: Connection,
  shortcut: TaskShortcut,
): Record<string, unknown> {
  const device = sanitizeString(connection.device).toLowerCase();
  const baseProtocol = sanitizeString(shortcut.protocol) || sanitizeString(connection.protocol).toLowerCase();
  const params = sanitizeParams(shortcut.params);

  switch (device) {
    case "atem":
      return {
        protocol: "udp",
        action: sanitizeString(shortcut.action) || "command",
        command: sanitizeString(params.command),
        lineEnd: sanitizeString(params.lineEnd) || "none",
      };
    case "resolume":
      return {
        protocol: "osc",
        action: "osc",
        address: ensureLeadingSlash(
          sanitizeString(params.address) || sanitizeString(params.command),
        ),
        args: normalizeOscArgs(params),
      };
    case "grandma3": {
      const command = sanitizeString(params.command) || (sanitizeString(params.cue) ? `Go+ Cue ${sanitizeString(params.cue)}` : "");
      const definitionId = sanitizeString(params.definitionId);
      const options = sanitizeParams(params.options);
      const grandma3Fields = sanitizeParams(params.grandma3Fields);
      return {
        protocol: "osc",
        action: "osc",
        address: defaultOscPrefix(connection),
        args: command ? [command] : [],
        ...(definitionId ? { definitionId } : {}),
        ...(Object.keys(options).length ? { options } : {}),
        ...(Object.keys(grandma3Fields).length ? { grandma3Fields } : {}),
        ...(command ? { grandma3Command: command } : {}),
      };
    }
    case "grandma2": {
      const command = sanitizeString(params.command) || (sanitizeString(params.cue) ? `Go+ Cue ${sanitizeString(params.cue)}` : "");
      const definitionId = sanitizeString(params.definitionId);
      const options = sanitizeParams(params.options);
      const grandma2Function = sanitizeString(params.grandma2Function);
      return {
        protocol: "tcp",
        action: "command",
        command,
        lineEnd: sanitizeString(params.lineEnd) || "crlf",
        ...(definitionId ? { definitionId } : {}),
        ...(Object.keys(options).length ? { options } : {}),
        ...(grandma2Function ? { grandma2Function } : {}),
      };
    }
    case "http_api":
      return {
        protocol: baseProtocol || "http",
        action: "http",
        method: sanitizeString(params.method) || "GET",
        path: sanitizeString(params.path) || "/",
        headers: normalizeHttpHeaders(params),
        body: normalizeHttpBody(params),
      };
    case "obs":
      return {
        protocol: baseProtocol || "ws",
        action: sanitizeString(shortcut.action) || "command",
        command: sanitizeString(params.command),
        requestType: sanitizeString(params.requestType) || undefined,
        requestData: parseJsonValue(params.requestData),
      };
    case "x32":
    case "generic_osc":
      return {
        protocol: "osc",
        action: "osc",
        address: ensureLeadingSlash(
          sanitizeString(params.address) || sanitizeString(params.command),
        ),
        args: normalizeOscArgs(params),
      };
    case "ross_talk":
    case "ross_xpression":
      return {
        protocol: "rosstalk",
        action: sanitizeString(shortcut.action) || "rosstalk",
        command: sanitizeString(params.command),
        rosstalkMode: sanitizeString(params.rosstalkMode) || "raw",
        lineEnd: sanitizeString(params.lineEnd) || "crlf",
      };
    case "vmix":
    case "videohub":
    case "swp08":
    case "companion_remote":
    case "generic_tcp":
      return {
        protocol: baseProtocol || "tcp",
        action: sanitizeString(shortcut.action) || "command",
        command: sanitizeString(params.command),
        lineEnd:
          sanitizeString(params.lineEnd) ||
          (baseProtocol === "udp" ? "none" : "crlf"),
      };
    default:
      return {
        protocol: baseProtocol || "tcp",
        action: sanitizeString(shortcut.action) || "command",
        ...params,
      };
  }
}

function supportsModuleConnection(module: RawShortcutModule, connection: Connection): boolean {
  const device = sanitizeString(connection.device).toLowerCase();
  const moduleConnectionType = sanitizeString(module.connectionType).toLowerCase();

  if (moduleConnectionType) {
    return moduleConnectionType === device;
  }

  if (module.id === "generic-tcp-udp") {
    if (device === "generic_tcp" || device === "companion_remote") return true;
    if (device === "generic_osc") return true;
  }

  return false;
}

function supportsShortcutConnection(
  module: RawShortcutModule,
  shortcut: RawShortcutDefinition,
  connection: Connection,
): boolean {
  const device = sanitizeString(connection.device).toLowerCase();
  const protocol = sanitizeString(shortcut.protocol || module.protocol).toLowerCase();

  if (!supportsModuleConnection(module, connection)) return false;

  if (module.id !== "generic-tcp-udp") return true;

  if (device === "generic_osc") return protocol === "osc";
  if (device === "generic_tcp" || device === "companion_remote") {
    return protocol === "tcp" || protocol === "udp";
  }

  return false;
}

export function getTaskShortcutsForConnection(
  connection: Connection | undefined,
  modules: RawShortcutModule[],
): TaskShortcut[] {
  if (!connection) return [];

  const shortcuts: TaskShortcut[] = [];

  for (const module of modules) {
    for (const shortcut of module.shortcuts) {
      if (!supportsShortcutConnection(module, shortcut, connection)) continue;

      shortcuts.push({
        id: `${module.id}:${shortcut.id}`,
        label: shortcut.label,
        moduleId: module.id,
        moduleName: module.name,
        connectionType: module.connectionType,
        protocol: sanitizeString(shortcut.protocol || module.protocol) || undefined,
        action: shortcut.action,
        params: sanitizeParams(shortcut.params),
      });
    }
  }

  return shortcuts.sort((left, right) => left.label.localeCompare(right.label));
}

export function buildTaskFromShortcut(
  connection: Connection,
  shortcut: TaskShortcut,
): TaskEntry {
  return {
    id: createEntityId("task"),
    connection: connection.name,
    connectionId: connection.id,
    mode: "Shortcut",
    category: shortcut.moduleName,
    funcName: shortcut.label,
    input: "",
    value: "",
    pause: "",
    label: `${shortcut.moduleName}: ${shortcut.label}`,
    shortcutId: shortcut.id,
    presetId: shortcut.id,
    params: normalizeShortcutParams(connection, shortcut),
  };
}
