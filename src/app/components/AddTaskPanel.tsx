/**
 * AddTaskPanel — exact Figma design (19-2419)
 * Renders as an absolute overlay inside the 480px right panel.
 * Layout: header | scrollable form + task list | footer
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import svgPaths from "../assets/generated/add-task-panel-svg";
import { Checkbox } from "./ui/checkbox";
import { useTheme } from "../context/AppContext";
import { getTaskCatalogue } from "../services/dashboardTasks";
import {
  buildVmixCommand,
  buildVmixTask,
  getVmixCategories,
  getVmixFunctionByName,
  getVmixFunctionsForCategory,
  loadVmixShortcutCatalog,
  type VmixShortcutCatalog,
  type VmixShortcutFunction,
} from "../services/vmixShortcuts";
import {
  fetchObsRuntimeCatalogue,
  type ObsRuntimeCatalogue,
} from "../services/obsDiscovery";
import { createEntityId } from "../services/ids";
import type { Connection, TaskEntry } from "../types";
import { APP_THEME_PALETTE } from "../styles/palette";
import { loadSwp08RouterNames, loadVideohubRouterLabels } from "../services/runtimeState";
import { isTauri, tauriInvoke } from "../services/tauri";
import { compileDashboardRows } from "../services/dashboardTasks";

// Re-export so callers don't need to know where the type lives
export type { TaskEntry };

type Props = {
  tasks: TaskEntry[];
  connections: Connection[];
  onClose: () => void;
  onSave: (tasks: TaskEntry[]) => void;
  variant?: "popup" | "workspace";
  title?: string;
  onDraftChange?: (tasks: TaskEntry[]) => void;
  selectedTaskId?: string | null;
  selectedTask?: TaskEntry | null;
  onSelectionChange?: (id: string | null) => void;
  showWorkspaceTaskActions?: boolean;
  onWorkspaceActionsChange?: (actions: WorkspaceTaskActions | null) => void;
};
export type WorkspaceTaskActions = {
  canAdd: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canTest: boolean;
  testing: boolean;
  testMessage: string | null;
  add: () => void;
  update: () => void;
  remove: () => void;
  test: () => void;
};

type ResolumeMasterAction = "+" | "-" | "=";
type ResolumeCompositionChangeFunction =
  | "Composition Master Change"
  | "Composition Opacity Change"
  | "Composition Speed Change"
  | "Composition Volume Change";
type ResolumeClipChangeFunction =
  | "Clip Opacity Change"
  | "Clip Speed Change"
  | "Clip Volume Change";
type ResolumeClipSelectionFunction =
  | "Select Clip"
  | "Trigger Clip";
type ResolumeColumnActionFunction =
  | "Connect Column"
  | "Connect Layer Group Column"
  | "Select Column"
  | "Select Layer Group Column";
type ResolumeLayerColumnStepFunction =
  | "Layer Next Column"
  | "Layer Previous Column";
type ResolumeLayerGroupColumnStepFunction =
  | "Layer Group Next Column"
  | "Layer Group Previous Column";
type ResolumeToggleFunction =
  | "Bypass Layer"
  | "Bypass Layer Group"
  | "Solo Layer"
  | "Solo Layer Group";
type ResolumeToggleAction = "toggle" | "on" | "off";
type ResolumeLayerChangeFunction =
  | "Layer Master Change"
  | "Layer Opacity Change"
  | "Layer Transition Duration Change"
  | "Layer Volume Change";
type ResolumeLayerGroupChangeFunction =
  | "Layer Group Master Change"
  | "Layer Group Opacity Change"
  | "Layer Group Speed Change"
  | "Layer Group Volume Change";
type ResolumeLayerSelectFunction =
  | "Select Layer"
  | "Select Layer Group";
type ResolumeLayerClearFunction =
  | "Clear All Layers"
  | "Clear Layer"
  | "Clear Layer Group";
type ResolumeCompositionColumnStepFunction =
  | "Composition Next Column"
  | "Composition Previous Column";
type ResolumeDeckSelectFunction = "Select Deck";
type ResolumeDeckStepFunction =
  | "Select Next Deck"
  | "Select Previous Deck";
type ResolumeCustomOscFunction = "Custom OSC Command";
const WAIT_CONNECTION_VALUE = "__wait__";
const WAIT_FUNC_NAME = "Wait";
const P = APP_THEME_PALETTE;
type Swp08NameOption = { value: string; label: string };
type VideohubNameOption = { value: string; label: string };
const SWP08_NAMES_CACHE = new Map<string, {
  sourceOptions: Swp08NameOption[];
  destinationOptions: Swp08NameOption[];
  fetchedAt: number;
}>();
const VIDEOHUB_NAMES_CACHE = new Map<string, {
  sourceOptions: VideohubNameOption[];
  destinationOptions: VideohubNameOption[];
  fetchedAt: number;
}>();
const ROSS_XPRESSION_CUSTOM_COMMAND_REFERENCE: Array<{
  command: string;
  syntax: string;
  note?: string;
}> = [
  { command: "CLRA", syntax: "CLRA", note: "Clear all framebuffers." },
  { command: "CLFB", syntax: "CLFB <framebuffer>", note: "Clear a framebuffer." },
  { command: "CLFB (layer)", syntax: "CLFB <framebuffer>:<layer>", note: "Clear one layer in a framebuffer." },
  { command: "SWAP", syntax: "SWAP [framebuffer]", note: "Swap all or one framebuffer." },
  { command: "SEQI", syntax: "SEQI <takeId>:<layer>", note: "Take item to air on layer." },
  { command: "TAKE", syntax: "TAKE <takeId>:<framebuffer>:<layer>", note: "Take item to framebuffer layer." },
  { command: "CUE", syntax: "CUE <takeId>:<framebuffer>:<layer>", note: "Ready item in framebuffer layer." },
  { command: "UNCUE", syntax: "UNCUE <takeId>", note: "Remove item from cue state." },
  { command: "UNCUEALL", syntax: "UNCUEALL", note: "Remove all cued items." },
  { command: "RESUME", syntax: "RESUME <framebuffer>[:<layer>]", note: "Resume framebuffer or layer." },
  { command: "LAYEROFF", syntax: "LAYEROFF <framebuffer>:<layer>", note: "Take layer off air." },
  { command: "UPNEXT", syntax: "UPNEXT <takeId>", note: "Set preview item." },
  { command: "FOCUS", syntax: "FOCUS <takeId>", note: "Set sequencer focus." },
  { command: "READ", syntax: "READ", note: "Take current sequencer item to air." },
  { command: "NEXT", syntax: "NEXT", note: "Take and advance sequencer." },
  { command: "UP / DOWN", syntax: "UP | DOWN", note: "Move sequencer focus." },
  { command: "SEQO", syntax: "SEQO <takeId>", note: "Take item off air." },
  { command: "GPI", syntax: "GPI <number>", note: "Trigger simulated GPI." },
];
const ROSS_XPRESSION_TAKE_ID_FUNCTIONS = new Set<string>([
  "Load take item to air on layer (SEQI)",
  "Load take item to framebuffer layer (TAKE)",
  "Ready item into a framebuffer layer (CUE)",
  "Remove take item from the cued state (UNCUE)",
  "Set preview to take item (UPNEXT)",
  "Set sequencer focus to take item (FOCUS)",
  "Take take item off air (SEQO)",
]);
const ROSS_XPRESSION_FRAMEBUFFER_FUNCTIONS = new Set<string>([
  "Clear framebuffer (CLFB)",
  "Clear layer in framebuffer (CLFB)",
  "Load cued items in framebuffer (SWAP)",
  "Load take item to framebuffer layer (TAKE)",
  "Ready item into a framebuffer layer (CUE)",
  "Resume all layers in framebuffer (RESUME)",
  "Resume layer in framebuffer (RESUME)",
  "Take layer in framebuffer off air (LAYEROFF)",
]);
const ROSS_XPRESSION_LAYER_FUNCTIONS = new Set<string>([
  "Clear layer in framebuffer (CLFB)",
  "Load take item to air on layer (SEQI)",
  "Load take item to framebuffer layer (TAKE)",
  "Ready item into a framebuffer layer (CUE)",
  "Resume layer in framebuffer (RESUME)",
  "Take layer in framebuffer off air (LAYEROFF)",
]);
const ROSS_TALK_CUSTOM_COMMAND_FUNCTIONS = new Set<string>([
  "Send Custom Command",
  "Send a custom command",
]);
const ROSS_TALK_FUNCTIONS_WITHOUT_EXTRA_FIELDS = new Set<string>([
  "Fade to Black",
]);
const ROSS_TALK_FUNCTION_ORDER: string[] = [
  "Auto Transition",
  "Change Multiviewer Box",
  "Cut",
  "Fade to Black",
  "Fire Custom Control",
  "Load Set",
  "MEM",
  "Send a custom command",
  "Send Custom Command",
  "SEQI",
  "SEQO",
  "Transition Keyer",
  "Trigger GPI",
  "Trigger GPI by Name",
  "Ultrix Timer",
  "XPT",
];
const ROSS_TALK_CUSTOM_COMMAND_REFERENCE: Array<{ command: string; syntax: string }> = [
  { command: "AUTO", syntax: "AUTO <ME:1>" },
  { command: "CUT", syntax: "CUT <ME:1>" },
  { command: "MVO", syntax: "MVO <multiviewer>:<box> <source>" },
  { command: "CC", syntax: "CC <bank>:<number>" },
  { command: "LOADSET", syntax: "LOADSET <setName> [location]" },
  { command: "MEM", syntax: "MEM <memoryId>" },
  { command: "SEQI", syntax: "SEQI <takeId> <layer>" },
  { command: "SEQO", syntax: "SEQO <takeId>" },
  { command: "TRANSKEY", syntax: "TRANSKEY <ME:1:keyer> <CUT|AUTO|CUTON|CUTOFF|AUTOON|AUTOOFF>" },
  { command: "GPI", syntax: "GPI <number>" },
  { command: "GPINAME", syntax: "GPINAME <name> [parameter]" },
  { command: "XPT", syntax: "XPT <destination> <source>" },
];
const OBS_SCENE_FUNCTION_TO_REQUEST: Record<string, string> = {
  "Set Program Scene": "SetCurrentProgramScene",
  "Set Preview Scene": "SetCurrentPreviewScene",
  "Smart Scene Switcher": "SetCurrentPreviewScene",
};
const OBS_SCENE_FUNCTIONS = new Set<string>(Object.keys(OBS_SCENE_FUNCTION_TO_REQUEST));
type ObsFunctionSpec = {
  requestType: string;
  defaultRequestData?: Record<string, unknown>;
  parameterKind?: "scenes" | "sceneItems" | "inputs" | "transitions" | "profiles" | "sceneCollections" | "outputs" | "hotkeys";
  parameterKey?: string;
  parameterLabel?: string;
  valueLabel?: string;
  fields?: Array<{
    key: string;
    label: string;
    type: "text" | "number" | "select" | "json";
    placeholder?: string;
    options?: string[];
    optionsKind?: ObsFunctionSpec["parameterKind"];
    defaultValue?: string;
  }>;
};
type GrandMA3FieldSpec = {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
};
type GrandMA3FunctionSpec = {
  definitionId: string;
  fields: GrandMA3FieldSpec[];
  toOptions: (values: Record<string, string>) => Record<string, unknown>;
  buildCommand: (values: Record<string, string>) => string;
  summary: (values: Record<string, string>) => string;
};
const GRANDMA3_AT_MENU_ITEMS: string[] = [
  "At Full",
  "At Zero",
  "At Default",
  "Cut Programmer",
  "At Normal",
  "Copy Programmer",
  "On Selection",
  "Paste Programmer",
  "Off Selection",
  "At Release",
  "Delete Programmer",
  "At Remove",
];
const GRANDMA3_EXEC_BUTTON_STATE_OPTIONS: string[] = ["push", "release"];
const GRANDMA3_CURRENT_PAGE_OPTIONS: string[] = ["false", "true"];
function quoteGrandMA3Token(value: string): string {
  const escaped = value.replace(/"/g, '\\"');
  return `"${escaped}"`;
}
const GRANDMA3_FUNCTION_SPECS: Record<string, GrandMA3FunctionSpec> = {
  "At Menu": {
    definitionId: "atmenu",
    fields: [
      { key: "menuItem", label: "At Menu Item", type: "select", options: GRANDMA3_AT_MENU_ITEMS, defaultValue: "At Full" },
    ],
    toOptions: (values) => ({ atmenu: values.menuItem ?? "" }),
    buildCommand: (values) => {
      const menuItem = (values.menuItem ?? "").trim();
      return menuItem ? menuItem : "";
    },
    summary: (values) => (values.menuItem ?? "").trim(),
  },
  "Call Macro via name": {
    definitionId: "macro_name",
    fields: [{ key: "name", label: "Macro Name", type: "text", placeholder: "Macro Name" }],
    toOptions: (values) => ({ macro: values.name ?? "" }),
    buildCommand: (values) => {
      const name = (values.name ?? "").trim();
      return name ? `Macro ${quoteGrandMA3Token(name)}` : "";
    },
    summary: (values) => (values.name ?? "").trim(),
  },
  "Call Macro via number": {
    definitionId: "macro",
    fields: [{ key: "number", label: "Macro Number", type: "text", placeholder: "1" }],
    toOptions: (values) => ({ macro: Number.parseInt(values.number ?? "", 10) || 0 }),
    buildCommand: (values) => {
      const number = (values.number ?? "").trim();
      return number ? `Macro ${number}` : "";
    },
    summary: (values) => (values.number ?? "").trim(),
  },
  "Call Plugin via name": {
    definitionId: "plugin_name",
    fields: [{ key: "name", label: "Plugin Name", type: "text", placeholder: "Plugin Name" }],
    toOptions: (values) => ({ plugin: values.name ?? "" }),
    buildCommand: (values) => {
      const name = (values.name ?? "").trim();
      return name ? `Plugin ${quoteGrandMA3Token(name)}` : "";
    },
    summary: (values) => (values.name ?? "").trim(),
  },
  "Call Plugin via number": {
    definitionId: "plugin",
    fields: [{ key: "number", label: "Plugin Number", type: "text", placeholder: "1" }],
    toOptions: (values) => ({ plugin: Number.parseInt(values.number ?? "", 10) || 0 }),
    buildCommand: (values) => {
      const number = (values.number ?? "").trim();
      return number ? `Plugin ${number}` : "";
    },
    summary: (values) => (values.number ?? "").trim(),
  },
  "Executor Button": {
    definitionId: "exec_button",
    fields: [
      { key: "page", label: "Page", type: "text", placeholder: "1", defaultValue: "1" },
      { key: "current_page", label: "Current Page", type: "select", options: GRANDMA3_CURRENT_PAGE_OPTIONS, defaultValue: "false" },
      { key: "button_number", label: "Button Number", type: "text", placeholder: "201", defaultValue: "201" },
      { key: "button_state", label: "Button State", type: "select", options: GRANDMA3_EXEC_BUTTON_STATE_OPTIONS, defaultValue: "push" },
    ],
    toOptions: (values) => ({
      page: Number.parseInt(values.page ?? "", 10) || 1,
      current_page: (values.current_page ?? "false") === "true",
      button_number: Number.parseInt(values.button_number ?? "", 10) || 0,
      button_state: values.button_state ?? "push",
    }),
    buildCommand: (values) => {
      const page = (values.page ?? "1").trim();
      const currentPage = (values.current_page ?? "false") === "true";
      const button = (values.button_number ?? "").trim();
      const state = (values.button_state ?? "push").trim();
      if (!button) return "";
      return currentPage
        ? `ExecutorButton ${button} ${state}`
        : `Page ${page}; ExecutorButton ${button} ${state}`;
    },
    summary: (values) => {
      const page = (values.page ?? "1").trim();
      const currentPage = (values.current_page ?? "false") === "true";
      const button = (values.button_number ?? "").trim();
      const state = (values.button_state ?? "push").trim();
      return currentPage ? `Current Page, Button ${button}, ${state}` : `Page ${page}, Button ${button}, ${state}`;
    },
  },
  "Run Command": {
    definitionId: "command",
    fields: [{ key: "command", label: "Command", type: "text", placeholder: "Go+ Sequence 1 Cue 1" }],
    toOptions: (values) => ({ command: values.command ?? "" }),
    buildCommand: (values) => (values.command ?? "").trim(),
    summary: (values) => (values.command ?? "").trim(),
  },
  "Select Group via name": {
    definitionId: "group_name",
    fields: [{ key: "name", label: "Group Name", type: "text", placeholder: "Group Name" }],
    toOptions: (values) => ({ group: values.name ?? "" }),
    buildCommand: (values) => {
      const name = (values.name ?? "").trim();
      return name ? `Group ${quoteGrandMA3Token(name)}` : "";
    },
    summary: (values) => (values.name ?? "").trim(),
  },
  "Select Group via number": {
    definitionId: "group",
    fields: [{ key: "number", label: "Group Number", type: "text", placeholder: "1" }],
    toOptions: (values) => ({ group: Number.parseInt(values.number ?? "", 10) || 0 }),
    buildCommand: (values) => {
      const number = (values.number ?? "").trim();
      return number ? `Group ${number}` : "";
    },
    summary: (values) => (values.number ?? "").trim(),
  },
  "Select MAtrick via name": {
    definitionId: "matrick_name",
    fields: [{ key: "name", label: "MAtricks Name", type: "text", placeholder: "MAtricks Name" }],
    toOptions: (values) => ({ matrick: values.name ?? "" }),
    buildCommand: (values) => {
      const name = (values.name ?? "").trim();
      return name ? `MAtricks ${quoteGrandMA3Token(name)}` : "";
    },
    summary: (values) => (values.name ?? "").trim(),
  },
  "Select MAtrick via number": {
    definitionId: "matrick",
    fields: [{ key: "number", label: "MAtricks Number", type: "text", placeholder: "1" }],
    toOptions: (values) => ({ matrick: Number.parseInt(values.number ?? "", 10) || 0 }),
    buildCommand: (values) => {
      const number = (values.number ?? "").trim();
      return number ? `MAtricks ${number}` : "";
    },
    summary: (values) => (values.number ?? "").trim(),
  },
  "Select Quickey via name": {
    definitionId: "quickey_name",
    fields: [{ key: "name", label: "Quickey Name", type: "text", placeholder: "Quickey Name" }],
    toOptions: (values) => ({ quickey: values.name ?? "" }),
    buildCommand: (values) => {
      const name = (values.name ?? "").trim();
      return name ? `Quickey ${quoteGrandMA3Token(name)}` : "";
    },
    summary: (values) => (values.name ?? "").trim(),
  },
  "Select Quickey via number": {
    definitionId: "quickey",
    fields: [{ key: "number", label: "Quickey Number", type: "text", placeholder: "1" }],
    toOptions: (values) => ({ quickey: Number.parseInt(values.number ?? "", 10) || 0 }),
    buildCommand: (values) => {
      const number = (values.number ?? "").trim();
      return number ? `Quickey ${number}` : "";
    },
    summary: (values) => (values.number ?? "").trim(),
  },
  "Select Sequence via name": {
    definitionId: "sequence_name",
    fields: [{ key: "name", label: "Sequence Name", type: "text", placeholder: "Sequence Name" }],
    toOptions: (values) => ({ sequence: values.name ?? "" }),
    buildCommand: (values) => {
      const name = (values.name ?? "").trim();
      return name ? `Sequence ${quoteGrandMA3Token(name)}` : "";
    },
    summary: (values) => (values.name ?? "").trim(),
  },
  "Select Sequence via number": {
    definitionId: "sequence",
    fields: [{ key: "number", label: "Sequence Number", type: "text", placeholder: "1" }],
    toOptions: (values) => ({ sequence: Number.parseInt(values.number ?? "", 10) || 0 }),
    buildCommand: (values) => {
      const number = (values.number ?? "").trim();
      return number ? `Sequence ${number}` : "";
    },
    summary: (values) => (values.number ?? "").trim(),
  },
};
const OBS_FUNCTION_SPECS: Record<string, ObsFunctionSpec> = {
  "Toggle Recording": { requestType: "ToggleRecord" },
  "Start Recording": { requestType: "StartRecord" },
  "Stop Recording": { requestType: "StopRecord" },
  "Toggle Recording Pause": { requestType: "ToggleRecordPause" },
  "Pause Recording": { requestType: "PauseRecord" },
  "Resume Recording": { requestType: "ResumeRecord" },
  "Split Recording": { requestType: "SplitRecordFile" },
  "Start Streaming": { requestType: "StartStream" },
  "Stop Streaming": { requestType: "StopStream" },
  "Toggle Streaming": { requestType: "ToggleStream" },
  "Start Replay Buffer": { requestType: "StartReplayBuffer" },
  "Stop Replay Buffer": { requestType: "StopReplayBuffer" },
  "Toggle Replay Buffer": { requestType: "ToggleReplayBuffer" },
  "Save Replay Buffer": { requestType: "SaveReplayBuffer" },
  "Enable Studio Mode": {
    requestType: "SetStudioModeEnabled",
    defaultRequestData: { studioModeEnabled: true },
  },
  "Disable Studio Mode": {
    requestType: "SetStudioModeEnabled",
    defaultRequestData: { studioModeEnabled: false },
  },
  "Toggle Studio Mode": { requestType: "ToggleStudioMode" },
  Transition: { requestType: "TriggerStudioModeTransition" },
  "Preview Next Scene": {
    requestType: "AUTOCOM_PREVIEW_SCENE_STEP",
    fields: [{ key: "direction", label: "Direction", type: "select", options: ["next"], defaultValue: "next" }],
  },
  "Preview Previous Scene": {
    requestType: "AUTOCOM_PREVIEW_SCENE_STEP",
    fields: [{ key: "direction", label: "Direction", type: "select", options: ["previous"], defaultValue: "previous" }],
  },
  "Set Transition Type": {
    requestType: "SetCurrentSceneTransition",
    parameterKind: "transitions",
    parameterKey: "transitionName",
    parameterLabel: "Transition",
  },
  "Set Profile": {
    requestType: "SetCurrentProfile",
    parameterKind: "profiles",
    parameterKey: "profileName",
    parameterLabel: "Profile",
  },
  "Set Scene Collection": {
    requestType: "SetCurrentSceneCollection",
    parameterKind: "sceneCollections",
    parameterKey: "sceneCollectionName",
    parameterLabel: "Scene Collection",
  },
  "Start Output": {
    requestType: "StartOutput",
    parameterKind: "outputs",
    parameterKey: "outputName",
    parameterLabel: "Output",
  },
  "Stop Output": {
    requestType: "StopOutput",
    parameterKind: "outputs",
    parameterKey: "outputName",
    parameterLabel: "Output",
  },
  "Toggle Output": {
    requestType: "ToggleOutput",
    parameterKind: "outputs",
    parameterKey: "outputName",
    parameterLabel: "Output",
  },
  "Trigger Hotkey by ID": {
    requestType: "TriggerHotkeyByName",
    parameterKind: "hotkeys",
    parameterKey: "hotkeyName",
    parameterLabel: "Hotkey",
  },
  "Toggle Source Mute": {
    requestType: "ToggleInputMute",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
  },
  "Set Source Mute": {
    requestType: "SetInputMute",
    fields: [
      { key: "inputName", label: "Source", type: "select", optionsKind: "inputs" },
      { key: "inputMuted", label: "Mute", type: "select", options: ["on", "off", "toggle"], defaultValue: "toggle" },
    ],
  },
  "Set Source Volume": {
    requestType: "SetInputVolume",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
    valueLabel: "Volume in dB",
  },
  "Adjust Source Volume (dB)": {
    requestType: "OffsetInputVolume",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
    valueLabel: "Volume offset in dB",
  },
  "Adjust Source Volume (Percentage)": {
    requestType: "SetInputVolume",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
    valueLabel: "Percent Adjustment",
  },
  "Set Audio Monitor": {
    requestType: "SetInputAudioMonitorType",
    fields: [
      { key: "inputName", label: "Source", type: "select", optionsKind: "inputs" },
      {
        key: "monitorType",
        label: "Monitor Type",
        type: "select",
        options: [
          "OBS_MONITORING_TYPE_NONE",
          "OBS_MONITORING_TYPE_MONITOR_ONLY",
          "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT",
        ],
        defaultValue: "OBS_MONITORING_TYPE_NONE",
      },
    ],
  },
  "Set Audio Sync Offset": {
    requestType: "SetInputAudioSyncOffset",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
    valueLabel: "Sync Offset (ms)",
  },
  "Adjust Audio Sync Offset": {
    requestType: "OffsetInputAudioSyncOffset",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
    valueLabel: "Sync Offset Delta (ms)",
  },
  "Set Audio Balance": {
    requestType: "SetInputAudioBalance",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
    valueLabel: "Balance (0.0 left to 1.0 right)",
  },
  "Adjust Audio Balance": {
    requestType: "OffsetInputAudioBalance",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
    valueLabel: "Balance Delta",
  },
  "Play / Pause Media": {
    requestType: "TriggerMediaInputAction",
    fields: [
      { key: "inputName", label: "Media Source", type: "select", optionsKind: "inputs" },
      {
        key: "mediaAction",
        label: "Action",
        type: "select",
        options: [
          "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY",
          "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE",
          "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY_PAUSE",
          "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP",
        ],
        defaultValue: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY_PAUSE",
      },
    ],
  },
  "Restart Media": {
    requestType: "TriggerMediaInputAction",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Media Source",
  },
  "Stop Media": {
    requestType: "TriggerMediaInputAction",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Media Source",
  },
  "Next Media": {
    requestType: "TriggerMediaInputAction",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Media Source",
  },
  "Previous Media": {
    requestType: "TriggerMediaInputAction",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Media Source",
  },
  "Set Media Time": {
    requestType: "SetMediaInputCursor",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Media Source",
    valueLabel: "Timecode in seconds",
  },
  "Scrub Media": {
    requestType: "OffsetMediaInputCursor",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Media Source",
    valueLabel: "Scrub offset in seconds",
  },
  "Open Source Properties Window": {
    requestType: "OpenInputPropertiesDialog",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
  },
  "Open Source Filters Window": {
    requestType: "OpenInputFiltersDialog",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
  },
  "Open Source Interact Window": {
    requestType: "OpenInputInteractDialog",
    parameterKind: "inputs",
    parameterKey: "inputName",
    parameterLabel: "Source",
  },
  "Set Transition Duration": {
    requestType: "SetCurrentSceneTransitionDuration",
    fields: [
      { key: "transitionDuration", label: "Transition time (ms)", type: "number", defaultValue: "500" },
    ],
  },
  "Adjust Transition Duration": {
    requestType: "SetCurrentSceneTransitionDuration",
    fields: [
      { key: "transitionDuration", label: "Transition time (ms)", type: "number", defaultValue: "500" },
    ],
  },
  "Adjust Transition Type": {
    requestType: "AUTOCOM_TRANSITION_TYPE_STEP",
    fields: [
      { key: "direction", label: "Adjust", type: "select", options: ["next", "previous"], defaultValue: "next" },
    ],
  },
  "Quick Transition": {
    requestType: "TriggerStudioModeTransition",
  },
  "Set Stream Settings": {
    requestType: "SetStreamServiceSettings",
    fields: [
      { key: "streamServiceType", label: "Stream Type", type: "select", options: ["rtmp_custom", "rtmp_common"], defaultValue: "rtmp_custom" },
      { key: "streamServiceSettings.server", label: "Stream URL", type: "text" },
      { key: "streamServiceSettings.key", label: "Stream Key", type: "text" },
      { key: "streamServiceSettings.use_auth", label: "Use Authentication", type: "select", options: ["false", "true"], defaultValue: "false" },
      { key: "streamServiceSettings.username", label: "Username", type: "text" },
      { key: "streamServiceSettings.password", label: "Password", type: "text" },
    ],
  },
  "Create Record Chapter": {
    requestType: "CreateRecordChapter",
    fields: [{ key: "chapterName", label: "Chapter Name", type: "text" }],
  },
  "Send Stream Caption": {
    requestType: "SendStreamCaption",
    fields: [
      { key: "captionText", label: "Caption Text", type: "text" },
    ],
  },
  "Set Filter Visibility": {
    requestType: "AUTOCOM_FILTER_VISIBILITY",
    fields: [
      { key: "sourceName", label: "Source", type: "select", optionsKind: "inputs" },
      { key: "filterName", label: "Filter", type: "text" },
      { key: "filterEnabled", label: "Visibility", type: "select", options: ["on", "off", "toggle"], defaultValue: "toggle" },
    ],
  },
  "Set Filter Settings": {
    requestType: "SetSourceFilterSettings",
    fields: [
      { key: "sourceName", label: "Source", type: "select", optionsKind: "inputs" },
      { key: "filterName", label: "Filter", type: "text" },
      { key: "filterSettings", label: "Filter Settings JSON", type: "json", placeholder: "{\"left\":100}" },
    ],
  },
  "Set Source Visibility": {
    requestType: "AUTOCOM_SCENE_ITEM_VISIBILITY",
    fields: [
      { key: "sceneName", label: "Scene", type: "select", optionsKind: "scenes" },
      { key: "sceneItemId", label: "Scene Item", type: "select", optionsKind: "sceneItems" },
      { key: "sceneItemEnabled", label: "Visible", type: "select", options: ["on", "off", "toggle"], defaultValue: "toggle" },
    ],
  },
  "Set Source Transform": {
    requestType: "SetSceneItemTransform",
    fields: [
      { key: "sceneName", label: "Scene", type: "select", optionsKind: "scenes" },
      { key: "sceneItemId", label: "Scene Item", type: "select", optionsKind: "sceneItems" },
      { key: "sceneItemTransform.positionX", label: "Position X", type: "number" },
      { key: "sceneItemTransform.positionY", label: "Position Y", type: "number" },
      { key: "sceneItemTransform.scaleX", label: "Scale X", type: "number" },
      { key: "sceneItemTransform.scaleY", label: "Scale Y", type: "number" },
      { key: "sceneItemTransform.rotation", label: "Rotation", type: "number" },
    ],
  },
  "Set Source Text": {
    requestType: "SetInputSettings",
    fields: [
      { key: "inputName", label: "Source", type: "select", optionsKind: "inputs" },
      { key: "inputSettings.text", label: "Text", type: "text" },
    ],
  },
  "Set Text Properties": {
    requestType: "SetInputSettings",
    fields: [
      { key: "inputName", label: "Source", type: "select", optionsKind: "inputs" },
      { key: "inputSettings", label: "Properties JSON", type: "json", placeholder: "{\"font\":{\"size\":72}}" },
    ],
  },
  "Refresh Browser Source": {
    requestType: "PressInputPropertiesButton",
    fields: [
      { key: "inputName", label: "Source", type: "select", optionsKind: "inputs" },
      { key: "propertyName", label: "Property", type: "text", defaultValue: "refreshnocache" },
    ],
  },
  "Reset Video Capture Device": {
    requestType: "PressInputPropertiesButton",
    fields: [
      { key: "inputName", label: "Source", type: "select", optionsKind: "inputs" },
      { key: "propertyName", label: "Property", type: "text", defaultValue: "refresh" },
    ],
  },
  "Update Media Source Local File Path": {
    requestType: "SetInputSettings",
    fields: [
      { key: "inputName", label: "Media Source", type: "select", optionsKind: "inputs" },
      { key: "inputSettings.local_file", label: "File Path", type: "text" },
    ],
  },
  "Open Projector": {
    requestType: "OpenVideoMixProjector",
    fields: [
      { key: "videoMixType", label: "Projector Type", type: "select", options: ["OBS_WEBSOCKET_VIDEO_MIX_TYPE_PROGRAM", "OBS_WEBSOCKET_VIDEO_MIX_TYPE_PREVIEW"], defaultValue: "OBS_WEBSOCKET_VIDEO_MIX_TYPE_PROGRAM" },
      { key: "monitorIndex", label: "Monitor Index", type: "number", defaultValue: "0" },
      { key: "projectorGeometry", label: "Geometry (optional)", type: "text" },
    ],
  },
  "Take Screenshot": {
    requestType: "GetSourceScreenshot",
    fields: [
      { key: "sourceName", label: "Source", type: "select", optionsKind: "scenes" },
      { key: "imageFormat", label: "Format", type: "select", options: ["png", "jpg"], defaultValue: "png" },
      { key: "imageCompressionQuality", label: "Compression Quality (0-100)", type: "number", defaultValue: "0" },
    ],
  },
  "Fade Source Volume": {
    requestType: "AUTOCOM_FADE_INPUT_VOLUME",
    fields: [
      { key: "inputName", label: "Source", type: "select", optionsKind: "inputs" },
      { key: "targetDb", label: "Target Volume (dB)", type: "number", defaultValue: "0" },
      { key: "durationMs", label: "Fade Duration (ms)", type: "number", defaultValue: "500" },
    ],
  },
  "Trigger Hotkey by Key": {
    requestType: "TriggerHotkeyByKeySequence",
    fields: [
      { key: "keyId", label: "Key", type: "text", defaultValue: "OBS_KEY_A" },
      { key: "keyModifiers.shift", label: "Shift", type: "select", options: ["false", "true"], defaultValue: "false" },
      { key: "keyModifiers.alt", label: "Alt / Option", type: "select", options: ["false", "true"], defaultValue: "false" },
      { key: "keyModifiers.control", label: "Control", type: "select", options: ["false", "true"], defaultValue: "false" },
      { key: "keyModifiers.command", label: "Command (Mac)", type: "select", options: ["false", "true"], defaultValue: "false" },
    ],
  },
  "Custom Vendor Request": {
    requestType: "CallVendorRequest",
    fields: [
      { key: "vendorName", label: "Vendor Name", type: "text" },
      { key: "requestType", label: "Request Type", type: "text" },
      { key: "requestData", label: "Request Data JSON", type: "json", placeholder: "{\"key\":\"value\"}" },
    ],
  },
  "Custom Command": {
    requestType: "AUTOCOM_CUSTOM_REQUEST",
    fields: [
      { key: "customRequestType", label: "Request Type", type: "text" },
      { key: "customRequestData", label: "Request Data JSON", type: "json", placeholder: "{\"sceneName\":\"Scene 1\"}" },
    ],
  },
};
function isRossXpressionCustomCommandFunction(funcName: string): boolean {
  return funcName === "Send a custom command";
}

function isRossXpressionGpiFunction(funcName: string): boolean {
  return funcName === "Trigger simulated GPI (GPI)";
}

function needsRossXpressionTakeId(funcName: string): boolean {
  return ROSS_XPRESSION_TAKE_ID_FUNCTIONS.has(funcName);
}

function needsRossXpressionFramebuffer(funcName: string): boolean {
  return ROSS_XPRESSION_FRAMEBUFFER_FUNCTIONS.has(funcName);
}

function needsRossXpressionLayer(funcName: string): boolean {
  return ROSS_XPRESSION_LAYER_FUNCTIONS.has(funcName);
}

function readRossXpressionToken(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return null;
}

function parseRossXpressionTakeFramebuffer(input: string): { takeId: string; framebuffer: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const [takeIdRaw, framebufferRaw] = trimmed.split(":");
  if (!takeIdRaw || !framebufferRaw) return null;
  const takeId = takeIdRaw.trim();
  const framebuffer = framebufferRaw.trim();
  if (!takeId || !framebuffer) return null;
  return { takeId, framebuffer };
}

function isRossTalkCustomCommandFunction(funcName: string): boolean {
  return ROSS_TALK_CUSTOM_COMMAND_FUNCTIONS.has(funcName);
}

function parseRossTalkMleKeyerReference(value: string): { mle: string; keyer: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((segment) => segment.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0].toUpperCase() === "ME" && parts.length >= 3) {
    return { mle: `ME:${parts[1]}`, keyer: parts[2] };
  }
  return { mle: `${parts[0]}:${parts[1]}`, keyer: parts[2] ?? "1" };
}

function buildRossTalkMleKeyerReference(mle: string, keyer: string): string {
  const mleToken = mle.trim();
  const keyerToken = keyer.trim();
  if (!mleToken || !keyerToken) return "";
  return `${mleToken}:${keyerToken}`;
}

function parseRossTalkMultiviewerBox(value: string): { multiviewer: string; box: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((segment) => segment.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { multiviewer: parts[0], box: parts[1] };
}

function buildRossTalkTransitionToken(onOff: string, transitionType: string): string {
  const type = transitionType.trim().toUpperCase() === "AUTO" ? "AUTO" : "CUT";
  const mode = onOff.trim().toLowerCase();
  if (mode === "on") return type === "AUTO" ? "AUTOON" : "CUTON";
  if (mode === "off") return type === "AUTO" ? "AUTOOFF" : "CUTOFF";
  return type;
}

function parseRossTalkTransitionToken(value: string): { onOff: "toggle" | "on" | "off"; transitionType: "CUT" | "AUTO" } {
  const token = value.trim().toUpperCase();
  if (token === "AUTOON") return { onOff: "on", transitionType: "AUTO" };
  if (token === "AUTOOFF") return { onOff: "off", transitionType: "AUTO" };
  if (token === "AUTO") return { onOff: "toggle", transitionType: "AUTO" };
  if (token === "CUTON") return { onOff: "on", transitionType: "CUT" };
  if (token === "CUTOFF") return { onOff: "off", transitionType: "CUT" };
  return { onOff: "toggle", transitionType: "CUT" };
}

function asTaskParams(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseConnectionId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function findConnectionForTask(
  connections: Connection[],
  task: Pick<TaskEntry, "connection" | "connectionId">,
): Connection | undefined {
  const connectionId = parseConnectionId(task.connectionId);
  if (connectionId !== null) {
    const byId = connections.find((connection) => connection.id === connectionId);
    if (byId) return byId;
  }
  return connections.find((connection) => connection.name === task.connection);
}

function parseResolvableNumber(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveIntegerValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function isResolumeCompositionChangeFunction(
  funcName: string,
): funcName is ResolumeCompositionChangeFunction {
  return [
    "Composition Master Change",
    "Composition Opacity Change",
    "Composition Speed Change",
    "Composition Volume Change",
  ].includes(funcName);
}

function isResolumeClipChangeFunction(
  funcName: string,
): funcName is ResolumeClipChangeFunction {
  return [
    "Clip Opacity Change",
    "Clip Speed Change",
    "Clip Volume Change",
  ].includes(funcName);
}

function isResolumeClipSelectionFunction(
  funcName: string,
): funcName is ResolumeClipSelectionFunction {
  return ["Select Clip", "Trigger Clip"].includes(funcName);
}

function isResolumeColumnActionFunction(
  funcName: string,
): funcName is ResolumeColumnActionFunction {
  return [
    "Connect Column",
    "Connect Layer Group Column",
    "Select Column",
    "Select Layer Group Column",
  ].includes(funcName);
}

function isResolumeLayerColumnStepFunction(
  funcName: string,
): funcName is ResolumeLayerColumnStepFunction {
  return ["Layer Next Column", "Layer Previous Column"].includes(funcName);
}

function isResolumeLayerGroupColumnStepFunction(
  funcName: string,
): funcName is ResolumeLayerGroupColumnStepFunction {
  return ["Layer Group Next Column", "Layer Group Previous Column"].includes(funcName);
}

function isResolumeToggleFunction(
  funcName: string,
): funcName is ResolumeToggleFunction {
  return [
    "Bypass Layer",
    "Bypass Layer Group",
    "Solo Layer",
    "Solo Layer Group",
  ].includes(funcName);
}

function isResolumeLayerChangeFunction(
  funcName: string,
): funcName is ResolumeLayerChangeFunction {
  return [
    "Layer Master Change",
    "Layer Opacity Change",
    "Layer Transition Duration Change",
    "Layer Volume Change",
  ].includes(funcName);
}

function isResolumeLayerGroupChangeFunction(
  funcName: string,
): funcName is ResolumeLayerGroupChangeFunction {
  return [
    "Layer Group Master Change",
    "Layer Group Opacity Change",
    "Layer Group Speed Change",
    "Layer Group Volume Change",
  ].includes(funcName);
}

function isResolumeLayerSelectFunction(
  funcName: string,
): funcName is ResolumeLayerSelectFunction {
  return ["Select Layer", "Select Layer Group"].includes(funcName);
}

function isResolumeLayerClearFunction(
  funcName: string,
): funcName is ResolumeLayerClearFunction {
  return ["Clear All Layers", "Clear Layer", "Clear Layer Group"].includes(funcName);
}

function isResolumeCompositionColumnStepFunction(
  funcName: string,
): funcName is ResolumeCompositionColumnStepFunction {
  return ["Composition Next Column", "Composition Previous Column"].includes(funcName);
}

function isResolumeDeckSelectFunction(
  funcName: string,
): funcName is ResolumeDeckSelectFunction {
  return funcName === "Select Deck";
}

function isResolumeDeckStepFunction(
  funcName: string,
): funcName is ResolumeDeckStepFunction {
  return ["Select Next Deck", "Select Previous Deck"].includes(funcName);
}

function isResolumeCustomOscFunction(
  funcName: string,
): funcName is ResolumeCustomOscFunction {
  return funcName === "Custom OSC Command";
}

function isLayerGroupSelectFunction(funcName: ResolumeLayerSelectFunction): boolean {
  return funcName === "Select Layer Group";
}

function isLayerGroupClearFunction(funcName: ResolumeLayerClearFunction): boolean {
  return funcName === "Clear Layer Group";
}

function isLayerGroupToggleFunction(funcName: ResolumeToggleFunction): boolean {
  return funcName === "Bypass Layer Group" || funcName === "Solo Layer Group";
}

function toggleBaseAddress(funcName: ResolumeToggleFunction, target: number): string {
  const scope = isLayerGroupToggleFunction(funcName)
    ? `/composition/layergroups/${target}`
    : `/composition/layers/${target}`;
  const suffix = funcName.includes("Bypass") ? "bypass" : "solo";
  return `${scope}/${suffix}`;
}

function resolveToggleAddress(
  funcName: ResolumeToggleFunction,
  target: number,
  action: ResolumeToggleAction,
): string {
  const base = toggleBaseAddress(funcName, target);
  if (action === "toggle") return `${base}/toggle`;
  return base;
}

function resolveToggleArgs(action: ResolumeToggleAction): unknown[] {
  if (action === "on") return [1];
  if (action === "off") return [0];
  return [];
}

function resolveLayerChangeAddress(
  funcName: ResolumeLayerChangeFunction,
  layer: number,
  action: ResolumeMasterAction,
): string {
  const base =
    funcName === "Layer Master Change"
      ? `/composition/layers/${layer}/master`
      : funcName === "Layer Opacity Change"
        ? `/composition/layers/${layer}/opacity`
        : funcName === "Layer Transition Duration Change"
          ? `/composition/layers/${layer}/transition/duration`
          : `/composition/layers/${layer}/volume`;
  if (action === "+") return `${base}/increase`;
  if (action === "-") return `${base}/decrease`;
  return base;
}

function resolveLayerGroupChangeAddress(
  funcName: ResolumeLayerGroupChangeFunction,
  group: number,
  action: ResolumeMasterAction,
): string {
  const base =
    funcName === "Layer Group Master Change"
      ? `/composition/layergroups/${group}/master`
      : funcName === "Layer Group Opacity Change"
        ? `/composition/layergroups/${group}/opacity`
        : funcName === "Layer Group Speed Change"
          ? `/composition/layergroups/${group}/speed`
          : `/composition/layergroups/${group}/volume`;
  if (action === "+") return `${base}/increase`;
  if (action === "-") return `${base}/decrease`;
  return base;
}

function resolveLayerSelectAddress(
  funcName: ResolumeLayerSelectFunction,
  target: number,
): string {
  if (isLayerGroupSelectFunction(funcName)) {
    return `/composition/layergroups/${target}/select`;
  }
  return `/composition/layers/${target}/select`;
}

function resolveLayerClearAddress(
  funcName: ResolumeLayerClearFunction,
  target: number | null,
): string {
  if (funcName === "Clear All Layers") return "/composition/layers/clear";
  if (isLayerGroupClearFunction(funcName)) return `/composition/layergroups/${target ?? 1}/clear`;
  return `/composition/layers/${target ?? 1}/clear`;
}

function resolveCompositionColumnStepAddress(
  funcName: ResolumeCompositionColumnStepFunction,
): string {
  if (funcName === "Composition Next Column") return "/composition/columns/next/connect";
  return "/composition/columns/previous/connect";
}

function resolveDeckSelectAddress(action: ResolumeMasterAction, value: number): string {
  if (action === "+") return "/composition/decks/next/select";
  if (action === "-") return "/composition/decks/previous/select";
  return `/composition/decks/${value}/select`;
}

function resolveDeckStepAddress(funcName: ResolumeDeckStepFunction): string {
  if (funcName === "Select Next Deck") return "/composition/decks/next/select";
  return "/composition/decks/previous/select";
}

function normalizeOscAddress(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function parseCustomOscArgs(input: string): unknown[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [trimmed];
  }
}

function parseCompanionOscMultipleArgs(input: string): unknown[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const tokens = (trimmed.match(/"[^"]*"|'[^']*'|\S+/g) ?? []);
  return tokens.map((token) => {
    const unquoted = (
      (token.startsWith("\"") && token.endsWith("\""))
      || (token.startsWith("'") && token.endsWith("'"))
    )
      ? token.slice(1, -1)
      : token;
    if (/^(true|false)$/i.test(unquoted)) return unquoted.toLowerCase() === "true";
    const asNumber = Number.parseFloat(unquoted);
    if (!Number.isNaN(asNumber) && /^[-+]?\d+(\.\d+)?$/.test(unquoted)) return asNumber;
    return unquoted;
  });
}

function parseHexBytes(input: string): number[] {
  const cleaned = input.replace(/[^0-9a-fA-F]/g, "");
  if (!cleaned) return [];
  const normalized = cleaned.length % 2 === 0 ? cleaned : `0${cleaned}`;
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i += 2) {
    const value = Number.parseInt(normalized.slice(i, i + 2), 16);
    if (Number.isFinite(value)) bytes.push(Math.max(0, Math.min(255, value)));
  }
  return bytes;
}

function buildOscMidiBytes(options: {
  mode: string;
  channel: number;
  data1: number;
  data2: number;
  pitch: number;
  rawHex: string;
}): number[] {
  const mode = options.mode.trim().toLowerCase();
  if (mode === "raw") {
    return parseHexBytes(options.rawHex).slice(0, 4);
  }
  const channel = Math.max(1, Math.min(16, options.channel)) - 1;
  if (mode === "pitchbend") {
    const bend = Math.max(-8192, Math.min(8191, Math.trunc(options.pitch)));
    const value = bend + 8192;
    const lsb = value & 0x7f;
    const msb = (value >> 7) & 0x7f;
    return [0xe0 | channel, lsb, msb, 0x00];
  }
  if (mode === "cc") {
    return [
      0xb0 | channel,
      Math.max(0, Math.min(127, Math.trunc(options.data1))),
      Math.max(0, Math.min(127, Math.trunc(options.data2))),
      0x00,
    ];
  }
  if (mode === "noteoff") {
    return [
      0x80 | channel,
      Math.max(0, Math.min(127, Math.trunc(options.data1))),
      Math.max(0, Math.min(127, Math.trunc(options.data2))),
      0x00,
    ];
  }
  return [
    0x90 | channel,
    Math.max(0, Math.min(127, Math.trunc(options.data1))),
    Math.max(0, Math.min(127, Math.trunc(options.data2))),
    0x00,
  ];
}

function clipBaseAddress(layer: number, clip: number): string {
  return `/composition/layers/${layer}/clips/${clip}`;
}

function isLayerGroupColumnAction(funcName: ResolumeColumnActionFunction): boolean {
  return funcName === "Connect Layer Group Column" || funcName === "Select Layer Group Column";
}

function resolveColumnActionAddress(
  funcName: ResolumeColumnActionFunction,
  action: ResolumeMasterAction,
  value: number,
  layerGroup: number | null,
): string {
  const suffix = funcName.includes("Select") ? "select" : "connect";
  if (isLayerGroupColumnAction(funcName)) {
    const group = layerGroup ?? 1;
    if (action === "+") return `/composition/layergroups/${group}/columns/next/${suffix}`;
    if (action === "-") return `/composition/layergroups/${group}/columns/previous/${suffix}`;
    return `/composition/layergroups/${group}/columns/${value}/${suffix}`;
  }

  if (action === "+") return `/composition/columns/next/${suffix}`;
  if (action === "-") return `/composition/columns/previous/${suffix}`;
  return `/composition/columns/${value}/${suffix}`;
}

function resolveLayerColumnStepAddress(
  funcName: ResolumeLayerColumnStepFunction,
  layer: number,
): string {
  if (funcName === "Layer Next Column") {
    return `/composition/layers/${layer}/columns/next/connect`;
  }
  return `/composition/layers/${layer}/columns/previous/connect`;
}

function resolveLayerGroupColumnStepAddress(
  funcName: ResolumeLayerGroupColumnStepFunction,
  layerGroup: number,
): string {
  if (funcName === "Layer Group Next Column") {
    return `/composition/layergroups/${layerGroup}/columns/next/connect`;
  }
  return `/composition/layergroups/${layerGroup}/columns/previous/connect`;
}

function resolveCompositionChangeAddress(
  funcName: ResolumeCompositionChangeFunction,
  action: ResolumeMasterAction,
): string {
  const base =
    funcName === "Composition Master Change"
      ? "/composition/master"
      : funcName === "Composition Opacity Change"
        ? "/composition/opacity"
        : funcName === "Composition Speed Change"
          ? "/composition/speed"
          : "/composition/volume";

  if (action === "+") return `${base}/increase`;
  if (action === "-") return `${base}/decrease`;
  return base;
}

function resolveClipChangeAddress(
  funcName: ResolumeClipChangeFunction,
  layer: number,
  clip: number,
  action: ResolumeMasterAction,
): string {
  const base =
    funcName === "Clip Opacity Change"
      ? `${clipBaseAddress(layer, clip)}/opacity`
      : funcName === "Clip Speed Change"
        ? `${clipBaseAddress(layer, clip)}/speed`
        : `${clipBaseAddress(layer, clip)}/volume`;

  if (action === "+") return `${base}/increase`;
  if (action === "-") return `${base}/decrease`;
  return base;
}

function resolveClipSelectionAddress(
  funcName: ResolumeClipSelectionFunction,
  layer: number,
  clip: number,
): string {
  if (funcName === "Select Clip") return `${clipBaseAddress(layer, clip)}/select`;
  return `${clipBaseAddress(layer, clip)}/connect`;
}

function extractLayerClipFromAddress(value: unknown): { layer: number; clip: number } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/composition\/layers\/(\d+)\/clips\/(\d+)/i);
  if (!match) return null;
  const layer = Number.parseInt(match[1], 10);
  const clip = Number.parseInt(match[2], 10);
  if (!Number.isInteger(layer) || layer < 1 || !Number.isInteger(clip) || clip < 1) {
    return null;
  }
  return { layer, clip };
}

function detectColumnActionFromAddress(value: unknown): ResolumeMasterAction | null {
  if (typeof value !== "string") return null;
  if (/\/columns\/next\//i.test(value)) return "+";
  if (/\/columns\/previous\//i.test(value)) return "-";
  if (/\/columns\/\d+\//i.test(value)) return "=";
  return null;
}

function detectDeltaActionFromAddress(value: unknown): ResolumeMasterAction | null {
  if (typeof value !== "string") return null;
  if (/\/increase$/i.test(value)) return "+";
  if (/\/decrease$/i.test(value)) return "-";
  if (value.trim().length > 0) return "=";
  return null;
}

function detectDeckActionFromAddress(value: unknown): ResolumeMasterAction | null {
  if (typeof value !== "string") return null;
  if (/\/decks\/next\//i.test(value)) return "+";
  if (/\/decks\/previous\//i.test(value)) return "-";
  if (/\/decks\/\d+\//i.test(value)) return "=";
  return null;
}

function extractDeckValueFromAddress(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/\/decks\/(\d+)\//i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractColumnValueFromAddress(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/\/columns\/(\d+)\//i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractLayerGroupFromAddress(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/\/layergroups\/(\d+)\//i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractLayerFromAddress(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/\/layers\/(\d+)\//i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseToggleActionFromAddressAndArgs(
  address: unknown,
  args: unknown,
): ResolumeToggleAction | null {
  if (typeof address === "string" && /\/toggle$/i.test(address.trim())) {
    return "toggle";
  }
  if (Array.isArray(args) && args.length > 0) {
    const first = args[0];
    if (typeof first === "number") return first > 0 ? "on" : "off";
    if (typeof first === "boolean") return first ? "on" : "off";
    if (typeof first === "string") {
      const normalized = first.trim().toLowerCase();
      if (["1", "true", "on"].includes(normalized)) return "on";
      if (["0", "false", "off"].includes(normalized)) return "off";
    }
  }
  return null;
}

// ── Small SVG icon helper ──────────────────────────────────────────────────────

function SvgIcon({ d, size = 16, color = "currentColor" }: {
  d: string; size?: number; color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      style={{ display: "block", flexShrink: 0 }}>
      <path d={d} stroke={color}
        strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333"/>
    </svg>
  );
}

// ── Field sub-component ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: 5 }}>
      <span style={{ fontSize: 12, color: P.text50 }}>{label}</span>
      {children}
    </div>
  );
}

function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="grid items-center gap-[10px]"
      style={{ gridTemplateColumns: "minmax(128px, 190px) minmax(0, 1fr)" }}
    >
      <span style={{ fontSize: 12, color: P.text50 }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  height:          32,
  backgroundColor: P.ink950,
  border:          `1px solid ${P.surface600}`,
  color:           P.text50,
  fontSize:        12,
  paddingLeft:     8,
  paddingRight:    8,
  outline:         "none",
  width:           "100%",
  boxSizing:       "border-box",
};

const PANEL_BUTTON_HEIGHT = 32;
const PANEL_ICON_BUTTON_SIZE = 24;
const PANEL_TASK_ROW_HEIGHT = 32;
const PURPLE_ACCENT_BG = "#1E2939";
const PURPLE_ACCENT_BG_SOFT = "rgba(30, 41, 57, 0.26)";
const PURPLE_ACCENT_BORDER = "#334155";
const PURPLE_ACCENT_TEXT = "#F9FAFB";
const ACTION_ADD_BG_SOFT = "#111B2E";
const ACTION_ADD_BORDER = "#324056";
const ACTION_UPDATE_BG_SOFT = "#111B2E";
const ACTION_UPDATE_BORDER = "#324056";
const ACTION_APPLY_BG = "#111B2E";
const ACTION_APPLY_BG_SOFT = "#111B2E";
const ACTION_APPLY_BORDER = "#324056";
const ACTION_APPLY_CLOSE_BG_SOFT = "#111B2E";
const ACTION_APPLY_CLOSE_BORDER = "#324056";
const ACTION_CLOSE_BG = "#111B2E";
const ACTION_CLOSE_BORDER = "#324056";
const ACTION_CLOSE_TEXT = "#E5EAF3";
const ACTION_HOVER_OUTLINE_CLASS =
  "hover:shadow-[0_0_0_1px_#8E51FF] focus-visible:shadow-[0_0_0_1px_#8E51FF] active:shadow-[0_0_0_1px_#8E51FF] focus-visible:outline-none disabled:hover:shadow-none";
const ACTION_CLOSE_HOVER_OUTLINE_CLASS =
  "hover:shadow-[0_0_0_1px_#EF4444] focus-visible:shadow-[0_0_0_1px_#EF4444] active:shadow-[0_0_0_1px_#EF4444] focus-visible:outline-none";
const ACTION_DELETE_BG_SOFT = P.surface900;
const ACTION_DELETE_BORDER = P.surface600;

type SelectOption = string | { value: string; label: string };
type AtemFieldSpec = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: SelectOption[];
  placeholder?: string;
  defaultValue?: string;
};
type AtemFunctionSpec = {
  definitionId: string;
  fields: AtemFieldSpec[];
};
type MA2Direction = "press" | "release";
type MA2DownUpDirection = "true" | "false";
type MA2RotateDirection = "-1" | "1";

const MA2_DIRECTION_OPTIONS: SelectOption[] = [
  { value: "press", label: "Press" },
  { value: "release", label: "Release" },
];
const MA2_DOWN_UP_OPTIONS: SelectOption[] = [
  { value: "true", label: "Press (down)" },
  { value: "false", label: "Release (up)" },
];
const MA2_ROTATE_DIRECTION_OPTIONS: SelectOption[] = [
  { value: "-1", label: "CCW" },
  { value: "1", label: "CW" },
];
const MA2_ENCODER_SELECT_OPTIONS: SelectOption[] = [
  { value: "0", label: "Main Encoder (1)" },
  { value: "1", label: "Main Encoder (2)" },
  { value: "2", label: "Main Encoder (3)" },
  { value: "3", label: "Main Encoder (4)" },
  { value: "4", label: "Command Screen Encoder (5)" },
  { value: "5", label: "Screen 2 Encoder (6)" },
  { value: "6", label: "Screen 3 Encoder (7)" },
  { value: "7", label: "Screen 4 Encoder (8)" },
];
const MA2_BUTTON_OPTIONS: SelectOption[] = [
  { value: "3", label: "Ch Pg +" },
  { value: "4", label: "Ch Pg -" },
  { value: "5", label: "Fd Pg +" },
  { value: "6", label: "Fd Pg -" },
  { value: "7", label: "Bt Pg +" },
  { value: "8", label: "Bt Pg -" },
  { value: "9", label: "Pause Playback" },
  { value: "10", label: "Go - Playback" },
  { value: "11", label: "Go + Playback" },
  { value: "12", label: "X1" },
  { value: "13", label: "X2" },
  { value: "14", label: "X3" },
  { value: "15", label: "X4" },
  { value: "16", label: "X5" },
  { value: "17", label: "X6" },
  { value: "18", label: "X7" },
  { value: "19", label: "X8" },
  { value: "20", label: "X9" },
  { value: "21", label: "X10" },
  { value: "22", label: "X11" },
  { value: "23", label: "X12" },
  { value: "24", label: "X13" },
  { value: "25", label: "X14" },
  { value: "26", label: "X15" },
  { value: "27", label: "X16" },
  { value: "28", label: "X17" },
  { value: "29", label: "X18" },
  { value: "30", label: "X19" },
  { value: "31", label: "X20" },
  { value: "32", label: "List" },
  { value: "33", label: "User 1" },
  { value: "34", label: "User 2" },
  { value: "36", label: "U1" },
  { value: "37", label: "U2" },
  { value: "38", label: "U3" },
  { value: "39", label: "U4" },
  { value: "40", label: "Nipple" },
  { value: "41", label: "Fix" },
  { value: "42", label: "Select" },
  { value: "43", label: "Off" },
  { value: "44", label: "Temp" },
  { value: "45", label: "Top" },
  { value: "46", label: "On" },
  { value: "47", label: "<<<" },
  { value: "48", label: "Learn" },
  { value: "49", label: ">>>" },
  { value: "50", label: "Go -" },
  { value: "51", label: "Pause" },
  { value: "52", label: "Go +" },
  { value: "53", label: "Oops" },
  { value: "54", label: "Esc" },
  { value: "55", label: "Edit" },
  { value: "56", label: "Goto" },
  { value: "57", label: "Update" },
  { value: "58", label: "Time" },
  { value: "59", label: "Store" },
  { value: "60", label: "Blind" },
  { value: "61", label: "Freeze" },
  { value: "62", label: "Preview" },
  { value: "63", label: "Assign" },
  { value: "64", label: "Align" },
  { value: "65", label: "Blackout" },
  { value: "66", label: "View" },
  { value: "67", label: "Effect" },
  { value: "68", label: "MA" },
  { value: "69", label: "Delete" },
  { value: "70", label: "Page" },
  { value: "71", label: "Macro" },
  { value: "72", label: "Preset" },
  { value: "73", label: "Copy" },
  { value: "74", label: "Sequence" },
  { value: "75", label: "Cue" },
  { value: "76", label: "Executor" },
  { value: "82", label: "Channel" },
  { value: "83", label: "Fixture" },
  { value: "84", label: "Group" },
  { value: "85", label: "Move" },
  { value: "86", label: "0" },
  { value: "87", label: "1" },
  { value: "88", label: "2" },
  { value: "89", label: "3" },
  { value: "90", label: "4" },
  { value: "91", label: "5" },
  { value: "92", label: "6" },
  { value: "93", label: "7" },
  { value: "94", label: "8" },
  { value: "95", label: "9" },
  { value: "96", label: "+" },
  { value: "97", label: "-" },
  { value: "98", label: "." },
  { value: "99", label: "Full" },
  { value: "100", label: "Highlight" },
  { value: "101", label: "Solo" },
  { value: "102", label: "Thru" },
  { value: "103", label: "If" },
  { value: "104", label: "At" },
  { value: "105", label: "Clear" },
  { value: "106", label: "Please" },
  { value: "107", label: "Up" },
  { value: "108", label: "Set" },
  { value: "109", label: "Previous" },
  { value: "110", label: "Next" },
  { value: "111", label: "Down" },
  { value: "116", label: "Help" },
  { value: "117", label: "Backup" },
  { value: "118", label: "Setup" },
  { value: "119", label: "Tools" },
  { value: "120", label: "V1" },
  { value: "121", label: "V2" },
  { value: "122", label: "V3" },
  { value: "123", label: "V4" },
  { value: "124", label: "V5" },
  { value: "125", label: "V6" },
  { value: "126", label: "V7" },
  { value: "127", label: "V8" },
  { value: "128", label: "V9" },
  { value: "129", label: "V10" },
];
const MA2_FUNCTIONS = new Set<string>([
  "Button Press/Release",
  "Encoder Press/Release",
  "Move wheel up/down",
  "Rotate Encoder",
  "Run Custom Command",
]);
const GENERIC_TCP_UDP_FUNCTIONS = new Set<string>([
  "Send Command",
  "Send HEX encoded Command",
]);
const COMPANION_REMOTE_FUNCTIONS = new Set<string>([
  "Button Event",
]);
const COMPANION_SATELLITE_EVENT_OPTIONS: SelectOption[] = [
  { value: "press", label: "Press" },
  { value: "release", label: "Release" },
  { value: "rotate_left", label: "Rotate Left" },
  { value: "rotate_right", label: "Rotate Right" },
];
const SWP08_FUNCTIONS = new Set<string>([
  "Select Levels",
  "De-Select Levels",
  "Toggle Levels",
  "Select Destination",
  "Select Destination name",
  "Select Source",
  "Select Source name",
  "Route Source to selected Levels and Destination",
  "Route Source name to selected Levels and Destination",
  "Take",
  "Clear",
  "Set crosspoint",
  "Set crosspoint by name",
  "Refresh Source and Destination names",
]);
const VIDEOHUB_FUNCTIONS = new Set<string>([
  "Lock: Change destination lock state",
  "Lock: Change destination lock state (dynamic)",
  "Route File: Load file",
  "Route File: Save file",
  "Video: Clear queued route",
  "Video: Rename destination",
  "Video: Rename source",
  "Video: Return to previous route",
  "Video: Return to previous route (dynamic)",
  "Video: Route source to destination",
  "Video: Route source to destination (dynamic)",
  "Video: Route source to destination, based on another destination",
  "Video: Route source to destination, based on another destination (dynamic)",
  "Video: Route source to selected destination",
  "Video: Route source to selected destination (dynamic)",
  "Video: Select destination",
  "Video: Select destination (dynamic)",
  "Video: Take queued route",
]);
const VIDEOHUB_LOCK_STATE_OPTIONS: SelectOption[] = [
  { value: "T", label: "Toggle" },
  { value: "L", label: "Lock" },
  { value: "U", label: "Unlock" },
];
const VIDEOHUB_LOCK_STATE_DYNAMIC_OPTIONS: SelectOption[] = [
  { value: "toggle", label: "Toggle" },
  { value: "lock", label: "Lock" },
  { value: "unlock", label: "Unlock" },
];
const SWP08_CLEAR_OPTIONS: SelectOption[] = [
  { value: "all", label: "All" },
  { value: "level", label: "Levels" },
  { value: "dest", label: "Destination" },
  { value: "source", label: "Source" },
];
const GENERIC_HTTP_FUNCTIONS = new Set<string>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
const GENERIC_HTTP_CONTENT_TYPE_OPTIONS: SelectOption[] = [
  { value: "application/json", label: "application/json" },
  { value: "application/x-www-form-urlencoded", label: "application/x-www-form-urlencoded" },
  { value: "application/xml", label: "application/xml" },
  { value: "text/html", label: "text/html" },
  { value: "text/plain", label: "text/plain" },
  { value: "text/csv", label: "text/csv" },
  { value: "text/xml", label: "text/xml" },
  { value: "multipart/form-data", label: "multipart/form-data" },
  { value: "application/octet-stream", label: "application/octet-stream" },
  { value: "application/javascript", label: "application/javascript" },
  { value: "application/pdf", label: "application/pdf" },
  { value: "application/zip", label: "application/zip" },
  { value: "image/png", label: "image/png" },
  { value: "image/jpeg", label: "image/jpeg" },
  { value: "image/svg+xml", label: "image/svg+xml" },
  { value: "application/ld+json", label: "application/ld+json" },
  { value: "application/vnd.api+json", label: "application/vnd.api+json" },
  { value: "application/x-yaml", label: "application/x-yaml" },
  { value: "application/graphql", label: "application/graphql" },
];
const GENERIC_OSC_FUNCTIONS = new Set<string>([
  "Send blob",
  "Send boolean",
  "Send float",
  "Send int",
  "Send multiple",
  "Send blank",
  "Send midi",
  "Send string",
]);
const GENERIC_OSC_MIDI_MODE_OPTIONS: SelectOption[] = [
  { value: "noteon", label: "noteon" },
  { value: "noteoff", label: "noteoff" },
  { value: "cc", label: "cc" },
  { value: "pitchbend", label: "pitchbend" },
  { value: "raw", label: "raw" },
];
const GENERIC_TCP_UDP_LINE_END_OPTIONS: SelectOption[] = [
  { value: "\n", label: "LF - \\n (Common UNIX/Mac)" },
  { value: "\r\n", label: "CRLF - \\r\\n (Common Windows)" },
  { value: "\r", label: "CR - \\r (1970's RS232 terminal)" },
  { value: "\x00", label: "NULL - \\x00 (Can happen)" },
  { value: "\n\r", label: "LFCR - \\n\\r (Just weird)" },
];
const ATEM_BOOLEAN_OPTIONS: SelectOption[] = [
  { value: "true", label: "On" },
  { value: "false", label: "Off" },
];
const ATEM_TOGGLE_OPTIONS: SelectOption[] = [
  { value: "toggle", label: "Toggle" },
  { value: "on", label: "On Air" },
  { value: "off", label: "Off" },
];
const ATEM_TRANSITION_STYLE_OPTIONS: SelectOption[] = [
  { value: "mix", label: "Mix" },
  { value: "dip", label: "Dip" },
  { value: "wipe", label: "Wipe" },
  { value: "dve", label: "DVE" },
  { value: "sting", label: "Sting" },
];
const ATEM_USK_TYPE_OPTIONS: SelectOption[] = [
  { value: "luma", label: "Luma" },
  { value: "chroma", label: "Chroma" },
  { value: "pattern", label: "Pattern" },
  { value: "dve", label: "DVE" },
];
const ATEM_MEDIA_DIRECTION_OPTIONS: SelectOption[] = [
  { value: "next", label: "Next" },
  { value: "previous", label: "Previous" },
];
const ATEM_MACRO_LOOP_OPTIONS: SelectOption[] = [
  { value: "toggle", label: "Toggle" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];
const ATEM_MEDIA_SOURCE_TYPE_OPTIONS: SelectOption[] = [
  { value: "still", label: "Still" },
  { value: "clip", label: "Clip" },
];
const ATEM_FUNCTION_SPECS: Record<string, AtemFunctionSpec> = {
  "Aux/Output: Set source": {
    definitionId: "aux",
    fields: [
      { key: "aux", label: "Aux/Output", type: "select", defaultValue: "1" },
      { key: "input", label: "Input", type: "select", defaultValue: "1" },
    ],
  },
  "Downstream key: Run AUTO Transition": {
    definitionId: "dskAuto",
    fields: [
      { key: "downstreamKeyerId", label: "Key", type: "select", defaultValue: "1" },
      { key: "onair", label: "Mode", type: "select", options: ATEM_TOGGLE_OPTIONS, defaultValue: "toggle" },
    ],
  },
  "Downstream key: Set inputs": {
    definitionId: "dskSource",
    fields: [
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "fill", label: "Fill Source", type: "select", defaultValue: "1" },
      { key: "cut", label: "Key Source", type: "select", defaultValue: "1" },
    ],
  },
  "Downstream key: Set Mask": {
    definitionId: "dskMask",
    fields: [
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "maskEnabled", label: "Mask enabled", type: "select", options: ATEM_BOOLEAN_OPTIONS, defaultValue: "true" },
      { key: "maskTop", label: "Mask top", type: "number", defaultValue: "9" },
      { key: "maskBottom", label: "Mask bottom", type: "number", defaultValue: "-9" },
      { key: "maskLeft", label: "Mask left", type: "number", defaultValue: "-16" },
      { key: "maskRight", label: "Mask right", type: "number", defaultValue: "16" },
    ],
  },
  "Downstream key: Set OnAir": {
    definitionId: "dsk",
    fields: [
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "onair", label: "On Air", type: "select", options: ATEM_TOGGLE_OPTIONS, defaultValue: "toggle" },
    ],
  },
  "Downstream key: Set Pre Multiplied Key": {
    definitionId: "dskPreMultipliedKey",
    fields: [
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "preMultiply", label: "Premultiplied", type: "select", options: ATEM_BOOLEAN_OPTIONS, defaultValue: "true" },
      { key: "clip", label: "Clip", type: "number", defaultValue: "100" },
      { key: "gain", label: "Gain", type: "number", defaultValue: "0" },
      { key: "invert", label: "Invert", type: "select", options: ATEM_BOOLEAN_OPTIONS, defaultValue: "false" },
    ],
  },
  "Downstream key: Set Rate": {
    definitionId: "dskRate",
    fields: [
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "rate", label: "Rate", type: "number", defaultValue: "25" },
    ],
  },
  "Downstream key: Set Tied": {
    definitionId: "dskTie",
    fields: [
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "state", label: "Tied state", type: "select", options: ATEM_TOGGLE_OPTIONS, defaultValue: "on" },
    ],
  },
  "Fade to black: Change rate": {
    definitionId: "fadeToBlackRate",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "rate", label: "Rate", type: "number", defaultValue: "25" },
    ],
  },
  "Fade to black: Run AUTO Transition": {
    definitionId: "fadeToBlackAuto",
    fields: [{ key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" }],
  },
  "Input: Set name": {
    definitionId: "inputName",
    fields: [
      { key: "source", label: "Input", type: "select", defaultValue: "1" },
      { key: "short_enable", label: "Enable short name", type: "select", options: ATEM_BOOLEAN_OPTIONS, defaultValue: "true" },
      { key: "short_value", label: "Short name", type: "text", defaultValue: "" },
      { key: "long_enable", label: "Enable long name", type: "select", options: ATEM_BOOLEAN_OPTIONS, defaultValue: "true" },
      { key: "long_value", label: "Long name", type: "text", defaultValue: "" },
    ],
  },
  "Macro: Continue": { definitionId: "macrocontinue", fields: [] },
  "Macro: Loop": {
    definitionId: "macroloop",
    fields: [{ key: "loop", label: "Loop", type: "select", options: ATEM_MACRO_LOOP_OPTIONS, defaultValue: "toggle" }],
  },
  "Macro: Run": {
    definitionId: "macrorun",
    fields: [
      { key: "macro", label: "Macro", type: "number", defaultValue: "1" },
      { key: "action", label: "Action", type: "select", options: ["run", "start"], defaultValue: "run" },
    ],
  },
  "Macro: Stop": { definitionId: "macrostop", fields: [] },
  "ME: Perform AUTO transition": {
    definitionId: "auto",
    fields: [{ key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" }],
  },
  "ME: Perform CUT transition": {
    definitionId: "cut",
    fields: [{ key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" }],
  },
  "ME: Set Preview input": {
    definitionId: "preview",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "input", label: "Input", type: "select", defaultValue: "1" },
    ],
  },
  "ME: Set Program input": {
    definitionId: "program",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "input", label: "Input", type: "select", defaultValue: "1" },
    ],
  },
  "ME: Set TBar position": {
    definitionId: "tBar",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "position", label: "Position", type: "number", defaultValue: "0" },
      { key: "fadeDuration", label: "Fade duration", type: "number", defaultValue: "0" },
      { key: "fadeAlgorithm", label: "Fade algorithm", type: "select", options: ["linear"], defaultValue: "linear" },
      { key: "fadeCurve", label: "Fade curve", type: "select", options: ["ease-in"], defaultValue: "ease-in" },
    ],
  },
  "Media player: Capture still": { definitionId: "mediaCaptureStill", fields: [] },
  "Media player: Cycle source": {
    definitionId: "mediaPlayerCycle",
    fields: [
      { key: "mediaplayer", label: "Media player", type: "select", defaultValue: "1" },
      { key: "direction", label: "Direction", type: "select", options: ATEM_MEDIA_DIRECTION_OPTIONS, defaultValue: "next" },
    ],
  },
  "Media player: Delete still": {
    definitionId: "mediaDeleteStill",
    fields: [{ key: "slot", label: "Still slot", type: "number", defaultValue: "1" }],
  },
  "Media player: Set source": {
    definitionId: "mediaPlayerSource",
    fields: [
      { key: "mediaplayer", label: "Media player", type: "select", defaultValue: "1" },
      { key: "sourceType", label: "Source type", type: "select", options: ATEM_MEDIA_SOURCE_TYPE_OPTIONS, defaultValue: "still" },
      { key: "source", label: "Source", type: "select", defaultValue: "1" },
    ],
  },
  "Multiviewer: Change layout": {
    definitionId: "multiviewerLayout",
    fields: [
      { key: "multiViewerId", label: "Multiviewer", type: "select", defaultValue: "1" },
      { key: "layout", label: "Layout", type: "number", defaultValue: "1" },
      { key: "topLeft", label: "Top Left", type: "select", options: ["ignore", "program", "preview"], defaultValue: "ignore" },
      { key: "topRight", label: "Top Right", type: "select", options: ["ignore", "program", "preview"], defaultValue: "ignore" },
      { key: "bottomLeft", label: "Bottom Left", type: "select", options: ["ignore", "program", "preview"], defaultValue: "ignore" },
      { key: "bottomRight", label: "Bottom Right", type: "select", options: ["ignore", "program", "preview"], defaultValue: "ignore" },
    ],
  },
  "Multiviewer: Change window source": {
    definitionId: "setMvSource",
    fields: [
      { key: "multiViewerId", label: "Multiviewer", type: "select", defaultValue: "1" },
      { key: "windowIndex", label: "Window", type: "number", defaultValue: "1" },
      { key: "source", label: "Source", type: "select", defaultValue: "1" },
    ],
  },
  "Startup State: Clear": { definitionId: "clearStartupState", fields: [] },
  "Startup State: Save": { definitionId: "saveStartupState", fields: [] },
  "Transition: Change rate": {
    definitionId: "transitionRate",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "style", label: "Style", type: "select", options: ATEM_TRANSITION_STYLE_OPTIONS, defaultValue: "mix" },
      { key: "rate", label: "Rate", type: "number", defaultValue: "25" },
    ],
  },
  "Transition: Change selection": {
    definitionId: "transitionSelection",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "selection", label: "Selection", type: "select", defaultValue: "background" },
    ],
  },
  "Transition: Change selection component": {
    definitionId: "transitionSelectionComponent",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "component", label: "Component", type: "select", defaultValue: "key0" },
      { key: "mode", label: "Mode", type: "select", options: ATEM_TOGGLE_OPTIONS, defaultValue: "on" },
    ],
  },
  "Transition: Preview": {
    definitionId: "previewTransition",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "state", label: "State", type: "select", options: ATEM_TOGGLE_OPTIONS, defaultValue: "toggle" },
    ],
  },
  "Transition: Select components in transition": {
    definitionId: "transitionSelectComponents",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "background", label: "Background", type: "select", options: ["no-change", "true", "false"], defaultValue: "no-change" },
      { key: "key0", label: "Key 1", type: "select", options: ["no-change", "true", "false"], defaultValue: "no-change" },
      { key: "key1", label: "Key 2", type: "select", options: ["no-change", "true", "false"], defaultValue: "no-change" },
      { key: "key2", label: "Key 3", type: "select", options: ["no-change", "true", "false"], defaultValue: "no-change" },
      { key: "key3", label: "Key 4", type: "select", options: ["no-change", "true", "false"], defaultValue: "no-change" },
      { key: "key4", label: "Key 5", type: "select", options: ["no-change", "true", "false"], defaultValue: "no-change" },
    ],
  },
  "Transition: Set style/pattern": {
    definitionId: "transitionStyle",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "style", label: "Style", type: "select", options: ATEM_TRANSITION_STYLE_OPTIONS, defaultValue: "mix" },
    ],
  },
  "Upstream key: Set Flying Key (Luma, Chroma, Pattern)": {
    definitionId: "uskFlyKeyLumaChromaPattern",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "flyEnabled", label: "Flying key", type: "select", options: ATEM_BOOLEAN_OPTIONS, defaultValue: "true" },
      { key: "positionX", label: "Position X", type: "number", defaultValue: "0" },
      { key: "positionY", label: "Position Y", type: "number", defaultValue: "0" },
      { key: "sizeX", label: "Size X", type: "number", defaultValue: "1.0" },
      { key: "sizeY", label: "Size Y", type: "number", defaultValue: "1.0" },
    ],
  },
  "Upstream key: Set inputs": {
    definitionId: "uskSource",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "fill", label: "Fill Source", type: "select", defaultValue: "1" },
      { key: "cut", label: "Key Source", type: "select", defaultValue: "1" },
    ],
  },
  "Upstream key: Set Mask (Luma, Chroma, Pattern)": {
    definitionId: "uskMaskLumaChromaPattern",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "maskEnabled", label: "Mask enabled", type: "select", options: ATEM_BOOLEAN_OPTIONS, defaultValue: "true" },
      { key: "maskTop", label: "Mask top", type: "number", defaultValue: "9" },
      { key: "maskBottom", label: "Mask bottom", type: "number", defaultValue: "-9" },
      { key: "maskLeft", label: "Mask left", type: "number", defaultValue: "-16" },
      { key: "maskRight", label: "Mask right", type: "number", defaultValue: "16" },
    ],
  },
  "Upstream key: Set OnAir": {
    definitionId: "usk",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "onair", label: "On Air", type: "select", options: ATEM_TOGGLE_OPTIONS, defaultValue: "toggle" },
    ],
  },
  "Upstream key: Set type": {
    definitionId: "uskType",
    fields: [
      { key: "mixeffect", label: "M/E", type: "select", defaultValue: "1" },
      { key: "key", label: "Key", type: "select", defaultValue: "1" },
      { key: "type", label: "Key type", type: "select", options: ATEM_USK_TYPE_OPTIONS, defaultValue: "luma" },
    ],
  },
};
const ATEM_FUNCTIONS = new Set<string>(Object.keys(ATEM_FUNCTION_SPECS));
const ATEM_DEFINITION_TO_FUNCTION = Object.fromEntries(
  Object.entries(ATEM_FUNCTION_SPECS).map(([func, spec]) => [spec.definitionId, func]),
) as Record<string, string>;

function ensureUniqueTaskIds(source: TaskEntry[]): TaskEntry[] {
  const seen = new Set<string>();
  let changed = false;

  const next = source.map((task) => {
    const id = task.id?.trim();
    if (!id || seen.has(id)) {
      changed = true;
      const nextId = createEntityId("task");
      seen.add(nextId);
      return { ...task, id: nextId };
    }
    seen.add(id);
    return task;
  });

  return changed ? next : source;
}

function selectOptionValue(option: SelectOption | undefined): string {
  if (!option) return "";
  return typeof option === "string" ? option : option.value;
}

function parseNonNegativeIntegerValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function readValueByPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function setValueByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    if (isLast) {
      cursor[segment] = value;
      return;
    }
    const next = cursor[segment];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
}

function normalizeObsFieldValue(rawValue: string, type: "text" | "number" | "select" | "json"): unknown {
  const token = rawValue.trim();
  if (!token) return undefined;
  if (type === "number") {
    const parsed = Number.parseFloat(token);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (type === "json") {
    try {
      return JSON.parse(token) as unknown;
    } catch {
      return undefined;
    }
  }
  if (token === "true") return true;
  if (token === "false") return false;
  return token;
}

function parseIntegerValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseLooseValue(value: string): unknown {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && raw !== "") return numeric;
  return raw;
}

function atemParseNumber(rawValue: string, fallback: number): number {
  const parsed = Number.parseFloat(rawValue.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function atemParseIndex(rawValue: string, fallback = 1): number {
  const parsed = Number.parseInt(rawValue.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return 1;
  return parsed;
}

function atemOnOffToggle(rawValue: string, fallback: "TOGGLE" | "ON" | "OFF" = "TOGGLE"): "TOGGLE" | "ON" | "OFF" {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true" || normalized === "on" || normalized === "on air") return "ON";
  if (normalized === "false" || normalized === "off") return "OFF";
  if (normalized === "toggle") return "TOGGLE";
  return fallback;
}

function atemBoolean(rawValue: string, fallback = false): boolean {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function atemBuildCommand(definitionId: string, fields: Record<string, string>): string {
  const n = (key: string, fallback = 1) => atemParseIndex(fields[key] ?? "", fallback);
  const x = (key: string, fallback = 0) => atemParseNumber(fields[key] ?? "", fallback);
  const t = (key: string, fallback = "") => (fields[key] ?? fallback).trim();
  const onOff = (key: string, fallback: "TOGGLE" | "ON" | "OFF" = "TOGGLE") => atemOnOffToggle(fields[key] ?? "", fallback);

  switch (definitionId) {
    case "aux":
    case "auxVariables":
      return `AUX ${n("aux", 1)} ${n("input", 1)}`;
    case "dskAuto": {
      const mode = onOff("onair", "TOGGLE");
      if (mode === "ON" || mode === "OFF") return `DSK ${n("downstreamKeyerId", 1)} ${mode}`;
      return `DSK ${n("downstreamKeyerId", 1)} AUTO`;
    }
    case "dskSource":
    case "dskSourceVariables":
      return `DSK ${n("key", 1)} SOURCE ${n("fill", 1)} ${n("cut", n("fill", 1))}`;
    case "dskMask":
      return `DSK ${n("key", 1)} MASK ${x("maskTop", 9)} ${x("maskBottom", -9)} ${x("maskLeft", -16)} ${x("maskRight", 16)}`;
    case "dsk":
      return `DSK ${n("key", 1)} ${onOff("onair", "TOGGLE")}`;
    case "dskPreMultipliedKey":
      return `DSK ${n("key", 1)} PREMULT ${atemBoolean(t("preMultiply"), true) ? "ON" : "OFF"}`;
    case "dskRate":
      return `DSK ${n("key", 1)} RATE ${n("rate", 25)}`;
    case "dskTie": {
      const state = t("state", "on").toLowerCase();
      if (state === "toggle") return `DSK ${n("key", 1)} TIE`;
      return `DSK ${n("key", 1)} ${(state === "off" || state === "false") ? "OFF" : "ON"}`;
    }
    case "fadeToBlackRate":
      return `FTB ${n("mixeffect", 1)} RATE ${n("rate", 25)}`;
    case "fadeToBlackAuto":
      return `FTB ${n("mixeffect", 1)} AUTO`;
    case "inputName": {
      const label = (t("long_value") || t("short_value") || `Input ${n("source", 1)}`).trim();
      return `INPUT ${n("source", 1)} NAME ${label}`;
    }
    case "macrocontinue":
      return "MACRO CONTINUE";
    case "macroloop": {
      const loop = t("loop", "toggle").toLowerCase();
      if (loop === "off" || loop === "false") return "MACRO STOP";
      if (loop === "toggle") return "MACRO CONTINUE";
      return "MACRO LOOP 1";
    }
    case "macrorun":
      return `MACRO RUN ${n("macro", 1)}`;
    case "macrostop":
      return "MACRO STOP";
    case "auto":
      return "AUTO";
    case "cut":
      return "CUT";
    case "preview":
    case "previewVariables":
      return `PREVIEW ${n("input", 1)} ${n("mixeffect", 1)}`;
    case "program":
    case "programVariables":
      return `PROGRAM ${n("input", 1)} ${n("mixeffect", 1)}`;
    case "tBar":
      return `ME ${n("mixeffect", 1)} TBAR ${n("position", 0)}`;
    case "mediaCaptureStill":
      return "MEDIAPLAYER 1 CAPTURE 1";
    case "mediaPlayerCycle":
      return `MEDIAPLAYER ${n("mediaplayer", 1)} ${t("direction", "next").toLowerCase() === "previous" ? "PREV" : "NEXT"}`;
    case "mediaDeleteStill":
      return `MEDIAPLAYER 1 DELETE STILL ${n("slot", 1)}`;
    case "mediaPlayerSource": {
      const sourceType = t("sourceType", "still").toUpperCase() === "CLIP" ? "CLIP" : "STILL";
      return `MEDIAPLAYER ${n("mediaplayer", 1)} ${sourceType} ${n("source", 1)}`;
    }
    case "mediaPlayerSourceVariables2": {
      const sourceType = t("sourceType", "still").toUpperCase() === "CLIP" ? "CLIP" : "STILL";
      return `MEDIAPLAYER ${n("mediaplayer", 1)} ${sourceType} ${n("slot", 1)}`;
    }
    case "multiviewerLayout":
      return `MV ${n("multiViewerId", 1)} LAYOUT ${n("layout", 1)}`;
    case "setMvSource":
    case "setMvSourceVariables":
      return `MV ${n("multiViewerId", 1)} WINDOW ${n("windowIndex", 1)} SOURCE ${n("source", 1)}`;
    case "clearStartupState":
      return "STARTUP CLEAR";
    case "saveStartupState":
      return "STARTUP SAVE";
    case "transitionRate":
      return `TRANSITION ${n("mixeffect", 1)} RATE ${n("rate", 25)}`;
    case "transitionSelection":
      return `TRANSITION ${n("mixeffect", 1)} SELECTION ${t("selection", "background").toUpperCase()}`;
    case "transitionSelectionComponent": {
      const comp = t("component", "key0").toLowerCase();
      const compToken = comp === "background" ? "BKGD" : comp.toUpperCase().replace("KEY0", "KEY1");
      return `TRANSITION ${n("mixeffect", 1)} COMPONENT ${compToken} ${onOff("mode", "TOGGLE")}`;
    }
    case "previewTransition":
      return `TRANSITION ${n("mixeffect", 1)} PREVIEW ${onOff("state", "TOGGLE")}`;
    case "transitionSelectComponents": {
      const components: string[] = [];
      if (t("background", "no-change") === "true") components.push("BKGD");
      if (t("key0", "no-change") === "true") components.push("KEY1");
      if (t("key1", "no-change") === "true") components.push("KEY2");
      if (t("key2", "no-change") === "true") components.push("KEY3");
      if (t("key3", "no-change") === "true") components.push("KEY4");
      if (t("key4", "no-change") === "true") components.push("KEY5");
      return `TRANSITION ${n("mixeffect", 1)} SELECT ${components.length ? components.join("+") : "BKGD"}`;
    }
    case "transitionStyle":
      return `TRANSITION ${n("mixeffect", 1)} STYLE ${t("style", "mix").toUpperCase()}`;
    case "uskFlyKeyLumaChromaPattern":
    case "uskFlyKeyLumaChromaPatternVariables": {
      if (!atemBoolean(t("flyEnabled"), true)) return `USK ${n("mixeffect", 1)} ${n("key", 1)} FLY OFF`;
      return `USK ${n("mixeffect", 1)} ${n("key", 1)} FLY RUN`;
    }
    case "uskSource":
    case "uskSourceVariables":
      return `USK ${n("mixeffect", 1)} ${n("key", 1)} SOURCE ${n("fill", 1)} ${n("cut", n("fill", 1))}`;
    case "uskMaskLumaChromaPattern":
      return `USK ${n("mixeffect", 1)} ${n("key", 1)} MASK ${x("maskTop", 9)} ${x("maskBottom", -9)} ${x("maskLeft", -16)} ${x("maskRight", 16)}`;
    case "usk":
      return `USK ${n("mixeffect", 1)} ${n("key", 1)} ${onOff("onair", "TOGGLE")}`;
    case "uskType":
      return `USK ${n("mixeffect", 1)} ${n("key", 1)} TYPE ${t("type", "luma").toUpperCase()}`;
    default:
      return "";
  }
}

function SelectField({
  value, options, onChange, placeholder = "", includeEmptyOption = true,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  includeEmptyOption?: boolean;
}) {
  const resolvedPlaceholder = placeholder.trim() || "Select";
  return (
    <div className="relative" style={{ width: "100%" }}>
      <select
        className="appearance-none w-full outline-none cursor-pointer app-scrollbar"
        style={{ ...INPUT_STYLE, paddingRight: 24 }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {includeEmptyOption ? <option value="">{resolvedPlaceholder}</option> : null}
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return (
            <option key={optionValue} value={optionValue} style={{ backgroundColor: P.ink950 }}>
              {optionLabel}
            </option>
          );
        })}
      </select>
      {/* Chevron */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
        className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ right: 4 }}>
        <path d="M4 6L8 10L12 6" stroke={P.surface700}
          strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333"/>
      </svg>
    </div>
  );
}

function isBooleanSelectOptions(options: SelectOption[]): boolean {
  if (options.length !== 2) return false;
  const normalized = new Set(
    options
      .map((option) => (typeof option === "string" ? option : option.value).trim().toLowerCase()),
  );
  return normalized.has("true") && normalized.has("false");
}

function BooleanCheckboxField({
  value,
  onChange,
  label = "Enabled",
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const checked = value.trim().toLowerCase() === "true";
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none" style={{ color: P.text50, fontSize: 12 }}>
      <Checkbox
        checked={checked}
        onCheckedChange={(nextChecked) => onChange(nextChecked ? "true" : "false")}
      />
      <span>{label}</span>
    </label>
  );
}

// ── Task row ───────────────────────────────────────────────────────────────────

function TaskRow({ task, index, total, onChange, onDelete, onMove, onDuplicate }: {
  task:        TaskEntry;
  index:       number;
  total:       number;
  onChange:    (id: string, field: keyof TaskEntry, v: string) => void;
  onDelete:    (id: string) => void;
  onMove:      (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
}) {
  const isEnabled = task.enabled !== false;
  const label = task.label || [task.connection, task.funcName, task.input].filter(Boolean).join(" - ");
  return (
    <div
      className="flex items-center shrink-0"
      style={{
        height:       PANEL_TASK_ROW_HEIGHT,
        borderBottom: "1px solid rgba(60,67,80,0.1)",
        paddingLeft:  12,
      }}
    >
      <Checkbox
        checked={isEnabled}
        onCheckedChange={(nextChecked) => onChange(task.id, "enabled", nextChecked ? "true" : "false")}
      />

      {/* Task label */}
      <span className="flex-1 truncate" style={{ fontSize: 12, color: P.text50 }}>
        {label || "(empty task)"}{!isEnabled ? " [Excluded]" : ""}
      </span>

      {/* Pause input — compact */}
      <input
        className="outline-none text-center"
        style={{
          width:           54,
          height:          20,
          backgroundColor: "transparent",
          border:          "0.5px solid transparent",
          borderRadius:    2,
          fontSize:        11,
          color:           isEnabled ? P.muted500 : "#6b7280",
          flexShrink:      0,
        }}
        value={task.pause}
        placeholder="—"
        onChange={e => onChange(task.id, "pause", e.target.value)}
        onFocus={e => (e.currentTarget.style.borderColor = P.surface700)}
        onBlur={e  => (e.currentTarget.style.borderColor = "transparent")}
        title="Pause after this task (ms)"
      />

      {/* Up */}
      <button
        className="shrink-0 flex items-center justify-center hover:opacity-70"
        data-haptic="off"
        style={{
          width:           PANEL_ICON_BUTTON_SIZE,
          height:          PANEL_ICON_BUTTON_SIZE,
          backgroundColor: P.surface900,
          color:           P.text50,
          cursor:          index === 0 ? "not-allowed" : "pointer",
          opacity:         index === 0 ? 0.35 : 1,
        }}
        disabled={index === 0}
        onClick={() => onMove(task.id, -1)}
      >
        <SvgIcon d={svgPaths.p391e4dc0} size={14}/>
      </button>

      {/* Down */}
      <button
        className="shrink-0 flex items-center justify-center hover:opacity-70"
        data-haptic="off"
        style={{
          width:           PANEL_ICON_BUTTON_SIZE,
          height:          PANEL_ICON_BUTTON_SIZE,
          backgroundColor: P.surface900,
          color:           P.text50,
          cursor:          index === total - 1 ? "not-allowed" : "pointer",
          opacity:         index === total - 1 ? 0.35 : 1,
        }}
        disabled={index === total - 1}
        onClick={() => onMove(task.id, 1)}
      >
        <SvgIcon d={svgPaths.p14089660} size={14}/>
      </button>

      {/* Duplicate */}
      <button
        className="shrink-0 flex items-center justify-center hover:opacity-70"
        data-haptic="off"
        style={{ width: PANEL_ICON_BUTTON_SIZE, height: PANEL_ICON_BUTTON_SIZE, backgroundColor: P.surface900, color: P.text50 }}
        onClick={() => onDuplicate(task.id)}
      >
        <SvgIcon d={svgPaths.p23df5b00} size={14}/>
      </button>

      {/* Delete */}
      <button
        className="shrink-0 flex items-center justify-center hover:opacity-70"
        data-haptic="off"
        style={{ width: PANEL_ICON_BUTTON_SIZE, height: PANEL_ICON_BUTTON_SIZE, backgroundColor: P.surface900, color: P.text50 }}
        onClick={() => onDelete(task.id)}
      >
        <Trash2 size={12}/>
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AddTaskPanel({
  tasks: initialTasks,
  connections,
  onClose,
  onSave,
  variant = "popup",
  title,
  onDraftChange,
  selectedTaskId = null,
  selectedTask: selectedTaskProp = null,
  onSelectionChange,
  showWorkspaceTaskActions = true,
  onWorkspaceActionsChange,
}: Props) {
  const t = useTheme();
  const isWorkspace = variant === "workspace";

  // ── Form state ───────────────────────────────────────────────────────────────
  const [conn,     setConn]     = useState("");
  const [mode,     setMode]     = useState("");
  const [category, setCategory] = useState("");
  const [funcName, setFuncName] = useState("");
  const [input,    setInput]    = useState("");
  const [value,    setValue]    = useState("");
  const [resolumeMasterAction, setResolumeMasterAction] = useState<ResolumeMasterAction>("=");
  const [resolumeMasterValue, setResolumeMasterValue] = useState("");
  const [resolumeLayer, setResolumeLayer] = useState("1");
  const [resolumeClip, setResolumeClip] = useState("1");
  const [resolumeColumnAction, setResolumeColumnAction] = useState<ResolumeMasterAction>("=");
  const [resolumeColumnValue, setResolumeColumnValue] = useState("");
  const [resolumeLayerNumber, setResolumeLayerNumber] = useState("1");
  const [resolumeLayerGroupNumber, setResolumeLayerGroupNumber] = useState("1");
  const [resolumeLastColumn, setResolumeLastColumn] = useState("4");
  const [resolumeToggleAction, setResolumeToggleAction] = useState<ResolumeToggleAction>("toggle");
  const [resolumeDeckAction, setResolumeDeckAction] = useState<ResolumeMasterAction>("=");
  const [resolumeDeckValue, setResolumeDeckValue] = useState("");
  const [resolumeCustomOscAddress, setResolumeCustomOscAddress] = useState("");
  const [resolumeCustomOscArgs, setResolumeCustomOscArgs] = useState("");
  const [xpressionTakeId, setXpressionTakeId] = useState("0");
  const [xpressionFramebuffer, setXpressionFramebuffer] = useState("1");
  const [xpressionLayer, setXpressionLayer] = useState("0");
  const [xpressionGpi, setXpressionGpi] = useState("0");
  const [xpressionCustomCommand, setXpressionCustomCommand] = useState("");
  const [rossTalkMle, setRossTalkMle] = useState("ME:1");
  const [rossTalkMultiviewerNumber, setRossTalkMultiviewerNumber] = useState("1");
  const [rossTalkBoxNumber, setRossTalkBoxNumber] = useState("1");
  const [rossTalkSource, setRossTalkSource] = useState("IN:5");
  const [rossTalkCcBank, setRossTalkCcBank] = useState("1");
  const [rossTalkCcNumber, setRossTalkCcNumber] = useState("1");
  const [rossTalkSetName, setRossTalkSetName] = useState("set1");
  const [rossTalkSetLocation, setRossTalkSetLocation] = useState("");
  const [rossTalkMemoryId, setRossTalkMemoryId] = useState("1:1");
  const [rossTalkCommand, setRossTalkCommand] = useState("");
  const [rossTalkTakeId, setRossTalkTakeId] = useState("0");
  const [rossTalkLayer, setRossTalkLayer] = useState("0");
  const [rossTalkKeyer, setRossTalkKeyer] = useState("1");
  const [rossTalkTransitionOnOff, setRossTalkTransitionOnOff] = useState<"toggle" | "on" | "off">("toggle");
  const [rossTalkTransitionType, setRossTalkTransitionType] = useState<"CUT" | "AUTO">("CUT");
  const [rossTalkGpiNumber, setRossTalkGpiNumber] = useState("1");
  const [rossTalkGpiName, setRossTalkGpiName] = useState("");
  const [rossTalkGpiParameter, setRossTalkGpiParameter] = useState("");
  const [rossTalkXptDestination, setRossTalkXptDestination] = useState("ME:1:PGM");
  const [rossTalkXptSource, setRossTalkXptSource] = useState("IN:20");
  const [rossTalkTimerId, setRossTalkTimerId] = useState("1");
  const [rossTalkTimerAction, setRossTalkTimerAction] = useState("RUN");
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [vmixCatalog, setVmixCatalog] = useState<VmixShortcutCatalog | null>(null);
  const [vmixCatalogReady, setVmixCatalogReady] = useState(false);
  const [vmixCategory, setVmixCategory] = useState("");
  const [vmixFunctionName, setVmixFunctionName] = useState("");
  const [vmixArgs, setVmixArgs] = useState<Record<string, string>>({});
  const [obsRuntimeCatalogue, setObsRuntimeCatalogue] = useState<ObsRuntimeCatalogue | null>(null);
  const [obsCatalogueLoading, setObsCatalogueLoading] = useState(false);
  const [obsCatalogueError, setObsCatalogueError] = useState("");
  const [obsSceneName, setObsSceneName] = useState("");
  const [obsInputName, setObsInputName] = useState("");
  const [obsTransitionName, setObsTransitionName] = useState("");
  const [obsProfileName, setObsProfileName] = useState("");
  const [obsSceneCollectionName, setObsSceneCollectionName] = useState("");
  const [obsOutputName, setObsOutputName] = useState("");
  const [obsHotkeyName, setObsHotkeyName] = useState("");
  const [obsFieldValues, setObsFieldValues] = useState<Record<string, string>>({});
  const [atemFieldValues, setAtemFieldValues] = useState<Record<string, string>>({});
  const [grandMA3FieldValues, setGrandMA3FieldValues] = useState<Record<string, string>>({});
  const [ma2ButtonNumber, setMa2ButtonNumber] = useState("11");
  const [ma2ButtonDirection, setMa2ButtonDirection] = useState<MA2Direction>("press");
  const [ma2EncoderPressNumber, setMa2EncoderPressNumber] = useState("1");
  const [ma2EncoderPressUseVariable, setMa2EncoderPressUseVariable] = useState<"false" | "true">("false");
  const [ma2EncoderPressVariable, setMa2EncoderPressVariable] = useState("1");
  const [ma2EncoderPressDirection, setMa2EncoderPressDirection] = useState<MA2DownUpDirection>("true");
  const [ma2WheelSteps, setMa2WheelSteps] = useState("1");
  const [ma2RotateEncoderNumber, setMa2RotateEncoderNumber] = useState("1");
  const [ma2RotateUseVariable, setMa2RotateUseVariable] = useState<"false" | "true">("false");
  const [ma2RotateEncoderVariable, setMa2RotateEncoderVariable] = useState("1");
  const [ma2RotateDirection, setMa2RotateDirection] = useState<MA2RotateDirection>("1");
  const [ma2RotateSteps, setMa2RotateSteps] = useState("1");
  const [ma2CustomCommand, setMa2CustomCommand] = useState("");
  const [genericTcpUdpCommand, setGenericTcpUdpCommand] = useState("");
  const [genericTcpUdpHexCommand, setGenericTcpUdpHexCommand] = useState("");
  const [genericTcpUdpLineEnd, setGenericTcpUdpLineEnd] = useState("\n");
  const [companionSatellitePage, setCompanionSatellitePage] = useState("1");
  const [companionSatelliteRow, setCompanionSatelliteRow] = useState("0");
  const [companionSatelliteColumn, setCompanionSatelliteColumn] = useState("0");
  const [companionSatelliteEventType, setCompanionSatelliteEventType] = useState("press");
  const [companionSatelliteTesting, setCompanionSatelliteTesting] = useState(false);
  const [companionSatelliteTestResult, setCompanionSatelliteTestResult] = useState("");
  const [swp08Levels, setSwp08Levels] = useState<string[]>(["1"]);
  const [swp08Destination, setSwp08Destination] = useState("1");
  const [swp08Source, setSwp08Source] = useState("1");
  const [swp08ClearType, setSwp08ClearType] = useState("all");
  const [swp08ClearEnableLevels, setSwp08ClearEnableLevels] = useState<"true" | "false">("true");
  const [swp08SourceNameOptionsState, setSwp08SourceNameOptionsState] = useState<Swp08NameOption[]>([]);
  const [swp08DestinationNameOptionsState, setSwp08DestinationNameOptionsState] = useState<Swp08NameOption[]>([]);
  const [swp08NamesLoading, setSwp08NamesLoading] = useState(false);
  const [swp08NamesError, setSwp08NamesError] = useState("");
  const [swp08NamesReloadKey, setSwp08NamesReloadKey] = useState(0);
  const [videohubDestination, setVideohubDestination] = useState("0");
  const [videohubDestinationDynamic, setVideohubDestinationDynamic] = useState("");
  const [videohubSource, setVideohubSource] = useState("0");
  const [videohubSourceDynamic, setVideohubSourceDynamic] = useState("");
  const [videohubSourceRoutedDestination, setVideohubSourceRoutedDestination] = useState("0");
  const [videohubSourceRoutedDestinationDynamic, setVideohubSourceRoutedDestinationDynamic] = useState("");
  const [videohubOutput, setVideohubOutput] = useState("0");
  const [videohubOutputDynamic, setVideohubOutputDynamic] = useState("");
  const [videohubLockState, setVideohubLockState] = useState("T");
  const [videohubLockStateDynamic, setVideohubLockStateDynamic] = useState("toggle");
  const [videohubIgnoreLock, setVideohubIgnoreLock] = useState<"true" | "false">("false");
  const [videohubLabel, setVideohubLabel] = useState("");
  const [videohubSourceFile, setVideohubSourceFile] = useState("C:\\VideoHub.txt");
  const [videohubDestinationFile, setVideohubDestinationFile] = useState("C:\\VideoHub.txt");
  const [videohubSourceOptionsState, setVideohubSourceOptionsState] = useState<VideohubNameOption[]>([]);
  const [videohubDestinationOptionsState, setVideohubDestinationOptionsState] = useState<VideohubNameOption[]>([]);
  const [videohubNamesLoading, setVideohubNamesLoading] = useState(false);
  const [videohubNamesError, setVideohubNamesError] = useState("");
  const [videohubNamesReloadKey, setVideohubNamesReloadKey] = useState(0);
  const [httpRequestUrl, setHttpRequestUrl] = useState("");
  const [httpRequestBody, setHttpRequestBody] = useState("{}");
  const [httpRequestHeader, setHttpRequestHeader] = useState("");
  const [httpRequestContentType, setHttpRequestContentType] = useState("application/json");
  const [httpRequestJsonResultVariable, setHttpRequestJsonResultVariable] = useState("");
  const [httpRequestResultStringify, setHttpRequestResultStringify] = useState<"true" | "false">("true");
  const [httpRequestStatusCodeVariable, setHttpRequestStatusCodeVariable] = useState("");
  const [genericOscPath, setGenericOscPath] = useState("/osc/path");
  const [genericOscString, setGenericOscString] = useState("text");
  const [genericOscInt, setGenericOscInt] = useState("1");
  const [genericOscFloat, setGenericOscFloat] = useState("1");
  const [genericOscBoolean, setGenericOscBoolean] = useState<"true" | "false">("false");
  const [genericOscArguments, setGenericOscArguments] = useState("1 \"Let's go\" 2.5");
  const [genericOscBlob, setGenericOscBlob] = useState("");
  const [genericOscBlobHex, setGenericOscBlobHex] = useState("0A0B0C");
  const [genericOscBlobHexSwitch, setGenericOscBlobHexSwitch] = useState<"true" | "false">("false");
  const [genericOscMidiMode, setGenericOscMidiMode] = useState("noteon");
  const [genericOscMidiPortId, setGenericOscMidiPortId] = useState("0");
  const [genericOscMidiChannel, setGenericOscMidiChannel] = useState("1");
  const [genericOscMidiData1, setGenericOscMidiData1] = useState("69");
  const [genericOscMidiData2, setGenericOscMidiData2] = useState("100");
  const [genericOscMidiPitch, setGenericOscMidiPitch] = useState("0");
  const [genericOscMidiRawHex, setGenericOscMidiRawHex] = useState("00 90 45 65");

  // ── Task list state (local — committed on Save/Add) ──────────────────────────
  const [tasks, setTasks] = useState<TaskEntry[]>(initialTasks);

  useEffect(() => {
    setTasks(ensureUniqueTaskIds(initialTasks));
  }, [initialTasks]);

  useEffect(() => {
    onDraftChange?.(tasks);
  }, [onDraftChange, tasks]);

  // ── Derived options ──────────────────────────────────────────────────────────
  const selectedTask = useMemo(
    () => (
      selectedTaskProp
      ?? (tasks.find((task) => task.id === selectedTaskId) ?? null)
    ),
    [selectedTaskId, selectedTaskProp, tasks],
  );
  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.name === conn)
      ?? (selectedTask ? findConnectionForTask(connections, selectedTask) : undefined),
    [conn, connections, selectedTask],
  );
  const cat         = useMemo(() => getTaskCatalogue(conn, connections), [conn, connections]);
  const modeOpts    = cat.modes;
  const catOpts     = Object.keys(cat.categories);
  const funcOpts    = category ? (cat.categories[category] ?? []) : [];
  const genericFunctionOptions = useMemo<SelectOption[]>(
    () => (
      Object.entries(cat.categories)
        .flatMap(([, functions]) => functions.map((fn) => ({ value: fn, label: fn })))
    ),
    [cat.categories],
  );
  const obsFunctionOptions = useMemo<SelectOption[]>(
    () => (
      Object.entries(cat.categories)
        .flatMap(([group, functions]) => functions.map((fn) => ({
          value: fn,
          label: `${group} | ${fn}`,
        })))
    ),
    [cat.categories],
  );
  const xpressionFunctionOptions = useMemo<SelectOption[]>(
    () => (
      Object.entries(cat.categories)
        .flatMap(([, functions]) => functions.map((fn) => ({ value: fn, label: fn })))
    ),
    [cat.categories],
  );
  const selectedDevice = String(selectedConnection?.device ?? "").trim().toLowerCase();
  const isVmixConnection = selectedDevice === "vmix";
  const isResolumeConnection = selectedDevice === "resolume";
  const isRossTalkConnection = selectedDevice === "ross_talk";
  const isRossXpressionConnection = selectedDevice === "ross_xpression";
  const isAtemConnection = selectedDevice === "atem";
  const isX32Connection = selectedDevice === "x32";
  const isObsConnection = selectedDevice === "obs";
  const isGrandMA2Connection = selectedDevice === "grandma2";
  const isGrandMA3Connection = selectedDevice === "grandma3";
  const isSwp08Connection = selectedDevice === "swp08";
  const isVideohubConnection = selectedDevice === "videohub";
  const isHttpApiConnection = selectedDevice === "http_api";
  const isCompanionRemoteConnection = selectedDevice === "companion_remote";
  const isGenericTcpUdpConnection = selectedDevice === "generic_tcp";
  const isGenericOscConnection = selectedDevice === "generic_osc";
  const isMaLightingConnection = isGrandMA2Connection || isGrandMA3Connection;
  const isObsSceneFunction = isObsConnection && OBS_SCENE_FUNCTIONS.has(funcName);
  const obsFunctionSpec = isObsConnection ? (OBS_FUNCTION_SPECS[funcName] ?? null) : null;
  const grandMA3FunctionSpec = isGrandMA3Connection ? (GRANDMA3_FUNCTION_SPECS[funcName] ?? null) : null;
  const atemFunctionSpec = isAtemConnection ? (ATEM_FUNCTION_SPECS[funcName] ?? null) : null;
  const parameterSectionLabel =
    isRossTalkConnection
      ? "rosstalk"
      : isRossXpressionConnection
        ? "xpression"
        : isResolumeConnection
          ? "resolume"
          : isX32Connection
            ? "x32"
          : isGrandMA3Connection
            ? "grandma3"
          : isVmixConnection
            ? "vmix"
            : (selectedDevice ? selectedDevice.replace(/_/g, " ") : "parameters");
  const isRossXpressionCustomCommand = isRossXpressionConnection && isRossXpressionCustomCommandFunction(funcName);
  const isRossXpressionGpi = isRossXpressionConnection && isRossXpressionGpiFunction(funcName);
  const needsRossXpressionTakeIdField = isRossXpressionConnection && needsRossXpressionTakeId(funcName);
  const needsRossXpressionFramebufferField = isRossXpressionConnection && needsRossXpressionFramebuffer(funcName);
  const needsRossXpressionLayerField = isRossXpressionConnection && needsRossXpressionLayer(funcName);
  const isWaitCommand = conn === WAIT_CONNECTION_VALUE;
  const activeConnections = useMemo(
    () => connections.filter((connection) => connection.active !== false),
    [connections],
  );
  const connectionOptions = useMemo<SelectOption[]>(
    () => {
      const options: SelectOption[] = [];
      if (isWorkspace) options.push({ value: WAIT_CONNECTION_VALUE, label: "Internal" });
      if (activeConnections.length) {
        options.push(...activeConnections.map((connection) => ({ value: connection.name, label: connection.name })));
      }
      if (conn && conn !== WAIT_CONNECTION_VALUE) {
        const selectedConnection = connections.find((connection) => connection.name === conn);
        if (selectedConnection && selectedConnection.active === false) {
          options.push({
            value: selectedConnection.name,
            label: `${selectedConnection.name} (Disabled)`,
          });
        }
      } else if (!isWorkspace) {
        options.push("No connections");
      }
      return options;
    },
    [activeConnections, conn, connections, isWorkspace],
  );
  const isResolumeCompositionChange =
    isResolumeConnection && isResolumeCompositionChangeFunction(funcName);
  const isResolumeClipChange =
    isResolumeConnection && isResolumeClipChangeFunction(funcName);
  const isResolumeClipSelection =
    isResolumeConnection && isResolumeClipSelectionFunction(funcName);
  const isResolumeColumnAction =
    isResolumeConnection && isResolumeColumnActionFunction(funcName);
  const isResolumeLayerColumnStep =
    isResolumeConnection && isResolumeLayerColumnStepFunction(funcName);
  const isResolumeLayerGroupColumnStep =
    isResolumeConnection && isResolumeLayerGroupColumnStepFunction(funcName);
  const isResolumeToggleActionFunction =
    isResolumeConnection && isResolumeToggleFunction(funcName);
  const isResolumeLayerChange =
    isResolumeConnection && isResolumeLayerChangeFunction(funcName);
  const isResolumeLayerGroupChange =
    isResolumeConnection && isResolumeLayerGroupChangeFunction(funcName);
  const isResolumeLayerSelect =
    isResolumeConnection && isResolumeLayerSelectFunction(funcName);
  const isResolumeLayerClear =
    isResolumeConnection && isResolumeLayerClearFunction(funcName);
  const isResolumeDeckSelect =
    isResolumeConnection && isResolumeDeckSelectFunction(funcName);
  const isResolumeDeckStep =
    isResolumeConnection && isResolumeDeckStepFunction(funcName);
  const isResolumeCompositionColumnStep =
    isResolumeConnection && isResolumeCompositionColumnStepFunction(funcName);
  const isResolumeCustomOsc =
    isResolumeConnection && isResolumeCustomOscFunction(funcName);
  const isResolumeLayerGroupToggleAction =
    isResolumeToggleActionFunction
    && isResolumeToggleFunction(funcName)
    && isLayerGroupToggleFunction(funcName);
  const isResolumeLayerGroupSelectAction =
    isResolumeLayerSelect
    && isResolumeLayerSelectFunction(funcName)
    && isLayerGroupSelectFunction(funcName);
  const isResolumeLayerGroupClearAction =
    isResolumeLayerClear
    && isResolumeLayerClearFunction(funcName)
    && isLayerGroupClearFunction(funcName);
  const isResolumeLayerGroupColumnAction =
    isResolumeColumnAction
    && isResolumeColumnActionFunction(funcName)
    && isLayerGroupColumnAction(funcName);
  const isResolumeDbValueFunction =
    funcName === "Composition Volume Change"
    || funcName === "Clip Volume Change"
    || funcName === "Layer Volume Change"
    || funcName === "Layer Group Volume Change";
  const resolumeValueLabel = funcName === "Layer Transition Duration Change"
    ? "Value in seconds (e.g. 1 or 0.1)"
    : (isResolumeDbValueFunction
      ? "Value in db (e.g. 100 or 10)"
      : "Value in percentage (e.g. 100 or 10)");
  const resolumeDeltaActionOptions = useMemo<SelectOption[]>(
    () => (
      funcName === "Clip Speed Change"
        ? [
            { value: "+", label: "+ (not in OSC)" },
            "-",
            "=",
          ]
        : ["+", "-", "="]
    ),
    [funcName],
  );
  const resolumeColumnActionOptions = useMemo<SelectOption[]>(
    () => ["+", "-", "="],
    [],
  );
  const resolumeToggleOptions = useMemo<SelectOption[]>(
    () => [
      { value: "toggle", label: "Toggle" },
      { value: "on", label: "On" },
      { value: "off", label: "Off" },
    ],
    [],
  );
  const manualBuilderSupported = Boolean(selectedConnection) && !isVmixConnection;
  const atemMeta = (selectedConnection ?? null) as (Connection & Record<string, unknown>) | null;
  const atemInputCount = useMemo(
    () => Math.max(
      1,
      parsePositiveIntegerValue(atemMeta?.atemInputCount) ?? parsePositiveIntegerValue(selectedConnection?.inputCount) ?? 20,
    ),
    [atemMeta, selectedConnection?.inputCount],
  );
  const atemAuxCount = useMemo(
    () => Math.max(
      1,
      parsePositiveIntegerValue(atemMeta?.atemAuxCount) ?? parsePositiveIntegerValue(selectedConnection?.outputCount) ?? 4,
    ),
    [atemMeta, selectedConnection?.outputCount],
  );
  const atemMeCount = useMemo(
    () => Math.max(
      1,
      parsePositiveIntegerValue(atemMeta?.atemMeCount)
      ?? parsePositiveIntegerValue(atemMeta?.mixEffects)
      ?? 1,
    ),
    [atemMeta],
  );
  const atemDskCount = useMemo(
    () => Math.max(
      1,
      parsePositiveIntegerValue(atemMeta?.atemDskCount)
      ?? parsePositiveIntegerValue(atemMeta?.downstreamKeyers)
      ?? 2,
    ),
    [atemMeta],
  );
  const atemUskCount = useMemo(
    () => Math.max(
      1,
      parsePositiveIntegerValue(atemMeta?.atemUskCount)
      ?? parsePositiveIntegerValue(atemMeta?.upstreamKeyers)
      ?? 4,
    ),
    [atemMeta],
  );
  const atemMultiviewerCount = useMemo(
    () => Math.max(
      1,
      parsePositiveIntegerValue(atemMeta?.atemMultiviewerCount)
      ?? parsePositiveIntegerValue(atemMeta?.multiviewers)
      ?? 1,
    ),
    [atemMeta],
  );
  const atemMediaPlayerCount = useMemo(
    () => Math.max(
      1,
      parsePositiveIntegerValue(atemMeta?.atemMediaPlayerCount)
      ?? parsePositiveIntegerValue(atemMeta?.mediaPlayers)
      ?? 2,
    ),
    [atemMeta],
  );
  const atemMvWindowCount = useMemo(
    () => Math.max(
      1,
      parsePositiveIntegerValue(atemMeta?.atemMultiviewerWindowCount)
      ?? parsePositiveIntegerValue(atemMeta?.multiviewerWindows)
      ?? 10,
    ),
    [atemMeta],
  );
  const atemNamedInputs = useMemo<SelectOption[]>(
    () => {
      const sourceNames = atemMeta?.atemSourceNames;
      if (!Array.isArray(sourceNames) || !sourceNames.length) return [];
      return sourceNames
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const item = entry as Record<string, unknown>;
          const id = parsePositiveIntegerValue(item.id) ?? (index + 1);
          const name = typeof item.label === "string"
            ? item.label.trim()
            : (typeof item.name === "string" ? item.name.trim() : "");
          return {
            value: String(id),
            label: name ? `${id} - ${name}` : `Input ${id}`,
          };
        })
        .filter((entry): entry is { value: string; label: string } => entry !== null);
    },
    [atemMeta],
  );
  const atemNamedAux = useMemo<SelectOption[]>(
    () => {
      const auxNames = atemMeta?.atemAuxNames;
      if (!Array.isArray(auxNames) || !auxNames.length) return [];
      return auxNames
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const item = entry as Record<string, unknown>;
          const id = parsePositiveIntegerValue(item.id) ?? (index + 1);
          const name = typeof item.label === "string"
            ? item.label.trim()
            : (typeof item.name === "string" ? item.name.trim() : "");
          return {
            value: String(id),
            label: name ? `${id} - ${name}` : `Aux/Output ${id}`,
          };
        })
        .filter((entry): entry is { value: string; label: string } => entry !== null);
    },
    [atemMeta],
  );
  const atemInputOptions = useMemo<SelectOption[]>(
    () => (atemNamedInputs.length
      ? atemNamedInputs
      : Array.from({ length: atemInputCount }, (_, index) => {
          const value = String(index + 1);
          return { value, label: `Input ${value}` };
        })),
    [atemInputCount, atemNamedInputs],
  );
  const atemAuxOptions = useMemo<SelectOption[]>(
    () => (atemNamedAux.length
      ? atemNamedAux
      : Array.from({ length: atemAuxCount }, (_, index) => {
          const value = String(index + 1);
          return { value, label: `Aux/Output ${value}` };
        })),
    [atemAuxCount, atemNamedAux],
  );
  const atemMeOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: atemMeCount }, (_, index) => {
      const value = String(index + 1);
      return { value, label: `M/E ${value}` };
    }),
    [atemMeCount],
  );
  const atemDskOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: atemDskCount }, (_, index) => {
      const value = String(index + 1);
      return { value, label: `Key ${value}` };
    }),
    [atemDskCount],
  );
  const atemUskOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: atemUskCount }, (_, index) => {
      const value = String(index + 1);
      return { value, label: `Key ${value}` };
    }),
    [atemUskCount],
  );
  const atemMultiviewerOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: atemMultiviewerCount }, (_, index) => {
      const value = String(index + 1);
      return { value, label: `MV ${value}` };
    }),
    [atemMultiviewerCount],
  );
  const atemMediaPlayerOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: atemMediaPlayerCount }, (_, index) => {
      const value = String(index + 1);
      return { value, label: `Media Player ${value}` };
    }),
    [atemMediaPlayerCount],
  );
  const atemMvWindowOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: atemMvWindowCount }, (_, index) => {
      const value = String(index + 1);
      return { value, label: `Window ${value}` };
    }),
    [atemMvWindowCount],
  );
  const atemTransitionComponentOptions = useMemo<SelectOption[]>(
    () => [
      { value: "background", label: "Background" },
      ...Array.from({ length: atemUskCount }, (_, index) => ({
        value: `key${index}`,
        label: `Key ${index + 1}`,
      })),
    ],
    [atemUskCount],
  );
  const swp08LevelCount = useMemo(
    () => Math.max(1, parsePositiveIntegerValue(selectedConnection?.swp08LevelCount) ?? 3),
    [selectedConnection?.swp08LevelCount],
  );
  const swp08LevelOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: swp08LevelCount }, (_, index) => {
      const level = String(index + 1);
      return { value: level, label: `Level ${level}` };
    }),
    [swp08LevelCount],
  );
  const swp08NameNumberOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: 256 }, (_, index) => {
      const value = String(index + 1);
      return { value, label: value };
    }),
    [],
  );
  const swp08SourceNameOptions = useMemo<SelectOption[]>(
    () => (swp08SourceNameOptionsState.length
      ? swp08SourceNameOptionsState
      : swp08NameNumberOptions),
    [swp08NameNumberOptions, swp08SourceNameOptionsState],
  );
  const swp08DestinationNameOptions = useMemo<SelectOption[]>(
    () => (swp08DestinationNameOptionsState.length
      ? swp08DestinationNameOptionsState
      : swp08NameNumberOptions),
    [swp08DestinationNameOptionsState, swp08NameNumberOptions],
  );
  const videohubInputCount = useMemo(
    () => Math.max(1, parsePositiveIntegerValue(selectedConnection?.inputCount) ?? 12),
    [selectedConnection?.inputCount],
  );
  const videohubOutputCount = useMemo(
    () => Math.max(1, parsePositiveIntegerValue(selectedConnection?.outputCount) ?? 12),
    [selectedConnection?.outputCount],
  );
  const videohubSourceNumberOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: videohubInputCount }, (_, index) => {
      const value = String(index);
      return { value, label: value };
    }),
    [videohubInputCount],
  );
  const videohubDestinationNumberOptions = useMemo<SelectOption[]>(
    () => Array.from({ length: videohubOutputCount }, (_, index) => {
      const value = String(index);
      return { value, label: value };
    }),
    [videohubOutputCount],
  );
  const videohubSourceOptions = useMemo<SelectOption[]>(
    () => (videohubSourceOptionsState.length ? videohubSourceOptionsState : videohubSourceNumberOptions),
    [videohubSourceNumberOptions, videohubSourceOptionsState],
  );
  const videohubDestinationOptions = useMemo<SelectOption[]>(
    () => (videohubDestinationOptionsState.length ? videohubDestinationOptionsState : videohubDestinationNumberOptions),
    [videohubDestinationNumberOptions, videohubDestinationOptionsState],
  );
  const rossTalkFunctionOptions = useMemo<SelectOption[]>(
    () => (
      Object.entries(cat.categories)
        .flatMap(([, functions]) => functions.map((fn) => ({ value: fn, label: fn })))
    ),
    [cat.categories],
  );
  const rossTalkOrderedFunctionOptions = useMemo<Array<{ value: string; label: string }>>(
    () => {
      const normalized = rossTalkFunctionOptions.map((option) => (
        typeof option === "string"
          ? { value: option, label: option }
          : { value: option.value, label: option.label }
      ));
      const byValue = new Map(normalized.map((option) => [option.value, option]));
      const seen = new Set<string>();
      const ordered: Array<{ value: string; label: string }> = [];
      ROSS_TALK_FUNCTION_ORDER.forEach((func) => {
        const found = byValue.get(func);
        if (found && !seen.has(found.value)) {
          ordered.push(found);
          seen.add(found.value);
        }
      });
      normalized
        .filter((option) => !seen.has(option.value))
        .sort((a, b) => a.label.localeCompare(b.label))
        .forEach((option) => ordered.push(option));
      return ordered;
    },
    [rossTalkFunctionOptions],
  );
  const rossTalkTransitionOnOffOptions = useMemo<SelectOption[]>(
    () => [
      { value: "toggle", label: "Toggle Keyer" },
      { value: "on", label: "Take Keyer On Air" },
      { value: "off", label: "Take Keyer Off Air" },
    ],
    [],
  );
  const rossTalkTransitionTypeOptions = useMemo<SelectOption[]>(
    () => [
      { value: "CUT", label: "Cut Transition" },
      { value: "AUTO", label: "Auto Transition" },
    ],
    [],
  );
  const rossTalkTimerActionOptions = useMemo<SelectOption[]>(
    () => ["RUN", "PAUSE", "STOP", "END"],
    [],
  );
  const resolumeActionOptions = useMemo<SelectOption[]>(
    () => (
      Object.entries(cat.categories)
        .flatMap(([group, functions]) => functions.map((fn) => ({
          value: fn,
          label: `${group} | ${fn}`,
        })))
    ),
    [cat.categories],
  );
  const atemActionOptions = useMemo<SelectOption[]>(
    () => {
      const seen = new Set<string>();
      return Object.entries(cat.categories).flatMap(([group, functions]) => {
        const groupPrefix = `${group}:`.toLowerCase();
        return functions
          .filter((fn) => ATEM_FUNCTIONS.has(fn) && !seen.has(fn))
          .map((fn) => {
            seen.add(fn);
            const shortName = fn.toLowerCase().startsWith(groupPrefix)
              ? fn.slice(group.length + 1).trim()
              : fn;
            return {
              value: fn,
              label: `${group} | ${shortName || fn}`,
            };
          });
      });
    },
    [cat.categories],
  );
  const atemResolveFieldOptions = useCallback((field: AtemFieldSpec, spec: AtemFunctionSpec | null): SelectOption[] => {
    if (field.options?.length) return field.options;
    switch (field.key) {
      case "mixeffect":
        return atemMeOptions;
      case "downstreamKeyerId":
        return atemDskOptions;
      case "key":
        return spec?.definitionId.startsWith("dsk") ? atemDskOptions : atemUskOptions;
      case "aux":
        return atemAuxOptions;
      case "input":
      case "fill":
      case "cut":
      case "source":
        return atemInputOptions;
      case "mediaplayer":
        return atemMediaPlayerOptions;
      case "multiViewerId":
        return atemMultiviewerOptions;
      case "windowIndex":
        return atemMvWindowOptions;
      case "selection":
      case "component":
        return atemTransitionComponentOptions;
      default:
        return [];
    }
  }, [
    atemAuxOptions,
    atemDskOptions,
    atemInputOptions,
    atemMeOptions,
    atemMediaPlayerOptions,
    atemMultiviewerOptions,
    atemMvWindowOptions,
    atemTransitionComponentOptions,
    atemUskOptions,
  ]);
  const vmixCategories = useMemo(
    () => getVmixCategories(vmixCatalog),
    [vmixCatalog],
  );
  const vmixFunctionOptions = useMemo(
    () => getVmixFunctionsForCategory(vmixCatalog, vmixCategory).map((shortcut) => shortcut.name),
    [vmixCatalog, vmixCategory],
  );
  const obsSceneOptions = useMemo<SelectOption[]>(
    () => (obsRuntimeCatalogue?.scenes ?? []).map((scene) => ({ value: scene, label: scene })),
    [obsRuntimeCatalogue],
  );
  const obsInputOptions = useMemo<SelectOption[]>(
    () => (obsRuntimeCatalogue?.inputs ?? []).map((inputName) => ({ value: inputName, label: inputName })),
    [obsRuntimeCatalogue],
  );
  const obsTransitionOptions = useMemo<SelectOption[]>(
    () => (obsRuntimeCatalogue?.transitions ?? []).map((name) => ({ value: name, label: name })),
    [obsRuntimeCatalogue],
  );
  const obsProfileOptions = useMemo<SelectOption[]>(
    () => (obsRuntimeCatalogue?.profiles ?? []).map((name) => ({ value: name, label: name })),
    [obsRuntimeCatalogue],
  );
  const obsSceneCollectionOptions = useMemo<SelectOption[]>(
    () => (obsRuntimeCatalogue?.sceneCollections ?? []).map((name) => ({ value: name, label: name })),
    [obsRuntimeCatalogue],
  );
  const obsOutputOptions = useMemo<SelectOption[]>(
    () => (obsRuntimeCatalogue?.outputs ?? []).map((name) => ({ value: name, label: name })),
    [obsRuntimeCatalogue],
  );
  const obsHotkeyOptions = useMemo<SelectOption[]>(
    () => (obsRuntimeCatalogue?.hotkeys ?? []).map((name) => ({ value: name, label: name })),
    [obsRuntimeCatalogue],
  );
  const obsSceneItemOptions = useMemo<SelectOption[]>(
    () => (
      (obsRuntimeCatalogue?.sceneItemsByScene?.[obsSceneName] ?? [])
        .map((item) => ({
          value: String(item.sceneItemId),
          label: `${item.sourceName} (${item.sceneItemId})`,
        }))
    ),
    [obsRuntimeCatalogue, obsSceneName],
  );
  const obsCurrentParameterValue = useMemo(() => {
    const kind = obsFunctionSpec?.parameterKind;
    if (!kind) return "";
    if (kind === "scenes") return obsSceneName;
    if (kind === "inputs") return obsInputName;
    if (kind === "transitions") return obsTransitionName;
    if (kind === "profiles") return obsProfileName;
    if (kind === "sceneCollections") return obsSceneCollectionName;
    if (kind === "outputs") return obsOutputName;
    if (kind === "hotkeys") return obsHotkeyName;
    return "";
  }, [
    obsFunctionSpec?.parameterKind,
    obsHotkeyName,
    obsInputName,
    obsOutputName,
    obsProfileName,
    obsSceneCollectionName,
    obsSceneName,
    obsTransitionName,
  ]);
  const obsCurrentParameterOptions = useMemo<SelectOption[]>(() => {
    const kind = obsFunctionSpec?.parameterKind;
    if (!kind) return [];
    if (kind === "scenes") return obsSceneOptions;
    if (kind === "sceneItems") return obsSceneItemOptions;
    if (kind === "inputs") return obsInputOptions;
    if (kind === "transitions") return obsTransitionOptions;
    if (kind === "profiles") return obsProfileOptions;
    if (kind === "sceneCollections") return obsSceneCollectionOptions;
    if (kind === "outputs") return obsOutputOptions;
    if (kind === "hotkeys") return obsHotkeyOptions;
    return [];
  }, [
    obsFunctionSpec?.parameterKind,
    obsHotkeyOptions,
    obsInputOptions,
    obsOutputOptions,
    obsProfileOptions,
    obsSceneCollectionOptions,
    obsSceneOptions,
    obsSceneItemOptions,
    obsTransitionOptions,
  ]);
  const selectedVmixFunction = useMemo<VmixShortcutFunction | null>(
    () => getVmixFunctionByName(vmixCatalog, vmixFunctionName),
    [vmixCatalog, vmixFunctionName],
  );
  const swp08NamesCacheKey = useMemo(() => {
    if (!selectedConnection || selectedDevice !== "swp08") return "";
    return [
      selectedConnection.id ?? "",
      selectedConnection.ip ?? "",
      selectedConnection.port ?? "",
      selectedConnection.swp08Matrix ?? 1,
      selectedConnection.swp08ExtendedCommands ? 1 : 0,
      selectedConnection.swp08RequestNameLength ?? 8,
    ].join("|");
  }, [
    selectedConnection,
    selectedDevice,
  ]);
  const videohubNamesCacheKey = useMemo(() => {
    if (!selectedConnection || selectedDevice !== "videohub") return "";
    return [
      selectedConnection.id ?? "",
      selectedConnection.ip ?? "",
      selectedConnection.port ?? "",
      selectedConnection.inputCount ?? 12,
      selectedConnection.outputCount ?? 12,
    ].join("|");
  }, [
    selectedConnection,
    selectedDevice,
  ]);
  const refreshSwp08Names = () => setSwp08NamesReloadKey((prev) => prev + 1);
  const refreshVideohubNames = () => setVideohubNamesReloadKey((prev) => prev + 1);
  const vmixGeneratedCommand = useMemo(
    () => buildVmixCommand(vmixFunctionName, vmixArgs),
    [vmixArgs, vmixFunctionName],
  );
  const missingVmixParams = useMemo(
    () => selectedVmixFunction?.paramKeys.filter((key) => !(vmixArgs[key] ?? "").trim()) ?? [],
    [selectedVmixFunction, vmixArgs],
  );
  useEffect(() => {
    if (!isSwp08Connection || !selectedConnection) {
      setSwp08SourceNameOptionsState([]);
      setSwp08DestinationNameOptionsState([]);
      setSwp08NamesLoading(false);
      setSwp08NamesError("");
      return;
    }
    if (!isTauri()) {
      setSwp08SourceNameOptionsState([]);
      setSwp08DestinationNameOptionsState([]);
      setSwp08NamesLoading(false);
      setSwp08NamesError("");
      return;
    }

    const cached = swp08NamesCacheKey ? SWP08_NAMES_CACHE.get(swp08NamesCacheKey) : undefined;
    if (cached) {
      setSwp08SourceNameOptionsState(cached.sourceOptions);
      setSwp08DestinationNameOptionsState(cached.destinationOptions);
      setSwp08NamesError("");
      setSwp08NamesLoading(false);
      if (swp08NamesReloadKey === 0) return;
    }

    const host = String(selectedConnection.ip ?? "").trim();
    if (!host) {
      setSwp08NamesError("Router host/IP is missing.");
      return;
    }

    let cancelled = false;
    setSwp08NamesLoading(true);
    setSwp08NamesError("");

    void loadSwp08RouterNames({
      host,
      port: parsePositiveIntegerValue(selectedConnection.port) ?? 8910,
      matrix: selectedConnection.swp08Matrix ?? 1,
      matrixExt: selectedConnection.swp08Matrix ?? 1,
      extendedSupport: Boolean(selectedConnection.swp08ExtendedCommands),
      nameChars: selectedConnection.swp08RequestNameLength ?? 8,
    })
      .then((result) => {
        if (cancelled) return;
        const sourceOptions = result.sourceNames
          .map((entry) => {
            const value = String(entry.id);
            const labelText = `${entry.id}${entry.label?.trim() ? ` - ${entry.label.trim()}` : ""}`;
            return { value, label: labelText };
          })
          .sort((a, b) => Number(a.value) - Number(b.value));
        const destinationOptions = result.destinationNames
          .map((entry) => {
            const value = String(entry.id);
            const labelText = `${entry.id}${entry.label?.trim() ? ` - ${entry.label.trim()}` : ""}`;
            return { value, label: labelText };
          })
          .sort((a, b) => Number(a.value) - Number(b.value));

        setSwp08SourceNameOptionsState(sourceOptions);
        setSwp08DestinationNameOptionsState(destinationOptions);
        setSwp08NamesError("");
        if (swp08NamesCacheKey) {
          SWP08_NAMES_CACHE.set(swp08NamesCacheKey, {
            sourceOptions,
            destinationOptions,
            fetchedAt: Date.now(),
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setSwp08NamesError(
          error instanceof Error ? error.message : "Failed to fetch source/destination names from router.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setSwp08NamesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isSwp08Connection,
    selectedConnection,
    swp08NamesCacheKey,
    swp08NamesReloadKey,
  ]);
  useEffect(() => {
    if (!isVideohubConnection || !selectedConnection) {
      setVideohubSourceOptionsState([]);
      setVideohubDestinationOptionsState([]);
      setVideohubNamesLoading(false);
      setVideohubNamesError("");
      return;
    }
    if (!isTauri()) {
      setVideohubSourceOptionsState([]);
      setVideohubDestinationOptionsState([]);
      setVideohubNamesLoading(false);
      setVideohubNamesError("");
      return;
    }

    const cached = videohubNamesCacheKey ? VIDEOHUB_NAMES_CACHE.get(videohubNamesCacheKey) : undefined;
    if (cached) {
      setVideohubSourceOptionsState(cached.sourceOptions);
      setVideohubDestinationOptionsState(cached.destinationOptions);
      setVideohubNamesError("");
      setVideohubNamesLoading(false);
      if (videohubNamesReloadKey === 0) return;
    }

    const host = String(selectedConnection.ip ?? "").trim();
    if (!host) {
      setVideohubNamesError("Router host/IP is missing.");
      return;
    }

    let cancelled = false;
    setVideohubNamesLoading(true);
    setVideohubNamesError("");

    void loadVideohubRouterLabels({
      host,
      port: parsePositiveIntegerValue(selectedConnection.port) ?? 9990,
    })
      .then((result) => {
        if (cancelled) return;
        const sourceOptions = result.inputLabels
          .map((entry) => {
            const value = String(entry.id);
            const labelText = `${entry.id}${entry.label?.trim() ? ` - ${entry.label.trim()}` : ""}`;
            return { value, label: labelText };
          })
          .sort((a, b) => Number(a.value) - Number(b.value));
        const destinationOptions = result.outputLabels
          .map((entry) => {
            const value = String(entry.id);
            const labelText = `${entry.id}${entry.label?.trim() ? ` - ${entry.label.trim()}` : ""}`;
            return { value, label: labelText };
          })
          .sort((a, b) => Number(a.value) - Number(b.value));

        setVideohubSourceOptionsState(sourceOptions);
        setVideohubDestinationOptionsState(destinationOptions);
        setVideohubNamesError("");
        if (videohubNamesCacheKey) {
          VIDEOHUB_NAMES_CACHE.set(videohubNamesCacheKey, {
            sourceOptions,
            destinationOptions,
            fetchedAt: Date.now(),
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setVideohubNamesError(
          error instanceof Error ? error.message : "Failed to fetch VideoHub labels from router.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setVideohubNamesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isVideohubConnection,
    selectedConnection,
    videohubNamesCacheKey,
    videohubNamesReloadKey,
  ]);
  // Reset child selects when parent changes
  const handleConn = (v: string) => {
    const nextConnection = connections.find((connection) => connection.name === v);
    const nextDevice = String(nextConnection?.device ?? "").trim().toLowerCase();
    const nextCatalogue = getTaskCatalogue(v, connections);
    const defaultCategory = Object.keys(nextCatalogue.categories)[0] ?? "";
    const defaultFunction = defaultCategory
      ? (nextCatalogue.categories[defaultCategory]?.[0] ?? "")
      : "";

    setConn(v);
    if (v === WAIT_CONNECTION_VALUE) {
      setMode("Direct");
      setCategory("Timing");
      setFuncName(WAIT_FUNC_NAME);
      setInput("");
      setValue("500");
      setObsSceneName("");
      setObsInputName("");
      setObsTransitionName("");
      setObsProfileName("");
      setObsSceneCollectionName("");
      setObsOutputName("");
      setObsHotkeyName("");
      setObsFieldValues({});
      setAtemFieldValues({});
      setXpressionTakeId("0");
      setXpressionFramebuffer("1");
      setXpressionLayer("0");
      setXpressionGpi("0");
      setXpressionCustomCommand("");
      setGrandMA3FieldValues({});
      setMa2ButtonNumber("1");
      setMa2ButtonDirection("press");
      setMa2EncoderPressNumber("1");
      setMa2WheelSteps("1");
      setMa2RotateEncoderNumber("1");
      setMa2RotateSteps("1");
      setMa2CustomCommand("");
      setGenericTcpUdpCommand("");
      setGenericTcpUdpHexCommand("");
      setGenericTcpUdpLineEnd("\n");
      setCompanionSatellitePage("1");
      setCompanionSatelliteRow("0");
      setCompanionSatelliteColumn("0");
      setCompanionSatelliteEventType("press");
      setCompanionSatelliteTestResult("");
      setSwp08Levels(["1"]);
      setSwp08Destination("1");
      setSwp08Source("1");
      setSwp08ClearType("all");
      setSwp08ClearEnableLevels("true");
      setVideohubDestination("0");
      setVideohubDestinationDynamic("");
      setVideohubSource("0");
      setVideohubSourceDynamic("");
      setVideohubSourceRoutedDestination("0");
      setVideohubSourceRoutedDestinationDynamic("");
      setVideohubOutput("0");
      setVideohubOutputDynamic("");
      setVideohubLockState("T");
      setVideohubLockStateDynamic("toggle");
      setVideohubIgnoreLock("false");
      setVideohubLabel("");
      setVideohubSourceFile("C:\\VideoHub.txt");
      setVideohubDestinationFile("C:\\VideoHub.txt");
      setHttpRequestUrl("");
      setHttpRequestBody("{}");
      setHttpRequestHeader("");
      setHttpRequestContentType("application/json");
      setHttpRequestJsonResultVariable("");
      setHttpRequestResultStringify("true");
      setHttpRequestStatusCodeVariable("");
      setGenericOscPath("/osc/path");
      setGenericOscString("text");
      setGenericOscInt("1");
      setGenericOscFloat("1");
      setGenericOscBoolean("false");
      setGenericOscArguments("1 \"Let's go\" 2.5");
      setGenericOscBlob("");
      setGenericOscBlobHex("0A0B0C");
      setGenericOscBlobHexSwitch("false");
      setGenericOscMidiMode("noteon");
      setGenericOscMidiPortId("0");
      setGenericOscMidiChannel("1");
      setGenericOscMidiData1("69");
      setGenericOscMidiData2("100");
      setGenericOscMidiPitch("0");
      setGenericOscMidiRawHex("00 90 45 65");
      return;
    }
    if (nextDevice === "ross_xpression" || nextDevice === "ross_talk") {
      setMode("Direct");
      setCategory(defaultCategory);
      setFuncName(defaultFunction);
    } else {
      setMode(selectOptionValue(nextCatalogue.modes[0]) || "Direct");
      setCategory(defaultCategory);
      setFuncName(defaultFunction);
    }
    setResolumeMasterAction("=");
    setResolumeMasterValue("");
    setResolumeLayer("1");
    setResolumeClip("1");
    setResolumeColumnAction("=");
    setResolumeColumnValue("");
    setResolumeLayerNumber("1");
    setResolumeLayerGroupNumber("1");
    setResolumeLastColumn("4");
    setResolumeToggleAction("toggle");
    setResolumeDeckAction("=");
    setResolumeDeckValue("");
    setResolumeCustomOscAddress("");
    setResolumeCustomOscArgs("");
    setXpressionTakeId("0");
    setXpressionFramebuffer("1");
    setXpressionLayer("0");
    setXpressionGpi("0");
    setXpressionCustomCommand("");
    setRossTalkMle("ME:1");
    setRossTalkMultiviewerNumber("1");
    setRossTalkBoxNumber("1");
    setRossTalkSource("IN:5");
    setRossTalkCcBank("1");
    setRossTalkCcNumber("1");
    setRossTalkSetName("set1");
    setRossTalkSetLocation("");
    setRossTalkMemoryId("1:1");
    setRossTalkCommand("");
    setRossTalkTakeId("0");
    setRossTalkLayer("0");
    setRossTalkKeyer("1");
    setRossTalkTransitionOnOff("toggle");
    setRossTalkTransitionType("CUT");
    setRossTalkGpiNumber("1");
    setRossTalkGpiName("");
    setRossTalkGpiParameter("");
    setRossTalkXptDestination("ME:1:PGM");
    setRossTalkXptSource("IN:20");
    setRossTalkTimerId("1");
    setRossTalkTimerAction("RUN");
    setObsSceneName("");
    setObsInputName("");
    setObsTransitionName("");
    setObsProfileName("");
    setObsSceneCollectionName("");
    setObsOutputName("");
    setObsHotkeyName("");
    setObsFieldValues({});
    setAtemFieldValues({});
    setGrandMA3FieldValues({});
    setMa2ButtonNumber("1");
    setMa2ButtonDirection("press");
    setMa2EncoderPressNumber("1");
    setMa2WheelSteps("1");
    setMa2RotateEncoderNumber("1");
    setMa2RotateSteps("1");
    setMa2CustomCommand("");
    setGenericTcpUdpCommand("");
    setGenericTcpUdpHexCommand("");
    setGenericTcpUdpLineEnd("\n");
    setCompanionSatellitePage("1");
    setCompanionSatelliteRow("0");
    setCompanionSatelliteColumn("0");
    setCompanionSatelliteEventType("press");
    setCompanionSatelliteTestResult("");
    setSwp08Levels(["1"]);
    setSwp08Destination("1");
    setSwp08Source("1");
    setSwp08ClearType("all");
    setSwp08ClearEnableLevels("true");
    setVideohubDestination("0");
    setVideohubDestinationDynamic("");
    setVideohubSource("0");
    setVideohubSourceDynamic("");
    setVideohubSourceRoutedDestination("0");
    setVideohubSourceRoutedDestinationDynamic("");
    setVideohubOutput("0");
    setVideohubOutputDynamic("");
    setVideohubLockState("T");
    setVideohubLockStateDynamic("toggle");
    setVideohubIgnoreLock("false");
    setVideohubLabel("");
    setVideohubSourceFile("C:\\VideoHub.txt");
    setVideohubDestinationFile("C:\\VideoHub.txt");
    setHttpRequestUrl("");
    setHttpRequestBody("{}");
    setHttpRequestHeader("");
    setHttpRequestContentType("application/json");
    setHttpRequestJsonResultVariable("");
    setHttpRequestResultStringify("true");
    setHttpRequestStatusCodeVariable("");
    setGenericOscPath("/osc/path");
    setGenericOscString("text");
    setGenericOscInt("1");
    setGenericOscFloat("1");
    setGenericOscBoolean("false");
    setGenericOscArguments("1 \"Let's go\" 2.5");
    setGenericOscBlob("");
    setGenericOscBlobHex("0A0B0C");
    setGenericOscBlobHexSwitch("false");
    setGenericOscMidiMode("noteon");
    setGenericOscMidiPortId("0");
    setGenericOscMidiChannel("1");
    setGenericOscMidiData1("69");
    setGenericOscMidiData2("100");
    setGenericOscMidiPitch("0");
    setGenericOscMidiRawHex("00 90 45 65");
  };
  const handleCat  = (v: string) => {
    setCategory(v);
    setFuncName(cat.categories[v]?.[0] ?? "");
  };
  const handleRossXpressionFunction = (nextFuncName: string) => {
    setMode("Direct");
    setFuncName(nextFuncName);
    const match = Object.entries(cat.categories).find(([, functions]) => functions.includes(nextFuncName));
    setCategory(match?.[0] ?? "XPression");
  };
  const handleRossTalkFunction = (nextFuncName: string) => {
    setMode("Direct");
    setFuncName(nextFuncName);
    const match = Object.entries(cat.categories).find(([, functions]) => functions.includes(nextFuncName));
    setCategory(match?.[0] ?? "General");
  };
  const handleResolumeAction = (nextFuncName: string) => {
    setFuncName(nextFuncName);
    const match = Object.entries(cat.categories).find(([, functions]) => functions.includes(nextFuncName));
    setCategory(match?.[0] ?? "");
    if (
      isResolumeCompositionChangeFunction(nextFuncName)
      || isResolumeClipChangeFunction(nextFuncName)
      || isResolumeLayerChangeFunction(nextFuncName)
      || isResolumeLayerGroupChangeFunction(nextFuncName)
    ) {
      setResolumeMasterAction("=");
      setResolumeMasterValue("");
    }
    if (
      isResolumeClipChangeFunction(nextFuncName)
      || isResolumeClipSelectionFunction(nextFuncName)
    ) {
      setResolumeLayer("1");
      setResolumeClip("1");
    }
    if (isResolumeColumnActionFunction(nextFuncName)) {
      setResolumeColumnAction("=");
      setResolumeColumnValue("");
      setResolumeLayerGroupNumber("1");
    }
    if (isResolumeLayerColumnStepFunction(nextFuncName)) {
      setResolumeLayerNumber("1");
    }
    if (isResolumeLayerGroupColumnStepFunction(nextFuncName)) {
      setResolumeLayerGroupNumber("1");
      setResolumeLastColumn("4");
    }
    if (isResolumeLayerSelectFunction(nextFuncName)) {
      if (isLayerGroupSelectFunction(nextFuncName)) {
        setResolumeLayerGroupNumber("1");
      } else {
        setResolumeLayerNumber("1");
      }
    }
    if (isResolumeLayerClearFunction(nextFuncName)) {
      if (isLayerGroupClearFunction(nextFuncName)) {
        setResolumeLayerGroupNumber("1");
      } else {
        setResolumeLayerNumber("1");
      }
    }
    if (isResolumeLayerChangeFunction(nextFuncName)) {
      setResolumeLayerNumber("1");
    }
    if (isResolumeLayerGroupChangeFunction(nextFuncName)) {
      setResolumeLayerGroupNumber("1");
    }
    if (isResolumeToggleFunction(nextFuncName)) {
      setResolumeToggleAction("toggle");
      if (isLayerGroupToggleFunction(nextFuncName)) {
        setResolumeLayerGroupNumber("1");
      } else {
        setResolumeLayerNumber("1");
      }
    }
    if (isResolumeDeckSelectFunction(nextFuncName)) {
      setResolumeDeckAction("=");
      setResolumeDeckValue("");
    }
    if (isResolumeCustomOscFunction(nextFuncName)) {
      setResolumeCustomOscAddress("");
      setResolumeCustomOscArgs("");
    }
  };
  const setObsParameterValue = (
    kind: NonNullable<ObsFunctionSpec["parameterKind"]>,
    nextValue: string,
  ) => {
    if (kind === "scenes") setObsSceneName(nextValue);
    else if (kind === "inputs") setObsInputName(nextValue);
    else if (kind === "transitions") setObsTransitionName(nextValue);
    else if (kind === "profiles") setObsProfileName(nextValue);
    else if (kind === "sceneCollections") setObsSceneCollectionName(nextValue);
    else if (kind === "outputs") setObsOutputName(nextValue);
    else if (kind === "hotkeys") setObsHotkeyName(nextValue);
  };
  const setObsFieldValue = (key: string, nextValue: string) => {
    setObsFieldValues((prev) => ({ ...prev, [key]: nextValue }));
  };
  const setAtemFieldValue = (key: string, nextValue: string) => {
    setAtemFieldValues((prev) => ({ ...prev, [key]: nextValue }));
  };
  const setGrandMA3FieldValue = (key: string, nextValue: string) => {
    setGrandMA3FieldValues((prev) => ({ ...prev, [key]: nextValue }));
  };
  const resolveObsFieldOptions = (
    field: NonNullable<ObsFunctionSpec["fields"]>[number],
  ): SelectOption[] => {
    if (field.options?.length) {
      return field.options.map((value) => ({ value, label: value }));
    }
    if (field.optionsKind === "scenes") return obsSceneOptions;
    if (field.optionsKind === "sceneItems") return obsSceneItemOptions;
    if (field.optionsKind === "inputs") return obsInputOptions;
    if (field.optionsKind === "transitions") return obsTransitionOptions;
    if (field.optionsKind === "profiles") return obsProfileOptions;
    if (field.optionsKind === "sceneCollections") return obsSceneCollectionOptions;
    if (field.optionsKind === "outputs") return obsOutputOptions;
    if (field.optionsKind === "hotkeys") return obsHotkeyOptions;
    return [];
  };
  useEffect(() => {
    if (!isAtemConnection) {
      setAtemFieldValues({});
      return;
    }
    const fields = atemFunctionSpec?.fields ?? [];
    setAtemFieldValues((prev) => {
      const next: Record<string, string> = {};
      for (const field of fields) {
        const existing = prev[field.key] ?? "";
        if (existing.trim()) {
          next[field.key] = existing;
        } else if (field.defaultValue !== undefined) {
          next[field.key] = field.defaultValue;
        }
      }
      return next;
    });
  }, [atemFunctionSpec, isAtemConnection]);

  useEffect(() => {
    if (!isGrandMA3Connection) {
      setGrandMA3FieldValues({});
      return;
    }
    const fields = grandMA3FunctionSpec?.fields ?? [];
    setGrandMA3FieldValues((prev) => {
      const next: Record<string, string> = {};
      for (const field of fields) {
        const existing = prev[field.key] ?? "";
        if (existing.trim()) {
          next[field.key] = existing;
        } else if (field.defaultValue) {
          next[field.key] = field.defaultValue;
        }
      }
      return next;
    });
  }, [grandMA3FunctionSpec, isGrandMA3Connection]);

  useEffect(() => {
    let active = true;

    void loadVmixShortcutCatalog()
      .then((catalog) => {
        if (!active) return;
        setVmixCatalog(catalog);
        setVmixCatalogReady(true);
      })
      .catch(() => {
        if (!active) return;
        setVmixCatalogReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isVmixConnection) {
      setVmixCategory("");
      setVmixFunctionName("");
      setVmixArgs({});
      return;
    }

    if (!vmixCatalog) return;

    const nextCategory = vmixCategories.includes(vmixCategory)
      ? vmixCategory
      : (vmixCategories[0] ?? "");
    const nextFunctions = getVmixFunctionsForCategory(vmixCatalog, nextCategory);
    const nextFunction = nextFunctions.some((shortcut) => shortcut.name === vmixFunctionName)
      ? vmixFunctionName
      : "";

    if (nextCategory !== vmixCategory) {
      setVmixCategory(nextCategory);
    }
    if (nextFunction !== vmixFunctionName) {
      setVmixFunctionName(nextFunction);
    }
  }, [isVmixConnection, vmixCatalog, vmixCategories, vmixCategory, vmixFunctionName]);

  useEffect(() => {
    if (!selectedVmixFunction) {
      setVmixArgs({});
      return;
    }

    setVmixArgs((prev) => {
      const next: Record<string, string> = {};
      for (const key of selectedVmixFunction.paramKeys) {
        next[key] = prev[key] ?? "";
      }
      return next;
    });
  }, [selectedVmixFunction]);

  useEffect(() => {
    if (!isObsConnection || !selectedConnection) {
      setObsRuntimeCatalogue(null);
      setObsCatalogueLoading(false);
      setObsCatalogueError("");
      return;
    }

    let active = true;
    setObsCatalogueLoading(true);
    setObsCatalogueError("");

    void fetchObsRuntimeCatalogue(selectedConnection)
      .then((catalogue) => {
        if (!active) return;
        setObsRuntimeCatalogue(catalogue);
        setObsCatalogueLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setObsRuntimeCatalogue(null);
        setObsCatalogueLoading(false);
        setObsCatalogueError(error instanceof Error ? error.message : "Unable to load OBS data");
      });

    return () => {
      active = false;
    };
  }, [isObsConnection, selectedConnection]);

  useEffect(() => {
    if (!isObsSceneFunction) return;
    if (obsSceneName.trim()) return;
    const firstScene = obsRuntimeCatalogue?.scenes?.[0] ?? "";
    if (!firstScene) return;
    setObsSceneName(firstScene);
  }, [isObsSceneFunction, obsRuntimeCatalogue, obsSceneName]);
  useEffect(() => {
    if (!isObsConnection) return;
    const kind = obsFunctionSpec?.parameterKind;
    if (!kind) return;
    if (obsCurrentParameterValue.trim()) return;
    const firstValue = selectOptionValue(obsCurrentParameterOptions[0]);
    if (!firstValue) return;
    setObsParameterValue(kind, firstValue);
  }, [
    isObsConnection,
    obsCurrentParameterOptions,
    obsCurrentParameterValue,
    obsFunctionSpec?.parameterKind,
  ]);
  useEffect(() => {
    if (!isObsConnection) return;
    const fields = obsFunctionSpec?.fields ?? [];
    if (!fields.length) return;
    setObsFieldValues((prev) => {
      const next = { ...prev };
      for (const field of fields) {
        const current = (next[field.key] ?? "").trim();
        if (current) continue;
        let fallback = field.defaultValue ?? "";
        if (!fallback && field.key === "sceneItemId") {
          fallback = selectOptionValue(obsSceneItemOptions[0]);
        } else if (!fallback && field.type === "select") {
          fallback = selectOptionValue(resolveObsFieldOptions(field)[0]);
        }
        if (fallback) next[field.key] = fallback;
      }
      return next;
    });
  }, [isObsConnection, obsFunctionSpec?.fields, obsSceneItemOptions]);

  useEffect(() => {
    if (!isRossXpressionConnection) return;
    if (funcName.trim()) return;
    const first = xpressionFunctionOptions[0];
    const firstValue = selectOptionValue(first);
    if (!firstValue) return;
    handleRossXpressionFunction(firstValue);
  }, [funcName, handleRossXpressionFunction, isRossXpressionConnection, xpressionFunctionOptions]);

  useEffect(() => {
    if (!isRossTalkConnection) return;
    if (funcName.trim()) return;
    const first = rossTalkFunctionOptions[0];
    const firstValue = selectOptionValue(first);
    if (!firstValue) return;
    handleRossTalkFunction(firstValue);
  }, [funcName, handleRossTalkFunction, isRossTalkConnection, rossTalkFunctionOptions]);

  useEffect(() => {
    if (!isWorkspace || !selectedTask) return;

    const params = asTaskParams(selectedTask.params);
    const waitMsFromParams = parsePositiveIntegerValue(params.waitMs);
    const waitTaskSelected = params.action === "wait" || selectedTask.funcName === WAIT_FUNC_NAME;
    if (waitTaskSelected) {
      const waitMs = waitMsFromParams ?? parsePositiveIntegerValue(selectedTask.value) ?? 500;
      setConn(WAIT_CONNECTION_VALUE);
      setMode(selectedTask.mode ?? "Direct");
      setCategory(selectedTask.category ?? "Timing");
      setFuncName(selectedTask.funcName ?? WAIT_FUNC_NAME);
      setInput("");
      setValue(String(waitMs));
      return;
    }

    const resolvedConnection = findConnectionForTask(connections, selectedTask);
    const nextConnection = resolvedConnection?.name ?? selectedTask.connection ?? "";
    const nextDevice = String(
      resolvedConnection?.device ?? "",
    ).trim().toLowerCase();

    setConn(nextConnection);
    setMode(
      nextDevice === "ross_xpression" || nextDevice === "ross_talk"
        ? (selectedTask.mode ?? "Direct")
        : (selectedTask.mode ?? ""),
    );
    setCategory(
      nextDevice === "ross_xpression"
        ? (selectedTask.category ?? "XPression")
        : (selectedTask.category ?? ""),
    );
    setFuncName(selectedTask.funcName ?? "");
    setInput(selectedTask.input ?? "");
    setValue(selectedTask.value ?? "");
    if (nextDevice !== "atem") {
      setAtemFieldValues({});
    }

    if (nextDevice === "atem") {
      const options = asTaskParams(params.options);
      const atemFieldsFromParams = asTaskParams(params.atemFields);
      const definitionId = typeof params.definitionId === "string" ? params.definitionId.trim() : "";
      const normalizedFunc = ATEM_FUNCTIONS.has(selectedTask.funcName)
        ? selectedTask.funcName
        : (ATEM_DEFINITION_TO_FUNCTION[definitionId] ?? selectedTask.funcName ?? "");
      setFuncName(normalizedFunc);
      const spec = ATEM_FUNCTION_SPECS[normalizedFunc];
      if (spec) {
        const nextValues: Record<string, string> = {};
        for (const field of spec.fields) {
          const raw = atemFieldsFromParams[field.key] ?? options[field.key];
          if (typeof raw === "string" && raw.trim().length > 0) {
            const token = raw.trim().toLowerCase();
            const fieldOptions = field.options ?? [];
            const optionValues = new Set(fieldOptions.map((option) => selectOptionValue(option).trim().toLowerCase()));
            if ((token === "true" || token === "false") && optionValues.has("on") && optionValues.has("off")) {
              nextValues[field.key] = token === "true" ? "on" : "off";
            } else {
              nextValues[field.key] = raw;
            }
          } else if (typeof raw === "number" && Number.isFinite(raw)) {
            nextValues[field.key] = String(raw);
          } else if (typeof raw === "boolean") {
            const fieldOptions = field.options ?? [];
            const optionValues = new Set(fieldOptions.map((option) => selectOptionValue(option).trim().toLowerCase()));
            if (optionValues.has("on") && optionValues.has("off")) {
              nextValues[field.key] = raw ? "on" : "off";
            } else {
              nextValues[field.key] = raw ? "true" : "false";
            }
          } else if (field.defaultValue !== undefined) {
            nextValues[field.key] = field.defaultValue;
          }
        }
        setAtemFieldValues(nextValues);
      } else {
        setAtemFieldValues({});
      }
    } else if (nextDevice === "obs") {
      const requestType = (selectedTask.input ?? "").trim();
      const requestDataFromParams = asTaskParams(params.requestData);
      const requestDataFromValue = (() => {
        const raw = (selectedTask.value ?? "").trim();
        if (!raw) return {} as Record<string, unknown>;
        try {
          const parsed = JSON.parse(raw) as unknown;
          return asTaskParams(parsed);
        } catch {
          return {};
        }
      })();
      const sceneFromParams = typeof params.sceneName === "string"
        ? params.sceneName
        : "";
      const sceneFromRequestData = typeof requestDataFromParams.sceneName === "string"
        ? requestDataFromParams.sceneName
        : (typeof requestDataFromValue.sceneName === "string"
          ? requestDataFromValue.sceneName
          : "");
      if (
        OBS_SCENE_FUNCTIONS.has(selectedTask.funcName)
        || requestType === "SetCurrentProgramScene"
        || requestType === "SetCurrentPreviewScene"
      ) {
        setObsSceneName((sceneFromParams || sceneFromRequestData || obsRuntimeCatalogue?.scenes?.[0] || "").trim());
      } else {
        setObsSceneName("");
      }
      const inputName =
        (typeof params.inputName === "string" ? params.inputName : "")
        || (typeof requestDataFromParams.inputName === "string" ? requestDataFromParams.inputName : "")
        || (typeof requestDataFromValue.inputName === "string" ? requestDataFromValue.inputName : "");
      const transitionName =
        (typeof params.transitionName === "string" ? params.transitionName : "")
        || (typeof requestDataFromParams.transitionName === "string" ? requestDataFromParams.transitionName : "")
        || (typeof requestDataFromValue.transitionName === "string" ? requestDataFromValue.transitionName : "");
      const profileName =
        (typeof params.profileName === "string" ? params.profileName : "")
        || (typeof requestDataFromParams.profileName === "string" ? requestDataFromParams.profileName : "")
        || (typeof requestDataFromValue.profileName === "string" ? requestDataFromValue.profileName : "");
      const sceneCollectionName =
        (typeof params.sceneCollectionName === "string" ? params.sceneCollectionName : "")
        || (typeof requestDataFromParams.sceneCollectionName === "string" ? requestDataFromParams.sceneCollectionName : "")
        || (typeof requestDataFromValue.sceneCollectionName === "string" ? requestDataFromValue.sceneCollectionName : "");
      const outputName =
        (typeof params.outputName === "string" ? params.outputName : "")
        || (typeof requestDataFromParams.outputName === "string" ? requestDataFromParams.outputName : "")
        || (typeof requestDataFromValue.outputName === "string" ? requestDataFromValue.outputName : "");
      const hotkeyName =
        (typeof params.hotkeyName === "string" ? params.hotkeyName : "")
        || (typeof requestDataFromParams.hotkeyName === "string" ? requestDataFromParams.hotkeyName : "")
        || (typeof requestDataFromValue.hotkeyName === "string" ? requestDataFromValue.hotkeyName : "");
      setObsInputName(inputName.trim());
      setObsTransitionName(transitionName.trim());
      setObsProfileName(profileName.trim());
      setObsSceneCollectionName(sceneCollectionName.trim());
      setObsOutputName(outputName.trim());
      setObsHotkeyName(hotkeyName.trim());
      const spec = OBS_FUNCTION_SPECS[selectedTask.funcName];
      if (spec?.fields?.length) {
        const nextFieldValues: Record<string, string> = {};
        for (const field of spec.fields) {
          const fromParams = readValueByPath(params, field.key);
          const fromReq = readValueByPath(requestDataFromParams, field.key);
          const fromReqValue = readValueByPath(requestDataFromValue, field.key);
          const chosen = fromParams ?? fromReq ?? fromReqValue;
          if (chosen !== undefined && chosen !== null) {
            nextFieldValues[field.key] = typeof chosen === "string"
              ? chosen
              : JSON.stringify(chosen);
          }
        }
        setObsFieldValues(nextFieldValues);
      } else {
        setObsFieldValues({});
      }
    } else if (nextDevice === "companion_remote") {
      const options = asTaskParams(params.options);
      const normalizedFunc = COMPANION_REMOTE_FUNCTIONS.has(selectedTask.funcName)
        ? selectedTask.funcName
        : "Button Event";
      const eventTypeRaw = String(
        options.eventType
        ?? params.eventType
        ?? selectedTask.value
        ?? "press",
      ).trim().toLowerCase();
      const normalizedEventType = eventTypeRaw === "release" || eventTypeRaw === "up"
        ? "release"
        : (eventTypeRaw === "rotate_left" || eventTypeRaw === "left" || eventTypeRaw === "rotateleft" || eventTypeRaw === "rotate-left")
          ? "rotate_left"
          : (eventTypeRaw === "rotate_right" || eventTypeRaw === "right" || eventTypeRaw === "rotateright" || eventTypeRaw === "rotate-right")
            ? "rotate_right"
            : (eventTypeRaw === "down" || eventTypeRaw === "press")
              ? "press"
              : "press";

      let page = String(params.satellitePage ?? "1");
      let row = "0";
      let column = "0";

      const locationRaw = String(options.location ?? params.location ?? selectedTask.input ?? "").trim();
      const locationParts = locationRaw.split("/").map((part) => part.trim()).filter(Boolean);
      if (locationParts.length >= 2) {
        row = locationParts[0] ?? row;
        column = locationParts[1] ?? column;
      }

      const pathRaw = String(params.path ?? "").trim();
      const pathMatch = pathRaw.match(/^\/api\/location\/(\d+)\/(\d+)\/(\d+)\/([a-z_-]+)$/i);
      if (pathMatch) {
        page = pathMatch[1] ?? page;
        row = pathMatch[2] ?? row;
        column = pathMatch[3] ?? column;
      }

      const safePage = String(parsePositiveIntegerValue(page) ?? 1);
      const safeRow = String(parseNonNegativeIntegerValue(row) ?? 0);
      const safeColumn = String(parseNonNegativeIntegerValue(column) ?? 0);

      setFuncName(normalizedFunc);
      setCompanionSatellitePage(safePage);
      setCompanionSatelliteRow(safeRow);
      setCompanionSatelliteColumn(safeColumn);
      setCompanionSatelliteEventType(normalizedEventType);
    } else if (nextDevice === "generic_tcp") {
      const options = asTaskParams(params.options);
      const definitionId = typeof params.definitionId === "string" ? params.definitionId.trim() : "";
      const isHex = definitionId === "send_hex";
      const normalizedFunc = GENERIC_TCP_UDP_FUNCTIONS.has(selectedTask.funcName)
        ? selectedTask.funcName
        : (isHex ? "Send HEX encoded Command" : "Send Command");
      const command = String(
        (isHex ? options.id_send_hex : options.id_send)
        ?? params.command
        ?? selectedTask.input
        ?? "",
      );
      const lineEnd = String(options.id_end ?? params.lineEnd ?? (isHex ? "" : "\n"));
      setFuncName(normalizedFunc);
      if (isHex || normalizedFunc === "Send HEX encoded Command") {
        setGenericTcpUdpHexCommand(command);
      } else {
        setGenericTcpUdpCommand(command);
      }
      setGenericTcpUdpLineEnd(lineEnd);
    } else if (nextDevice === "swp08") {
      const options = asTaskParams(params.options);
      const definitionId = typeof params.definitionId === "string" ? params.definitionId.trim() : "";
      const normalizedFunc = SWP08_FUNCTIONS.has(selectedTask.funcName)
        ? selectedTask.funcName
        : (
          definitionId === "select_level" ? "Select Levels"
            : definitionId === "deselect_level" ? "De-Select Levels"
              : definitionId === "toggle_level" ? "Toggle Levels"
                : definitionId === "select_dest" ? "Select Destination"
                  : definitionId === "select_dest_name" ? "Select Destination name"
                    : definitionId === "select_source" ? "Select Source"
                      : definitionId === "select_source_name" ? "Select Source name"
                        : definitionId === "route_source" ? "Route Source to selected Levels and Destination"
                          : definitionId === "route_source_name" ? "Route Source name to selected Levels and Destination"
                            : definitionId === "take" ? "Take"
                              : definitionId === "clear" ? "Clear"
                                : definitionId === "set_crosspoint" ? "Set crosspoint"
                                  : definitionId === "set_crosspoint_name" ? "Set crosspoint by name"
                                    : definitionId === "get_names" ? "Refresh Source and Destination names"
                                      : "Select Destination"
        );
      const levelsValue = Array.isArray(options.level)
        ? options.level
        : (typeof options.level === "string" ? options.level.split(",") : []);
      const normalizedLevels = levelsValue
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0);
      setFuncName(normalizedFunc);
      setSwp08Levels(normalizedLevels.length ? normalizedLevels : ["1"]);
      setSwp08Destination(String(options.dest ?? "1"));
      setSwp08Source(String(options.source ?? "1"));
      setSwp08ClearType(String(options.clear ?? "all"));
      setSwp08ClearEnableLevels(
        String(options.clear_enable_levels ?? "true").trim().toLowerCase() === "false" ? "false" : "true",
      );
    } else if (nextDevice === "videohub") {
      const options = asTaskParams(params.options);
      const definitionId = typeof params.definitionId === "string" ? params.definitionId.trim() : "";
      const normalizedFunc = VIDEOHUB_FUNCTIONS.has(selectedTask.funcName)
        ? selectedTask.funcName
        : (
          definitionId === "lock_output" ? "Lock: Change destination lock state"
            : definitionId === "lock_output_dyn" ? "Lock: Change destination lock state (dynamic)"
              : definitionId === "load_route_from_file" ? "Route File: Load file"
                : definitionId === "store_route_in_file" ? "Route File: Save file"
                  : definitionId === "clear" ? "Video: Clear queued route"
                    : definitionId === "rename_destination" ? "Video: Rename destination"
                      : definitionId === "rename_source" ? "Video: Rename source"
                        : definitionId === "route_to_previous" ? "Video: Return to previous route"
                          : definitionId === "route_to_previous_dyn" ? "Video: Return to previous route (dynamic)"
                            : definitionId === "route" ? "Video: Route source to destination"
                              : definitionId === "route_dyn" ? "Video: Route source to destination (dynamic)"
                                : definitionId === "route_routed" ? "Video: Route source to destination, based on another destination"
                                  : definitionId === "route_routed_dyn" ? "Video: Route source to destination, based on another destination (dynamic)"
                                    : definitionId === "route_source" ? "Video: Route source to selected destination"
                                      : definitionId === "route_source_dyn" ? "Video: Route source to selected destination (dynamic)"
                                        : definitionId === "select_destination" ? "Video: Select destination"
                                          : definitionId === "select_destination_dyn" ? "Video: Select destination (dynamic)"
                                            : definitionId === "take" ? "Video: Take queued route"
                                              : "Video: Select destination"
        );
      setFuncName(normalizedFunc);
      setVideohubDestination(String(options.destination ?? "0"));
      setVideohubDestinationDynamic(String(options.destination ?? ""));
      setVideohubSource(String(options.source ?? "0"));
      setVideohubSourceDynamic(String(options.source ?? ""));
      setVideohubSourceRoutedDestination(String(options.source_routed_to_destination ?? "0"));
      setVideohubSourceRoutedDestinationDynamic(String(options.source_routed_to_destination ?? ""));
      setVideohubOutput(String(options.output ?? "0"));
      setVideohubOutputDynamic(String(options.output ?? ""));
      setVideohubLabel(String(options.label ?? ""));
      setVideohubSourceFile(String(options.source_file ?? "C:\\VideoHub.txt"));
      setVideohubDestinationFile(String(options.destination_file ?? "C:\\VideoHub.txt"));
      const lockRaw = String(options.lock_state ?? "").trim();
      const lockStatic =
        lockRaw === "L" || lockRaw.toLowerCase() === "lock"
          ? "L"
          : lockRaw === "U" || lockRaw.toLowerCase() === "unlock"
            ? "U"
            : "T";
      const lockDynamic =
        lockRaw.toLowerCase() === "lock"
          ? "lock"
          : lockRaw.toLowerCase() === "unlock"
            ? "unlock"
            : "toggle";
      setVideohubLockState(lockStatic);
      setVideohubLockStateDynamic(lockDynamic);
      setVideohubIgnoreLock(
        String(options.ignore_lock ?? "false").trim().toLowerCase() === "true" ? "true" : "false",
      );
    } else if (nextDevice === "http_api") {
      const options = asTaskParams(params.options);
      const definitionId = typeof params.definitionId === "string" ? params.definitionId.trim().toLowerCase() : "";
      const methodFromParams = typeof params.method === "string" ? params.method.trim().toUpperCase() : "";
      const normalizedFunc = GENERIC_HTTP_FUNCTIONS.has(selectedTask.funcName)
        ? selectedTask.funcName
        : (GENERIC_HTTP_FUNCTIONS.has(methodFromParams) ? methodFromParams
          : (GENERIC_HTTP_FUNCTIONS.has(definitionId.toUpperCase()) ? definitionId.toUpperCase() : "GET"));
      const url = String(options.url ?? params.path ?? selectedTask.input ?? "");
      const bodyRaw = options.body ?? params.body ?? selectedTask.value ?? "{}";
      const headerRaw = options.header ?? params.headers ?? "";
      const bodyText = typeof bodyRaw === "string" ? bodyRaw : JSON.stringify(bodyRaw);
      const headerText = typeof headerRaw === "string" ? headerRaw : JSON.stringify(headerRaw);
      const contentTypeFromOptions = String(options.contenttype ?? "").trim();
      const contentTypeFromHeaders = (() => {
        if (!headerRaw || typeof headerRaw !== "object" || Array.isArray(headerRaw)) return "";
        const headers = headerRaw as Record<string, unknown>;
        const candidate =
          (typeof headers["Content-Type"] === "string" ? headers["Content-Type"] : "")
          || (typeof headers["content-type"] === "string" ? headers["content-type"] : "");
        return candidate.trim();
      })();
      setFuncName(normalizedFunc);
      setHttpRequestUrl(url);
      setHttpRequestBody(bodyText || "{}");
      setHttpRequestHeader(headerText);
      setHttpRequestContentType(contentTypeFromOptions || contentTypeFromHeaders || "application/json");
      setHttpRequestJsonResultVariable(String(options.jsonResultDataVariable ?? ""));
      setHttpRequestResultStringify(
        String(options.result_stringify ?? "true").trim().toLowerCase() === "false" ? "false" : "true",
      );
      setHttpRequestStatusCodeVariable(String(options.statusCodeVariable ?? ""));
    } else if (nextDevice === "generic_osc") {
      const options = asTaskParams(params.options);
      const definitionId = typeof params.definitionId === "string" ? params.definitionId.trim() : "";
      const normalizedFunc = GENERIC_OSC_FUNCTIONS.has(selectedTask.funcName)
        ? selectedTask.funcName
        : (
          definitionId === "send_blob" ? "Send blob"
            : definitionId === "send_boolean" ? "Send boolean"
              : definitionId === "send_float" ? "Send float"
                : definitionId === "send_int" ? "Send int"
                  : definitionId === "send_multiple" ? "Send multiple"
                    : definitionId === "send_blank" ? "Send blank"
                      : definitionId === "send_midi" ? "Send midi"
                        : definitionId === "send_string" ? "Send string"
                          : "Send blank"
        );
      const address = String(options.path ?? params.address ?? selectedTask.input ?? "/osc/path");
      setFuncName(normalizedFunc);
      setGenericOscPath(address.trim() || "/osc/path");
      setGenericOscBlob(String(options.blob ?? ""));
      setGenericOscBlobHex(String(options.blob_hex ?? ""));
      setGenericOscBlobHexSwitch(String(options.hexswitch ?? "false").trim().toLowerCase() === "true" ? "true" : "false");
      setGenericOscBoolean(String(options.value ?? "false").trim().toLowerCase() === "true" ? "true" : "false");
      setGenericOscFloat(String(options.float ?? ""));
      setGenericOscInt(String(options.int ?? ""));
      setGenericOscArguments(String(options.arguments ?? ""));
      setGenericOscString(String(options.string ?? ""));
      setGenericOscMidiMode(String(options.mode ?? "noteon"));
      setGenericOscMidiPortId(String(options.portId ?? "0"));
      setGenericOscMidiChannel(String(options.channel ?? "1"));
      setGenericOscMidiData1(String(options.data1 ?? "69"));
      setGenericOscMidiData2(String(options.data2 ?? "100"));
      setGenericOscMidiPitch(String(options.pitch ?? "0"));
      setGenericOscMidiRawHex(String(options.rawHex ?? "00 90 45 65"));
    } else if (nextDevice === "grandma2") {
      const options = asTaskParams(params.options);
      const definitionId = typeof params.definitionId === "string" ? params.definitionId.trim() : "";
      const normalizedFunc = MA2_FUNCTIONS.has(selectedTask.funcName) ? selectedTask.funcName : "Run Custom Command";
      const button = parsePositiveIntegerValue(options.button) ?? parsePositiveIntegerValue(selectedTask.input) ?? 1;
      const encoder = parseNonNegativeIntegerValue(options.enc) ?? parseNonNegativeIntegerValue(selectedTask.input) ?? 1;
      const encoderVariable = parsePositiveIntegerValue(options.encoder_variable) ?? 1;
      const encoderFromVariable = String(options.encoder_from_variable ?? "").trim().toLowerCase() === "true";
      const wheelSteps = parseIntegerValue(options.steps) ?? parseIntegerValue(selectedTask.value) ?? 1;
      const rotateSteps = parseIntegerValue(options.steps) ?? parseIntegerValue(selectedTask.value) ?? 1;
      const dirRaw = String(options.dir ?? "").trim().toLowerCase();
      const direction: MA2Direction = dirRaw === "false" || dirRaw === "release" ? "release" : "press";
      const encoderPressDirection: MA2DownUpDirection = dirRaw === "false" ? "false" : "true";
      const rotateDirection: MA2RotateDirection = dirRaw === "-1" ? "-1" : "1";
      const command = String(params.command ?? "").trim() || (selectedTask.input ?? "").trim() || (selectedTask.value ?? "").trim();

      setFuncName(normalizedFunc);
      if (definitionId === "button" || normalizedFunc === "Button Press/Release") {
        setMa2ButtonNumber(String(button));
        setMa2ButtonDirection(direction);
      }
      if (definitionId === "encoder_p" || normalizedFunc === "Encoder Press/Release") {
        setMa2EncoderPressNumber(String(encoder));
        setMa2EncoderPressUseVariable(encoderFromVariable ? "true" : "false");
        setMa2EncoderPressVariable(String(encoderVariable));
        setMa2EncoderPressDirection(encoderPressDirection);
      }
      if (definitionId === "wheel" || normalizedFunc === "Move wheel up/down") {
        setMa2WheelSteps(String(wheelSteps));
      }
      if (definitionId === "encoder" || normalizedFunc === "Rotate Encoder") {
        setMa2RotateEncoderNumber(String(encoder));
        setMa2RotateUseVariable(encoderFromVariable ? "true" : "false");
        setMa2RotateEncoderVariable(String(encoderVariable));
        setMa2RotateDirection(rotateDirection);
        setMa2RotateSteps(String(rotateSteps));
      }
      if (definitionId === "command" || normalizedFunc === "Run Custom Command") {
        setMa2CustomCommand(command);
      }
    } else if (nextDevice === "grandma3") {
      const grandMA3Spec = GRANDMA3_FUNCTION_SPECS[selectedTask.funcName];
      const grandMA3FieldsFromParams = asTaskParams(params.grandma3Fields);
      const grandMA3OptionsFromParams = asTaskParams(params.options);
      const definitionId = typeof params.definitionId === "string" ? params.definitionId.trim() : "";
      if (grandMA3Spec) {
        const nextValues: Record<string, string> = {};
        const optionToFieldMap: Record<string, string> = {
          atmenu: "menuItem",
          macro: grandMA3Spec.definitionId.includes("macro") ? (grandMA3Spec.definitionId.endsWith("_name") ? "name" : "number") : "",
          plugin: grandMA3Spec.definitionId.includes("plugin") ? (grandMA3Spec.definitionId.endsWith("_name") ? "name" : "number") : "",
          group: grandMA3Spec.definitionId.includes("group") ? (grandMA3Spec.definitionId.endsWith("_name") ? "name" : "number") : "",
          matrick: grandMA3Spec.definitionId.includes("matrick") ? (grandMA3Spec.definitionId.endsWith("_name") ? "name" : "number") : "",
          quickey: grandMA3Spec.definitionId.includes("quickey") ? (grandMA3Spec.definitionId.endsWith("_name") ? "name" : "number") : "",
          sequence: grandMA3Spec.definitionId.includes("sequence") ? (grandMA3Spec.definitionId.endsWith("_name") ? "name" : "number") : "",
          command: "command",
          page: "page",
          current_page: "current_page",
          button_number: "button_number",
          button_state: "button_state",
        };
        for (const field of grandMA3Spec.fields) {
          let fromParams = grandMA3FieldsFromParams[field.key];
          if ((fromParams === undefined || fromParams === null || `${fromParams}`.trim() === "") && definitionId === grandMA3Spec.definitionId) {
            const optionKey = Object.entries(optionToFieldMap).find(([, mappedField]) => mappedField === field.key)?.[0];
            if (optionKey) {
              fromParams = grandMA3OptionsFromParams[optionKey];
            }
          }
          if (typeof fromParams === "string" && fromParams.trim()) {
            nextValues[field.key] = fromParams;
          } else if (typeof fromParams === "number" && Number.isFinite(fromParams)) {
            nextValues[field.key] = String(Math.trunc(fromParams));
          } else if (typeof fromParams === "boolean") {
            nextValues[field.key] = fromParams ? "true" : "false";
          } else if (field.defaultValue) {
            nextValues[field.key] = field.defaultValue;
          }
        }
        setGrandMA3FieldValues(nextValues);
      } else {
        setGrandMA3FieldValues({});
      }
    } else if (nextDevice === "ross_talk") {
      const taskInput = (selectedTask.input ?? "").trim();
      const taskValue = (selectedTask.value ?? "").trim();
      const keyerRef =
        (typeof params.keyerRef === "string" ? params.keyerRef : null)
        ?? taskInput;
      const parsedKeyerRef = parseRossTalkMleKeyerReference(keyerRef);
      const parsedTransition = parseRossTalkTransitionToken(
        typeof params.transition === "string" ? params.transition : taskValue,
      );
      const parsedMvBox = parseRossTalkMultiviewerBox(taskInput);

      setRossTalkMle(
        (typeof params.mle === "string" ? params.mle : null)
        ?? parsedKeyerRef?.mle
        ?? (taskInput || "ME:1"),
      );
      setRossTalkKeyer(
        (typeof params.keyer === "string" ? params.keyer : null)
        ?? parsedKeyerRef?.keyer
        ?? "1",
      );
      setRossTalkTransitionOnOff(parsedTransition.onOff);
      setRossTalkTransitionType(parsedTransition.transitionType);

      setRossTalkMultiviewerNumber(
        (typeof params.multiviewer === "string" ? params.multiviewer : null)
        ?? parsedMvBox?.multiviewer
        ?? "1",
      );
      setRossTalkBoxNumber(
        (typeof params.box === "string" ? params.box : null)
        ?? parsedMvBox?.box
        ?? "1",
      );
      setRossTalkSource(
        (typeof params.source === "string" ? params.source : null)
        ?? (taskValue || "IN:5"),
      );
      setRossTalkCcBank(
        (typeof params.bank === "string" ? params.bank : null)
        ?? taskInput
        ?? "1",
      );
      setRossTalkCcNumber(
        (typeof params.cc === "string" ? params.cc : null)
        ?? taskValue
        ?? "1",
      );
      setRossTalkSetName(
        (typeof params.set === "string" ? params.set : null)
        ?? taskInput
        ?? "set1",
      );
      setRossTalkSetLocation(
        (typeof params.location === "string" ? params.location : null)
        ?? taskValue
        ?? "",
      );
      setRossTalkMemoryId(
        (typeof params.memId === "string" ? params.memId : null)
        ?? taskInput
        ?? "1:1",
      );
      setRossTalkCommand(
        (typeof params.command === "string" ? params.command : null)
        ?? (taskInput || taskValue),
      );
      setRossTalkTakeId(
        (typeof params.takeId === "string" ? params.takeId : null)
        ?? taskInput
        ?? "0",
      );
      setRossTalkLayer(
        (typeof params.layer === "string" ? params.layer : null)
        ?? taskValue
        ?? "0",
      );
      setRossTalkGpiNumber(
        (typeof params.gpi === "string" ? params.gpi : null)
        ?? taskInput
        ?? "1",
      );
      setRossTalkGpiName(
        (typeof params.gpiName === "string" ? params.gpiName : null)
        ?? taskInput
        ?? "",
      );
      setRossTalkGpiParameter(
        (typeof params.parameter === "string" ? params.parameter : null)
        ?? taskValue
        ?? "",
      );
      setRossTalkXptDestination(
        (typeof params.destination === "string" ? params.destination : null)
        ?? taskInput
        ?? "ME:1:PGM",
      );
      setRossTalkXptSource(
        (typeof params.source === "string" ? params.source : null)
        ?? taskValue
        ?? "IN:20",
      );
      setRossTalkTimerId(
        (typeof params.timerId === "string" ? params.timerId : null)
        ?? taskInput
        ?? "1",
      );
      setRossTalkTimerAction(
        (typeof params.timerAction === "string" ? params.timerAction : null)
        ?? (taskValue || "RUN"),
      );
      setXpressionTakeId("0");
      setXpressionFramebuffer("1");
      setXpressionLayer("0");
      setXpressionGpi("0");
      setXpressionCustomCommand("");
    } else if (nextDevice === "ross_xpression") {
      const taskInput = (selectedTask.input ?? "").trim();
      const taskValue = (selectedTask.value ?? "").trim();
      const splitTakeFramebuffer = parseRossXpressionTakeFramebuffer(taskInput);
      const hasTakeId = needsRossXpressionTakeId(selectedTask.funcName);
      const hasFramebuffer = needsRossXpressionFramebuffer(selectedTask.funcName);
      const hasLayer = needsRossXpressionLayer(selectedTask.funcName);
      const isGpi = isRossXpressionGpiFunction(selectedTask.funcName);
      const isCustomCommand = isRossXpressionCustomCommandFunction(selectedTask.funcName);

      const takeId =
        readRossXpressionToken(params.takeId)
        ?? readRossXpressionToken(params.takeID)
        ?? (splitTakeFramebuffer?.takeId ?? null)
        ?? (hasTakeId ? readRossXpressionToken(taskInput) : null)
        ?? "0";
      const framebuffer =
        readRossXpressionToken(params.framebuffer)
        ?? readRossXpressionToken(params.fb)
        ?? (splitTakeFramebuffer?.framebuffer ?? null)
        ?? (hasFramebuffer && !splitTakeFramebuffer ? readRossXpressionToken(taskInput) : null)
        ?? "1";
      const layer =
        readRossXpressionToken(params.layer)
        ?? (hasLayer ? readRossXpressionToken(taskValue) : null)
        ?? "0";
      const gpi =
        readRossXpressionToken(params.gpi)
        ?? (isGpi ? readRossXpressionToken(taskInput) : null)
        ?? "0";
      const command =
        readRossXpressionToken(params.command)
        ?? (isCustomCommand ? (readRossXpressionToken(taskInput) ?? readRossXpressionToken(taskValue)) : null)
        ?? "";

      setXpressionTakeId(takeId);
      setXpressionFramebuffer(framebuffer);
      setXpressionLayer(layer);
      setXpressionGpi(gpi);
      setXpressionCustomCommand(command);
    } else {
      setXpressionTakeId("0");
      setXpressionFramebuffer("1");
      setXpressionLayer("0");
      setXpressionGpi("0");
      setXpressionCustomCommand("");
      setRossTalkMle("ME:1");
      setRossTalkMultiviewerNumber("1");
      setRossTalkBoxNumber("1");
      setRossTalkSource("IN:5");
      setRossTalkCcBank("1");
      setRossTalkCcNumber("1");
      setRossTalkSetName("set1");
      setRossTalkSetLocation("");
      setRossTalkMemoryId("1:1");
      setRossTalkCommand("");
      setRossTalkTakeId("0");
      setRossTalkLayer("0");
      setRossTalkKeyer("1");
      setRossTalkTransitionOnOff("toggle");
      setRossTalkTransitionType("CUT");
      setRossTalkGpiNumber("1");
      setRossTalkGpiName("");
      setRossTalkGpiParameter("");
      setRossTalkXptDestination("ME:1:PGM");
      setRossTalkXptSource("IN:20");
      setRossTalkTimerId("1");
      setRossTalkTimerAction("RUN");
    }

    if (
      nextDevice === "resolume"
      && isResolumeCompositionChangeFunction(selectedTask.funcName)
    ) {
      const rawAction = typeof params.resolumeCompositionAction === "string"
        ? params.resolumeCompositionAction
        : (typeof params.resolumeMasterAction === "string"
            ? params.resolumeMasterAction
            : selectedTask.input);
      const parsedAction: ResolumeMasterAction =
        rawAction === "+" || rawAction === "-" || rawAction === "="
          ? rawAction
          : "=";
      const rawValue =
        typeof params.resolumeCompositionValue === "number"
          ? params.resolumeCompositionValue
          : (typeof params.resolumeMasterPercent === "number"
              ? params.resolumeMasterPercent
              : selectedTask.value);
      const parsedPercent = typeof rawValue === "number" && Number.isFinite(rawValue)
        ? String(rawValue)
        : String(rawValue ?? "");
      setResolumeMasterAction(parsedAction);
      setResolumeMasterValue(parsedPercent);
    } else if (
      nextDevice === "resolume"
      && isResolumeClipChangeFunction(selectedTask.funcName)
    ) {
      const rawAction =
        typeof params.resolumeClipAction === "string"
          ? params.resolumeClipAction
          : selectedTask.input;
      const parsedAction: ResolumeMasterAction =
        rawAction === "+" || rawAction === "-" || rawAction === "="
          ? rawAction
          : "=";
      const rawValue =
        typeof params.resolumeClipValue === "number"
          ? params.resolumeClipValue
          : selectedTask.value;
      const parsedValue = typeof rawValue === "number" && Number.isFinite(rawValue)
        ? String(rawValue)
        : String(rawValue ?? "");
      const fromAddress = extractLayerClipFromAddress(
        typeof params.address === "string" ? params.address : undefined,
      );
      const parsedLayer =
        parsePositiveIntegerValue(params.resolumeClipLayer)
        ?? parsePositiveIntegerValue(params.layer)
        ?? fromAddress?.layer
        ?? 1;
      const parsedClip =
        parsePositiveIntegerValue(params.resolumeClipColumn)
        ?? parsePositiveIntegerValue(params.clip)
        ?? parsePositiveIntegerValue(params.column)
        ?? fromAddress?.clip
        ?? 1;

      setResolumeMasterAction(parsedAction);
      setResolumeMasterValue(parsedValue);
      setResolumeLayer(String(parsedLayer));
      setResolumeClip(String(parsedClip));
    } else if (
      nextDevice === "resolume"
      && isResolumeClipSelectionFunction(selectedTask.funcName)
    ) {
      const fromAddress = extractLayerClipFromAddress(
        typeof params.address === "string" ? params.address : undefined,
      );
      const parsedLayer =
        parsePositiveIntegerValue(params.resolumeClipLayer)
        ?? parsePositiveIntegerValue(params.layer)
        ?? parsePositiveIntegerValue(selectedTask.input)
        ?? fromAddress?.layer
        ?? 1;
      const parsedClip =
        parsePositiveIntegerValue(params.resolumeClipColumn)
        ?? parsePositiveIntegerValue(params.clip)
        ?? parsePositiveIntegerValue(params.column)
        ?? parsePositiveIntegerValue(selectedTask.value)
        ?? fromAddress?.clip
        ?? 1;
      setResolumeLayer(String(parsedLayer));
      setResolumeClip(String(parsedClip));
    } else if (
      nextDevice === "resolume"
      && isResolumeColumnActionFunction(selectedTask.funcName)
    ) {
      const address = typeof params.address === "string" ? params.address : undefined;
      const parsedAction =
        (typeof params.resolumeColumnAction === "string"
          && (params.resolumeColumnAction === "+" || params.resolumeColumnAction === "-" || params.resolumeColumnAction === "="))
        ? params.resolumeColumnAction
        : (
          selectedTask.input === "+" || selectedTask.input === "-" || selectedTask.input === "="
            ? selectedTask.input
            : (detectColumnActionFromAddress(address) ?? "=")
        );
      const parsedColumn =
        parsePositiveIntegerValue(params.resolumeColumnValue)
        ?? parsePositiveIntegerValue(selectedTask.value)
        ?? extractColumnValueFromAddress(address)
        ?? 1;
      const parsedLayerGroup =
        parsePositiveIntegerValue(params.resolumeLayerGroup)
        ?? parsePositiveIntegerValue(params.layerGroup)
        ?? extractLayerGroupFromAddress(address)
        ?? 1;
      setResolumeColumnAction(parsedAction);
      setResolumeColumnValue(String(parsedColumn));
      setResolumeLayerGroupNumber(String(parsedLayerGroup));
    } else if (
      nextDevice === "resolume"
      && isResolumeLayerColumnStepFunction(selectedTask.funcName)
    ) {
      const address = typeof params.address === "string" ? params.address : undefined;
      const parsedLayer =
        parsePositiveIntegerValue(params.resolumeLayerNumber)
        ?? parsePositiveIntegerValue(params.layer)
        ?? parsePositiveIntegerValue(selectedTask.input)
        ?? extractLayerFromAddress(address)
        ?? 1;
      setResolumeLayerNumber(String(parsedLayer));
    } else if (
      nextDevice === "resolume"
      && isResolumeLayerGroupColumnStepFunction(selectedTask.funcName)
    ) {
      const address = typeof params.address === "string" ? params.address : undefined;
      const parsedLayerGroup =
        parsePositiveIntegerValue(params.resolumeLayerGroup)
        ?? parsePositiveIntegerValue(params.layerGroup)
        ?? parsePositiveIntegerValue(selectedTask.input)
        ?? extractLayerGroupFromAddress(address)
        ?? 1;
      const parsedLastColumn =
        parsePositiveIntegerValue(params.resolumeLastColumn)
        ?? parsePositiveIntegerValue(selectedTask.value)
        ?? 4;
      setResolumeLayerGroupNumber(String(parsedLayerGroup));
      setResolumeLastColumn(String(parsedLastColumn));
    } else if (
      nextDevice === "resolume"
      && isResolumeToggleFunction(selectedTask.funcName)
    ) {
      const address = typeof params.address === "string" ? params.address : undefined;
      const parsedAction =
        (typeof params.resolumeToggleAction === "string"
          && ["toggle", "on", "off"].includes(params.resolumeToggleAction.toLowerCase()))
          ? params.resolumeToggleAction.toLowerCase() as ResolumeToggleAction
          : (
            (typeof selectedTask.value === "string"
              && ["toggle", "on", "off"].includes(selectedTask.value.toLowerCase()))
              ? selectedTask.value.toLowerCase() as ResolumeToggleAction
              : parseToggleActionFromAddressAndArgs(address, params.args)
          );
      const nextToggleAction: ResolumeToggleAction = parsedAction ?? "toggle";

      if (isLayerGroupToggleFunction(selectedTask.funcName)) {
        const parsedGroup =
          parsePositiveIntegerValue(params.resolumeLayerGroup)
          ?? parsePositiveIntegerValue(params.layerGroup)
          ?? parsePositiveIntegerValue(selectedTask.input)
          ?? extractLayerGroupFromAddress(address)
          ?? 1;
        setResolumeLayerGroupNumber(String(parsedGroup));
      } else {
        const parsedLayer =
          parsePositiveIntegerValue(params.resolumeLayerNumber)
          ?? parsePositiveIntegerValue(params.layer)
          ?? parsePositiveIntegerValue(selectedTask.input)
          ?? extractLayerFromAddress(address)
          ?? 1;
        setResolumeLayerNumber(String(parsedLayer));
      }

      setResolumeToggleAction(nextToggleAction);
    } else if (
      nextDevice === "resolume"
      && isResolumeLayerChangeFunction(selectedTask.funcName)
    ) {
      const address = typeof params.address === "string" ? params.address : undefined;
      const rawAction =
        typeof params.resolumeLayerAction === "string"
          ? params.resolumeLayerAction
          : selectedTask.input;
      const parsedAction: ResolumeMasterAction =
        rawAction === "+" || rawAction === "-" || rawAction === "="
          ? rawAction
          : (detectDeltaActionFromAddress(address) ?? "=");
      const rawValue =
        typeof params.resolumeLayerValue === "number"
          ? params.resolumeLayerValue
          : selectedTask.value;
      const parsedValue = typeof rawValue === "number" && Number.isFinite(rawValue)
        ? String(rawValue)
        : String(rawValue ?? "");
      const parsedLayer =
        parsePositiveIntegerValue(params.resolumeLayerNumber)
        ?? parsePositiveIntegerValue(params.layer)
        ?? parsePositiveIntegerValue(selectedTask.input)
        ?? extractLayerFromAddress(address)
        ?? 1;
      setResolumeMasterAction(parsedAction);
      setResolumeMasterValue(parsedValue);
      setResolumeLayerNumber(String(parsedLayer));
    } else if (
      nextDevice === "resolume"
      && isResolumeLayerGroupChangeFunction(selectedTask.funcName)
    ) {
      const address = typeof params.address === "string" ? params.address : undefined;
      const rawAction =
        typeof params.resolumeLayerGroupAction === "string"
          ? params.resolumeLayerGroupAction
          : selectedTask.input;
      const parsedAction: ResolumeMasterAction =
        rawAction === "+" || rawAction === "-" || rawAction === "="
          ? rawAction
          : (detectDeltaActionFromAddress(address) ?? "=");
      const rawValue =
        typeof params.resolumeLayerGroupValue === "number"
          ? params.resolumeLayerGroupValue
          : selectedTask.value;
      const parsedValue = typeof rawValue === "number" && Number.isFinite(rawValue)
        ? String(rawValue)
        : String(rawValue ?? "");
      const parsedLayerGroup =
        parsePositiveIntegerValue(params.resolumeLayerGroup)
        ?? parsePositiveIntegerValue(params.layerGroup)
        ?? parsePositiveIntegerValue(selectedTask.input)
        ?? extractLayerGroupFromAddress(address)
        ?? 1;
      setResolumeMasterAction(parsedAction);
      setResolumeMasterValue(parsedValue);
      setResolumeLayerGroupNumber(String(parsedLayerGroup));
    } else if (
      nextDevice === "resolume"
      && isResolumeLayerSelectFunction(selectedTask.funcName)
    ) {
      const address = typeof params.address === "string" ? params.address : undefined;
      if (isLayerGroupSelectFunction(selectedTask.funcName)) {
        const parsedLayerGroup =
          parsePositiveIntegerValue(params.resolumeLayerGroup)
          ?? parsePositiveIntegerValue(params.layerGroup)
          ?? parsePositiveIntegerValue(selectedTask.input)
          ?? extractLayerGroupFromAddress(address)
          ?? 1;
        setResolumeLayerGroupNumber(String(parsedLayerGroup));
      } else {
        const parsedLayer =
          parsePositiveIntegerValue(params.resolumeLayerNumber)
          ?? parsePositiveIntegerValue(params.layer)
          ?? parsePositiveIntegerValue(selectedTask.input)
          ?? extractLayerFromAddress(address)
          ?? 1;
        setResolumeLayerNumber(String(parsedLayer));
      }
    } else if (
      nextDevice === "resolume"
      && isResolumeLayerClearFunction(selectedTask.funcName)
    ) {
      const address = typeof params.address === "string" ? params.address : undefined;
      if (selectedTask.funcName === "Clear All Layers") {
        setResolumeLayerNumber("1");
      } else if (isLayerGroupClearFunction(selectedTask.funcName)) {
        const parsedLayerGroup =
          parsePositiveIntegerValue(params.resolumeLayerGroup)
          ?? parsePositiveIntegerValue(params.layerGroup)
          ?? parsePositiveIntegerValue(selectedTask.input)
          ?? extractLayerGroupFromAddress(address)
          ?? 1;
        setResolumeLayerGroupNumber(String(parsedLayerGroup));
      } else {
        const parsedLayer =
          parsePositiveIntegerValue(params.resolumeLayerNumber)
          ?? parsePositiveIntegerValue(params.layer)
          ?? parsePositiveIntegerValue(selectedTask.input)
          ?? extractLayerFromAddress(address)
          ?? 1;
        setResolumeLayerNumber(String(parsedLayer));
      }
    } else if (
      nextDevice === "resolume"
      && isResolumeDeckSelectFunction(selectedTask.funcName)
    ) {
      const address = typeof params.address === "string" ? params.address : undefined;
      const rawAction =
        typeof params.resolumeDeckAction === "string"
          ? params.resolumeDeckAction
          : selectedTask.input;
      const parsedAction: ResolumeMasterAction =
        rawAction === "+" || rawAction === "-" || rawAction === "="
          ? rawAction
          : (detectDeckActionFromAddress(address) ?? "=");
      const parsedDeck =
        parsePositiveIntegerValue(params.resolumeDeckValue)
        ?? parsePositiveIntegerValue(selectedTask.value)
        ?? extractDeckValueFromAddress(address)
        ?? 1;
      setResolumeDeckAction(parsedAction);
      setResolumeDeckValue(String(parsedDeck));
    } else if (
      nextDevice === "resolume"
      && isResolumeDeckStepFunction(selectedTask.funcName)
    ) {
      // no extra fields, action fully encoded by function choice
      setResolumeDeckAction(selectedTask.funcName === "Select Next Deck" ? "+" : "-");
      setResolumeDeckValue("");
    } else if (
      nextDevice === "resolume"
      && isResolumeCustomOscFunction(selectedTask.funcName)
    ) {
      const address = typeof params.address === "string"
        ? params.address
        : selectedTask.input;
      const argsText =
        typeof params.argsText === "string"
          ? params.argsText
          : (
            Array.isArray(params.args)
              ? JSON.stringify(params.args)
              : selectedTask.value
          );
      setResolumeCustomOscAddress(String(address ?? ""));
      setResolumeCustomOscArgs(String(argsText ?? ""));
    } else if (
      nextDevice === "resolume"
      && isResolumeCompositionColumnStepFunction(selectedTask.funcName)
    ) {
      // no extra fields
    }

    if (nextDevice === "vmix") {
      const nextCategory = typeof params.vmixCategory === "string" ? params.vmixCategory : (selectedTask.category ?? "");
      const nextFunction = typeof params.vmixFunction === "string" ? params.vmixFunction : (selectedTask.funcName ?? "");
      const rawArgs = asTaskParams(params.vmixArgs);
      const nextArgs = Object.entries(rawArgs).reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value === "string" && value.trim()) acc[key] = value;
        return acc;
      }, {});
      setVmixCategory(nextCategory);
      setVmixFunctionName(nextFunction);
      setVmixArgs(nextArgs);
    }
  }, [connections, isWorkspace, selectedTask]);

  // ── Task operations ──────────────────────────────────────────────────────────
  const changeTask = (id: string, field: keyof TaskEntry, v: string) => {
    setTasks(prev => prev.map((t) => {
      if (t.id !== id) return t;
      if (field === "enabled") {
        return { ...t, enabled: v.trim().toLowerCase() === "true" };
      }
      return { ...t, [field]: v };
    }));
  };
  const deleteTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));
  const moveTask   = (id: string, dir: -1 | 1) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };
  const dupTask = (id: string) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      const dup: TaskEntry = { ...prev[idx], id: createEntityId("task") };
      const arr = [...prev];
      arr.splice(idx + 1, 0, dup);
      return arr;
    });
  };

  const resetDraftFields = () => {
    if (isWaitCommand) {
      setMode("Direct");
      setCategory("Timing");
      setFuncName(WAIT_FUNC_NAME);
      setInput("");
      setValue("500");
    } else {
      const defaultCategory = Object.keys(cat.categories)[0] ?? "";
      const defaultFunction = defaultCategory
        ? (cat.categories[defaultCategory]?.[0] ?? "")
        : "";
      setMode("");
      setCategory(defaultCategory);
      setFuncName(defaultFunction);
      setInput("");
      setValue("");
    }
    setResolumeMasterAction("=");
    setResolumeMasterValue("");
    setResolumeLayer("1");
    setResolumeClip("1");
    setResolumeColumnAction("=");
    setResolumeColumnValue("");
    setResolumeLayerNumber("1");
    setResolumeLayerGroupNumber("1");
    setResolumeLastColumn("4");
    setResolumeToggleAction("toggle");
    setResolumeDeckAction("=");
    setResolumeDeckValue("");
    setResolumeCustomOscAddress("");
    setResolumeCustomOscArgs("");
    setXpressionTakeId("0");
    setXpressionFramebuffer("1");
    setXpressionLayer("0");
    setXpressionGpi("0");
    setXpressionCustomCommand("");
    setRossTalkMle("ME:1");
    setRossTalkMultiviewerNumber("1");
    setRossTalkBoxNumber("1");
    setRossTalkSource("IN:5");
    setRossTalkCcBank("1");
    setRossTalkCcNumber("1");
    setRossTalkSetName("set1");
    setRossTalkSetLocation("");
    setRossTalkMemoryId("1:1");
    setRossTalkCommand("");
    setRossTalkTakeId("0");
    setRossTalkLayer("0");
    setRossTalkKeyer("1");
    setRossTalkTransitionOnOff("toggle");
    setRossTalkTransitionType("CUT");
    setRossTalkGpiNumber("1");
    setRossTalkGpiName("");
    setRossTalkGpiParameter("");
    setRossTalkXptDestination("ME:1:PGM");
    setRossTalkXptSource("IN:20");
    setRossTalkTimerId("1");
    setRossTalkTimerAction("RUN");
    setObsSceneName("");
    setObsInputName("");
    setObsTransitionName("");
    setObsProfileName("");
    setObsSceneCollectionName("");
    setObsOutputName("");
    setObsHotkeyName("");
    setObsFieldValues({});
    setAtemFieldValues({});
    setSwp08Levels(["1"]);
    setSwp08Destination("1");
    setSwp08Source("1");
    setSwp08ClearType("all");
    setSwp08ClearEnableLevels("true");
    setHttpRequestUrl("");
    setHttpRequestBody("{}");
    setHttpRequestHeader("");
    setHttpRequestContentType("application/json");
    setHttpRequestJsonResultVariable("");
    setHttpRequestResultStringify("true");
    setHttpRequestStatusCodeVariable("");
    setGenericOscPath("/osc/path");
    setGenericOscString("text");
    setGenericOscInt("1");
    setGenericOscFloat("1");
    setGenericOscBoolean("false");
    setGenericOscArguments("1 \"Let's go\" 2.5");
    setGenericOscBlob("");
    setGenericOscBlobHex("0A0B0C");
    setGenericOscBlobHexSwitch("false");
    setGenericOscMidiMode("noteon");
    setGenericOscMidiPortId("0");
    setGenericOscMidiChannel("1");
    setGenericOscMidiData1("69");
    setGenericOscMidiData2("100");
    setGenericOscMidiPitch("0");
    setGenericOscMidiRawHex("00 90 45 65");
  };

  const handleAdd = () => {
    const draftTask = buildDraftTask();
    if (!draftTask) return;
    setTasks((prev) => [
      ...prev,
      { ...draftTask, id: createEntityId("task"), pause: "", enabled: draftTask.enabled ?? true },
    ]);
    resetDraftFields();
  };



  const handleVmixFunction = (nextFunctionName: string) => {
    const shortcut = getVmixFunctionByName(vmixCatalog, nextFunctionName);
    if (!shortcut) {
      setVmixFunctionName(nextFunctionName);
      return;
    }

    setVmixCategory(shortcut.category);
    setVmixFunctionName(shortcut.name);
  };

  const handleVmixArgChange = (key: string, nextValue: string) => {
    setVmixArgs((prev) => ({ ...prev, [key]: nextValue }));
  };

  const handleTest = async () => {
    const draftTask = buildDraftTask();
    if (!draftTask) {
      setTestMessage("Fill required fields before testing.");
      return;
    }
    setTesting(true);
    setTestMessage(null);
    try {
      const rows = compileDashboardRows([draftTask], connections);
      const response = await tauriInvoke<any>("api_request", {
        method: "POST",
        path: "/api/execute",
        body: { rows },
      });
      const ok = response?.status < 400 && response?.body?.success !== false;
      setTestMessage(ok ? "Sent to device." : (response?.body?.error ?? "Execution failed."));
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : "Execution failed.");
    } finally {
      setTesting(false);
    }
  };

  const buildDraftTask = (): TaskEntry | null => {
    if (isWaitCommand) {
      const waitMs = parsePositiveIntegerValue(value) ?? parsePositiveIntegerValue(input);
      if (waitMs === null) return null;
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: "Wait",
        mode: "Direct",
        category: "Timing",
        funcName: WAIT_FUNC_NAME,
        input: "",
        value: String(waitMs),
        pause: selectedTask?.pause ?? "",
        label: `Wait ${waitMs} ms`,
        params: {
          action: "wait",
          waitMs,
        },
      };
    }

    if (isVmixConnection) {
      if (!selectedConnection || !selectedVmixFunction || missingVmixParams.length > 0) {
        return null;
      }
      const built = buildVmixTask(selectedConnection, selectedVmixFunction, vmixArgs);
      return selectedTask
        ? { ...built, id: selectedTask.id, pause: selectedTask.pause }
        : built;
    }

    if (!manualBuilderSupported || conn.trim().length === 0 || funcName.trim().length === 0) {
      return null;
    }
    const resolvedMode = isResolumeConnection
      ? (selectOptionValue(modeOpts[0]) || mode || "osc")
      : ((isRossXpressionConnection || isRossTalkConnection)
          ? "Direct"
          : (mode || selectOptionValue(modeOpts[0]) || "Direct"));

    if (isAtemConnection) {
      const spec = atemFunctionSpec;
      if (!spec) return null;

      const nextFieldValues: Record<string, string> = {};
      for (const field of spec.fields) {
        const raw = (atemFieldValues[field.key] ?? "").trim();
        if (raw) {
          nextFieldValues[field.key] = raw;
        } else if (field.defaultValue !== undefined) {
          nextFieldValues[field.key] = field.defaultValue;
        } else {
          nextFieldValues[field.key] = "";
        }
      }

      const options: Record<string, unknown> = {};
      for (const field of spec.fields) {
        const raw = nextFieldValues[field.key] ?? "";
        if (!raw && field.defaultValue === undefined) continue;
        if (field.type === "number") {
          const parsed = Number.parseFloat(raw);
          options[field.key] = Number.isFinite(parsed) ? parsed : raw;
        } else if (field.type === "select" && (raw === "true" || raw === "false")) {
          options[field.key] = raw === "true";
        } else {
          options[field.key] = raw;
        }
      }

      const command = atemBuildCommand(spec.definitionId, nextFieldValues).trim();
      if (!command) return null;

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: "",
        value: "",
        pause: selectedTask?.pause ?? "",
        label: `ATEM: ${funcName}`,
        params: {
          protocol: "udp",
          action: "command",
          command,
          lineEnd: "none",
          definitionId: spec.definitionId,
          options,
          atemFields: nextFieldValues,
        },
      };
    }

    if (isResolumeCompositionChange && isResolumeCompositionChangeFunction(funcName)) {
      const parsedPercent = parseResolvableNumber(resolumeMasterValue);
      if (parsedPercent === null || parsedPercent < 0) {
        return null;
      }

      const normalized = isResolumeDbValueFunction
        ? parsedPercent
        : parsedPercent / 100;
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: resolumeMasterAction,
        value: resolumeMasterValue,
        pause: selectedTask?.pause ?? "",
        label: `Resolume: ${funcName} (${resolumeMasterAction}${parsedPercent}${isResolumeDbValueFunction ? "dB" : "%"})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveCompositionChangeAddress(funcName, resolumeMasterAction),
          args: [normalized],
          resolumeCompositionFunction: funcName,
          resolumeCompositionAction: resolumeMasterAction,
          resolumeCompositionValue: parsedPercent,
          resolumeValueUnit: funcName === "Composition Volume Change" ? "db" : "percent",
          // Backward compatibility for tasks created before this refactor.
          resolumeMasterAction: funcName === "Composition Master Change" ? resolumeMasterAction : undefined,
          resolumeMasterPercent: funcName === "Composition Master Change" ? parsedPercent : undefined,
        },
      };
    }

    if (isResolumeClipChange && isResolumeClipChangeFunction(funcName)) {
      const parsedValue = parseResolvableNumber(resolumeMasterValue);
      const parsedLayer = parsePositiveIntegerValue(resolumeLayer);
      const parsedClip = parsePositiveIntegerValue(resolumeClip);
      if (parsedValue === null || parsedValue < 0 || parsedLayer === null || parsedClip === null) {
        return null;
      }

      const normalized = funcName === "Clip Volume Change"
        ? parsedValue
        : parsedValue / 100;
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: resolumeMasterAction,
        value: resolumeMasterValue,
        pause: selectedTask?.pause ?? "",
        label: `Resolume: ${funcName} (L${parsedLayer} C${parsedClip}, ${resolumeMasterAction}${parsedValue}${funcName === "Clip Volume Change" ? "dB" : "%"})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveClipChangeAddress(funcName, parsedLayer, parsedClip, resolumeMasterAction),
          args: [normalized],
          resolumeClipFunction: funcName,
          resolumeClipAction: resolumeMasterAction,
          resolumeClipValue: parsedValue,
          resolumeClipLayer: parsedLayer,
          resolumeClipColumn: parsedClip,
          resolumeValueUnit: funcName === "Clip Volume Change" ? "db" : "percent",
        },
      };
    }

    if (isResolumeClipSelection && isResolumeClipSelectionFunction(funcName)) {
      const parsedLayer = parsePositiveIntegerValue(resolumeLayer);
      const parsedClip = parsePositiveIntegerValue(resolumeClip);
      if (parsedLayer === null || parsedClip === null) {
        return null;
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: String(parsedLayer),
        value: String(parsedClip),
        pause: selectedTask?.pause ?? "",
        label: `Resolume: ${funcName} (L${parsedLayer} C${parsedClip})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveClipSelectionAddress(funcName, parsedLayer, parsedClip),
          args: [],
          resolumeClipFunction: funcName,
          resolumeClipLayer: parsedLayer,
          resolumeClipColumn: parsedClip,
        },
      };
    }

    if (isResolumeColumnAction && isResolumeColumnActionFunction(funcName)) {
      const parsedValue = parsePositiveIntegerValue(resolumeColumnValue);
      const parsedLayerGroup = parsePositiveIntegerValue(resolumeLayerGroupNumber);
      if (parsedValue === null) {
        return null;
      }
      if (isLayerGroupColumnAction(funcName) && parsedLayerGroup === null) {
        return null;
      }
      const layerGroup = isLayerGroupColumnAction(funcName)
        ? (parsedLayerGroup ?? 1)
        : null;
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: resolumeColumnAction,
        value: resolumeColumnValue,
        pause: selectedTask?.pause ?? "",
        label: isLayerGroupColumnAction(funcName)
          ? `Resolume: ${funcName} (Group ${layerGroup}, ${resolumeColumnAction}${parsedValue})`
          : `Resolume: ${funcName} (${resolumeColumnAction}${parsedValue})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveColumnActionAddress(funcName, resolumeColumnAction, parsedValue, layerGroup),
          args: [],
          resolumeColumnFunction: funcName,
          resolumeColumnAction,
          resolumeColumnValue: parsedValue,
          resolumeLayerGroup: layerGroup ?? undefined,
        },
      };
    }

    if (isResolumeLayerColumnStep && isResolumeLayerColumnStepFunction(funcName)) {
      const parsedLayer = parsePositiveIntegerValue(resolumeLayerNumber);
      if (parsedLayer === null) {
        return null;
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: String(parsedLayer),
        value: "",
        pause: selectedTask?.pause ?? "",
        label: `Resolume: ${funcName} (Layer ${parsedLayer})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveLayerColumnStepAddress(funcName, parsedLayer),
          args: [],
          resolumeLayerColumnFunction: funcName,
          resolumeLayerNumber: parsedLayer,
        },
      };
    }

    if (isResolumeLayerGroupColumnStep && isResolumeLayerGroupColumnStepFunction(funcName)) {
      const parsedLayerGroup = parsePositiveIntegerValue(resolumeLayerGroupNumber);
      const parsedLastColumn = parsePositiveIntegerValue(resolumeLastColumn);
      if (parsedLayerGroup === null || parsedLastColumn === null) {
        return null;
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: String(parsedLayerGroup),
        value: String(parsedLastColumn),
        pause: selectedTask?.pause ?? "",
        label: `Resolume: ${funcName} (Group ${parsedLayerGroup}, last ${parsedLastColumn})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveLayerGroupColumnStepAddress(funcName, parsedLayerGroup),
          args: [],
          resolumeLayerGroupColumnFunction: funcName,
          resolumeLayerGroup: parsedLayerGroup,
          resolumeLastColumn: parsedLastColumn,
        },
      };
    }

    if (isResolumeToggleActionFunction && isResolumeToggleFunction(funcName)) {
      const target = isLayerGroupToggleFunction(funcName)
        ? parsePositiveIntegerValue(resolumeLayerGroupNumber)
        : parsePositiveIntegerValue(resolumeLayerNumber);
      if (target === null) {
        return null;
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: String(target),
        value: resolumeToggleAction,
        pause: selectedTask?.pause ?? "",
        label: isLayerGroupToggleFunction(funcName)
          ? `Resolume: ${funcName} (Group ${target}, ${resolumeToggleAction})`
          : `Resolume: ${funcName} (Layer ${target}, ${resolumeToggleAction})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveToggleAddress(funcName, target, resolumeToggleAction),
          args: resolveToggleArgs(resolumeToggleAction),
          resolumeToggleFunction: funcName,
          resolumeToggleAction,
          resolumeLayerNumber: isLayerGroupToggleFunction(funcName) ? undefined : target,
          resolumeLayerGroup: isLayerGroupToggleFunction(funcName) ? target : undefined,
        },
      };
    }

    if (isResolumeLayerChange && isResolumeLayerChangeFunction(funcName)) {
      const parsedLayer = parsePositiveIntegerValue(resolumeLayerNumber);
      const parsedValue = parseResolvableNumber(resolumeMasterValue);
      if (parsedLayer === null || parsedValue === null || parsedValue < 0) {
        return null;
      }

      const normalized =
        funcName === "Layer Volume Change" || funcName === "Layer Transition Duration Change"
          ? parsedValue
          : parsedValue / 100;
      const valueUnit =
        funcName === "Layer Volume Change"
          ? "db"
          : funcName === "Layer Transition Duration Change"
            ? "seconds"
            : "percent";
      const valueSuffix = valueUnit === "db" ? "dB" : valueUnit === "seconds" ? "s" : "%";

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: resolumeMasterAction,
        value: resolumeMasterValue,
        pause: selectedTask?.pause ?? "",
        label: `Resolume: ${funcName} (Layer ${parsedLayer}, ${resolumeMasterAction}${parsedValue}${valueSuffix})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveLayerChangeAddress(funcName, parsedLayer, resolumeMasterAction),
          args: [normalized],
          resolumeLayerFunction: funcName,
          resolumeLayerAction: resolumeMasterAction,
          resolumeLayerValue: parsedValue,
          resolumeLayerNumber: parsedLayer,
          resolumeValueUnit: valueUnit,
        },
      };
    }

    if (isResolumeLayerGroupChange && isResolumeLayerGroupChangeFunction(funcName)) {
      const parsedLayerGroup = parsePositiveIntegerValue(resolumeLayerGroupNumber);
      const parsedValue = parseResolvableNumber(resolumeMasterValue);
      if (parsedLayerGroup === null || parsedValue === null || parsedValue < 0) {
        return null;
      }

      const normalized = funcName === "Layer Group Volume Change"
        ? parsedValue
        : parsedValue / 100;
      const valueUnit = funcName === "Layer Group Volume Change" ? "db" : "percent";
      const valueSuffix = valueUnit === "db" ? "dB" : "%";

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: resolumeMasterAction,
        value: resolumeMasterValue,
        pause: selectedTask?.pause ?? "",
        label: `Resolume: ${funcName} (Group ${parsedLayerGroup}, ${resolumeMasterAction}${parsedValue}${valueSuffix})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveLayerGroupChangeAddress(funcName, parsedLayerGroup, resolumeMasterAction),
          args: [normalized],
          resolumeLayerGroupFunction: funcName,
          resolumeLayerGroupAction: resolumeMasterAction,
          resolumeLayerGroupValue: parsedValue,
          resolumeLayerGroup: parsedLayerGroup,
          resolumeValueUnit: valueUnit,
        },
      };
    }

    if (isResolumeLayerSelect && isResolumeLayerSelectFunction(funcName)) {
      const parsedTarget = isLayerGroupSelectFunction(funcName)
        ? parsePositiveIntegerValue(resolumeLayerGroupNumber)
        : parsePositiveIntegerValue(resolumeLayerNumber);
      if (parsedTarget === null) {
        return null;
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: String(parsedTarget),
        value: "",
        pause: selectedTask?.pause ?? "",
        label: isLayerGroupSelectFunction(funcName)
          ? `Resolume: ${funcName} (Group ${parsedTarget})`
          : `Resolume: ${funcName} (Layer ${parsedTarget})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveLayerSelectAddress(funcName, parsedTarget),
          args: [],
          resolumeLayerSelectFunction: funcName,
          resolumeLayerNumber: isLayerGroupSelectFunction(funcName) ? undefined : parsedTarget,
          resolumeLayerGroup: isLayerGroupSelectFunction(funcName) ? parsedTarget : undefined,
        },
      };
    }

    if (isResolumeLayerClear && isResolumeLayerClearFunction(funcName)) {
      const parsedTarget = funcName === "Clear All Layers"
        ? null
        : (isLayerGroupClearFunction(funcName)
          ? parsePositiveIntegerValue(resolumeLayerGroupNumber)
          : parsePositiveIntegerValue(resolumeLayerNumber));
      if (funcName !== "Clear All Layers" && parsedTarget === null) {
        return null;
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: parsedTarget === null ? "" : String(parsedTarget),
        value: "",
        pause: selectedTask?.pause ?? "",
        label: funcName === "Clear All Layers"
          ? "Resolume: Clear All Layers"
          : (isLayerGroupClearFunction(funcName)
            ? `Resolume: ${funcName} (Group ${parsedTarget})`
            : `Resolume: ${funcName} (Layer ${parsedTarget})`),
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveLayerClearAddress(funcName, parsedTarget),
          args: [],
          resolumeLayerClearFunction: funcName,
          resolumeLayerNumber: funcName === "Clear Layer" ? parsedTarget ?? undefined : undefined,
          resolumeLayerGroup: funcName === "Clear Layer Group" ? parsedTarget ?? undefined : undefined,
        },
      };
    }

    if (isResolumeDeckSelect && isResolumeDeckSelectFunction(funcName)) {
      const parsedDeck = parsePositiveIntegerValue(resolumeDeckValue);
      if (parsedDeck === null) {
        return null;
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: resolumeDeckAction,
        value: resolumeDeckValue,
        pause: selectedTask?.pause ?? "",
        label: `Resolume: ${funcName} (${resolumeDeckAction}${parsedDeck})`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveDeckSelectAddress(resolumeDeckAction, parsedDeck),
          args: [],
          resolumeDeckFunction: funcName,
          resolumeDeckAction,
          resolumeDeckValue: parsedDeck,
        },
      };
    }

    if (isResolumeDeckStep && isResolumeDeckStepFunction(funcName)) {
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: "",
        value: "",
        pause: selectedTask?.pause ?? "",
        label: `Resolume: ${funcName}`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveDeckStepAddress(funcName),
          args: [],
          resolumeDeckFunction: funcName,
        },
      };
    }

    if (isResolumeCompositionColumnStep && isResolumeCompositionColumnStepFunction(funcName)) {
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: "",
        value: "",
        pause: selectedTask?.pause ?? "",
        label: `Resolume: ${funcName}`,
        params: {
          protocol: "osc",
          action: "osc",
          address: resolveCompositionColumnStepAddress(funcName),
          args: [],
          resolumeCompositionColumnFunction: funcName,
        },
      };
    }

    if (isResolumeCustomOsc && isResolumeCustomOscFunction(funcName)) {
      const address = normalizeOscAddress(resolumeCustomOscAddress);
      if (!address) {
        return null;
      }
      const args = parseCustomOscArgs(resolumeCustomOscArgs);
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: address,
        value: resolumeCustomOscArgs,
        pause: selectedTask?.pause ?? "",
        label: `Resolume: Custom OSC (${address})`,
        params: {
          protocol: "osc",
          action: "osc",
          address,
          args,
          argsText: resolumeCustomOscArgs,
          resolumeCustomOsc: true,
        },
      };
    }

    if (isRossTalkConnection) {
      let nextInput = input;
      let nextValue = value;
      let summary = "";

      switch (funcName) {
        case "Auto Transition":
        case "Cut": {
          const mleToken = rossTalkMle.trim();
          if (!mleToken) return null;
          nextInput = mleToken;
          nextValue = "";
          summary = mleToken;
          break;
        }
        case "Change Multiviewer Box": {
          const multiviewerToken = rossTalkMultiviewerNumber.trim();
          const boxToken = rossTalkBoxNumber.trim();
          const sourceToken = rossTalkSource.trim();
          if (!multiviewerToken || !boxToken || !sourceToken) return null;
          nextInput = `${multiviewerToken}:${boxToken}`;
          nextValue = sourceToken;
          summary = `MV ${multiviewerToken}, Box ${boxToken}, ${sourceToken}`;
          break;
        }
        case "Fire Custom Control": {
          const bankToken = rossTalkCcBank.trim();
          const ccToken = rossTalkCcNumber.trim();
          if (!bankToken || !ccToken) return null;
          nextInput = bankToken;
          nextValue = ccToken;
          summary = `Bank ${bankToken}, CC ${ccToken}`;
          break;
        }
        case "Load Set": {
          const setToken = rossTalkSetName.trim();
          if (!setToken) return null;
          nextInput = setToken;
          nextValue = rossTalkSetLocation.trim();
          summary = nextValue ? `${setToken} (${nextValue})` : setToken;
          break;
        }
        case "MEM": {
          const memToken = rossTalkMemoryId.trim();
          if (!memToken) return null;
          nextInput = memToken;
          nextValue = "";
          summary = memToken;
          break;
        }
        case "SEQI": {
          const takeIdToken = rossTalkTakeId.trim();
          const layerToken = rossTalkLayer.trim();
          if (!takeIdToken || !layerToken) return null;
          nextInput = takeIdToken;
          nextValue = layerToken;
          summary = `Take ${takeIdToken}, Layer ${layerToken}`;
          break;
        }
        case "SEQO": {
          const takeIdToken = rossTalkTakeId.trim();
          if (!takeIdToken) return null;
          nextInput = takeIdToken;
          nextValue = "";
          summary = `Take ${takeIdToken}`;
          break;
        }
        case "Transition Keyer": {
          const keyerRef = buildRossTalkMleKeyerReference(rossTalkMle, rossTalkKeyer);
          if (!keyerRef) return null;
          nextInput = keyerRef;
          nextValue = buildRossTalkTransitionToken(rossTalkTransitionOnOff, rossTalkTransitionType);
          summary = `${keyerRef}, ${nextValue}`;
          break;
        }
        case "Trigger GPI": {
          const gpiToken = rossTalkGpiNumber.trim();
          if (!gpiToken) return null;
          nextInput = gpiToken;
          nextValue = "";
          summary = `GPI ${gpiToken}`;
          break;
        }
        case "Trigger GPI by Name": {
          const nameToken = rossTalkGpiName.trim();
          if (!nameToken) return null;
          nextInput = nameToken;
          nextValue = rossTalkGpiParameter.trim();
          summary = nextValue ? `${nameToken} (${nextValue})` : nameToken;
          break;
        }
        case "XPT": {
          const destinationToken = rossTalkXptDestination.trim();
          const sourceToken = rossTalkXptSource.trim();
          if (!destinationToken || !sourceToken) return null;
          nextInput = destinationToken;
          nextValue = sourceToken;
          summary = `${destinationToken} -> ${sourceToken}`;
          break;
        }
        case "Ultrix Timer": {
          const timerToken = rossTalkTimerId.trim();
          const actionToken = rossTalkTimerAction.trim().toUpperCase();
          if (!timerToken || !actionToken) return null;
          nextInput = timerToken;
          nextValue = actionToken;
          summary = `Timer ${timerToken}, ${actionToken}`;
          break;
        }
        default: {
          if (isRossTalkCustomCommandFunction(funcName)) {
            const commandToken = rossTalkCommand.trim() || input.trim() || value.trim();
            if (!commandToken) return null;
            nextInput = commandToken;
            nextValue = "";
            summary = commandToken;
          } else if (ROSS_TALK_FUNCTIONS_WITHOUT_EXTRA_FIELDS.has(funcName)) {
            nextInput = "";
            nextValue = "";
            summary = "";
          }
          break;
        }
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: nextInput,
        value: nextValue,
        pause: selectedTask?.pause ?? "",
        label: summary ? `RossTalk: ${funcName} (${summary})` : `RossTalk: ${funcName}`,
        params: {
          action: "command",
          mle: rossTalkMle.trim() || undefined,
          multiviewer: rossTalkMultiviewerNumber.trim() || undefined,
          box: rossTalkBoxNumber.trim() || undefined,
          source: (funcName === "XPT" ? rossTalkXptSource : rossTalkSource).trim() || undefined,
          bank: rossTalkCcBank.trim() || undefined,
          cc: rossTalkCcNumber.trim() || undefined,
          set: rossTalkSetName.trim() || undefined,
          location: rossTalkSetLocation.trim() || undefined,
          memId: rossTalkMemoryId.trim() || undefined,
          command: rossTalkCommand.trim() || undefined,
          takeId: rossTalkTakeId.trim() || undefined,
          layer: rossTalkLayer.trim() || undefined,
          keyer: rossTalkKeyer.trim() || undefined,
          keyerRef: buildRossTalkMleKeyerReference(rossTalkMle, rossTalkKeyer) || undefined,
          transition: buildRossTalkTransitionToken(rossTalkTransitionOnOff, rossTalkTransitionType),
          gpi: rossTalkGpiNumber.trim() || undefined,
          gpiName: rossTalkGpiName.trim() || undefined,
          parameter: rossTalkGpiParameter.trim() || undefined,
          destination: rossTalkXptDestination.trim() || undefined,
          timerId: rossTalkTimerId.trim() || undefined,
          timerAction: rossTalkTimerAction.trim().toUpperCase() || undefined,
        },
      };
    }

    if (isRossXpressionConnection) {
      const takeIdToken = xpressionTakeId.trim() || "0";
      const framebufferToken = xpressionFramebuffer.trim() || "1";
      const layerToken = xpressionLayer.trim() || "0";
      const gpiToken = xpressionGpi.trim() || "0";
      const commandToken = xpressionCustomCommand.trim() || input.trim() || value.trim();

      let nextInput = input;
      let nextValue = value;
      let summary = "";

      switch (funcName) {
        case "Clear framebuffer (CLFB)":
        case "Load cued items in framebuffer (SWAP)":
        case "Resume all layers in framebuffer (RESUME)":
          nextInput = framebufferToken;
          nextValue = "";
          summary = `FB ${framebufferToken}`;
          break;
        case "Clear layer in framebuffer (CLFB)":
        case "Resume layer in framebuffer (RESUME)":
        case "Take layer in framebuffer off air (LAYEROFF)":
          nextInput = framebufferToken;
          nextValue = layerToken;
          summary = `FB ${framebufferToken}, L${layerToken}`;
          break;
        case "Load take item to air on layer (SEQI)":
          nextInput = takeIdToken;
          nextValue = layerToken;
          summary = `Take ${takeIdToken}, L${layerToken}`;
          break;
        case "Load take item to framebuffer layer (TAKE)":
        case "Ready item into a framebuffer layer (CUE)":
          nextInput = `${takeIdToken}:${framebufferToken}`;
          nextValue = layerToken;
          summary = `Take ${takeIdToken}, FB ${framebufferToken}, L${layerToken}`;
          break;
        case "Remove take item from the cued state (UNCUE)":
        case "Set preview to take item (UPNEXT)":
        case "Set sequencer focus to take item (FOCUS)":
        case "Take take item off air (SEQO)":
          nextInput = takeIdToken;
          nextValue = "";
          summary = `Take ${takeIdToken}`;
          break;
        case "Trigger simulated GPI (GPI)":
          nextInput = gpiToken;
          nextValue = "";
          summary = `GPI ${gpiToken}`;
          break;
        case "Send a custom command":
          if (!commandToken) return null;
          nextInput = commandToken;
          nextValue = "";
          summary = commandToken;
          break;
        default:
          break;
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: nextInput,
        value: nextValue,
        pause: selectedTask?.pause ?? "",
        label: summary ? `XPression: ${funcName} (${summary})` : `XPression: ${funcName}`,
      };
    }

    if (isObsConnection && isObsSceneFunction) {
      const requestType = OBS_SCENE_FUNCTION_TO_REQUEST[funcName] ?? "";
      const sceneName = obsSceneName.trim();
      if (!requestType || !sceneName) return null;
      const requestData = { sceneName };
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: requestType,
        value: JSON.stringify(requestData),
        pause: selectedTask?.pause ?? "",
        label: `OBS: ${funcName} (${sceneName})`,
        params: {
          action: "command",
          protocol: "ws",
          requestType,
          requestData,
          sceneName,
        },
      };
    }

    if (isObsConnection && obsFunctionSpec) {
      let requestType = obsFunctionSpec.requestType.trim();
      if (!requestType) return null;
      const requestData: Record<string, unknown> = {
        ...(obsFunctionSpec.defaultRequestData ?? {}),
      };
      if (obsFunctionSpec.parameterKind && obsFunctionSpec.parameterKey) {
        const parameterValue = obsCurrentParameterValue.trim();
        if (!parameterValue) return null;
        requestData[obsFunctionSpec.parameterKey] = parameterValue;
      }
      if (obsFunctionSpec.fields?.length) {
        for (const field of obsFunctionSpec.fields) {
          const raw = obsFieldValues[field.key] ?? "";
          const parsed = normalizeObsFieldValue(raw, field.type);
          if (parsed === undefined) continue;
          setValueByPath(requestData, field.key, parsed);
        }
      }
      if (funcName === "Set Source Mute") {
        const mode = String(requestData.inputMuted ?? "").trim().toLowerCase();
        if (mode === "toggle") {
          requestType = "ToggleInputMute";
          delete requestData.inputMuted;
        } else if (mode === "on" || mode === "off") {
          requestData.inputMuted = mode === "on";
        }
      }
      if (funcName === "Custom Command") {
        const customRequestType = String(requestData.customRequestType ?? "").trim();
        if (!customRequestType) return null;
        const customRequestData = requestData.customRequestData;
        requestType = customRequestType;
        Object.keys(requestData).forEach((key) => delete requestData[key]);
        if (customRequestData && typeof customRequestData === "object" && !Array.isArray(customRequestData)) {
          Object.assign(requestData, customRequestData as Record<string, unknown>);
        }
      }
      const valueToken = value.trim();
      if (valueToken) {
        if (funcName === "Set Source Volume" || funcName === "Adjust Source Volume (dB)") {
          const parsed = Number.parseFloat(valueToken);
          if (Number.isFinite(parsed)) {
            requestData.inputVolumeDb = parsed;
          }
        } else if (funcName === "Set Audio Sync Offset" || funcName === "Adjust Audio Sync Offset") {
          const parsed = Number.parseInt(valueToken, 10);
          if (Number.isFinite(parsed)) {
            requestData.inputAudioSyncOffset = parsed;
          }
        } else if (funcName === "Set Audio Balance" || funcName === "Adjust Audio Balance") {
          const parsed = Number.parseFloat(valueToken);
          if (Number.isFinite(parsed)) {
            requestData.inputAudioBalance = parsed;
          }
        } else if (funcName === "Set Audio Monitor") {
          requestData.monitorType = valueToken;
        } else if (funcName === "Play / Pause Media") {
          requestData.mediaAction = valueToken || "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY_PAUSE";
        } else if (funcName === "Set Media Time") {
          const seconds = Number.parseFloat(valueToken);
          if (Number.isFinite(seconds)) {
            requestData.mediaCursor = Math.trunc(seconds * 1000);
          }
        } else if (funcName === "Scrub Media") {
          const seconds = Number.parseFloat(valueToken);
          if (Number.isFinite(seconds)) {
            requestData.mediaCursorOffset = Math.trunc(seconds * 1000);
          }
        } else if (funcName === "Adjust Source Volume (Percentage)") {
          const parsed = Number.parseFloat(valueToken);
          if (Number.isFinite(parsed)) {
            requestData.inputVolumeMul = parsed / 100;
          }
        }
      }
      if (funcName === "Set Source Visibility") {
        const mode = String(requestData.sceneItemEnabled ?? "").trim().toLowerCase();
        if (mode === "toggle") {
          requestType = "AUTOCOM_TOGGLE_SCENE_ITEM_ENABLED";
          delete requestData.sceneItemEnabled;
        } else if (mode === "on" || mode === "off") {
          requestType = "SetSceneItemEnabled";
          requestData.sceneItemEnabled = mode === "on";
        }
      }
      if (funcName === "Set Filter Visibility") {
        const mode = String(requestData.filterEnabled ?? "").trim().toLowerCase();
        if (mode === "toggle") {
          requestType = "AUTOCOM_TOGGLE_FILTER_ENABLED";
          delete requestData.filterEnabled;
        } else if (mode === "on" || mode === "off") {
          requestType = "SetSourceFilterEnabled";
          requestData.filterEnabled = mode === "on";
        }
      }
      if (funcName === "Set Source Visibility") {
        const sceneItemToken = String(requestData.sceneItemId ?? "").trim();
        const sceneItemId = Number.parseInt(sceneItemToken, 10);
        if (!Number.isFinite(sceneItemId) || sceneItemId <= 0) return null;
        requestData.sceneItemId = sceneItemId;
      }
      if (funcName === "Set Source Transform") {
        const sceneItemToken = String(requestData.sceneItemId ?? "").trim();
        const sceneItemId = Number.parseInt(sceneItemToken, 10);
        if (!Number.isFinite(sceneItemId) || sceneItemId <= 0) return null;
        requestData.sceneItemId = sceneItemId;
        const transform = requestData.sceneItemTransform;
        if (!transform || typeof transform !== "object" || Array.isArray(transform)) {
          delete requestData.sceneItemTransform;
        }
      }
      if (funcName === "Restart Media") requestData.mediaAction = "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART";
      if (funcName === "Stop Media") requestData.mediaAction = "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP";
      if (funcName === "Next Media") requestData.mediaAction = "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT";
      if (funcName === "Previous Media") requestData.mediaAction = "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS";
      const hasRequestData = Object.keys(requestData).length > 0;
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: requestType,
        value: hasRequestData ? JSON.stringify(requestData) : "",
        pause: selectedTask?.pause ?? "",
        label: `OBS: ${funcName}`,
        params: {
          action: "command",
          protocol: "ws",
          requestType,
          ...(hasRequestData ? { requestData } : {}),
        },
      };
    }

    if (isGenericOscConnection) {
      const path = normalizeOscAddress(genericOscPath);
      if (!path) return null;

      let definitionId = "send_blank";
      let options: Record<string, unknown> = { path };
      let args: unknown[] = [];
      let labelSuffix = "";

      if (funcName === "Send string") {
        definitionId = "send_string";
        options = { path, string: genericOscString };
        args = [genericOscString];
        labelSuffix = genericOscString;
      } else if (funcName === "Send int") {
        definitionId = "send_int";
        const intValue = parseIntegerValue(genericOscInt) ?? 0;
        options = { path, int: intValue };
        args = [intValue];
        labelSuffix = String(intValue);
      } else if (funcName === "Send float") {
        definitionId = "send_float";
        const floatValue = Number.parseFloat(genericOscFloat);
        const normalized = Number.isFinite(floatValue) ? floatValue : 0;
        options = { path, float: normalized };
        args = [normalized];
        labelSuffix = String(normalized);
      } else if (funcName === "Send boolean") {
        definitionId = "send_boolean";
        const boolValue = genericOscBoolean === "true";
        options = { path, value: boolValue };
        args = [boolValue];
        labelSuffix = boolValue ? "true" : "false";
      } else if (funcName === "Send multiple") {
        definitionId = "send_multiple";
        const argumentsText = genericOscArguments.trim();
        options = { path, arguments: argumentsText };
        args = parseCompanionOscMultipleArgs(argumentsText);
        labelSuffix = argumentsText;
      } else if (funcName === "Send blob") {
        definitionId = "send_blob";
        const useHex = genericOscBlobHexSwitch === "true";
        const blobText = genericOscBlob.trim();
        const hexText = genericOscBlobHex.trim();
        options = {
          path,
          blob: blobText,
          blob_hex: hexText,
          hexswitch: useHex,
        };
        args = useHex ? [parseHexBytes(hexText)] : (blobText ? [blobText] : []);
        labelSuffix = useHex ? hexText : blobText;
      } else if (funcName === "Send midi") {
        definitionId = "send_midi";
        const portId = parseNonNegativeIntegerValue(genericOscMidiPortId) ?? 0;
        const channel = parsePositiveIntegerValue(genericOscMidiChannel) ?? 1;
        const data1 = parseNonNegativeIntegerValue(genericOscMidiData1) ?? 69;
        const data2 = parseNonNegativeIntegerValue(genericOscMidiData2) ?? 100;
        const pitch = parseIntegerValue(genericOscMidiPitch) ?? 0;
        const rawHex = genericOscMidiRawHex.trim();
        const mode = genericOscMidiMode.trim().toLowerCase() || "noteon";
        const midiBytes = buildOscMidiBytes({
          mode,
          channel,
          data1,
          data2,
          pitch,
          rawHex,
        });
        options = {
          path,
          mode,
          portId,
          channel,
          data1,
          data2,
          pitch,
          rawHex,
        };
        args = [midiBytes];
        labelSuffix = `${mode} ch${channel}`;
      } else {
        definitionId = "send_blank";
        options = { path };
        args = [];
      }

      const valuePreview = args.length ? JSON.stringify(args) : "";
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName: funcName || "Send blank",
        input: path,
        value: valuePreview,
        pause: selectedTask?.pause ?? "",
        label: labelSuffix
          ? `OSC: ${funcName} (${labelSuffix})`
          : `OSC: ${funcName || "Send blank"} (${path})`,
        params: {
          action: "osc",
          protocol: "osc",
          address: path,
          args,
          definitionId,
          options,
        },
      };
    }

    if (isHttpApiConnection) {
      if (!GENERIC_HTTP_FUNCTIONS.has(funcName)) return null;

      const method = funcName;
      const definitionId = method.toLowerCase();
      const url = httpRequestUrl.trim() || "/";
      const includeBody = method !== "GET";
      const includeContentType = method !== "GET" && method !== "DELETE";
      const includeStatusCodeVariable = method !== "DELETE";
      const bodyText = httpRequestBody;
      const headerText = httpRequestHeader.trim();
      const protocol = String(selectedConnection?.protocol ?? "http").trim().toLowerCase() || "http";
      const options: Record<string, unknown> = {
        url,
        ...(includeBody ? { body: bodyText } : {}),
        header: headerText,
        ...(includeContentType ? { contenttype: httpRequestContentType } : {}),
        result_stringify: httpRequestResultStringify === "true",
      };

      const jsonResultDataVariable = httpRequestJsonResultVariable.trim();
      const statusCodeVariable = httpRequestStatusCodeVariable.trim();
      if (jsonResultDataVariable) options.jsonResultDataVariable = jsonResultDataVariable;
      if (includeStatusCodeVariable && statusCodeVariable) options.statusCodeVariable = statusCodeVariable;

      const parsedHeaders = headerText ? parseLooseValue(headerText) : undefined;
      const parsedBody = includeBody ? parseLooseValue(bodyText) : undefined;

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName: method,
        input: url,
        value: includeBody ? bodyText : "",
        pause: selectedTask?.pause ?? "",
        label: `HTTP: ${method} ${url}`,
        params: {
          action: "http",
          protocol,
          method,
          path: url,
          ...(parsedHeaders !== undefined ? { headers: parsedHeaders } : {}),
          ...(includeBody ? { body: parsedBody } : {}),
          definitionId,
          options,
        },
      };
    }

    if (isSwp08Connection) {
      if (!SWP08_FUNCTIONS.has(funcName)) return null;

      const levels = swp08Levels
        .map((value) => parsePositiveIntegerValue(value))
        .filter((value): value is number => value !== null);
      const destination = parsePositiveIntegerValue(swp08Destination) ?? 1;
      const source = parsePositiveIntegerValue(swp08Source) ?? 1;
      const options: Record<string, unknown> = {};
      let definitionId = "";
      let inputValue = "";
      let valueValue = "";

      if (funcName === "Select Levels") {
        definitionId = "select_level";
        options.level = levels;
        inputValue = levels.join(",");
      } else if (funcName === "De-Select Levels") {
        definitionId = "deselect_level";
        options.level = levels;
        inputValue = levels.join(",");
      } else if (funcName === "Toggle Levels") {
        definitionId = "toggle_level";
        options.level = levels;
        inputValue = levels.join(",");
      } else if (funcName === "Select Destination") {
        definitionId = "select_dest";
        options.dest = destination;
        inputValue = String(destination);
      } else if (funcName === "Select Destination name") {
        definitionId = "select_dest_name";
        options.dest = destination;
        inputValue = String(destination);
      } else if (funcName === "Select Source") {
        definitionId = "select_source";
        options.source = source;
        inputValue = String(source);
      } else if (funcName === "Select Source name") {
        definitionId = "select_source_name";
        options.source = source;
        inputValue = String(source);
      } else if (funcName === "Route Source to selected Levels and Destination") {
        definitionId = "route_source";
        options.source = source;
        inputValue = String(source);
      } else if (funcName === "Route Source name to selected Levels and Destination") {
        definitionId = "route_source_name";
        options.source = source;
        inputValue = String(source);
      } else if (funcName === "Take") {
        definitionId = "take";
      } else if (funcName === "Clear") {
        definitionId = "clear";
        options.clear = swp08ClearType;
        options.clear_enable_levels = swp08ClearEnableLevels === "true";
        inputValue = swp08ClearType;
        valueValue = swp08ClearEnableLevels === "true" ? "enabled" : "disabled";
      } else if (funcName === "Set crosspoint") {
        definitionId = "set_crosspoint";
        options.level = levels;
        options.source = source;
        options.dest = destination;
        inputValue = String(destination);
        valueValue = String(source);
      } else if (funcName === "Set crosspoint by name") {
        definitionId = "set_crosspoint_name";
        options.level = levels;
        options.source = source;
        options.dest = destination;
        inputValue = String(destination);
        valueValue = String(source);
      } else if (funcName === "Refresh Source and Destination names") {
        definitionId = "get_names";
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: inputValue,
        value: valueValue,
        pause: selectedTask?.pause ?? "",
        label: `SWP08: ${funcName}`,
        params: {
          action: "command",
          protocol: "tcp",
          definitionId,
          options,
        },
      };
    }

    if (isVideohubConnection) {
      if (!VIDEOHUB_FUNCTIONS.has(funcName)) return null;
      const options: Record<string, unknown> = {};
      let definitionId = "";
      let inputValue = "";
      let valueValue = "";

      if (funcName === "Lock: Change destination lock state") {
        definitionId = "lock_output";
        options.output = parseNonNegativeIntegerValue(videohubOutput) ?? 0;
        options.lock_state = videohubLockState;
        options.ignore_lock = videohubIgnoreLock === "true";
        inputValue = String(options.output);
        valueValue = String(options.lock_state);
      } else if (funcName === "Lock: Change destination lock state (dynamic)") {
        definitionId = "lock_output_dyn";
        options.output = videohubOutputDynamic.trim();
        options.lock_state = videohubLockStateDynamic;
        options.ignore_lock = videohubIgnoreLock === "true";
        inputValue = String(options.output);
        valueValue = String(options.lock_state);
      } else if (funcName === "Route File: Load file") {
        definitionId = "load_route_from_file";
        options.source_file = videohubSourceFile.trim();
        inputValue = String(options.source_file);
      } else if (funcName === "Route File: Save file") {
        definitionId = "store_route_in_file";
        options.destination_file = videohubDestinationFile.trim();
        inputValue = String(options.destination_file);
      } else if (funcName === "Video: Clear queued route") {
        definitionId = "clear";
      } else if (funcName === "Video: Rename destination") {
        definitionId = "rename_destination";
        options.destination = parseNonNegativeIntegerValue(videohubDestination) ?? 0;
        options.label = videohubLabel;
        inputValue = String(options.destination);
        valueValue = String(options.label);
      } else if (funcName === "Video: Rename source") {
        definitionId = "rename_source";
        options.source = parseNonNegativeIntegerValue(videohubSource) ?? 0;
        options.label = videohubLabel;
        inputValue = String(options.source);
        valueValue = String(options.label);
      } else if (funcName === "Video: Return to previous route") {
        definitionId = "route_to_previous";
        options.destination = parseNonNegativeIntegerValue(videohubDestination) ?? 0;
        options.ignore_lock = videohubIgnoreLock === "true";
        inputValue = String(options.destination);
      } else if (funcName === "Video: Return to previous route (dynamic)") {
        definitionId = "route_to_previous_dyn";
        options.destination = videohubDestinationDynamic.trim();
        options.ignore_lock = videohubIgnoreLock === "true";
        inputValue = String(options.destination);
      } else if (funcName === "Video: Route source to destination") {
        definitionId = "route";
        options.source = parseNonNegativeIntegerValue(videohubSource) ?? 0;
        options.destination = parseNonNegativeIntegerValue(videohubDestination) ?? 0;
        options.ignore_lock = videohubIgnoreLock === "true";
        inputValue = String(options.destination);
        valueValue = String(options.source);
      } else if (funcName === "Video: Route source to destination (dynamic)") {
        definitionId = "route_dyn";
        options.source = videohubSourceDynamic.trim();
        options.destination = videohubDestinationDynamic.trim();
        options.ignore_lock = videohubIgnoreLock === "true";
        inputValue = String(options.destination);
        valueValue = String(options.source);
      } else if (funcName === "Video: Route source to destination, based on another destination") {
        definitionId = "route_routed";
        options.source_routed_to_destination = parseNonNegativeIntegerValue(videohubSourceRoutedDestination) ?? 0;
        options.destination = parseNonNegativeIntegerValue(videohubDestination) ?? 0;
        options.ignore_lock = videohubIgnoreLock === "true";
        inputValue = String(options.destination);
        valueValue = String(options.source_routed_to_destination);
      } else if (funcName === "Video: Route source to destination, based on another destination (dynamic)") {
        definitionId = "route_routed_dyn";
        options.source_routed_to_destination = videohubSourceRoutedDestinationDynamic.trim();
        options.destination = videohubDestinationDynamic.trim();
        options.ignore_lock = videohubIgnoreLock === "true";
        inputValue = String(options.destination);
        valueValue = String(options.source_routed_to_destination);
      } else if (funcName === "Video: Route source to selected destination") {
        definitionId = "route_source";
        options.source = parseNonNegativeIntegerValue(videohubSource) ?? 0;
        options.ignore_lock = videohubIgnoreLock === "true";
        inputValue = String(options.source);
      } else if (funcName === "Video: Route source to selected destination (dynamic)") {
        definitionId = "route_source_dyn";
        options.source = videohubSourceDynamic.trim();
        options.ignore_lock = videohubIgnoreLock === "true";
        inputValue = String(options.source);
      } else if (funcName === "Video: Select destination") {
        definitionId = "select_destination";
        options.destination = parseNonNegativeIntegerValue(videohubDestination) ?? 0;
        inputValue = String(options.destination);
      } else if (funcName === "Video: Select destination (dynamic)") {
        definitionId = "select_destination_dyn";
        options.destination = videohubDestinationDynamic.trim();
        inputValue = String(options.destination);
      } else if (funcName === "Video: Take queued route") {
        definitionId = "take";
        options.ignore_lock = videohubIgnoreLock === "true";
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: inputValue,
        value: valueValue,
        pause: selectedTask?.pause ?? "",
        label: `VideoHub: ${funcName}`,
        params: {
          action: "command",
          protocol: "tcp",
          definitionId,
          options,
        },
      };
    }

    if (isCompanionRemoteConnection) {
      const normalizedFunc = COMPANION_REMOTE_FUNCTIONS.has(funcName)
        ? funcName
        : "Button Event";
      const page = parsePositiveIntegerValue(companionSatellitePage) ?? 1;
      const row = parseNonNegativeIntegerValue(companionSatelliteRow) ?? 0;
      const column = parseNonNegativeIntegerValue(companionSatelliteColumn) ?? 0;
      const eventType = companionSatelliteEventType === "release"
        ? "release"
        : (companionSatelliteEventType === "rotate_left" || companionSatelliteEventType === "rotate_right")
          ? companionSatelliteEventType
          : "press";
      const eventPath = eventType === "release"
        ? "up"
        : eventType === "rotate_left"
          ? "rotate-left"
          : eventType === "rotate_right"
            ? "rotate-right"
            : "press";
      const path = `/api/location/${page}/${row}/${column}/${eventPath}`;
      const eventLabel = eventType === "rotate_left"
        ? "Rotate Left"
        : eventType === "rotate_right"
          ? "Rotate Right"
          : (eventType === "release" ? "Release" : "Press");
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category: "Satellite",
        funcName: normalizedFunc,
        input: `${page}/${row}/${column}`,
        value: eventType,
        pause: selectedTask?.pause ?? "",
        label: `Satellite: ${eventLabel} P${page} ${row}/${column}`,
        params: {
          action: "http",
          protocol: "http",
          method: "POST",
          path,
          definitionId: "keyEvent",
          satellitePage: page,
          options: {
            location: `${row}/${column}`,
            eventType,
          },
        },
      };
    }

    if (isGenericTcpUdpConnection) {
      const isHex = funcName === "Send HEX encoded Command";
      const definitionId = isHex ? "send_hex" : "send";
      const command = isHex ? genericTcpUdpHexCommand : genericTcpUdpCommand;
      const lineEnd = genericTcpUdpLineEnd;
      const protocol = String(selectedConnection?.protocol ?? "tcp").trim().toLowerCase() || "tcp";
      const options = isHex
        ? { id_send_hex: command, id_end: lineEnd }
        : { id_send: command, id_end: lineEnd };
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: command,
        value: "",
        pause: selectedTask?.pause ?? "",
        label: command ? `${funcName} (${command})` : funcName,
        params: {
          action: "command",
          protocol,
          command,
          lineEnd,
          definitionId,
          options,
        },
      };
    }

    if (isGrandMA2Connection) {
      if (!MA2_FUNCTIONS.has(funcName)) return null;
      let definitionId = "";
      let command = "";
      let summary = "";
      let options: Record<string, unknown> = {};

      if (funcName === "Button Press/Release") {
        const button = parsePositiveIntegerValue(ma2ButtonNumber);
        if (button === null) return null;
        definitionId = "button";
        options = { button, dir: ma2ButtonDirection === "press" ? "true" : "false" };
        command = `Button ${button} ${ma2ButtonDirection}`;
        summary = `Button ${button} (${ma2ButtonDirection})`;
      } else if (funcName === "Encoder Press/Release") {
        const useVariable = ma2EncoderPressUseVariable === "true";
        const encoder = parseNonNegativeIntegerValue(ma2EncoderPressNumber);
        const encoderVariable = parsePositiveIntegerValue(ma2EncoderPressVariable);
        if ((!useVariable && encoder === null) || (useVariable && encoderVariable === null)) return null;
        definitionId = "encoder_p";
        options = {
          encoder_from_variable: useVariable,
          enc: encoder ?? 1,
          encoder_variable: encoderVariable ?? 1,
          dir: ma2EncoderPressDirection,
        };
        command = useVariable
          ? `Encoder ${encoderVariable} Press/Release (${ma2EncoderPressDirection === "true" ? "press" : "release"})`
          : `Encoder ${encoder} Press/Release (${ma2EncoderPressDirection === "true" ? "press" : "release"})`;
        summary = useVariable
          ? `Variable encoder ${encoderVariable}, ${ma2EncoderPressDirection === "true" ? "press" : "release"}`
          : `Encoder ${encoder}, ${ma2EncoderPressDirection === "true" ? "press" : "release"}`;
      } else if (funcName === "Move wheel up/down") {
        const steps = parseIntegerValue(ma2WheelSteps);
        if (steps === null || steps === 0) return null;
        definitionId = "wheel";
        options = { steps };
        command = `Wheel ${steps}`;
        summary = `Steps ${steps}`;
      } else if (funcName === "Rotate Encoder") {
        const useVariable = ma2RotateUseVariable === "true";
        const encoder = parseNonNegativeIntegerValue(ma2RotateEncoderNumber);
        const encoderVariable = parsePositiveIntegerValue(ma2RotateEncoderVariable);
        const steps = parseIntegerValue(ma2RotateSteps);
        if ((!useVariable && encoder === null) || (useVariable && encoderVariable === null) || steps === null || steps === 0) return null;
        definitionId = "encoder";
        options = {
          encoder_from_variable: useVariable,
          enc: encoder ?? 1,
          encoder_variable: encoderVariable ?? 1,
          dir: ma2RotateDirection,
          steps: Math.abs(steps),
        };
        const directionLabel = ma2RotateDirection === "-1" ? "CCW" : "CW";
        command = useVariable
          ? `Encoder ${encoderVariable} Rotate ${directionLabel} x${Math.abs(steps)}`
          : `Encoder ${encoder} Rotate ${directionLabel} x${Math.abs(steps)}`;
        summary = useVariable
          ? `Variable encoder ${encoderVariable}, ${directionLabel}, steps ${Math.abs(steps)}`
          : `Encoder ${encoder}, ${directionLabel}, steps ${Math.abs(steps)}`;
      } else if (funcName === "Run Custom Command") {
        const custom = ma2CustomCommand.trim();
        if (!custom) return null;
        definitionId = "command";
        options = {};
        command = custom;
        summary = custom;
      }

      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: command,
        value: "",
        pause: selectedTask?.pause ?? "",
        label: summary ? `GrandMA2: ${funcName} (${summary})` : `GrandMA2: ${funcName}`,
        params: {
          action: "command",
          protocol: "tcp",
          command,
          lineEnd: "crlf",
          definitionId,
          options,
          grandma2Function: funcName,
        },
      };
    }

    if (isGrandMA3Connection && grandMA3FunctionSpec) {
      const nextFieldValues: Record<string, string> = {};
      for (const field of grandMA3FunctionSpec.fields) {
        const raw = (grandMA3FieldValues[field.key] ?? "").trim();
        if (!raw) return null;
        nextFieldValues[field.key] = raw;
      }
      const command = grandMA3FunctionSpec.buildCommand(nextFieldValues).trim();
      if (!command) return null;
      const oscPrefixRaw = String(selectedConnection?.oscPrefix ?? "/cmd").trim();
      const address = oscPrefixRaw
        ? (oscPrefixRaw.startsWith("/") ? oscPrefixRaw : `/${oscPrefixRaw}`)
        : "/cmd";
      const summary = grandMA3FunctionSpec.summary(nextFieldValues).trim();
      const options = grandMA3FunctionSpec.toOptions(nextFieldValues);
      return {
        id: selectedTask?.id ?? createEntityId("task"),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: address,
        value: command,
        pause: selectedTask?.pause ?? "",
        label: summary ? `GrandMA3: ${funcName} (${summary})` : `GrandMA3: ${funcName}`,
        params: {
          action: "osc",
          protocol: "osc",
          address,
          args: [command],
          definitionId: grandMA3FunctionSpec.definitionId,
          options,
          grandma3Command: command,
          grandma3Fields: nextFieldValues,
        },
      };
    }

    return {
      id: selectedTask?.id ?? createEntityId("task"),
      connection: conn,
      connectionId: selectedConnection?.id,
      mode: resolvedMode,
      category,
      funcName,
      input,
      value,
      pause: selectedTask?.pause ?? "",
    };
  };



  const buildTasksWithSelectedDraftApplied = (): TaskEntry[] => {
    if (!isWorkspace || !selectedTaskId) return tasks;
    const draftTask = buildDraftTask();
    if (!draftTask) return tasks;
    return tasks.map((task) => (
      task.id === selectedTaskId
        ? { ...draftTask, id: selectedTaskId, pause: task.pause, enabled: task.enabled ?? draftTask.enabled ?? true }
        : task
    ));
  };

  const handleCompanionSatelliteTest = async () => {
    const page = parsePositiveIntegerValue(companionSatellitePage) ?? 1;
    const row = parseNonNegativeIntegerValue(companionSatelliteRow) ?? 0;
    const column = parseNonNegativeIntegerValue(companionSatelliteColumn) ?? 0;
    const eventType = companionSatelliteEventType === "release"
      ? "release"
      : (companionSatelliteEventType === "rotate_left" || companionSatelliteEventType === "rotate_right")
        ? companionSatelliteEventType
        : "press";
    const eventPath = eventType === "release"
      ? "up"
      : eventType === "rotate_left"
        ? "rotate-left"
        : eventType === "rotate_right"
          ? "rotate-right"
          : "press";
    const path = `/api/location/${page}/${row}/${column}/${eventPath}`;
    const host = String(selectedConnection?.ip ?? "").trim();
    const portParsed = Number.parseInt(String(selectedConnection?.port ?? "16622"), 10);
    const port = Number.isFinite(portParsed) && portParsed > 0 ? portParsed : 16622;

    if (!host) {
      setCompanionSatelliteTestResult("Set target IP/Hostname in connection first.");
      return;
    }
    if (!isTauri()) {
      setCompanionSatelliteTestResult("Test Trigger works in Tauri app runtime.");
      return;
    }

    setCompanionSatelliteTesting(true);
    setCompanionSatelliteTestResult("");
    try {
      await tauriInvoke<string>("send_protocol", {
        input: {
          protocol: "http",
          host,
          port,
          address: path,
          payload: "{}",
        },
      });
      setCompanionSatelliteTestResult(`Triggered: P${page} ${row}/${column} ${eventType}`);
    } catch (error) {
      setCompanionSatelliteTestResult(
        error instanceof Error ? error.message : "Failed to trigger Satellite event.",
      );
    } finally {
      setCompanionSatelliteTesting(false);
    }
  };

  const handleSave = () => {
    const nextTasks = buildTasksWithSelectedDraftApplied();
    if (nextTasks !== tasks) {
      setTasks(nextTasks);
    }
    onSave(nextTasks);
  };
  const handleApplyAndClose = () => {
    const nextTasks = buildTasksWithSelectedDraftApplied();
    if (nextTasks !== tasks) {
      setTasks(nextTasks);
    }
    onSave(nextTasks);
    onClose();
  };

  const handleWorkspaceAdd = () => {
    const draftTask = buildDraftTask();
    if (!draftTask) return;
    const nextTask: TaskEntry = {
      ...draftTask,
      id: createEntityId("task"),
      pause: "",
      enabled: draftTask.enabled ?? true,
    };
    setTasks((prev) => [...prev, nextTask]);
    onSelectionChange?.(nextTask.id);
  };

  const handleWorkspaceEdit = () => {
    if (!selectedTaskId) return;
    const draftTask = buildDraftTask();
    if (!draftTask) return;
    setTasks((prev) => prev.map((task) => (
      task.id === selectedTaskId
        ? { ...draftTask, id: selectedTaskId, enabled: task.enabled ?? draftTask.enabled ?? true }
        : task
    )));
  };

  const handleWorkspaceDelete = () => {
    if (!selectedTaskId) return;
    setTasks((prev) => prev.filter((task) => task.id !== selectedTaskId));
  };

  const canAdd = !isWorkspace && Boolean(buildDraftTask());
  const canBuildWorkspaceTask = Boolean(buildDraftTask());
  const canUpdateWorkspaceTask = Boolean(selectedTaskId && canBuildWorkspaceTask);
  const canDeleteWorkspaceTask = Boolean(selectedTaskId);

  useEffect(() => {
    if (!isWorkspace || !onWorkspaceActionsChange) return;
    onWorkspaceActionsChange({
      canAdd: canBuildWorkspaceTask,
      canUpdate: canUpdateWorkspaceTask,
      canDelete: canDeleteWorkspaceTask,
      canTest: canBuildWorkspaceTask,
      testing,
      testMessage,
      add: handleWorkspaceAdd,
      update: handleWorkspaceEdit,
      remove: handleWorkspaceDelete,
      test: handleTest,
    });
    return () => onWorkspaceActionsChange(null);
  }, [
    canBuildWorkspaceTask,
    canDeleteWorkspaceTask,
    canUpdateWorkspaceTask,
    handleWorkspaceAdd,
    handleWorkspaceDelete,
    handleWorkspaceEdit,
    handleTest,
    isWorkspace,
    onWorkspaceActionsChange,
    testMessage,
    testing,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        backgroundColor: isWorkspace ? P.surface900 : t.bgContent,
        zIndex:          20,
        fontFamily:      "'JetBrains Mono', monospace",
      }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-center border-b"
        style={{
          height:          isWorkspace ? 30 : 26,
          backgroundColor: isWorkspace ? P.surface700 : P.surface800,
          borderColor:     P.surface700,
          fontSize:        14,
          color:           P.text50,
        }}
      >
        {title ?? (isWorkspace ? "Edit Task" : "Add Task")}
      </div>

      {/* ── SCROLLABLE BODY ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto app-scrollbar">

        {/* Form fields */}
        <div className="flex flex-col" style={{ padding: "12px 14px", gap: 12 }}>

          <Field label="Connection">
            <SelectField
              value={conn}
              options={connectionOptions}
              onChange={handleConn}
              placeholder="Select a connection"
            />
          </Field>

          {conn ? (
            <div className="flex flex-col" style={{ gap: 6 }}>
              <div style={{ fontSize: 12, color: PURPLE_ACCENT_TEXT, paddingLeft: 2 }}>
                {isWaitCommand
                  ? "Wait Sequence Step"
                  : (isVmixConnection
                    ? "vMix Shortcut Builder"
                    : (isRossTalkConnection
                      ? "RossTalk Task Builder"
                    : (isRossXpressionConnection
                      ? "XPression Template Builder"
                      : (isResolumeConnection
                        ? "Resolume Sequence Control"
                        : (manualBuilderSupported
                          ? "Task Configuration"
                          : "Task Arguments")))))}
              </div>
              <div
                className="flex flex-col"
                style={{
                  gap: 12,
                  padding: 12,
                  backgroundColor: P.surface900,
                  border: `0.5px solid ${P.surface700}`,
                  borderRadius: 4,
                }}
              >

              {isWaitCommand ? (
            <>
              <Field label="Function">
                <input
                  readOnly
                  style={{ ...INPUT_STYLE, color: P.muted500 }}
                  value="Wait"
                />
              </Field>
              <Field label="Milliseconds">
                <input
                  style={INPUT_STYLE}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder="500"
                />
              </Field>
            </>
          ) : null}

          {isVmixConnection ? (
            <>
              <Field label="vMix Function">
                <div className="relative" style={{ width: "100%" }}>
                  <select
                    className="appearance-none w-full outline-none cursor-pointer"
                    style={{ ...INPUT_STYLE, paddingRight: 24 }}
                    value={vmixFunctionName}
                    onChange={(e) => handleVmixFunction(e.target.value)}
                  >
                    <option value="">
                      {vmixCatalogReady ? "Choose a function" : "Loading vMix functions..."}
                    </option>
                    {vmixCategories.map(cat => (
                       <optgroup key={cat} label={cat} style={{ backgroundColor: P.ink950, color: P.muted500 }}>
                         {getVmixFunctionsForCategory(vmixCatalog, cat).map(fn => (
                           <option key={fn.name} value={fn.name} style={{ backgroundColor: P.ink950, color: P.text50 }}>
                             {fn.name}
                           </option>
                         ))}
                       </optgroup>
                    ))}
                  </select>
                  {/* Chevron */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                    className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ right: 4 }}>
                    <path d="M4 6L8 10L12 6" stroke="#364153"
                      strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333"/>
                  </svg>
                </div>
              </Field>

              {selectedVmixFunction?.paramKeys.map((key) => (
                <Field key={key} label={key}>
                  <input
                    style={INPUT_STYLE}
                    value={vmixArgs[key] ?? ""}
                    onChange={e => handleVmixArgChange(key, e.target.value)}
                    placeholder={key}
                  />
                </Field>
              ))}
            </>
          ) : null}

          {!isWaitCommand && manualBuilderSupported ? (
            <>
              {isResolumeConnection ? (
                <>
                  <Field label="Resolume Action">
                    <SelectField
                      value={funcName}
                      options={resolumeActionOptions}
                      onChange={handleResolumeAction}
                      placeholder="Select an action"
                    />
                  </Field>
                </>
              ) : isAtemConnection ? (
                <>
                  <Field label="ATEM Action">
                    <SelectField
                      value={funcName}
                      options={atemActionOptions}
                      onChange={(nextFuncName) => {
                        setFuncName(nextFuncName);
                        const match = Object.entries(cat.categories).find(([, functions]) => functions.includes(nextFuncName));
                        setCategory(match?.[0] ?? "");
                      }}
                      placeholder="Select an action"
                    />
                  </Field>
                </>
              ) : isX32Connection ? (
                <>
                  <Field label="X32/M32 Category">
                    <SelectField
                      value={category}
                      options={catOpts}
                      onChange={(nextCategory) => {
                        const nextFunc = cat.categories[nextCategory]?.[0] ?? "";
                        setCategory(nextCategory);
                        setFuncName(nextFunc);
                      }}
                      placeholder="Select a category"
                    />
                  </Field>
                  <Field label="X32/M32 Action">
                    <SelectField
                      value={funcName}
                      options={funcOpts}
                      onChange={(next) => setFuncName(next)}
                      placeholder="Select an action"
                    />
                  </Field>
                </>
              ) : isRossXpressionConnection ? (
                <Field label="Function">
                  <SelectField
                    value={funcName}
                    options={xpressionFunctionOptions}
                    onChange={handleRossXpressionFunction}
                    placeholder="Select a function"
                  />
                </Field>
              ) : isRossTalkConnection ? (
                <div className="flex flex-col" style={{ gap: 6 }}>
                  <Field label="Function">
                    <SelectField
                      value={funcName}
                      options={rossTalkOrderedFunctionOptions}
                      onChange={handleRossTalkFunction}
                      placeholder="Select a function"
                    />
                  </Field>
                </div>
              ) : isObsConnection ? (
                <Field label="Function">
                  <SelectField
                    value={funcName}
                    options={obsFunctionOptions}
                    onChange={(next) => {
                      setFuncName(next);
                      const match = Object.entries(cat.categories).find(([, functions]) => functions.includes(next));
                      setCategory(match?.[0] ?? category);
                    }}
                    placeholder="Select function"
                  />
                </Field>
              ) : (
                <Field label="Function">
                  <SelectField
                    value={funcName}
                    options={genericFunctionOptions}
                    onChange={(next) => {
                      setFuncName(next);
                      const match = Object.entries(cat.categories).find(([, functions]) => functions.includes(next));
                      setCategory(match?.[0] ?? category);
                    }}
                    placeholder="Select function"
                  />
                </Field>
              )}

              <div
                className="rounded-sm border"
                style={{
                  borderColor: isRossTalkConnection ? "transparent" : P.surface700,
                  backgroundColor: isRossTalkConnection ? "transparent" : P.surface900,
                  padding: isRossTalkConnection ? 0 : 10,
                }}
              >
                {!isRossTalkConnection ? (
                  <div style={{ fontSize: 12, color: P.text50, marginBottom: 10 }}>
                    {parameterSectionLabel}: {funcName || "Select a function"}
                  </div>
                ) : null}
                <div className="flex flex-col" style={{ gap: 10 }}>
              {isResolumeCompositionChange ? (
                <>
                  <Field label="Action">
                    <SelectField
                      value={resolumeMasterAction}
                      options={resolumeDeltaActionOptions}
                      onChange={(next) =>
                        setResolumeMasterAction(
                          next === "+" || next === "-" || next === "=" ? next : "=",
                        )
                      }
                    />
                  </Field>

                  <Field label={resolumeValueLabel}>
                    <input
                      style={INPUT_STYLE}
                      value={resolumeMasterValue}
                      onChange={(e) => setResolumeMasterValue(e.target.value)}
                      placeholder=""
                    />
                  </Field>
                </>
              ) : isResolumeClipChange ? (
                <>
                  <Field label="Layer">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeLayer}
                      onChange={(e) => setResolumeLayer(e.target.value)}
                      placeholder="1"
                    />
                  </Field>

                  <Field label="Column">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeClip}
                      onChange={(e) => setResolumeClip(e.target.value)}
                      placeholder="1"
                    />
                  </Field>

                  <Field label="Action">
                    <SelectField
                      value={resolumeMasterAction}
                      options={resolumeDeltaActionOptions}
                      onChange={(next) =>
                        setResolumeMasterAction(
                          next === "+" || next === "-" || next === "=" ? next : "=",
                        )
                      }
                    />
                  </Field>

                  <Field label={resolumeValueLabel}>
                    <input
                      style={INPUT_STYLE}
                      value={resolumeMasterValue}
                      onChange={(e) => setResolumeMasterValue(e.target.value)}
                      placeholder=""
                    />
                  </Field>
                </>
              ) : isResolumeClipSelection ? (
                <>
                  <Field label="Layer">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeLayer}
                      onChange={(e) => setResolumeLayer(e.target.value)}
                      placeholder="1"
                    />
                  </Field>

                  <Field label="Column">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeClip}
                      onChange={(e) => setResolumeClip(e.target.value)}
                      placeholder="1"
                    />
                  </Field>
                </>
              ) : isResolumeColumnAction ? (
                <>
                  {isResolumeLayerGroupColumnAction ? (
                    <Field label="Layer Group">
                      <input
                        style={INPUT_STYLE}
                        value={resolumeLayerGroupNumber}
                        onChange={(e) => setResolumeLayerGroupNumber(e.target.value)}
                        placeholder="1"
                      />
                    </Field>
                  ) : null}

                  <Field label="Action">
                    <SelectField
                      value={resolumeColumnAction}
                      options={resolumeColumnActionOptions}
                      onChange={(next) =>
                        setResolumeColumnAction(
                          next === "+" || next === "-" || next === "=" ? next : "=",
                        )
                      }
                    />
                  </Field>

                  <Field label="Value">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeColumnValue}
                      onChange={(e) => setResolumeColumnValue(e.target.value)}
                      placeholder=""
                    />
                  </Field>
                </>
              ) : isResolumeLayerColumnStep ? (
                <Field label="Layer Number">
                  <input
                    style={INPUT_STYLE}
                    value={resolumeLayerNumber}
                    onChange={(e) => setResolumeLayerNumber(e.target.value)}
                    placeholder="1"
                  />
                </Field>
              ) : isResolumeLayerGroupColumnStep ? (
                <>
                  <Field label="Layer Group Number">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeLayerGroupNumber}
                      onChange={(e) => setResolumeLayerGroupNumber(e.target.value)}
                      placeholder="1"
                    />
                  </Field>

                  <Field label="Last Column">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeLastColumn}
                      onChange={(e) => setResolumeLastColumn(e.target.value)}
                      placeholder="4"
                    />
                  </Field>
                </>
              ) : isResolumeToggleActionFunction ? (
                <>
                  <Field label={isResolumeLayerGroupToggleAction ? "Layer Group" : "Layer"}>
                    <input
                      style={INPUT_STYLE}
                      value={isResolumeLayerGroupToggleAction ? resolumeLayerGroupNumber : resolumeLayerNumber}
                      onChange={(e) => {
                        if (isResolumeLayerGroupToggleAction) {
                          setResolumeLayerGroupNumber(e.target.value);
                        } else {
                          setResolumeLayerNumber(e.target.value);
                        }
                      }}
                      placeholder="1"
                    />
                  </Field>

                  <Field label={funcName.includes("Bypass") ? "Bypass" : "Solo"}>
                    <SelectField
                      value={resolumeToggleAction}
                      options={resolumeToggleOptions}
                      onChange={(next) =>
                        setResolumeToggleAction(
                          next === "on" || next === "off" ? next : "toggle",
                        )
                      }
                    />
                  </Field>
                </>
              ) : isResolumeLayerGroupChange ? (
                <>
                  <Field label="Layer Group">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeLayerGroupNumber}
                      onChange={(e) => setResolumeLayerGroupNumber(e.target.value)}
                      placeholder="1"
                    />
                  </Field>

                  <Field label="Action">
                    <SelectField
                      value={resolumeMasterAction}
                      options={resolumeDeltaActionOptions}
                      onChange={(next) =>
                        setResolumeMasterAction(
                          next === "+" || next === "-" || next === "=" ? next : "=",
                        )
                      }
                    />
                  </Field>

                  <Field label={resolumeValueLabel}>
                    <input
                      style={INPUT_STYLE}
                      value={resolumeMasterValue}
                      onChange={(e) => setResolumeMasterValue(e.target.value)}
                      placeholder=""
                    />
                  </Field>
                </>
              ) : isResolumeLayerChange ? (
                <>
                  <Field label="Layer">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeLayerNumber}
                      onChange={(e) => setResolumeLayerNumber(e.target.value)}
                      placeholder="1"
                    />
                  </Field>

                  <Field label="Action">
                    <SelectField
                      value={resolumeMasterAction}
                      options={resolumeDeltaActionOptions}
                      onChange={(next) =>
                        setResolumeMasterAction(
                          next === "+" || next === "-" || next === "=" ? next : "=",
                        )
                      }
                    />
                  </Field>

                  <Field label={resolumeValueLabel}>
                    <input
                      style={INPUT_STYLE}
                      value={resolumeMasterValue}
                      onChange={(e) => setResolumeMasterValue(e.target.value)}
                      placeholder=""
                    />
                  </Field>
                </>
              ) : isResolumeLayerSelect ? (
                <Field label={isResolumeLayerGroupSelectAction ? "Layer Group" : "Layer"}>
                  <input
                    style={INPUT_STYLE}
                    value={isResolumeLayerGroupSelectAction ? resolumeLayerGroupNumber : resolumeLayerNumber}
                    onChange={(e) => {
                      if (isResolumeLayerGroupSelectAction) {
                        setResolumeLayerGroupNumber(e.target.value);
                      } else {
                        setResolumeLayerNumber(e.target.value);
                      }
                    }}
                    placeholder="1"
                  />
                </Field>
              ) : isResolumeLayerClear ? (
                funcName === "Clear All Layers" ? (
                  null
                ) : (
                  <Field label={isResolumeLayerGroupClearAction ? "Layer Group" : "Layer"}>
                    <input
                      style={INPUT_STYLE}
                      value={isResolumeLayerGroupClearAction ? resolumeLayerGroupNumber : resolumeLayerNumber}
                      onChange={(e) => {
                        if (isResolumeLayerGroupClearAction) {
                          setResolumeLayerGroupNumber(e.target.value);
                        } else {
                          setResolumeLayerNumber(e.target.value);
                        }
                      }}
                      placeholder="1"
                    />
                  </Field>
                )
              ) : isResolumeDeckSelect ? (
                <>
                  <Field label="Action">
                    <SelectField
                      value={resolumeDeckAction}
                      options={resolumeColumnActionOptions}
                      onChange={(next) =>
                        setResolumeDeckAction(
                          next === "+" || next === "-" || next === "=" ? next : "=",
                        )
                      }
                    />
                  </Field>

                  <Field label="Value">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeDeckValue}
                      onChange={(e) => setResolumeDeckValue(e.target.value)}
                      placeholder=""
                    />
                  </Field>
                </>
              ) : isResolumeDeckStep ? (
                null
              ) : isResolumeCompositionColumnStep ? (
                null
              ) : isResolumeCustomOsc ? (
                <>
                  <Field label="OSC Address">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeCustomOscAddress}
                      onChange={(e) => setResolumeCustomOscAddress(e.target.value)}
                      placeholder="/composition/..."
                    />
                  </Field>

                  <Field label="Args (JSON or text)">
                    <input
                      style={INPUT_STYLE}
                      value={resolumeCustomOscArgs}
                      onChange={(e) => setResolumeCustomOscArgs(e.target.value)}
                      placeholder='[1, "test"] or 1'
                    />
                  </Field>
                </>
              ) : isRossTalkConnection ? (
                <div
                  className="rounded-sm border px-[10px] py-[10px]"
                  style={{ borderColor: P.surface700, backgroundColor: P.surface900 }}
                >
                  <div style={{ fontSize: 12, color: P.text50, marginBottom: 10 }}>
                    rosstalk: {funcName || "Select a function"}
                  </div>
                  <div className="flex flex-col" style={{ gap: 10 }}>
                    {isRossTalkCustomCommandFunction(funcName) ? (
                      <>
                        <InlineField label="Command">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkCommand}
                            onChange={(e) => setRossTalkCommand(e.target.value)}
                            placeholder="XPT ME:1:PGM IN:20"
                          />
                        </InlineField>
                        <div
                          className="rounded-sm border px-[10px] py-[8px]"
                          style={{
                            borderColor: P.surface700,
                            backgroundColor: P.ink950,
                            marginLeft: 0,
                          }}
                        >
                          <div style={{ fontSize: 11, color: PURPLE_ACCENT_TEXT, marginBottom: 6 }}>
                            RossTalk Custom Command Reference
                          </div>
                          <div
                            className="grid grid-cols-1 gap-[6px] max-h-[170px] overflow-y-auto app-scrollbar pr-[2px]"
                            style={{ fontSize: 10, color: P.text300, lineHeight: 1.45 }}
                          >
                            {ROSS_TALK_CUSTOM_COMMAND_REFERENCE.map((entry) => (
                              <div
                                key={`${entry.command}-${entry.syntax}`}
                                className="rounded-sm border px-[8px] py-[6px]"
                                style={{ borderColor: P.surface700, backgroundColor: P.surface900 }}
                              >
                                <div style={{ color: P.text50, fontSize: 11 }}>{entry.command}</div>
                                <div style={{ color: P.text100, wordBreak: "break-word" }}>{entry.syntax}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : funcName === "Auto Transition" || funcName === "Cut" ? (
                      <InlineField label="MLE">
                        <input
                          style={INPUT_STYLE}
                          value={rossTalkMle}
                          onChange={(e) => setRossTalkMle(e.target.value)}
                          placeholder="ME:1"
                        />
                      </InlineField>
                    ) : funcName === "Change Multiviewer Box" ? (
                      <>
                        <InlineField label="Multiviewer Number">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkMultiviewerNumber}
                            onChange={(e) => setRossTalkMultiviewerNumber(e.target.value)}
                            placeholder="1"
                          />
                        </InlineField>
                        <InlineField label="Box Number">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkBoxNumber}
                            onChange={(e) => setRossTalkBoxNumber(e.target.value)}
                            placeholder="1"
                          />
                        </InlineField>
                        <InlineField label="Source">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkSource}
                            onChange={(e) => setRossTalkSource(e.target.value)}
                            placeholder="IN:5"
                          />
                        </InlineField>
                      </>
                    ) : funcName === "Fire Custom Control" ? (
                      <>
                        <InlineField label="CC Bank">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkCcBank}
                            onChange={(e) => setRossTalkCcBank(e.target.value)}
                            placeholder="1"
                          />
                        </InlineField>
                        <InlineField label="CC Number">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkCcNumber}
                            onChange={(e) => setRossTalkCcNumber(e.target.value)}
                            placeholder="1"
                          />
                        </InlineField>
                      </>
                    ) : funcName === "Load Set" ? (
                      <>
                        <InlineField label="Set name">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkSetName}
                            onChange={(e) => setRossTalkSetName(e.target.value)}
                            placeholder="set1"
                          />
                        </InlineField>
                        <InlineField label="Location (optional)">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkSetLocation}
                            onChange={(e) => setRossTalkSetLocation(e.target.value)}
                            placeholder="USB"
                          />
                        </InlineField>
                      </>
                    ) : funcName === "MEM" ? (
                      <InlineField label="Memory ID">
                        <input
                          style={INPUT_STYLE}
                          value={rossTalkMemoryId}
                          onChange={(e) => setRossTalkMemoryId(e.target.value)}
                          placeholder="1:1"
                        />
                      </InlineField>
                    ) : funcName === "SEQI" ? (
                      <>
                        <InlineField label="take ID">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkTakeId}
                            onChange={(e) => setRossTalkTakeId(e.target.value)}
                            placeholder="0"
                          />
                        </InlineField>
                        <InlineField label="Layer">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkLayer}
                            onChange={(e) => setRossTalkLayer(e.target.value)}
                            placeholder="0"
                          />
                        </InlineField>
                      </>
                    ) : funcName === "SEQO" ? (
                      <InlineField label="take ID">
                        <input
                          style={INPUT_STYLE}
                          value={rossTalkTakeId}
                          onChange={(e) => setRossTalkTakeId(e.target.value)}
                          placeholder="0"
                        />
                      </InlineField>
                    ) : funcName === "Transition Keyer" ? (
                      <>
                        <InlineField label="MLE">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkMle}
                            onChange={(e) => setRossTalkMle(e.target.value)}
                            placeholder="ME:1"
                          />
                        </InlineField>
                        <InlineField label="Keyer">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkKeyer}
                            onChange={(e) => setRossTalkKeyer(e.target.value)}
                            placeholder="1"
                          />
                        </InlineField>
                        <InlineField label="Transition On/Off Air">
                          <SelectField
                            value={rossTalkTransitionOnOff}
                            options={rossTalkTransitionOnOffOptions}
                            onChange={(next) => setRossTalkTransitionOnOff(
                              next === "on" || next === "off" ? next : "toggle",
                            )}
                          />
                        </InlineField>
                        <InlineField label="Transition type">
                          <SelectField
                            value={rossTalkTransitionType}
                            options={rossTalkTransitionTypeOptions}
                            onChange={(next) => setRossTalkTransitionType(
                              next === "AUTO" ? "AUTO" : "CUT",
                            )}
                          />
                        </InlineField>
                      </>
                    ) : funcName === "Trigger GPI" ? (
                      <InlineField label="Number">
                        <input
                          style={INPUT_STYLE}
                          value={rossTalkGpiNumber}
                          onChange={(e) => setRossTalkGpiNumber(e.target.value)}
                          placeholder="1"
                        />
                      </InlineField>
                    ) : funcName === "Trigger GPI by Name" ? (
                      <>
                        <InlineField label="Name">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkGpiName}
                            onChange={(e) => setRossTalkGpiName(e.target.value)}
                            placeholder=""
                          />
                        </InlineField>
                        <InlineField label="Parameter">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkGpiParameter}
                            onChange={(e) => setRossTalkGpiParameter(e.target.value)}
                            placeholder=""
                          />
                        </InlineField>
                      </>
                    ) : funcName === "XPT" ? (
                      <>
                        <InlineField label="Destination">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkXptDestination}
                            onChange={(e) => setRossTalkXptDestination(e.target.value)}
                            placeholder="ME:1:PGM"
                          />
                        </InlineField>
                        <InlineField label="Source">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkXptSource}
                            onChange={(e) => setRossTalkXptSource(e.target.value)}
                            placeholder="IN:20"
                          />
                        </InlineField>
                      </>
                    ) : funcName === "Ultrix Timer" ? (
                      <>
                        <InlineField label="Timer Number">
                          <input
                            style={INPUT_STYLE}
                            value={rossTalkTimerId}
                            onChange={(e) => setRossTalkTimerId(e.target.value)}
                            placeholder="1"
                          />
                        </InlineField>
                        <InlineField label="Action">
                          <SelectField
                            value={rossTalkTimerAction}
                            options={rossTalkTimerActionOptions}
                            onChange={(next) => setRossTalkTimerAction(next || "RUN")}
                          />
                        </InlineField>
                      </>
                    ) : ROSS_TALK_FUNCTIONS_WITHOUT_EXTRA_FIELDS.has(funcName) ? (
                      null
                    ) : (
                      <>
                        <InlineField label="Input">
                          <input
                            style={INPUT_STYLE}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder=""
                          />
                        </InlineField>
                        <InlineField label="Value (if required)">
                          <input
                            style={INPUT_STYLE}
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder=""
                          />
                        </InlineField>
                      </>
                    )}
                  </div>
                </div>
              ) : isRossXpressionConnection ? (
                <>
                  {isRossXpressionCustomCommand ? (
                    <>
                      <Field label="Command">
                        <input
                          style={INPUT_STYLE}
                          value={xpressionCustomCommand}
                          onChange={(e) => setXpressionCustomCommand(e.target.value)}
                          placeholder="TAKE 0000:0000:0"
                        />
                      </Field>
                      <div
                        className="rounded-sm border px-[10px] py-[8px]"
                        style={{
                          borderColor: P.surface700,
                          backgroundColor: P.surface900,
                        }}
                      >
                        <div style={{ fontSize: 11, color: PURPLE_ACCENT_TEXT, marginBottom: 6 }}>
                          Ross XPression Custom Command Reference
                        </div>
                        <div
                          className="grid grid-cols-1 gap-[6px] max-h-[220px] overflow-y-auto app-scrollbar pr-[2px]"
                          style={{ fontSize: 10, color: P.text300, lineHeight: 1.45 }}
                        >
                          {ROSS_XPRESSION_CUSTOM_COMMAND_REFERENCE.map((entry) => (
                            <div
                              key={entry.command + entry.syntax}
                              className="rounded-sm border px-[8px] py-[6px]"
                              style={{ borderColor: P.surface700, backgroundColor: P.ink950 }}
                            >
                              <div style={{ color: P.text50, fontSize: 11 }}>
                                {entry.command}
                              </div>
                              <div style={{ color: P.text100, wordBreak: "break-word" }}>
                                {entry.syntax}
                              </div>
                              {entry.note ? (
                                <div style={{ color: P.muted500 }}>
                                  {entry.note}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 10, color: P.muted500 }}>
                          Tip: for framebuffer-based commands, UI framebuffer `1` maps to RossTalk framebuffer `0`.
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {needsRossXpressionTakeIdField ? (
                        <Field label="Take ID">
                          <input
                            style={INPUT_STYLE}
                            value={xpressionTakeId}
                            onChange={(e) => setXpressionTakeId(e.target.value)}
                            placeholder="0000"
                          />
                        </Field>
                      ) : null}
                      {needsRossXpressionFramebufferField ? (
                        <Field label="Framebuffer (UI index)">
                          <input
                            style={INPUT_STYLE}
                            value={xpressionFramebuffer}
                            onChange={(e) => setXpressionFramebuffer(e.target.value)}
                            placeholder="1"
                          />
                        </Field>
                      ) : null}
                      {needsRossXpressionLayerField ? (
                        <Field label="Layer">
                          <input
                            style={INPUT_STYLE}
                            value={xpressionLayer}
                            onChange={(e) => setXpressionLayer(e.target.value)}
                            placeholder="0"
                          />
                        </Field>
                      ) : null}
                      {isRossXpressionGpi ? (
                        <Field label="GPI">
                          <input
                            style={INPUT_STYLE}
                            value={xpressionGpi}
                            onChange={(e) => setXpressionGpi(e.target.value)}
                            placeholder="0"
                          />
                        </Field>
                      ) : null}
                    </>
                  )}
                </>
              ) : isSwp08Connection ? (
                <>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 11, color: P.muted400 }}>
                      {swp08NamesLoading
                        ? "Loading router names..."
                        : swp08NamesError
                          ? swp08NamesError
                          : "Router names are used for Source name / Destination name actions."}
                    </span>
                    <button
                      type="button"
                      className={`rounded-sm border px-[8px] py-[4px] text-[11px] ${ACTION_HOVER_OUTLINE_CLASS}`}
                      style={{
                        borderColor: P.surface600,
                        backgroundColor: P.ink950,
                        color: P.text100,
                        opacity: swp08NamesLoading ? 0.7 : 1,
                      }}
                      onClick={refreshSwp08Names}
                      disabled={swp08NamesLoading}
                    >
                      {swp08NamesLoading ? "Refreshing..." : "Refresh Names"}
                    </button>
                  </div>
                  {(
                    funcName === "Select Levels"
                    || funcName === "De-Select Levels"
                    || funcName === "Toggle Levels"
                    || funcName === "Set crosspoint"
                    || funcName === "Set crosspoint by name"
                  ) ? (
                    <Field label="Levels">
                      <div className="flex flex-wrap gap-[6px]">
                        {swp08LevelOptions.map((levelOption) => {
                          const levelValue = typeof levelOption === "string" ? levelOption : levelOption.value;
                          const levelLabel = typeof levelOption === "string" ? levelOption : levelOption.label;
                          const checked = swp08Levels.includes(levelValue);
                          return (
                            <button
                              key={levelValue}
                              type="button"
                              className="rounded-sm border px-[8px] py-[4px] text-[11px] transition-colors"
                              style={{
                                borderColor: checked ? "#8E51FF" : P.surface600,
                                backgroundColor: checked ? "rgba(142,81,255,0.2)" : P.ink950,
                                color: P.text50,
                              }}
                              onClick={() => {
                                setSwp08Levels((prev) => {
                                  const hasLevel = prev.includes(levelValue);
                                  if (hasLevel) {
                                    const next = prev.filter((entry) => entry !== levelValue);
                                    return next.length ? next : [levelValue];
                                  }
                                  return [...prev, levelValue];
                                });
                              }}
                            >
                              {levelLabel}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  ) : null}

                  {(
                    funcName === "Select Destination"
                    || funcName === "Select Destination name"
                    || funcName === "Set crosspoint"
                    || funcName === "Set crosspoint by name"
                  ) ? (
                    <Field label={funcName.includes("name") ? "Destination name" : "Destination"}>
                      {funcName.includes("name") ? (
                        <SelectField
                          value={swp08Destination}
                          options={swp08DestinationNameOptions}
                          onChange={(next) => setSwp08Destination(next || "1")}
                          includeEmptyOption={false}
                        />
                      ) : (
                        <input
                          style={INPUT_STYLE}
                          value={swp08Destination}
                          onChange={(e) => setSwp08Destination(e.target.value)}
                          placeholder="1"
                        />
                      )}
                    </Field>
                  ) : null}

                  {(
                    funcName === "Select Source"
                    || funcName === "Select Source name"
                    || funcName === "Route Source to selected Levels and Destination"
                    || funcName === "Route Source name to selected Levels and Destination"
                    || funcName === "Set crosspoint"
                    || funcName === "Set crosspoint by name"
                  ) ? (
                    <Field label={funcName.includes("name") ? "Source name" : "Source"}>
                      {funcName.includes("name") ? (
                        <SelectField
                          value={swp08Source}
                          options={swp08SourceNameOptions}
                          onChange={(next) => setSwp08Source(next || "1")}
                          includeEmptyOption={false}
                        />
                      ) : (
                        <input
                          style={INPUT_STYLE}
                          value={swp08Source}
                          onChange={(e) => setSwp08Source(e.target.value)}
                          placeholder="1"
                        />
                      )}
                    </Field>
                  ) : null}

                  {funcName === "Clear" ? (
                    <>
                      <Field label="Clear">
                        <SelectField
                          value={swp08ClearType}
                          options={SWP08_CLEAR_OPTIONS}
                          onChange={(next) => setSwp08ClearType(next || "all")}
                          includeEmptyOption={false}
                        />
                      </Field>
                      <Field label="Clear enable levels">
                        <BooleanCheckboxField
                          value={swp08ClearEnableLevels}
                          onChange={(next) => setSwp08ClearEnableLevels(next === "false" ? "false" : "true")}
                          label={swp08ClearEnableLevels === "true" ? "Enabled" : "Disabled"}
                        />
                      </Field>
                    </>
                  ) : null}
                </>
              ) : isVideohubConnection ? (
                <>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 11, color: P.muted400 }}>
                      {videohubNamesLoading
                        ? "Loading router labels..."
                        : videohubNamesError
                          ? videohubNamesError
                          : "Router labels are used for Source / Destination / Output dropdowns."}
                    </span>
                    <button
                      type="button"
                      className={`rounded-sm border px-[8px] py-[4px] text-[11px] ${ACTION_HOVER_OUTLINE_CLASS}`}
                      style={{
                        borderColor: P.surface600,
                        backgroundColor: P.ink950,
                        color: P.text100,
                        opacity: videohubNamesLoading ? 0.7 : 1,
                      }}
                      onClick={refreshVideohubNames}
                      disabled={videohubNamesLoading}
                    >
                      {videohubNamesLoading ? "Refreshing..." : "Refresh Labels"}
                    </button>
                  </div>
                  {(
                    funcName === "Lock: Change destination lock state"
                    || funcName === "Lock: Change destination lock state (dynamic)"
                  ) ? (
                    <>
                      <Field label="Output">
                        {funcName.includes("(dynamic)") ? (
                          <input
                            style={INPUT_STYLE}
                            value={videohubOutputDynamic}
                            onChange={(e) => setVideohubOutputDynamic(e.target.value)}
                            placeholder=""
                          />
                        ) : (
                          <SelectField
                            value={videohubOutput}
                            options={videohubDestinationOptions}
                            onChange={(next) => setVideohubOutput(next || "0")}
                            includeEmptyOption={false}
                          />
                        )}
                      </Field>
                      <Field label="Lock State">
                        <SelectField
                          value={funcName.includes("(dynamic)") ? videohubLockStateDynamic : videohubLockState}
                          options={funcName.includes("(dynamic)") ? VIDEOHUB_LOCK_STATE_DYNAMIC_OPTIONS : VIDEOHUB_LOCK_STATE_OPTIONS}
                          onChange={(next) => {
                            if (funcName.includes("(dynamic)")) {
                              setVideohubLockStateDynamic(next || "toggle");
                            } else {
                              setVideohubLockState(next || "T");
                            }
                          }}
                          includeEmptyOption={false}
                        />
                      </Field>
                    </>
                  ) : null}

                  {(
                    funcName === "Video: Return to previous route"
                    || funcName === "Video: Route source to destination"
                    || funcName === "Video: Route source to destination, based on another destination"
                    || funcName === "Video: Select destination"
                    || funcName === "Video: Rename destination"
                  ) ? (
                    <Field label="Destination">
                      <SelectField
                        value={videohubDestination}
                        options={videohubDestinationOptions}
                        onChange={(next) => setVideohubDestination(next || "0")}
                        includeEmptyOption={false}
                      />
                    </Field>
                  ) : null}

                  {(
                    funcName === "Video: Return to previous route (dynamic)"
                    || funcName === "Video: Route source to destination (dynamic)"
                    || funcName === "Video: Route source to destination, based on another destination (dynamic)"
                    || funcName === "Video: Select destination (dynamic)"
                  ) ? (
                    <Field label="Destination">
                      <input
                        style={INPUT_STYLE}
                        value={videohubDestinationDynamic}
                        onChange={(e) => setVideohubDestinationDynamic(e.target.value)}
                        placeholder=""
                      />
                    </Field>
                  ) : null}

                  {(
                    funcName === "Video: Route source to destination"
                    || funcName === "Video: Route source to selected destination"
                    || funcName === "Video: Rename source"
                  ) ? (
                    <Field label="Source">
                      <SelectField
                        value={videohubSource}
                        options={videohubSourceOptions}
                        onChange={(next) => setVideohubSource(next || "0")}
                        includeEmptyOption={false}
                      />
                    </Field>
                  ) : null}

                  {(
                    funcName === "Video: Route source to destination (dynamic)"
                    || funcName === "Video: Route source to selected destination (dynamic)"
                  ) ? (
                    <Field label="Source">
                      <input
                        style={INPUT_STYLE}
                        value={videohubSourceDynamic}
                        onChange={(e) => setVideohubSourceDynamic(e.target.value)}
                        placeholder=""
                      />
                    </Field>
                  ) : null}

                  {funcName === "Video: Route source to destination, based on another destination" ? (
                    <Field label="Source routed to destination">
                      <SelectField
                        value={videohubSourceRoutedDestination}
                        options={videohubDestinationOptions}
                        onChange={(next) => setVideohubSourceRoutedDestination(next || "0")}
                        includeEmptyOption={false}
                      />
                    </Field>
                  ) : null}

                  {funcName === "Video: Route source to destination, based on another destination (dynamic)" ? (
                    <Field label="Source routed to destination">
                      <input
                        style={INPUT_STYLE}
                        value={videohubSourceRoutedDestinationDynamic}
                        onChange={(e) => setVideohubSourceRoutedDestinationDynamic(e.target.value)}
                        placeholder=""
                      />
                    </Field>
                  ) : null}

                  {(funcName === "Video: Rename destination" || funcName === "Video: Rename source") ? (
                    <Field label="Label">
                      <input
                        style={INPUT_STYLE}
                        value={videohubLabel}
                        onChange={(e) => setVideohubLabel(e.target.value)}
                        placeholder=""
                      />
                    </Field>
                  ) : null}

                  {funcName === "Route File: Load file" ? (
                    <Field label="Source File">
                      <input
                        style={INPUT_STYLE}
                        value={videohubSourceFile}
                        onChange={(e) => setVideohubSourceFile(e.target.value)}
                        placeholder="C:\\VideoHub.txt"
                      />
                    </Field>
                  ) : null}

                  {funcName === "Route File: Save file" ? (
                    <Field label="Destination File">
                      <input
                        style={INPUT_STYLE}
                        value={videohubDestinationFile}
                        onChange={(e) => setVideohubDestinationFile(e.target.value)}
                        placeholder="C:\\VideoHub.txt"
                      />
                    </Field>
                  ) : null}

                  {(
                    funcName === "Lock: Change destination lock state"
                    || funcName === "Lock: Change destination lock state (dynamic)"
                    || funcName === "Video: Return to previous route"
                    || funcName === "Video: Return to previous route (dynamic)"
                    || funcName === "Video: Route source to destination"
                    || funcName === "Video: Route source to destination (dynamic)"
                    || funcName === "Video: Route source to destination, based on another destination"
                    || funcName === "Video: Route source to destination, based on another destination (dynamic)"
                    || funcName === "Video: Route source to selected destination"
                    || funcName === "Video: Route source to selected destination (dynamic)"
                    || funcName === "Video: Take queued route"
                  ) ? (
                    <Field label="Ignore Lock">
                      <BooleanCheckboxField
                        value={videohubIgnoreLock}
                        onChange={(next) => setVideohubIgnoreLock(next === "true" ? "true" : "false")}
                        label={videohubIgnoreLock === "true" ? "Enabled" : "Disabled"}
                      />
                    </Field>
                  ) : null}
                </>
              ) : isHttpApiConnection ? (
                <>
                  <Field label={(selectedConnection?.httpBaseUrl ?? "").trim() ? "URI" : "URL"}>
                    <input
                      style={INPUT_STYLE}
                      value={httpRequestUrl}
                      onChange={(e) => setHttpRequestUrl(e.target.value)}
                      placeholder=""
                    />
                  </Field>
                  {funcName !== "GET" ? (
                    <Field label="Body">
                      <textarea
                        style={{
                          ...INPUT_STYLE,
                          minHeight: 70,
                          height: 70,
                          paddingTop: 8,
                          paddingBottom: 8,
                          resize: "vertical",
                        }}
                        value={httpRequestBody}
                        onChange={(e) => setHttpRequestBody(e.target.value)}
                        placeholder="{}"
                      />
                    </Field>
                  ) : null}
                  <Field label="header input(JSON)">
                    <textarea
                      style={{
                        ...INPUT_STYLE,
                        minHeight: 70,
                        height: 70,
                        paddingTop: 8,
                        paddingBottom: 8,
                        resize: "vertical",
                      }}
                      value={httpRequestHeader}
                      onChange={(e) => setHttpRequestHeader(e.target.value)}
                      placeholder=""
                    />
                  </Field>
                  {funcName !== "GET" && funcName !== "DELETE" ? (
                    <Field label="Content Type">
                      <SelectField
                        value={httpRequestContentType}
                        options={GENERIC_HTTP_CONTENT_TYPE_OPTIONS}
                        onChange={(next) => setHttpRequestContentType(next || "application/json")}
                        includeEmptyOption={false}
                      />
                    </Field>
                  ) : null}
                  <Field label="JSON Response Data Variable">
                    <input
                      style={INPUT_STYLE}
                      value={httpRequestJsonResultVariable}
                      onChange={(e) => setHttpRequestJsonResultVariable(e.target.value)}
                      placeholder=""
                    />
                  </Field>
                  <Field label="JSON Stringify Result">
                    <BooleanCheckboxField
                      value={httpRequestResultStringify}
                      onChange={(next) => setHttpRequestResultStringify(next === "false" ? "false" : "true")}
                      label={httpRequestResultStringify === "true" ? "Enabled" : "Disabled"}
                    />
                  </Field>
                  {funcName !== "DELETE" ? (
                    <Field label="Response Status Code Variable">
                      <input
                        style={INPUT_STYLE}
                        value={httpRequestStatusCodeVariable}
                        onChange={(e) => setHttpRequestStatusCodeVariable(e.target.value)}
                        placeholder=""
                      />
                    </Field>
                  ) : null}
                </>
              ) : isGenericOscConnection ? (
                <>
                  <Field label="Path">
                    <input
                      style={INPUT_STYLE}
                      value={genericOscPath}
                      onChange={(e) => setGenericOscPath(e.target.value)}
                      placeholder="/osc/path"
                    />
                  </Field>
                  {funcName === "Send string" ? (
                    <Field label="String">
                      <input
                        style={INPUT_STYLE}
                        value={genericOscString}
                        onChange={(e) => setGenericOscString(e.target.value)}
                        placeholder="text"
                      />
                    </Field>
                  ) : null}
                  {funcName === "Send int" ? (
                    <Field label="Int">
                      <input
                        style={INPUT_STYLE}
                        value={genericOscInt}
                        onChange={(e) => setGenericOscInt(e.target.value)}
                        placeholder="1"
                      />
                    </Field>
                  ) : null}
                  {funcName === "Send float" ? (
                    <Field label="Float">
                      <input
                        style={INPUT_STYLE}
                        value={genericOscFloat}
                        onChange={(e) => setGenericOscFloat(e.target.value)}
                        placeholder="1"
                      />
                    </Field>
                  ) : null}
                  {funcName === "Send boolean" ? (
                    <Field label="Boolean value">
                      <BooleanCheckboxField
                        value={genericOscBoolean}
                        onChange={(next) => setGenericOscBoolean(next === "true" ? "true" : "false")}
                        label={genericOscBoolean === "true" ? "True" : "False"}
                      />
                    </Field>
                  ) : null}
                  {funcName === "Send multiple" ? (
                    <Field label="Arguments">
                      <input
                        style={INPUT_STYLE}
                        value={genericOscArguments}
                        onChange={(e) => setGenericOscArguments(e.target.value)}
                        placeholder={"1 \"Let's go\" 2.5"}
                      />
                    </Field>
                  ) : null}
                  {funcName === "Send blob" ? (
                    <>
                      <Field label="Use hex blob">
                        <BooleanCheckboxField
                          value={genericOscBlobHexSwitch}
                          onChange={(next) => setGenericOscBlobHexSwitch(next === "true" ? "true" : "false")}
                          label={genericOscBlobHexSwitch === "true" ? "Enabled" : "Disabled"}
                        />
                      </Field>
                      {genericOscBlobHexSwitch === "true" ? (
                        <Field label="Blob hex">
                          <input
                            style={INPUT_STYLE}
                            value={genericOscBlobHex}
                            onChange={(e) => setGenericOscBlobHex(e.target.value)}
                            placeholder="0A0B0C"
                          />
                        </Field>
                      ) : (
                        <Field label="Blob (base64/text)">
                          <input
                            style={INPUT_STYLE}
                            value={genericOscBlob}
                            onChange={(e) => setGenericOscBlob(e.target.value)}
                            placeholder=""
                          />
                        </Field>
                      )}
                    </>
                  ) : null}
                  {funcName === "Send midi" ? (
                    <>
                      <Field label="Mode">
                        <SelectField
                          value={genericOscMidiMode}
                          options={GENERIC_OSC_MIDI_MODE_OPTIONS}
                          onChange={setGenericOscMidiMode}
                          includeEmptyOption={false}
                        />
                      </Field>
                      <Field label="Port ID">
                        <input
                          style={INPUT_STYLE}
                          value={genericOscMidiPortId}
                          onChange={(e) => setGenericOscMidiPortId(e.target.value)}
                          placeholder="0"
                        />
                      </Field>
                      <Field label="Channel">
                        <input
                          style={INPUT_STYLE}
                          value={genericOscMidiChannel}
                          onChange={(e) => setGenericOscMidiChannel(e.target.value)}
                          placeholder="1"
                        />
                      </Field>
                      <Field label="Data 1">
                        <input
                          style={INPUT_STYLE}
                          value={genericOscMidiData1}
                          onChange={(e) => setGenericOscMidiData1(e.target.value)}
                          placeholder="69"
                        />
                      </Field>
                      <Field label="Data 2">
                        <input
                          style={INPUT_STYLE}
                          value={genericOscMidiData2}
                          onChange={(e) => setGenericOscMidiData2(e.target.value)}
                          placeholder="100"
                        />
                      </Field>
                      <Field label="Pitch">
                        <input
                          style={INPUT_STYLE}
                          value={genericOscMidiPitch}
                          onChange={(e) => setGenericOscMidiPitch(e.target.value)}
                          placeholder="0"
                        />
                      </Field>
                      <Field label="Raw hex">
                        <input
                          style={INPUT_STYLE}
                          value={genericOscMidiRawHex}
                          onChange={(e) => setGenericOscMidiRawHex(e.target.value)}
                          placeholder="00 90 45 65"
                        />
                      </Field>
                    </>
                  ) : null}
                </>
              ) : isCompanionRemoteConnection ? (
                <>
                  <Field label="Page">
                    <input
                      style={INPUT_STYLE}
                      value={companionSatellitePage}
                      onChange={(e) => setCompanionSatellitePage(e.target.value)}
                      placeholder="1"
                    />
                  </Field>
                  <Field label="Location (row/column)">
                    <div className="grid grid-cols-2 gap-[8px]">
                      <input
                        style={INPUT_STYLE}
                        value={companionSatelliteRow}
                        onChange={(e) => setCompanionSatelliteRow(e.target.value)}
                        placeholder="0"
                      />
                      <input
                        style={INPUT_STYLE}
                        value={companionSatelliteColumn}
                        onChange={(e) => setCompanionSatelliteColumn(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </Field>
                  <Field label="Event Type">
                    <SelectField
                      value={companionSatelliteEventType}
                      options={COMPANION_SATELLITE_EVENT_OPTIONS}
                      onChange={(next) => setCompanionSatelliteEventType(next)}
                    />
                  </Field>
                  <Field label="Request Path">
                    <input
                      style={{ ...INPUT_STYLE, color: P.muted500 }}
                      value={`/api/location/${parsePositiveIntegerValue(companionSatellitePage) ?? 1}/${parseNonNegativeIntegerValue(companionSatelliteRow) ?? 0}/${parseNonNegativeIntegerValue(companionSatelliteColumn) ?? 0}/${companionSatelliteEventType === "release" ? "up" : (companionSatelliteEventType === "rotate_left" ? "rotate-left" : (companionSatelliteEventType === "rotate_right" ? "rotate-right" : "press"))}`}
                      readOnly
                    />
                  </Field>
                  <div className="flex items-center gap-[8px]">
                    <button
                      className={`flex items-center justify-center transition-colors rounded ${ACTION_HOVER_OUTLINE_CLASS}`}
                      style={{
                        height: 30,
                        padding: "0 12px",
                        backgroundColor: companionSatelliteTesting ? P.surface600 : ACTION_UPDATE_BG_SOFT,
                        border: `1px solid ${companionSatelliteTesting ? P.surface700 : ACTION_UPDATE_BORDER}`,
                        color: ACTION_CLOSE_TEXT,
                        fontSize: 12,
                        cursor: companionSatelliteTesting ? "not-allowed" : "pointer",
                      }}
                      disabled={companionSatelliteTesting}
                      onClick={() => { void handleCompanionSatelliteTest(); }}
                    >
                      {companionSatelliteTesting ? "Testing..." : "Test Trigger"}
                    </button>
                    {companionSatelliteTestResult ? (
                      <span style={{ fontSize: 11, color: P.muted500 }}>
                        {companionSatelliteTestResult}
                      </span>
                    ) : null}
                  </div>
                </>
              ) : isGenericTcpUdpConnection ? (
                <>
                  {funcName === "Send Command" ? (
                    <Field label="Command">
                      <input
                        style={INPUT_STYLE}
                        value={genericTcpUdpCommand}
                        onChange={(e) => setGenericTcpUdpCommand(e.target.value)}
                        placeholder=""
                      />
                    </Field>
                  ) : null}
                  {funcName === "Send HEX encoded Command" ? (
                    <Field label="Hex Command">
                      <input
                        style={INPUT_STYLE}
                        value={genericTcpUdpHexCommand}
                        onChange={(e) => setGenericTcpUdpHexCommand(e.target.value)}
                        placeholder=""
                      />
                    </Field>
                  ) : null}
                  <Field label="Command End Character">
                    <SelectField
                      value={genericTcpUdpLineEnd}
                      options={GENERIC_TCP_UDP_LINE_END_OPTIONS}
                      onChange={setGenericTcpUdpLineEnd}
                      includeEmptyOption={false}
                    />
                  </Field>
                </>
              ) : isAtemConnection && atemFunctionSpec ? (
                <>
                  {atemFunctionSpec.fields.map((field) => {
                    if (/^key\d+$/i.test(field.key)) {
                      const numericKey = Number.parseInt(field.key.slice(3), 10);
                      if (Number.isFinite(numericKey) && numericKey >= atemUskCount) {
                        return null;
                      }
                    }
                    const fieldValue = atemFieldValues[field.key] ?? "";
                    if (field.type === "select") {
                      const options = atemResolveFieldOptions(field, atemFunctionSpec);
                      const isBooleanField = isBooleanSelectOptions(options);
                      return (
                        <Field key={field.key} label={field.label}>
                          {isBooleanField ? (
                            <BooleanCheckboxField
                              value={fieldValue}
                              onChange={(next) => setAtemFieldValue(field.key, next)}
                            />
                          ) : (
                            <SelectField
                              value={fieldValue}
                              options={options}
                              onChange={(next) => setAtemFieldValue(field.key, next)}
                              placeholder="Select"
                              includeEmptyOption={false}
                            />
                          )}
                        </Field>
                      );
                    }
                    return (
                      <Field key={field.key} label={field.label}>
                        <input
                          style={INPUT_STYLE}
                          value={fieldValue}
                          onChange={(e) => setAtemFieldValue(field.key, e.target.value)}
                          placeholder={field.placeholder ?? ""}
                        />
                      </Field>
                    );
                  })}
                </>
              ) : isGrandMA2Connection ? (
                <>
                  {funcName === "Button Press/Release" ? (
                    <>
                      <Field label="Button">
                        <SelectField
                          value={ma2ButtonNumber}
                          options={MA2_BUTTON_OPTIONS}
                          onChange={(next) => setMa2ButtonNumber(next)}
                        />
                      </Field>
                      <Field label="Action">
                        <SelectField
                          value={ma2ButtonDirection}
                          options={MA2_DIRECTION_OPTIONS}
                          onChange={(next) => setMa2ButtonDirection(next === "release" ? "release" : "press")}
                        />
                      </Field>
                    </>
                  ) : null}
                  {funcName === "Encoder Press/Release" ? (
                    <>
                      <Field label="Use variable for encoder">
                        <BooleanCheckboxField
                          value={ma2EncoderPressUseVariable}
                          onChange={(next) => setMa2EncoderPressUseVariable(next === "true" ? "true" : "false")}
                          label={ma2EncoderPressUseVariable === "true" ? "Enabled" : "Disabled"}
                        />
                      </Field>
                      {ma2EncoderPressUseVariable === "true" ? (
                        <Field label="Encoder Number (1-8)">
                          <input
                            style={INPUT_STYLE}
                            value={ma2EncoderPressVariable}
                            onChange={(e) => setMa2EncoderPressVariable(e.target.value)}
                            placeholder="1"
                          />
                        </Field>
                      ) : (
                        <Field label="Select Encoder">
                          <SelectField
                            value={ma2EncoderPressNumber}
                            options={MA2_ENCODER_SELECT_OPTIONS}
                            onChange={(next) => setMa2EncoderPressNumber(next)}
                          />
                        </Field>
                      )}
                      <Field label="Direction">
                        <SelectField
                          value={ma2EncoderPressDirection}
                          options={MA2_DOWN_UP_OPTIONS}
                          onChange={(next) => setMa2EncoderPressDirection(next === "false" ? "false" : "true")}
                        />
                      </Field>
                    </>
                  ) : null}
                  {funcName === "Move wheel up/down" ? (
                    <Field label="Steps (+/-)">
                      <input
                        style={INPUT_STYLE}
                        value={ma2WheelSteps}
                        onChange={(e) => setMa2WheelSteps(e.target.value)}
                        placeholder="1"
                      />
                    </Field>
                  ) : null}
                  {funcName === "Rotate Encoder" ? (
                    <>
                      <Field label="Use variable for encoder">
                        <BooleanCheckboxField
                          value={ma2RotateUseVariable}
                          onChange={(next) => setMa2RotateUseVariable(next === "true" ? "true" : "false")}
                          label={ma2RotateUseVariable === "true" ? "Enabled" : "Disabled"}
                        />
                      </Field>
                      {ma2RotateUseVariable === "true" ? (
                        <Field label="Encoder Number (1-8)">
                          <input
                            style={INPUT_STYLE}
                            value={ma2RotateEncoderVariable}
                            onChange={(e) => setMa2RotateEncoderVariable(e.target.value)}
                            placeholder="1"
                          />
                        </Field>
                      ) : (
                        <Field label="Select Encoder">
                          <SelectField
                            value={ma2RotateEncoderNumber}
                            options={MA2_ENCODER_SELECT_OPTIONS}
                            onChange={(next) => setMa2RotateEncoderNumber(next)}
                          />
                        </Field>
                      )}
                      <Field label="Direction">
                        <SelectField
                          value={ma2RotateDirection}
                          options={MA2_ROTATE_DIRECTION_OPTIONS}
                          onChange={(next) => setMa2RotateDirection(next === "-1" ? "-1" : "1")}
                        />
                      </Field>
                      <Field label="Steps (+/-)">
                        <input
                          style={INPUT_STYLE}
                          value={ma2RotateSteps}
                          onChange={(e) => setMa2RotateSteps(e.target.value)}
                          placeholder="1"
                        />
                      </Field>
                    </>
                  ) : null}
                  {funcName === "Run Custom Command" ? (
                    <Field label="Command">
                      <input
                        style={INPUT_STYLE}
                        value={ma2CustomCommand}
                        onChange={(e) => setMa2CustomCommand(e.target.value)}
                        placeholder="Go+ Executor 1.1"
                      />
                    </Field>
                  ) : null}
                </>
              ) : isGrandMA3Connection && grandMA3FunctionSpec ? (
                <>
                  {grandMA3FunctionSpec.fields.map((field) => {
                    const fieldValue = grandMA3FieldValues[field.key] ?? "";
                    if (field.type === "select") {
                      const options = (field.options ?? []).map((option) => ({ value: option, label: option }));
                      const isBooleanField = isBooleanSelectOptions(options);
                      return (
                        <Field key={field.key} label={field.label}>
                          {isBooleanField ? (
                            <BooleanCheckboxField
                              value={fieldValue}
                              onChange={(next) => setGrandMA3FieldValue(field.key, next)}
                            />
                          ) : (
                            <SelectField
                              value={fieldValue}
                              options={options}
                              onChange={(next) => setGrandMA3FieldValue(field.key, next)}
                              placeholder="Select"
                            />
                          )}
                        </Field>
                      );
                    }
                    return (
                      <Field key={field.key} label={field.label}>
                        <input
                          style={INPUT_STYLE}
                          value={fieldValue}
                          onChange={(e) => setGrandMA3FieldValue(field.key, e.target.value)}
                          placeholder={field.placeholder ?? ""}
                        />
                      </Field>
                    );
                  })}
                </>
              ) : isObsConnection && isObsSceneFunction ? (
                <>
                  <Field label="Scene">
                    {obsSceneOptions.length ? (
                      <SelectField
                        value={obsSceneName}
                        options={obsSceneOptions}
                        onChange={setObsSceneName}
                        placeholder={obsCatalogueLoading ? "Loading scenes..." : "Select scene"}
                      />
                    ) : (
                      <input
                        style={INPUT_STYLE}
                        value={obsSceneName}
                        onChange={e => setObsSceneName(e.target.value)}
                        placeholder={obsCatalogueLoading ? "Loading scenes..." : "Scene name"}
                      />
                    )}
                  </Field>

                  {obsCatalogueError ? (
                    <div style={{ fontSize: 11, color: P.muted700, lineHeight: 1.5 }}>
                      OBS scene list unavailable: {obsCatalogueError}
                    </div>
                  ) : null}
                </>
              ) : isObsConnection && obsFunctionSpec ? (
                <>
                  <Field label="Request Type">
                    <input
                      style={{ ...INPUT_STYLE, color: P.muted500 }}
                      value={obsFunctionSpec.requestType}
                      readOnly
                    />
                  </Field>
                  {obsFunctionSpec.parameterKind && obsFunctionSpec.parameterKey ? (
                    <Field label={obsFunctionSpec.parameterLabel || "Parameter"}>
                      {obsCurrentParameterOptions.length ? (
                        <SelectField
                          value={obsCurrentParameterValue}
                          options={obsCurrentParameterOptions}
                          onChange={(next) => setObsParameterValue(obsFunctionSpec.parameterKind!, next)}
                          placeholder={obsCatalogueLoading ? "Loading..." : "Select"}
                        />
                      ) : (
                        <input
                          style={INPUT_STYLE}
                          value={obsCurrentParameterValue}
                          onChange={(e) => setObsParameterValue(obsFunctionSpec.parameterKind!, e.target.value)}
                          placeholder={obsCatalogueLoading ? "Loading..." : ""}
                        />
                      )}
                    </Field>
                  ) : null}
                  {obsFunctionSpec.fields?.map((field) => {
                    const fieldValue = obsFieldValues[field.key] ?? "";
                    const options = resolveObsFieldOptions(field);
                    if (field.type === "select") {
                      const isBooleanField = isBooleanSelectOptions(options);
                      return (
                        <Field key={field.key} label={field.label}>
                          {isBooleanField ? (
                            <BooleanCheckboxField
                              value={fieldValue}
                              onChange={(next) => setObsFieldValue(field.key, next)}
                            />
                          ) : options.length ? (
                            <SelectField
                              value={fieldValue}
                              options={options}
                              onChange={(next) => setObsFieldValue(field.key, next)}
                              placeholder={obsCatalogueLoading ? "Loading..." : "Select"}
                            />
                          ) : (
                            <input
                              style={INPUT_STYLE}
                              value={fieldValue}
                              onChange={(e) => setObsFieldValue(field.key, e.target.value)}
                              placeholder={field.placeholder ?? ""}
                            />
                          )}
                        </Field>
                      );
                    }
                    return (
                      <Field key={field.key} label={field.label}>
                        <input
                          style={INPUT_STYLE}
                          value={fieldValue}
                          onChange={(e) => setObsFieldValue(field.key, e.target.value)}
                          placeholder={field.placeholder ?? ""}
                        />
                      </Field>
                    );
                  })}
                  {obsFunctionSpec.valueLabel ? (
                    <Field label={obsFunctionSpec.valueLabel}>
                      <input
                        style={INPUT_STYLE}
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder=""
                      />
                    </Field>
                  ) : null}
                  {obsFunctionSpec.defaultRequestData ? (
                    <Field label="Request Data">
                      <input
                        style={{ ...INPUT_STYLE, color: P.muted500 }}
                        value={JSON.stringify(obsFunctionSpec.defaultRequestData)}
                        readOnly
                      />
                    </Field>
                  ) : null}
                  {obsCatalogueError && obsFunctionSpec.parameterKind ? (
                    <div style={{ fontSize: 11, color: P.muted700, lineHeight: 1.5 }}>
                      OBS list unavailable: {obsCatalogueError}
                    </div>
                  ) : null}
                </>
              ) : isX32Connection ? (
                <>
                  <Field label="Input">
                    <input
                      style={INPUT_STYLE}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder=""
                    />
                  </Field>

                  <Field label="Value (if required)">
                    <input
                      style={INPUT_STYLE}
                      value={value}
                      onChange={e => setValue(e.target.value)}
                      placeholder=""
                    />
                  </Field>

                  {(
                    funcName === "Channel, AuxIn, FxReturn, Bus, Matrix, Main Stereo, Mono fader"
                    || funcName === "Channel, AuxIn, FxReturn Send level"
                    || funcName === "Bus, Main Stereo, Mono Send level"
                  ) ? (
                    <div
                      className="rounded-sm border px-[10px] py-[8px]"
                      style={{
                        borderColor: P.surface700,
                        backgroundColor: P.surface900,
                        fontSize: 11,
                        color: P.text300,
                        lineHeight: 1.45,
                      }}
                    >
                      If setting a fade duration, running another action for that value cancels the first and runs
                      the new one from the current level. To cancel a fade, run an "Adjust fader level" with offset 0.
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <Field label="Input">
                    <input
                      style={INPUT_STYLE}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder=""
                    />
                  </Field>

                  <Field label="Value (if required)">
                    <input
                      style={INPUT_STYLE}
                      value={value}
                      onChange={e => setValue(e.target.value)}
                      placeholder=""
                    />
                  </Field>
                </>
              )}
                </div>
              </div>
            </>
          ) : null}
          </div>
        </div>
      ) : (
        null
      )}
    </div>

        {/* Help text removed to reduce clutter */}
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex flex-col border-t"
        style={{ borderColor: P.surface700 }}
      >
        {isWorkspace ? (
          <div className="flex items-center justify-between px-[14px] py-[12px]" style={{ backgroundColor: P.surface900 }}>
            <div className="flex items-center gap-[6px]">
              {showWorkspaceTaskActions ? (
                <>
                  <button
                    className={`flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded ${ACTION_HOVER_OUTLINE_CLASS}`}
                    data-haptic="strong"
                    style={{
                      height: PANEL_BUTTON_HEIGHT,
                      padding: "0 14px",
                      backgroundColor: canBuildWorkspaceTask ? ACTION_ADD_BG_SOFT : P.surface600,
                      border: `1px solid ${canBuildWorkspaceTask ? ACTION_ADD_BORDER : "transparent"}`,
                      fontSize: 12,
                      color: canBuildWorkspaceTask ? ACTION_CLOSE_TEXT : P.muted500,
                      cursor: canBuildWorkspaceTask ? "pointer" : "not-allowed",
                    }}
                    disabled={!canBuildWorkspaceTask}
                    onClick={handleWorkspaceAdd}
                  >
                    Add
                  </button>
                  <button
                    className={`flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded ${ACTION_HOVER_OUTLINE_CLASS}`}
                    data-haptic="strong"
                    style={{
                      height: PANEL_BUTTON_HEIGHT,
                      padding: "0 14px",
                      backgroundColor: selectedTaskId && canBuildWorkspaceTask ? ACTION_UPDATE_BG_SOFT : P.surface700,
                      fontSize: 12,
                      color: selectedTaskId && canBuildWorkspaceTask ? ACTION_CLOSE_TEXT : P.muted500,
                      cursor: selectedTaskId && canBuildWorkspaceTask ? "pointer" : "not-allowed",
                      border: `1px solid ${selectedTaskId && canBuildWorkspaceTask ? ACTION_UPDATE_BORDER : "transparent"}`,
                    }}
                    disabled={!selectedTaskId || !canBuildWorkspaceTask}
                    onClick={handleWorkspaceEdit}
                  >
                    Edit
                  </button>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-[6px]">
              <button
                className={`flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded ${ACTION_HOVER_OUTLINE_CLASS}`}
                data-haptic="strong"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  padding: "0 14px",
                  backgroundColor: ACTION_APPLY_BG_SOFT,
                  border: `1px solid ${ACTION_APPLY_BORDER}`,
                  fontSize: 12,
                  color: ACTION_CLOSE_TEXT,
                }}
                onClick={handleSave}
              >
                Apply Changes
              </button>
              <button
                className={`flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded ${ACTION_HOVER_OUTLINE_CLASS}`}
                data-haptic="strong"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  padding: "0 14px",
                  backgroundColor: ACTION_APPLY_CLOSE_BG_SOFT,
                  border: `1px solid ${ACTION_APPLY_CLOSE_BORDER}`,
                  fontSize: 12,
                  color: ACTION_CLOSE_TEXT,
                }}
                onClick={handleApplyAndClose}
              >
                Apply and Close
              </button>
              <button
                className={`flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded ${ACTION_HOVER_OUTLINE_CLASS}`}
                data-haptic="strong"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  padding: "0 14px",
                  backgroundColor: ACTION_CLOSE_BG,
                  border: `1px solid ${ACTION_CLOSE_BORDER}`,
                  fontSize: 12,
                  color: ACTION_CLOSE_TEXT,
                }}
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
        <>
        {/* Row 1 — Cancel  +  Add-to-list */}
        <div className="flex border-b" style={{ borderColor: "#364153" }}>
          {/* Cancel */}
          <button
            className={`flex-1 flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors ${ACTION_HOVER_OUTLINE_CLASS}`}
            data-haptic="strong"
            style={{
              height:          PANEL_BUTTON_HEIGHT,
              backgroundColor: ACTION_CLOSE_BG,
              border:          `1px solid ${ACTION_CLOSE_BORDER}`,
              borderRight:     "1px solid #364153",
              fontSize:        12,
              color:           ACTION_CLOSE_TEXT,
            }}
            onClick={onClose}
          >
            {isWorkspace ? "Back" : "Cancel"}
          </button>

          {/* Add (to list) */}
          <button
            className={`flex-1 flex items-center justify-center transition-colors ${ACTION_HOVER_OUTLINE_CLASS}`}
            data-haptic="strong"
            style={{
              height:          PANEL_BUTTON_HEIGHT,
              backgroundColor: canAdd ? ACTION_ADD_BG_SOFT : "#101828",
              fontSize:        12,
              color:           canAdd ? ACTION_CLOSE_TEXT : P.muted500,
              cursor:          canAdd ? "pointer" : "not-allowed",
              borderLeft:      canAdd ? `1px solid ${ACTION_ADD_BORDER}` : "none",
            }}
            disabled={!canAdd}
            onClick={handleAdd}
            title="Add this task to the list above"
          >
            Add to list
          </button>
          <button
            className={`flex-1 flex items-center justify-center transition-colors ${ACTION_HOVER_OUTLINE_CLASS}`}
            data-haptic="strong"
            style={{
              height:          PANEL_BUTTON_HEIGHT,
              backgroundColor: ACTION_UPDATE_BG_SOFT,
              fontSize:        12,
              color:           ACTION_CLOSE_TEXT,
              cursor:          testing ? "wait" : "pointer",
              borderLeft:      `1px solid ${ACTION_UPDATE_BORDER}`,
            }}
            disabled={testing}
            onClick={handleTest}
            title="Send this task now without saving"
          >
            {testing ? "Testing..." : "Test Action"}
          </button>
        </div>

        {/* Row 2 — Save (prominent) */}
        <button
          className={`flex items-center justify-center transition-colors hover:brightness-110 ${ACTION_HOVER_OUTLINE_CLASS}`}
          data-haptic="strong"
          style={{
            height:          PANEL_BUTTON_HEIGHT,
            backgroundColor: ACTION_APPLY_BG,
            fontSize:        13,
            color:           ACTION_CLOSE_TEXT,
            letterSpacing:   "0.02em",
            cursor:          "pointer",
            border:          `1px solid ${ACTION_APPLY_BORDER}`,
          }}
          onClick={handleSave}
        >
          {isWorkspace ? "Apply to Button" : "Save Changes"}
        </button>
        </>
        )}
        {!isWorkspace && testMessage ? (
          <div className="mt-[6px] text-[11px]" style={{ color: testMessage.toLowerCase().includes("fail") ? "#f87171" : P.muted500 }}>
            {testMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
