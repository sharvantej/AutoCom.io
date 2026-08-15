/**
 * AddTaskPanel — exact Figma design (19-2419)
 * Renders as an absolute overlay inside the 480px right panel.
 * Layout: header | scrollable form + task list | footer
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../context/AppContext';
import { getTaskCatalogue } from '../services/dashboardTasks';
import {
  buildVmixTask,
  getVmixCategories,
  getVmixFunctionByName,
  getVmixFunctionsForCategory,
  loadVmixShortcutCatalog,
  type VmixShortcutCatalog,
  type VmixShortcutFunction,
} from '../services/vmixShortcuts';
import { createEntityId } from '../services/ids';
import type { Connection, TaskEntry } from '../types';
import { isTauri, tauriInvoke } from '../services/tauri';
import { compileDashboardRows } from '../services/dashboardTasks';

// Re-export so callers don't need to know where the type lives
export type { TaskEntry };

type Props = {
  tasks: TaskEntry[];
  connections: Connection[];
  onClose: () => void;
  onSave: (tasks: TaskEntry[]) => void;
  variant?: 'popup' | 'workspace';
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


import { WAIT_CONNECTION_VALUE, WAIT_FUNC_NAME, P } from './add-task-panel/constants';
import { ROSS_XPRESSION_CUSTOM_COMMAND_REFERENCE, isRossXpressionCustomCommandFunction, isRossXpressionGpiFunction, needsRossXpressionTakeId, needsRossXpressionFramebuffer, needsRossXpressionLayer, readRossXpressionToken, parseRossXpressionTakeFramebuffer } from './add-task-panel/rossXpressionHelpers';
import { GRANDMA3_FUNCTION_SPECS } from './add-task-panel/grandma3Specs';
import { asTaskParams, findConnectionForTask, parsePositiveIntegerValue, normalizeOscAddress, parseCompanionOscMultipleArgs, parseHexBytes, buildOscMidiBytes, ensureUniqueTaskIds, selectOptionValue, parseNonNegativeIntegerValue, parseIntegerValue, parseLooseValue } from './add-task-panel/sharedUtils';
import { Field, INPUT_STYLE, PANEL_BUTTON_HEIGHT, PURPLE_ACCENT_TEXT, ACTION_ADD_BG_SOFT, ACTION_ADD_BORDER, ACTION_UPDATE_BG_SOFT, ACTION_UPDATE_BORDER, ACTION_APPLY_BG, ACTION_APPLY_BG_SOFT, ACTION_APPLY_BORDER, ACTION_CLOSE_BG, ACTION_CLOSE_BORDER, ACTION_CLOSE_TEXT, ACTION_HOVER_OUTLINE_CLASS, SelectField, isBooleanSelectOptions, BooleanCheckboxField } from './add-task-panel/fields';
import { SelectOption, GENERIC_TCP_UDP_FUNCTIONS, COMPANION_REMOTE_FUNCTIONS, COMPANION_SATELLITE_EVENT_OPTIONS, GENERIC_HTTP_FUNCTIONS, GENERIC_HTTP_CONTENT_TYPE_OPTIONS, GENERIC_OSC_FUNCTIONS, GENERIC_OSC_MIDI_MODE_OPTIONS, GENERIC_TCP_UDP_LINE_END_OPTIONS } from './add-task-panel/deviceFunctionSets';
import type { SharedFormCtx } from './add-task-panel/deviceRegistry';
import {
  useGrandma2State,
  resetGrandma2Fields,
  hydrateGrandma2,
  buildGrandma2Params,
  Grandma2ParamFields,
} from './add-task-panel/devices/grandma2';
import {
  useAtemState,
  resetAtemFields,
  hydrateAtem,
  buildAtemParams,
  AtemFunctionStep,
  AtemParamFields,
} from './add-task-panel/devices/atem';
import {
  useSwp08State,
  resetSwp08Fields,
  hydrateSwp08,
  buildSwp08Params,
  Swp08ParamFields,
} from './add-task-panel/devices/swp08';
import {
  useVideohubState,
  resetVideohubFields,
  hydrateVideohub,
  buildVideohubParams,
  VideohubParamFields,
} from './add-task-panel/devices/videohub';
import {
  useRossTalkState,
  handleRossTalkFunction,
  resetRossTalkFields,
  hydrateRossTalk,
  buildRossTalkParams,
  RossTalkFunctionStep,
  RossTalkParamFields,
} from './add-task-panel/devices/rossTalk';
import {
  useObsState,
  resetObsFields,
  hydrateObs,
  buildObsSceneParams,
  buildObsFunctionParams,
  ObsFunctionStep,
  ObsParamFields,
} from './add-task-panel/devices/obs';
import {
  useResolumeState,
  resetResolumeFields,
  hydrateResolume,
  buildResolumeParams,
  ResolumeFunctionStep,
  ResolumeParamFields,
} from './add-task-panel/devices/resolume';


export function AddTaskPanel({
  tasks: initialTasks,
  connections,
  onClose,
  onSave,
  variant = 'popup',
  title,
  onDraftChange,
  selectedTaskId = null,
  selectedTask: selectedTaskProp = null,
  onSelectionChange,
  showWorkspaceTaskActions = true,
  onWorkspaceActionsChange,
}: Props) {
  const t = useTheme();
  const isWorkspace = variant === 'workspace';

  // ── Form state ───────────────────────────────────────────────────────────────
  const [conn, setConn] = useState('');
  const [mode, setMode] = useState('');
  const [category, setCategory] = useState('');
  const [funcName, setFuncName] = useState('');
  const [input, setInput] = useState('');
  const [value, setValue] = useState('');
  const [xpressionTakeId, setXpressionTakeId] = useState('0');
  const [xpressionFramebuffer, setXpressionFramebuffer] = useState('1');
  const [xpressionLayer, setXpressionLayer] = useState('0');
  const [xpressionGpi, setXpressionGpi] = useState('0');
  const [xpressionCustomCommand, setXpressionCustomCommand] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [vmixCatalog, setVmixCatalog] = useState<VmixShortcutCatalog | null>(
    null
  );
  const [vmixCatalogReady, setVmixCatalogReady] = useState(false);
  const [vmixCategory, setVmixCategory] = useState('');
  const [vmixFunctionName, setVmixFunctionName] = useState('');
  const [vmixArgs, setVmixArgs] = useState<Record<string, string>>({});
  const [grandMA3FieldValues, setGrandMA3FieldValues] = useState<
    Record<string, string>
  >({});
  const grandma2State = useGrandma2State();
  const [genericTcpUdpCommand, setGenericTcpUdpCommand] = useState('');
  const [genericTcpUdpHexCommand, setGenericTcpUdpHexCommand] = useState('');
  const [genericTcpUdpLineEnd, setGenericTcpUdpLineEnd] = useState('\n');
  const [companionSatellitePage, setCompanionSatellitePage] = useState('1');
  const [companionSatelliteRow, setCompanionSatelliteRow] = useState('0');
  const [companionSatelliteColumn, setCompanionSatelliteColumn] = useState('0');
  const [companionSatelliteEventType, setCompanionSatelliteEventType] =
    useState('press');
  const [companionSatelliteTesting, setCompanionSatelliteTesting] =
    useState(false);
  const [companionSatelliteTestResult, setCompanionSatelliteTestResult] =
    useState('');
  const [httpRequestUrl, setHttpRequestUrl] = useState('');
  const [httpRequestBody, setHttpRequestBody] = useState('{}');
  const [httpRequestHeader, setHttpRequestHeader] = useState('');
  const [httpRequestContentType, setHttpRequestContentType] =
    useState('application/json');
  const [httpRequestJsonResultVariable, setHttpRequestJsonResultVariable] =
    useState('');
  const [httpRequestResultStringify, setHttpRequestResultStringify] = useState<
    'true' | 'false'
  >('true');
  const [httpRequestStatusCodeVariable, setHttpRequestStatusCodeVariable] =
    useState('');
  const [genericOscPath, setGenericOscPath] = useState('/osc/path');
  const [genericOscString, setGenericOscString] = useState('text');
  const [genericOscInt, setGenericOscInt] = useState('1');
  const [genericOscFloat, setGenericOscFloat] = useState('1');
  const [genericOscBoolean, setGenericOscBoolean] = useState<'true' | 'false'>(
    'false'
  );
  const [genericOscArguments, setGenericOscArguments] =
    useState('1 "Let\'s go" 2.5');
  const [genericOscBlob, setGenericOscBlob] = useState('');
  const [genericOscBlobHex, setGenericOscBlobHex] = useState('0A0B0C');
  const [genericOscBlobHexSwitch, setGenericOscBlobHexSwitch] = useState<
    'true' | 'false'
  >('false');
  const [genericOscMidiMode, setGenericOscMidiMode] = useState('noteon');
  const [genericOscMidiPortId, setGenericOscMidiPortId] = useState('0');
  const [genericOscMidiChannel, setGenericOscMidiChannel] = useState('1');
  const [genericOscMidiData1, setGenericOscMidiData1] = useState('69');
  const [genericOscMidiData2, setGenericOscMidiData2] = useState('100');
  const [genericOscMidiPitch, setGenericOscMidiPitch] = useState('0');
  const [genericOscMidiRawHex, setGenericOscMidiRawHex] =
    useState('00 90 45 65');

  // ── Task list state (local — committed on Save/Add) ──────────────────────────
  const [tasks, setTasks] = useState<TaskEntry[]>(initialTasks);
  // Tracks the value we last wrote into `tasks` from the `initialTasks` prop, so the
  // onDraftChange effect below can tell "the parent just pushed this down to us" apart
  // from "the user actually edited something" and avoid echoing it straight back up —
  // otherwise a workspace tasks array recreated on every parent render turns this pair
  // of effects into an infinite parent<->child update loop.
  const lastSyncedTasksRef = useRef<TaskEntry[] | null>(null);

  useEffect(() => {
    const next = ensureUniqueTaskIds(initialTasks);
    lastSyncedTasksRef.current = next;
    setTasks(next);
  }, [initialTasks]);

  useEffect(() => {
    if (tasks === lastSyncedTasksRef.current) return;
    onDraftChange?.(tasks);
  }, [onDraftChange, tasks]);

  // ── Derived options ──────────────────────────────────────────────────────────
  const selectedTask = useMemo(
    () =>
      selectedTaskProp ??
      tasks.find((task) => task.id === selectedTaskId) ??
      null,
    [selectedTaskId, selectedTaskProp, tasks]
  );
  const selectedConnection = useMemo(
    () =>
      connections.find((connection) => connection.name === conn) ??
      (selectedTask
        ? findConnectionForTask(connections, selectedTask)
        : undefined),
    [conn, connections, selectedTask]
  );
  const cat = useMemo(
    () => getTaskCatalogue(conn, connections),
    [conn, connections]
  );
  const sharedCtx: SharedFormCtx = {
    conn,
    selectedConnection,
    connections,
    category,
    setCategory,
    cat,
    funcName,
    setFuncName,
    mode,
    setMode,
    input,
    setInput,
    value,
    setValue,
    isWorkspace,
  };
  const modeOpts = cat.modes;
  const catOpts = Object.keys(cat.categories);
  const funcOpts = category ? (cat.categories[category] ?? []) : [];
  const genericFunctionOptions = useMemo<SelectOption[]>(
    () =>
      Object.entries(cat.categories).flatMap(([, functions]) =>
        functions.map((fn) => ({ value: fn, label: fn }))
      ),
    [cat.categories]
  );
  const xpressionFunctionOptions = useMemo<SelectOption[]>(
    () =>
      Object.entries(cat.categories).flatMap(([, functions]) =>
        functions.map((fn) => ({ value: fn, label: fn }))
      ),
    [cat.categories]
  );
  const selectedDevice = String(selectedConnection?.device ?? '')
    .trim()
    .toLowerCase();
  const isVmixConnection = selectedDevice === 'vmix';
  const isResolumeConnection = selectedDevice === 'resolume';
  const isRossTalkConnection = selectedDevice === 'ross_talk';
  const isRossXpressionConnection = selectedDevice === 'ross_xpression';
  const isAtemConnection = selectedDevice === 'atem';
  const isX32Connection = selectedDevice === 'x32';
  const isObsConnection = selectedDevice === 'obs';
  const isGrandMA2Connection = selectedDevice === 'grandma2';
  const isGrandMA3Connection = selectedDevice === 'grandma3';
  const isSwp08Connection = selectedDevice === 'swp08';
  const isVideohubConnection = selectedDevice === 'videohub';
  const isHttpApiConnection = selectedDevice === 'http_api';
  const isCompanionRemoteConnection = selectedDevice === 'companion_remote';
  const isGenericTcpUdpConnection = selectedDevice === 'generic_tcp';
  const isGenericOscConnection = selectedDevice === 'generic_osc';
  const swp08State = useSwp08State(isSwp08Connection, selectedConnection);
  const videohubState = useVideohubState(
    isVideohubConnection,
    selectedConnection
  );
  const atemState = useAtemState(
    isAtemConnection,
    selectedConnection,
    funcName,
    cat
  );
  const rossTalkState = useRossTalkState(cat);
  const obsState = useObsState(isObsConnection, selectedConnection, funcName, cat);
  const resolumeState = useResolumeState();
  const grandMA3FunctionSpec = isGrandMA3Connection
    ? (GRANDMA3_FUNCTION_SPECS[funcName] ?? null)
    : null;
  const parameterSectionLabel = isRossTalkConnection
    ? 'rosstalk'
    : isRossXpressionConnection
      ? 'xpression'
      : isResolumeConnection
        ? 'resolume'
        : isX32Connection
          ? 'x32'
          : isGrandMA3Connection
            ? 'grandma3'
            : isVmixConnection
              ? 'vmix'
              : selectedDevice
                ? selectedDevice.replace(/_/g, ' ')
                : 'parameters';
  const isRossXpressionCustomCommand =
    isRossXpressionConnection && isRossXpressionCustomCommandFunction(funcName);
  const isRossXpressionGpi =
    isRossXpressionConnection && isRossXpressionGpiFunction(funcName);
  const needsRossXpressionTakeIdField =
    isRossXpressionConnection && needsRossXpressionTakeId(funcName);
  const needsRossXpressionFramebufferField =
    isRossXpressionConnection && needsRossXpressionFramebuffer(funcName);
  const needsRossXpressionLayerField =
    isRossXpressionConnection && needsRossXpressionLayer(funcName);
  const isWaitCommand = conn === WAIT_CONNECTION_VALUE;
  const activeConnections = useMemo(
    () => connections.filter((connection) => connection.active !== false),
    [connections]
  );
  const connectionOptions = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = [];
    if (isWorkspace)
      options.push({ value: WAIT_CONNECTION_VALUE, label: 'Internal' });
    if (activeConnections.length) {
      options.push(
        ...activeConnections.map((connection) => ({
          value: connection.name,
          label: connection.name,
        }))
      );
    }
    if (conn && conn !== WAIT_CONNECTION_VALUE) {
      const selectedConnection = connections.find(
        (connection) => connection.name === conn
      );
      if (selectedConnection && selectedConnection.active === false) {
        options.push({
          value: selectedConnection.name,
          label: `${selectedConnection.name} (Disabled)`,
        });
      }
    } else if (!isWorkspace) {
      options.push('No connections');
    }
    return options;
  }, [activeConnections, conn, connections, isWorkspace]);
  const manualBuilderSupported =
    Boolean(selectedConnection) && !isVmixConnection;
  const vmixCategories = useMemo(
    () => getVmixCategories(vmixCatalog),
    [vmixCatalog]
  );
  const selectedVmixFunction = useMemo<VmixShortcutFunction | null>(
    () => getVmixFunctionByName(vmixCatalog, vmixFunctionName),
    [vmixCatalog, vmixFunctionName]
  );
  const missingVmixParams = useMemo(
    () =>
      selectedVmixFunction?.paramKeys.filter(
        (key) => !(vmixArgs[key] ?? '').trim()
      ) ?? [],
    [selectedVmixFunction, vmixArgs]
  );
  // Reset child selects when parent changes
  const handleConn = (v: string) => {
    const nextConnection = connections.find(
      (connection) => connection.name === v
    );
    const nextDevice = String(nextConnection?.device ?? '')
      .trim()
      .toLowerCase();
    const nextCatalogue = getTaskCatalogue(v, connections);
    const defaultCategory = Object.keys(nextCatalogue.categories)[0] ?? '';
    const defaultFunction = defaultCategory
      ? (nextCatalogue.categories[defaultCategory]?.[0] ?? '')
      : '';

    setConn(v);
    if (v === WAIT_CONNECTION_VALUE) {
      setMode('Direct');
      setCategory('Timing');
      setFuncName(WAIT_FUNC_NAME);
      setInput('');
      setValue('500');
      resetObsFields(obsState);
      resetAtemFields(atemState);
      setXpressionTakeId('0');
      setXpressionFramebuffer('1');
      setXpressionLayer('0');
      setXpressionGpi('0');
      setXpressionCustomCommand('');
      setGrandMA3FieldValues({});
      resetGrandma2Fields(grandma2State);
      setGenericTcpUdpCommand('');
      setGenericTcpUdpHexCommand('');
      setGenericTcpUdpLineEnd('\n');
      setCompanionSatellitePage('1');
      setCompanionSatelliteRow('0');
      setCompanionSatelliteColumn('0');
      setCompanionSatelliteEventType('press');
      setCompanionSatelliteTestResult('');
      resetSwp08Fields(swp08State);
      resetVideohubFields(videohubState);
      setHttpRequestUrl('');
      setHttpRequestBody('{}');
      setHttpRequestHeader('');
      setHttpRequestContentType('application/json');
      setHttpRequestJsonResultVariable('');
      setHttpRequestResultStringify('true');
      setHttpRequestStatusCodeVariable('');
      setGenericOscPath('/osc/path');
      setGenericOscString('text');
      setGenericOscInt('1');
      setGenericOscFloat('1');
      setGenericOscBoolean('false');
      setGenericOscArguments('1 "Let\'s go" 2.5');
      setGenericOscBlob('');
      setGenericOscBlobHex('0A0B0C');
      setGenericOscBlobHexSwitch('false');
      setGenericOscMidiMode('noteon');
      setGenericOscMidiPortId('0');
      setGenericOscMidiChannel('1');
      setGenericOscMidiData1('69');
      setGenericOscMidiData2('100');
      setGenericOscMidiPitch('0');
      setGenericOscMidiRawHex('00 90 45 65');
      return;
    }
    if (nextDevice === 'ross_xpression' || nextDevice === 'ross_talk') {
      setMode('Direct');
      setCategory(defaultCategory);
      setFuncName(defaultFunction);
    } else {
      setMode(selectOptionValue(nextCatalogue.modes[0]) || 'Direct');
      setCategory(defaultCategory);
      setFuncName(defaultFunction);
    }
    resetResolumeFields(resolumeState);
    setXpressionTakeId('0');
    setXpressionFramebuffer('1');
    setXpressionLayer('0');
    setXpressionGpi('0');
    setXpressionCustomCommand('');
    resetRossTalkFields(rossTalkState);
    resetObsFields(obsState);
    resetAtemFields(atemState);
    setGrandMA3FieldValues({});
    resetGrandma2Fields(grandma2State);
    setGenericTcpUdpCommand('');
    setGenericTcpUdpHexCommand('');
    setGenericTcpUdpLineEnd('\n');
    setCompanionSatellitePage('1');
    setCompanionSatelliteRow('0');
    setCompanionSatelliteColumn('0');
    setCompanionSatelliteEventType('press');
    setCompanionSatelliteTestResult('');
    resetSwp08Fields(swp08State);
    resetVideohubFields(videohubState);
    setHttpRequestUrl('');
    setHttpRequestBody('{}');
    setHttpRequestHeader('');
    setHttpRequestContentType('application/json');
    setHttpRequestJsonResultVariable('');
    setHttpRequestResultStringify('true');
    setHttpRequestStatusCodeVariable('');
    setGenericOscPath('/osc/path');
    setGenericOscString('text');
    setGenericOscInt('1');
    setGenericOscFloat('1');
    setGenericOscBoolean('false');
    setGenericOscArguments('1 "Let\'s go" 2.5');
    setGenericOscBlob('');
    setGenericOscBlobHex('0A0B0C');
    setGenericOscBlobHexSwitch('false');
    setGenericOscMidiMode('noteon');
    setGenericOscMidiPortId('0');
    setGenericOscMidiChannel('1');
    setGenericOscMidiData1('69');
    setGenericOscMidiData2('100');
    setGenericOscMidiPitch('0');
    setGenericOscMidiRawHex('00 90 45 65');
  };
  const handleRossXpressionFunction = (nextFuncName: string) => {
    setMode('Direct');
    setFuncName(nextFuncName);
    const match = Object.entries(cat.categories).find(([, functions]) =>
      functions.includes(nextFuncName)
    );
    setCategory(match?.[0] ?? 'XPression');
  };
  const setGrandMA3FieldValue = (key: string, nextValue: string) => {
    setGrandMA3FieldValues((prev) => ({ ...prev, [key]: nextValue }));
  };
  useEffect(() => {
    if (!isGrandMA3Connection) {
      setGrandMA3FieldValues({});
      return;
    }
    const fields = grandMA3FunctionSpec?.fields ?? [];
    setGrandMA3FieldValues((prev) => {
      const next: Record<string, string> = {};
      for (const field of fields) {
        const existing = prev[field.key] ?? '';
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
      setVmixCategory('');
      setVmixFunctionName('');
      setVmixArgs({});
      return;
    }

    if (!vmixCatalog) return;

    const nextCategory = vmixCategories.includes(vmixCategory)
      ? vmixCategory
      : (vmixCategories[0] ?? '');
    const nextFunctions = getVmixFunctionsForCategory(
      vmixCatalog,
      nextCategory
    );
    const nextFunction = nextFunctions.some(
      (shortcut) => shortcut.name === vmixFunctionName
    )
      ? vmixFunctionName
      : '';

    if (nextCategory !== vmixCategory) {
      setVmixCategory(nextCategory);
    }
    if (nextFunction !== vmixFunctionName) {
      setVmixFunctionName(nextFunction);
    }
  }, [
    isVmixConnection,
    vmixCatalog,
    vmixCategories,
    vmixCategory,
    vmixFunctionName,
  ]);

  useEffect(() => {
    if (!selectedVmixFunction) {
      setVmixArgs({});
      return;
    }

    setVmixArgs((prev) => {
      const next: Record<string, string> = {};
      for (const key of selectedVmixFunction.paramKeys) {
        next[key] = prev[key] ?? '';
      }
      return next;
    });
  }, [selectedVmixFunction]);

  useEffect(() => {
    if (!isRossXpressionConnection) return;
    if (funcName.trim()) return;
    const first = xpressionFunctionOptions[0];
    const firstValue = selectOptionValue(first);
    if (!firstValue) return;
    handleRossXpressionFunction(firstValue);
  }, [
    funcName,
    handleRossXpressionFunction,
    isRossXpressionConnection,
    xpressionFunctionOptions,
  ]);

  useEffect(() => {
    if (!isRossTalkConnection) return;
    if (funcName.trim()) return;
    const first = rossTalkState.rossTalkFunctionOptions[0];
    const firstValue = selectOptionValue(first);
    if (!firstValue) return;
    handleRossTalkFunction(firstValue, sharedCtx);
  }, [
    funcName,
    isRossTalkConnection,
    rossTalkState.rossTalkFunctionOptions,
    sharedCtx,
  ]);

  useEffect(() => {
    if (!isWorkspace || !selectedTask) return;

    const params = asTaskParams(selectedTask.params);
    const waitMsFromParams = parsePositiveIntegerValue(params.waitMs);
    const waitTaskSelected =
      params.action === 'wait' || selectedTask.funcName === WAIT_FUNC_NAME;
    if (waitTaskSelected) {
      const waitMs =
        waitMsFromParams ??
        parsePositiveIntegerValue(selectedTask.value) ??
        500;
      setConn(WAIT_CONNECTION_VALUE);
      setMode(selectedTask.mode ?? 'Direct');
      setCategory(selectedTask.category ?? 'Timing');
      setFuncName(selectedTask.funcName ?? WAIT_FUNC_NAME);
      setInput('');
      setValue(String(waitMs));
      return;
    }

    const resolvedConnection = findConnectionForTask(connections, selectedTask);
    const nextConnection =
      resolvedConnection?.name ?? selectedTask.connection ?? '';
    const nextDevice = String(resolvedConnection?.device ?? '')
      .trim()
      .toLowerCase();

    setConn(nextConnection);
    setMode(
      nextDevice === 'ross_xpression' || nextDevice === 'ross_talk'
        ? (selectedTask.mode ?? 'Direct')
        : (selectedTask.mode ?? '')
    );
    setCategory(
      nextDevice === 'ross_xpression'
        ? (selectedTask.category ?? 'XPression')
        : (selectedTask.category ?? '')
    );
    setFuncName(selectedTask.funcName ?? '');
    setInput(selectedTask.input ?? '');
    setValue(selectedTask.value ?? '');
    if (nextDevice !== 'atem') {
      resetAtemFields(atemState);
    }

    if (nextDevice === 'atem') {
      hydrateAtem(atemState, selectedTask, params, sharedCtx);
    } else if (nextDevice === 'obs') {
      hydrateObs(obsState, selectedTask, params);
    } else if (nextDevice === 'companion_remote') {
      const options = asTaskParams(params.options);
      const normalizedFunc = COMPANION_REMOTE_FUNCTIONS.has(
        selectedTask.funcName
      )
        ? selectedTask.funcName
        : 'Button Event';
      const eventTypeRaw = String(
        options.eventType ?? params.eventType ?? selectedTask.value ?? 'press'
      )
        .trim()
        .toLowerCase();
      const normalizedEventType =
        eventTypeRaw === 'release' || eventTypeRaw === 'up'
          ? 'release'
          : eventTypeRaw === 'rotate_left' ||
              eventTypeRaw === 'left' ||
              eventTypeRaw === 'rotateleft' ||
              eventTypeRaw === 'rotate-left'
            ? 'rotate_left'
            : eventTypeRaw === 'rotate_right' ||
                eventTypeRaw === 'right' ||
                eventTypeRaw === 'rotateright' ||
                eventTypeRaw === 'rotate-right'
              ? 'rotate_right'
              : eventTypeRaw === 'down' || eventTypeRaw === 'press'
                ? 'press'
                : 'press';

      let page = String(params.satellitePage ?? '1');
      let row = '0';
      let column = '0';

      const locationRaw = String(
        options.location ?? params.location ?? selectedTask.input ?? ''
      ).trim();
      const locationParts = locationRaw
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean);
      if (locationParts.length >= 2) {
        row = locationParts[0] ?? row;
        column = locationParts[1] ?? column;
      }

      const pathRaw = String(params.path ?? '').trim();
      const pathMatch = pathRaw.match(
        /^\/api\/location\/(\d+)\/(\d+)\/(\d+)\/([a-z_-]+)$/i
      );
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
    } else if (nextDevice === 'generic_tcp') {
      const options = asTaskParams(params.options);
      const definitionId =
        typeof params.definitionId === 'string'
          ? params.definitionId.trim()
          : '';
      const isHex = definitionId === 'send_hex';
      const normalizedFunc = GENERIC_TCP_UDP_FUNCTIONS.has(
        selectedTask.funcName
      )
        ? selectedTask.funcName
        : isHex
          ? 'Send HEX encoded Command'
          : 'Send Command';
      const command = String(
        (isHex ? options.id_send_hex : options.id_send) ??
          params.command ??
          selectedTask.input ??
          ''
      );
      const lineEnd = String(
        options.id_end ?? params.lineEnd ?? (isHex ? '' : '\n')
      );
      setFuncName(normalizedFunc);
      if (isHex || normalizedFunc === 'Send HEX encoded Command') {
        setGenericTcpUdpHexCommand(command);
      } else {
        setGenericTcpUdpCommand(command);
      }
      setGenericTcpUdpLineEnd(lineEnd);
    } else if (nextDevice === 'swp08') {
      hydrateSwp08(swp08State, selectedTask, params, sharedCtx);
    } else if (nextDevice === 'videohub') {
      hydrateVideohub(videohubState, selectedTask, params, sharedCtx);
    } else if (nextDevice === 'http_api') {
      const options = asTaskParams(params.options);
      const definitionId =
        typeof params.definitionId === 'string'
          ? params.definitionId.trim().toLowerCase()
          : '';
      const methodFromParams =
        typeof params.method === 'string'
          ? params.method.trim().toUpperCase()
          : '';
      const normalizedFunc = GENERIC_HTTP_FUNCTIONS.has(selectedTask.funcName)
        ? selectedTask.funcName
        : GENERIC_HTTP_FUNCTIONS.has(methodFromParams)
          ? methodFromParams
          : GENERIC_HTTP_FUNCTIONS.has(definitionId.toUpperCase())
            ? definitionId.toUpperCase()
            : 'GET';
      const url = String(
        options.url ?? params.path ?? selectedTask.input ?? ''
      );
      const bodyRaw = options.body ?? params.body ?? selectedTask.value ?? '{}';
      const headerRaw = options.header ?? params.headers ?? '';
      const bodyText =
        typeof bodyRaw === 'string' ? bodyRaw : JSON.stringify(bodyRaw);
      const headerText =
        typeof headerRaw === 'string' ? headerRaw : JSON.stringify(headerRaw);
      const contentTypeFromOptions = String(options.contenttype ?? '').trim();
      const contentTypeFromHeaders = (() => {
        if (
          !headerRaw ||
          typeof headerRaw !== 'object' ||
          Array.isArray(headerRaw)
        )
          return '';
        const headers = headerRaw as Record<string, unknown>;
        const candidate =
          (typeof headers['Content-Type'] === 'string'
            ? headers['Content-Type']
            : '') ||
          (typeof headers['content-type'] === 'string'
            ? headers['content-type']
            : '');
        return candidate.trim();
      })();
      setFuncName(normalizedFunc);
      setHttpRequestUrl(url);
      setHttpRequestBody(bodyText || '{}');
      setHttpRequestHeader(headerText);
      setHttpRequestContentType(
        contentTypeFromOptions || contentTypeFromHeaders || 'application/json'
      );
      setHttpRequestJsonResultVariable(
        String(options.jsonResultDataVariable ?? '')
      );
      setHttpRequestResultStringify(
        String(options.result_stringify ?? 'true')
          .trim()
          .toLowerCase() === 'false'
          ? 'false'
          : 'true'
      );
      setHttpRequestStatusCodeVariable(
        String(options.statusCodeVariable ?? '')
      );
    } else if (nextDevice === 'generic_osc') {
      const options = asTaskParams(params.options);
      const definitionId =
        typeof params.definitionId === 'string'
          ? params.definitionId.trim()
          : '';
      const normalizedFunc = GENERIC_OSC_FUNCTIONS.has(selectedTask.funcName)
        ? selectedTask.funcName
        : definitionId === 'send_blob'
          ? 'Send blob'
          : definitionId === 'send_boolean'
            ? 'Send boolean'
            : definitionId === 'send_float'
              ? 'Send float'
              : definitionId === 'send_int'
                ? 'Send int'
                : definitionId === 'send_multiple'
                  ? 'Send multiple'
                  : definitionId === 'send_blank'
                    ? 'Send blank'
                    : definitionId === 'send_midi'
                      ? 'Send midi'
                      : definitionId === 'send_string'
                        ? 'Send string'
                        : 'Send blank';
      const address = String(
        options.path ?? params.address ?? selectedTask.input ?? '/osc/path'
      );
      setFuncName(normalizedFunc);
      setGenericOscPath(address.trim() || '/osc/path');
      setGenericOscBlob(String(options.blob ?? ''));
      setGenericOscBlobHex(String(options.blob_hex ?? ''));
      setGenericOscBlobHexSwitch(
        String(options.hexswitch ?? 'false')
          .trim()
          .toLowerCase() === 'true'
          ? 'true'
          : 'false'
      );
      setGenericOscBoolean(
        String(options.value ?? 'false')
          .trim()
          .toLowerCase() === 'true'
          ? 'true'
          : 'false'
      );
      setGenericOscFloat(String(options.float ?? ''));
      setGenericOscInt(String(options.int ?? ''));
      setGenericOscArguments(String(options.arguments ?? ''));
      setGenericOscString(String(options.string ?? ''));
      setGenericOscMidiMode(String(options.mode ?? 'noteon'));
      setGenericOscMidiPortId(String(options.portId ?? '0'));
      setGenericOscMidiChannel(String(options.channel ?? '1'));
      setGenericOscMidiData1(String(options.data1 ?? '69'));
      setGenericOscMidiData2(String(options.data2 ?? '100'));
      setGenericOscMidiPitch(String(options.pitch ?? '0'));
      setGenericOscMidiRawHex(String(options.rawHex ?? '00 90 45 65'));
    } else if (nextDevice === 'grandma2') {
      hydrateGrandma2(grandma2State, selectedTask, params, sharedCtx);
    } else if (nextDevice === 'grandma3') {
      const grandMA3Spec = GRANDMA3_FUNCTION_SPECS[selectedTask.funcName];
      const grandMA3FieldsFromParams = asTaskParams(params.grandma3Fields);
      const grandMA3OptionsFromParams = asTaskParams(params.options);
      const definitionId =
        typeof params.definitionId === 'string'
          ? params.definitionId.trim()
          : '';
      if (grandMA3Spec) {
        const nextValues: Record<string, string> = {};
        const optionToFieldMap: Record<string, string> = {
          atmenu: 'menuItem',
          macro: grandMA3Spec.definitionId.includes('macro')
            ? grandMA3Spec.definitionId.endsWith('_name')
              ? 'name'
              : 'number'
            : '',
          plugin: grandMA3Spec.definitionId.includes('plugin')
            ? grandMA3Spec.definitionId.endsWith('_name')
              ? 'name'
              : 'number'
            : '',
          group: grandMA3Spec.definitionId.includes('group')
            ? grandMA3Spec.definitionId.endsWith('_name')
              ? 'name'
              : 'number'
            : '',
          matrick: grandMA3Spec.definitionId.includes('matrick')
            ? grandMA3Spec.definitionId.endsWith('_name')
              ? 'name'
              : 'number'
            : '',
          quickey: grandMA3Spec.definitionId.includes('quickey')
            ? grandMA3Spec.definitionId.endsWith('_name')
              ? 'name'
              : 'number'
            : '',
          sequence: grandMA3Spec.definitionId.includes('sequence')
            ? grandMA3Spec.definitionId.endsWith('_name')
              ? 'name'
              : 'number'
            : '',
          command: 'command',
          page: 'page',
          current_page: 'current_page',
          button_number: 'button_number',
          button_state: 'button_state',
        };
        for (const field of grandMA3Spec.fields) {
          let fromParams = grandMA3FieldsFromParams[field.key];
          if (
            (fromParams === undefined ||
              fromParams === null ||
              `${fromParams}`.trim() === '') &&
            definitionId === grandMA3Spec.definitionId
          ) {
            const optionKey = Object.entries(optionToFieldMap).find(
              ([, mappedField]) => mappedField === field.key
            )?.[0];
            if (optionKey) {
              fromParams = grandMA3OptionsFromParams[optionKey];
            }
          }
          if (typeof fromParams === 'string' && fromParams.trim()) {
            nextValues[field.key] = fromParams;
          } else if (
            typeof fromParams === 'number' &&
            Number.isFinite(fromParams)
          ) {
            nextValues[field.key] = String(Math.trunc(fromParams));
          } else if (typeof fromParams === 'boolean') {
            nextValues[field.key] = fromParams ? 'true' : 'false';
          } else if (field.defaultValue) {
            nextValues[field.key] = field.defaultValue;
          }
        }
        setGrandMA3FieldValues(nextValues);
      } else {
        setGrandMA3FieldValues({});
      }
    } else if (nextDevice === 'ross_talk') {
      hydrateRossTalk(rossTalkState, selectedTask, params);
      setXpressionTakeId('0');
      setXpressionFramebuffer('1');
      setXpressionLayer('0');
      setXpressionGpi('0');
      setXpressionCustomCommand('');
    } else if (nextDevice === 'ross_xpression') {
      const taskInput = (selectedTask.input ?? '').trim();
      const taskValue = (selectedTask.value ?? '').trim();
      const splitTakeFramebuffer = parseRossXpressionTakeFramebuffer(taskInput);
      const hasTakeId = needsRossXpressionTakeId(selectedTask.funcName);
      const hasFramebuffer = needsRossXpressionFramebuffer(
        selectedTask.funcName
      );
      const hasLayer = needsRossXpressionLayer(selectedTask.funcName);
      const isGpi = isRossXpressionGpiFunction(selectedTask.funcName);
      const isCustomCommand = isRossXpressionCustomCommandFunction(
        selectedTask.funcName
      );

      const takeId =
        readRossXpressionToken(params.takeId) ??
        readRossXpressionToken(params.takeID) ??
        splitTakeFramebuffer?.takeId ??
        (hasTakeId ? readRossXpressionToken(taskInput) : null) ??
        '0';
      const framebuffer =
        readRossXpressionToken(params.framebuffer) ??
        readRossXpressionToken(params.fb) ??
        splitTakeFramebuffer?.framebuffer ??
        (hasFramebuffer && !splitTakeFramebuffer
          ? readRossXpressionToken(taskInput)
          : null) ??
        '1';
      const layer =
        readRossXpressionToken(params.layer) ??
        (hasLayer ? readRossXpressionToken(taskValue) : null) ??
        '0';
      const gpi =
        readRossXpressionToken(params.gpi) ??
        (isGpi ? readRossXpressionToken(taskInput) : null) ??
        '0';
      const command =
        readRossXpressionToken(params.command) ??
        (isCustomCommand
          ? (readRossXpressionToken(taskInput) ??
            readRossXpressionToken(taskValue))
          : null) ??
        '';

      setXpressionTakeId(takeId);
      setXpressionFramebuffer(framebuffer);
      setXpressionLayer(layer);
      setXpressionGpi(gpi);
      setXpressionCustomCommand(command);
    } else {
      setXpressionTakeId('0');
      setXpressionFramebuffer('1');
      setXpressionLayer('0');
      setXpressionGpi('0');
      setXpressionCustomCommand('');
      resetRossTalkFields(rossTalkState);
    }

    if (nextDevice === 'resolume') {
      hydrateResolume(resolumeState, selectedTask, params, nextDevice);
    }

    if (nextDevice === 'vmix') {
      const nextCategory =
        typeof params.vmixCategory === 'string'
          ? params.vmixCategory
          : (selectedTask.category ?? '');
      const nextFunction =
        typeof params.vmixFunction === 'string'
          ? params.vmixFunction
          : (selectedTask.funcName ?? '');
      const rawArgs = asTaskParams(params.vmixArgs);
      const nextArgs = Object.entries(rawArgs).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          if (typeof value === 'string' && value.trim()) acc[key] = value;
          return acc;
        },
        {}
      );
      setVmixCategory(nextCategory);
      setVmixFunctionName(nextFunction);
      setVmixArgs(nextArgs);
    }
  }, [connections, isWorkspace, selectedTask]);

  const resetDraftFields = () => {
    if (isWaitCommand) {
      setMode('Direct');
      setCategory('Timing');
      setFuncName(WAIT_FUNC_NAME);
      setInput('');
      setValue('500');
    } else {
      const defaultCategory = Object.keys(cat.categories)[0] ?? '';
      const defaultFunction = defaultCategory
        ? (cat.categories[defaultCategory]?.[0] ?? '')
        : '';
      setMode('');
      setCategory(defaultCategory);
      setFuncName(defaultFunction);
      setInput('');
      setValue('');
    }
    resetResolumeFields(resolumeState);
    setXpressionTakeId('0');
    setXpressionFramebuffer('1');
    setXpressionLayer('0');
    setXpressionGpi('0');
    setXpressionCustomCommand('');
    resetRossTalkFields(rossTalkState);
    resetObsFields(obsState);
    resetAtemFields(atemState);
    resetSwp08Fields(swp08State);
    setHttpRequestUrl('');
    setHttpRequestBody('{}');
    setHttpRequestHeader('');
    setHttpRequestContentType('application/json');
    setHttpRequestJsonResultVariable('');
    setHttpRequestResultStringify('true');
    setHttpRequestStatusCodeVariable('');
    setGenericOscPath('/osc/path');
    setGenericOscString('text');
    setGenericOscInt('1');
    setGenericOscFloat('1');
    setGenericOscBoolean('false');
    setGenericOscArguments('1 "Let\'s go" 2.5');
    setGenericOscBlob('');
    setGenericOscBlobHex('0A0B0C');
    setGenericOscBlobHexSwitch('false');
    setGenericOscMidiMode('noteon');
    setGenericOscMidiPortId('0');
    setGenericOscMidiChannel('1');
    setGenericOscMidiData1('69');
    setGenericOscMidiData2('100');
    setGenericOscMidiPitch('0');
    setGenericOscMidiRawHex('00 90 45 65');
  };

  const handleAdd = () => {
    const draftTask = buildDraftTask();
    if (!draftTask) return;
    setTasks((prev) => [
      ...prev,
      {
        ...draftTask,
        id: createEntityId('task'),
        pause: '',
        enabled: draftTask.enabled ?? true,
      },
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
      setTestMessage('Fill required fields before testing.');
      return;
    }
    setTesting(true);
    setTestMessage(null);
    try {
      const rows = compileDashboardRows([draftTask], connections);
      const response = await tauriInvoke<{
        status: number;
        body?: { success?: boolean; error?: string };
      }>('api_request', {
        method: 'POST',
        path: '/api/execute',
        body: { rows },
      });
      const ok = response?.status < 400 && response?.body?.success !== false;
      setTestMessage(
        ok ? 'Sent to device.' : (response?.body?.error ?? 'Execution failed.')
      );
    } catch (error) {
      setTestMessage(
        error instanceof Error ? error.message : 'Execution failed.'
      );
    } finally {
      setTesting(false);
    }
  };

  const buildDraftTask = (): TaskEntry | null => {
    if (isWaitCommand) {
      const waitMs =
        parsePositiveIntegerValue(value) ?? parsePositiveIntegerValue(input);
      if (waitMs === null) return null;
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: 'Wait',
        mode: 'Direct',
        category: 'Timing',
        funcName: WAIT_FUNC_NAME,
        input: '',
        value: String(waitMs),
        pause: selectedTask?.pause ?? '',
        label: `Wait ${waitMs} ms`,
        params: {
          action: 'wait',
          waitMs,
        },
      };
    }

    if (isVmixConnection) {
      if (
        !selectedConnection ||
        !selectedVmixFunction ||
        missingVmixParams.length > 0
      ) {
        return null;
      }
      const built = buildVmixTask(
        selectedConnection,
        selectedVmixFunction,
        vmixArgs
      );
      return selectedTask
        ? { ...built, id: selectedTask.id, pause: selectedTask.pause }
        : built;
    }

    if (
      !manualBuilderSupported ||
      conn.trim().length === 0 ||
      funcName.trim().length === 0
    ) {
      return null;
    }
    const resolvedMode = isResolumeConnection
      ? selectOptionValue(modeOpts[0]) || mode || 'osc'
      : isRossXpressionConnection || isRossTalkConnection
        ? 'Direct'
        : mode || selectOptionValue(modeOpts[0]) || 'Direct';

    if (isAtemConnection) {
      const built = buildAtemParams(atemState, sharedCtx);
      if (!built) return null;
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: built.mode ?? resolvedMode,
        category,
        funcName,
        input: built.input ?? input,
        value: built.value ?? value,
        pause: selectedTask?.pause ?? '',
        label: built.label,
        params: built.params,
      };
    }

    if (isResolumeConnection) {
      const built = buildResolumeParams(resolumeState, sharedCtx);
      if (!built) return null;
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: built.mode ?? resolvedMode,
        category,
        funcName,
        input: built.input ?? input,
        value: built.value ?? value,
        pause: selectedTask?.pause ?? '',
        label: built.label,
        params: built.params,
      };
    }

    if (isRossTalkConnection) {
      const built = buildRossTalkParams(rossTalkState, sharedCtx);
      if (!built) return null;
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: built.mode ?? resolvedMode,
        category,
        funcName,
        input: built.input ?? input,
        value: built.value ?? value,
        pause: selectedTask?.pause ?? '',
        label: built.label,
        params: built.params,
      };
    }

    if (isRossXpressionConnection) {
      const takeIdToken = xpressionTakeId.trim() || '0';
      const framebufferToken = xpressionFramebuffer.trim() || '1';
      const layerToken = xpressionLayer.trim() || '0';
      const gpiToken = xpressionGpi.trim() || '0';
      const commandToken =
        xpressionCustomCommand.trim() || input.trim() || value.trim();

      let nextInput = input;
      let nextValue = value;
      let summary = '';

      switch (funcName) {
        case 'Clear framebuffer (CLFB)':
        case 'Load cued items in framebuffer (SWAP)':
        case 'Resume all layers in framebuffer (RESUME)':
          nextInput = framebufferToken;
          nextValue = '';
          summary = `FB ${framebufferToken}`;
          break;
        case 'Clear layer in framebuffer (CLFB)':
        case 'Resume layer in framebuffer (RESUME)':
        case 'Take layer in framebuffer off air (LAYEROFF)':
          nextInput = framebufferToken;
          nextValue = layerToken;
          summary = `FB ${framebufferToken}, L${layerToken}`;
          break;
        case 'Load take item to air on layer (SEQI)':
          nextInput = takeIdToken;
          nextValue = layerToken;
          summary = `Take ${takeIdToken}, L${layerToken}`;
          break;
        case 'Load take item to framebuffer layer (TAKE)':
        case 'Ready item into a framebuffer layer (CUE)':
          nextInput = `${takeIdToken}:${framebufferToken}`;
          nextValue = layerToken;
          summary = `Take ${takeIdToken}, FB ${framebufferToken}, L${layerToken}`;
          break;
        case 'Remove take item from the cued state (UNCUE)':
        case 'Set preview to take item (UPNEXT)':
        case 'Set sequencer focus to take item (FOCUS)':
        case 'Take take item off air (SEQO)':
          nextInput = takeIdToken;
          nextValue = '';
          summary = `Take ${takeIdToken}`;
          break;
        case 'Trigger simulated GPI (GPI)':
          nextInput = gpiToken;
          nextValue = '';
          summary = `GPI ${gpiToken}`;
          break;
        case 'Send a custom command':
          if (!commandToken) return null;
          nextInput = commandToken;
          nextValue = '';
          summary = commandToken;
          break;
        default:
          break;
      }

      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: nextInput,
        value: nextValue,
        pause: selectedTask?.pause ?? '',
        label: summary
          ? `XPression: ${funcName} (${summary})`
          : `XPression: ${funcName}`,
      };
    }

    if (isObsConnection && obsState.isObsSceneFunction) {
      const built = buildObsSceneParams(obsState, sharedCtx);
      if (!built) return null;
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: built.mode ?? resolvedMode,
        category,
        funcName,
        input: built.input ?? input,
        value: built.value ?? value,
        pause: selectedTask?.pause ?? '',
        label: built.label,
        params: built.params,
      };
    }

    if (isObsConnection && obsState.obsFunctionSpec) {
      const built = buildObsFunctionParams(obsState, sharedCtx);
      if (!built) return null;
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: built.mode ?? resolvedMode,
        category,
        funcName,
        input: built.input ?? input,
        value: built.value ?? value,
        pause: selectedTask?.pause ?? '',
        label: built.label,
        params: built.params,
      };
    }

    if (isGenericOscConnection) {
      const path = normalizeOscAddress(genericOscPath);
      if (!path) return null;

      let definitionId = 'send_blank';
      let options: Record<string, unknown> = { path };
      let args: unknown[] = [];
      let labelSuffix = '';

      if (funcName === 'Send string') {
        definitionId = 'send_string';
        options = { path, string: genericOscString };
        args = [genericOscString];
        labelSuffix = genericOscString;
      } else if (funcName === 'Send int') {
        definitionId = 'send_int';
        const intValue = parseIntegerValue(genericOscInt) ?? 0;
        options = { path, int: intValue };
        args = [intValue];
        labelSuffix = String(intValue);
      } else if (funcName === 'Send float') {
        definitionId = 'send_float';
        const floatValue = Number.parseFloat(genericOscFloat);
        const normalized = Number.isFinite(floatValue) ? floatValue : 0;
        options = { path, float: normalized };
        args = [normalized];
        labelSuffix = String(normalized);
      } else if (funcName === 'Send boolean') {
        definitionId = 'send_boolean';
        const boolValue = genericOscBoolean === 'true';
        options = { path, value: boolValue };
        args = [boolValue];
        labelSuffix = boolValue ? 'true' : 'false';
      } else if (funcName === 'Send multiple') {
        definitionId = 'send_multiple';
        const argumentsText = genericOscArguments.trim();
        options = { path, arguments: argumentsText };
        args = parseCompanionOscMultipleArgs(argumentsText);
        labelSuffix = argumentsText;
      } else if (funcName === 'Send blob') {
        definitionId = 'send_blob';
        const useHex = genericOscBlobHexSwitch === 'true';
        const blobText = genericOscBlob.trim();
        const hexText = genericOscBlobHex.trim();
        options = {
          path,
          blob: blobText,
          blob_hex: hexText,
          hexswitch: useHex,
        };
        args = useHex ? [parseHexBytes(hexText)] : blobText ? [blobText] : [];
        labelSuffix = useHex ? hexText : blobText;
      } else if (funcName === 'Send midi') {
        definitionId = 'send_midi';
        const portId = parseNonNegativeIntegerValue(genericOscMidiPortId) ?? 0;
        const channel = parsePositiveIntegerValue(genericOscMidiChannel) ?? 1;
        const data1 = parseNonNegativeIntegerValue(genericOscMidiData1) ?? 69;
        const data2 = parseNonNegativeIntegerValue(genericOscMidiData2) ?? 100;
        const pitch = parseIntegerValue(genericOscMidiPitch) ?? 0;
        const rawHex = genericOscMidiRawHex.trim();
        const mode = genericOscMidiMode.trim().toLowerCase() || 'noteon';
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
        definitionId = 'send_blank';
        options = { path };
        args = [];
      }

      const valuePreview = args.length ? JSON.stringify(args) : '';
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName: funcName || 'Send blank',
        input: path,
        value: valuePreview,
        pause: selectedTask?.pause ?? '',
        label: labelSuffix
          ? `OSC: ${funcName} (${labelSuffix})`
          : `OSC: ${funcName || 'Send blank'} (${path})`,
        params: {
          action: 'osc',
          protocol: 'osc',
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
      const url = httpRequestUrl.trim() || '/';
      const includeBody = method !== 'GET';
      const includeContentType = method !== 'GET' && method !== 'DELETE';
      const includeStatusCodeVariable = method !== 'DELETE';
      const bodyText = httpRequestBody;
      const headerText = httpRequestHeader.trim();
      const protocol =
        String(selectedConnection?.protocol ?? 'http')
          .trim()
          .toLowerCase() || 'http';
      const options: Record<string, unknown> = {
        url,
        ...(includeBody ? { body: bodyText } : {}),
        header: headerText,
        ...(includeContentType ? { contenttype: httpRequestContentType } : {}),
        result_stringify: httpRequestResultStringify === 'true',
      };

      const jsonResultDataVariable = httpRequestJsonResultVariable.trim();
      const statusCodeVariable = httpRequestStatusCodeVariable.trim();
      if (jsonResultDataVariable)
        options.jsonResultDataVariable = jsonResultDataVariable;
      if (includeStatusCodeVariable && statusCodeVariable)
        options.statusCodeVariable = statusCodeVariable;

      const parsedHeaders = headerText
        ? parseLooseValue(headerText)
        : undefined;
      const parsedBody = includeBody ? parseLooseValue(bodyText) : undefined;

      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName: method,
        input: url,
        value: includeBody ? bodyText : '',
        pause: selectedTask?.pause ?? '',
        label: `HTTP: ${method} ${url}`,
        params: {
          action: 'http',
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
      const built = buildSwp08Params(swp08State, sharedCtx);
      if (!built) return null;
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: built.mode ?? resolvedMode,
        category,
        funcName,
        input: built.input ?? input,
        value: built.value ?? value,
        pause: selectedTask?.pause ?? '',
        label: built.label,
        params: built.params,
      };
    }

    if (isVideohubConnection) {
      const built = buildVideohubParams(videohubState, sharedCtx);
      if (!built) return null;
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: built.mode ?? resolvedMode,
        category,
        funcName,
        input: built.input ?? input,
        value: built.value ?? value,
        pause: selectedTask?.pause ?? '',
        label: built.label,
        params: built.params,
      };
    }

    if (isCompanionRemoteConnection) {
      const normalizedFunc = COMPANION_REMOTE_FUNCTIONS.has(funcName)
        ? funcName
        : 'Button Event';
      const page = parsePositiveIntegerValue(companionSatellitePage) ?? 1;
      const row = parseNonNegativeIntegerValue(companionSatelliteRow) ?? 0;
      const column =
        parseNonNegativeIntegerValue(companionSatelliteColumn) ?? 0;
      const eventType =
        companionSatelliteEventType === 'release'
          ? 'release'
          : companionSatelliteEventType === 'rotate_left' ||
              companionSatelliteEventType === 'rotate_right'
            ? companionSatelliteEventType
            : 'press';
      const eventPath =
        eventType === 'release'
          ? 'up'
          : eventType === 'rotate_left'
            ? 'rotate-left'
            : eventType === 'rotate_right'
              ? 'rotate-right'
              : 'press';
      const path = `/api/location/${page}/${row}/${column}/${eventPath}`;
      const eventLabel =
        eventType === 'rotate_left'
          ? 'Rotate Left'
          : eventType === 'rotate_right'
            ? 'Rotate Right'
            : eventType === 'release'
              ? 'Release'
              : 'Press';
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category: 'Satellite',
        funcName: normalizedFunc,
        input: `${page}/${row}/${column}`,
        value: eventType,
        pause: selectedTask?.pause ?? '',
        label: `Satellite: ${eventLabel} P${page} ${row}/${column}`,
        params: {
          action: 'http',
          protocol: 'http',
          method: 'POST',
          path,
          definitionId: 'keyEvent',
          satellitePage: page,
          options: {
            location: `${row}/${column}`,
            eventType,
          },
        },
      };
    }

    if (isGenericTcpUdpConnection) {
      const isHex = funcName === 'Send HEX encoded Command';
      const definitionId = isHex ? 'send_hex' : 'send';
      const command = isHex ? genericTcpUdpHexCommand : genericTcpUdpCommand;
      const lineEnd = genericTcpUdpLineEnd;
      const protocol =
        String(selectedConnection?.protocol ?? 'tcp')
          .trim()
          .toLowerCase() || 'tcp';
      const options = isHex
        ? { id_send_hex: command, id_end: lineEnd }
        : { id_send: command, id_end: lineEnd };
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: command,
        value: '',
        pause: selectedTask?.pause ?? '',
        label: command ? `${funcName} (${command})` : funcName,
        params: {
          action: 'command',
          protocol,
          command,
          lineEnd,
          definitionId,
          options,
        },
      };
    }

    if (isGrandMA2Connection) {
      const built = buildGrandma2Params(grandma2State, sharedCtx);
      if (!built) return null;
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: built.mode ?? resolvedMode,
        category,
        funcName,
        input: built.input ?? input,
        value: built.value ?? value,
        pause: selectedTask?.pause ?? '',
        label: built.label,
        params: built.params,
      };
    }

    if (isGrandMA3Connection && grandMA3FunctionSpec) {
      const nextFieldValues: Record<string, string> = {};
      for (const field of grandMA3FunctionSpec.fields) {
        const raw = (grandMA3FieldValues[field.key] ?? '').trim();
        if (!raw) return null;
        nextFieldValues[field.key] = raw;
      }
      const command = grandMA3FunctionSpec.buildCommand(nextFieldValues).trim();
      if (!command) return null;
      const oscPrefixRaw = String(
        selectedConnection?.oscPrefix ?? '/cmd'
      ).trim();
      const address = oscPrefixRaw
        ? oscPrefixRaw.startsWith('/')
          ? oscPrefixRaw
          : `/${oscPrefixRaw}`
        : '/cmd';
      const summary = grandMA3FunctionSpec.summary(nextFieldValues).trim();
      const options = grandMA3FunctionSpec.toOptions(nextFieldValues);
      return {
        id: selectedTask?.id ?? createEntityId('task'),
        connection: conn,
        connectionId: selectedConnection?.id,
        mode: resolvedMode,
        category,
        funcName,
        input: address,
        value: command,
        pause: selectedTask?.pause ?? '',
        label: summary
          ? `GrandMA3: ${funcName} (${summary})`
          : `GrandMA3: ${funcName}`,
        params: {
          action: 'osc',
          protocol: 'osc',
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
      id: selectedTask?.id ?? createEntityId('task'),
      connection: conn,
      connectionId: selectedConnection?.id,
      mode: resolvedMode,
      category,
      funcName,
      input,
      value,
      pause: selectedTask?.pause ?? '',
    };
  };

  const buildTasksWithSelectedDraftApplied = (): TaskEntry[] => {
    if (!isWorkspace || !selectedTaskId) return tasks;
    const draftTask = buildDraftTask();
    if (!draftTask) return tasks;
    return tasks.map((task) =>
      task.id === selectedTaskId
        ? {
            ...draftTask,
            id: selectedTaskId,
            pause: task.pause,
            enabled: task.enabled ?? draftTask.enabled ?? true,
          }
        : task
    );
  };

  const handleCompanionSatelliteTest = async () => {
    const page = parsePositiveIntegerValue(companionSatellitePage) ?? 1;
    const row = parseNonNegativeIntegerValue(companionSatelliteRow) ?? 0;
    const column = parseNonNegativeIntegerValue(companionSatelliteColumn) ?? 0;
    const eventType =
      companionSatelliteEventType === 'release'
        ? 'release'
        : companionSatelliteEventType === 'rotate_left' ||
            companionSatelliteEventType === 'rotate_right'
          ? companionSatelliteEventType
          : 'press';
    const eventPath =
      eventType === 'release'
        ? 'up'
        : eventType === 'rotate_left'
          ? 'rotate-left'
          : eventType === 'rotate_right'
            ? 'rotate-right'
            : 'press';
    const path = `/api/location/${page}/${row}/${column}/${eventPath}`;
    const host = String(selectedConnection?.ip ?? '').trim();
    const portParsed = Number.parseInt(
      String(selectedConnection?.port ?? '16622'),
      10
    );
    const port =
      Number.isFinite(portParsed) && portParsed > 0 ? portParsed : 16622;

    if (!host) {
      setCompanionSatelliteTestResult(
        'Set target IP/Hostname in connection first.'
      );
      return;
    }
    if (!isTauri()) {
      setCompanionSatelliteTestResult(
        'Test Trigger works in Tauri app runtime.'
      );
      return;
    }

    setCompanionSatelliteTesting(true);
    setCompanionSatelliteTestResult('');
    try {
      await tauriInvoke<string>('send_protocol', {
        input: {
          protocol: 'http',
          host,
          port,
          address: path,
          payload: '{}',
        },
      });
      setCompanionSatelliteTestResult(
        `Triggered: P${page} ${row}/${column} ${eventType}`
      );
    } catch (error) {
      setCompanionSatelliteTestResult(
        error instanceof Error
          ? error.message
          : 'Failed to trigger Satellite event.'
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
      id: createEntityId('task'),
      pause: '',
      enabled: draftTask.enabled ?? true,
    };
    setTasks((prev) => [...prev, nextTask]);
    onSelectionChange?.(nextTask.id);
  };

  const handleWorkspaceEdit = () => {
    if (!selectedTaskId) return;
    const draftTask = buildDraftTask();
    if (!draftTask) return;
    setTasks((prev) =>
      prev.map((task) =>
        task.id === selectedTaskId
          ? {
              ...draftTask,
              id: selectedTaskId,
              enabled: task.enabled ?? draftTask.enabled ?? true,
            }
          : task
      )
    );
  };

  const handleWorkspaceDelete = () => {
    if (!selectedTaskId) return;
    setTasks((prev) => prev.filter((task) => task.id !== selectedTaskId));
  };

  const canAdd = !isWorkspace && Boolean(buildDraftTask());
  const canBuildWorkspaceTask = Boolean(buildDraftTask());
  const canUpdateWorkspaceTask = Boolean(
    selectedTaskId && canBuildWorkspaceTask
  );
  const canDeleteWorkspaceTask = Boolean(selectedTaskId);

  // handleWorkspaceAdd/Edit/Delete/handleTest close over buildDraftTask and other
  // state that changes every render, so they can't be made referentially stable
  // with useCallback without memoizing buildDraftTask itself (impractical — it
  // reads nearly all component state). Routing calls through a ref instead keeps
  // the effect below from depending on their identity, so it only re-fires when
  // the *values* it reports (the can*/testing/testMessage booleans) actually
  // change, rather than on every render — this was causing an infinite
  // onWorkspaceActionsChange -> parent setState -> re-render loop.
  const workspaceHandlersRef = useRef({
    add: handleWorkspaceAdd,
    update: handleWorkspaceEdit,
    remove: handleWorkspaceDelete,
    test: handleTest,
  });
  workspaceHandlersRef.current = {
    add: handleWorkspaceAdd,
    update: handleWorkspaceEdit,
    remove: handleWorkspaceDelete,
    test: handleTest,
  };

  useEffect(() => {
    if (!isWorkspace || !onWorkspaceActionsChange) return;
    onWorkspaceActionsChange({
      canAdd: canBuildWorkspaceTask,
      canUpdate: canUpdateWorkspaceTask,
      canDelete: canDeleteWorkspaceTask,
      canTest: canBuildWorkspaceTask,
      testing,
      testMessage,
      add: () => workspaceHandlersRef.current.add(),
      update: () => workspaceHandlersRef.current.update(),
      remove: () => workspaceHandlersRef.current.remove(),
      test: () => workspaceHandlersRef.current.test(),
    });
    return () => onWorkspaceActionsChange(null);
  }, [
    canBuildWorkspaceTask,
    canDeleteWorkspaceTask,
    canUpdateWorkspaceTask,
    isWorkspace,
    onWorkspaceActionsChange,
    testMessage,
    testing,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className={
        isWorkspace
          ? 'absolute inset-0 flex flex-col overflow-hidden'
          : 'flex flex-col overflow-hidden size-full'
      }
      style={{
        backgroundColor: isWorkspace ? P.surface900 : t.bgContent,
        zIndex: isWorkspace ? 20 : undefined,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div
        className={`shrink-0 flex items-center border-b ${isWorkspace ? '' : 'justify-center'}`}
        style={isWorkspace
          ? {
              height: 30,
              paddingLeft: 12,
              backgroundColor: P.surface700,
              borderColor: P.surface700,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: P.muted500,
            }
          : {
              height: 26,
              backgroundColor: P.surface800,
              borderColor: P.surface700,
              fontSize: 14,
              color: P.text50,
            }
        }
      >
        {title ?? (isWorkspace ? 'Edit Task' : 'Add Task')}
      </div>

      {/* ── SCROLLABLE BODY ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto app-scrollbar">
        {/* Form fields */}
        <div
          className="flex flex-col"
          style={{ padding: '12px 14px', gap: 12 }}
        >
          <Field label="Connection">
            <SelectField
              value={conn}
              options={connectionOptions}
              onChange={handleConn}
              placeholder="Select a connection"
            />
          </Field>

          {selectedDevice ? (
            <div style={{ marginTop: -6, paddingLeft: 2 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  padding: '2px 7px',
                  color:
                    selectedDevice === 'vmix'
                      ? '#86efac'
                      : selectedDevice.includes('atem')
                        ? '#93c5fd'
                        : selectedDevice === 'obs'
                          ? '#fdba74'
                          : selectedDevice === 'resolume'
                            ? '#f9a8d4'
                            : selectedDevice.includes('grandma')
                              ? '#d8b4fe'
                              : selectedDevice.includes('companion')
                                ? '#67e8f9'
                                : selectedDevice.includes('ross')
                                  ? '#fde68a'
                                  : '#94a3b8',
                  backgroundColor:
                    selectedDevice === 'vmix'
                      ? 'rgba(34,197,94,0.1)'
                      : selectedDevice.includes('atem')
                        ? 'rgba(59,130,246,0.1)'
                        : selectedDevice === 'obs'
                          ? 'rgba(249,115,22,0.1)'
                          : selectedDevice === 'resolume'
                            ? 'rgba(236,72,153,0.1)'
                            : selectedDevice.includes('grandma')
                              ? 'rgba(168,85,247,0.1)'
                              : selectedDevice.includes('companion')
                                ? 'rgba(6,182,212,0.1)'
                                : selectedDevice.includes('ross')
                                  ? 'rgba(234,179,8,0.1)'
                                  : 'rgba(148,163,184,0.1)',
                  border: '1px solid currentColor',
                  opacity: 0.8,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    backgroundColor: 'currentColor',
                    flexShrink: 0,
                  }}
                />
                {selectedDevice === 'vmix'
                  ? 'vMix'
                  : selectedDevice.includes('atem')
                    ? 'ATEM'
                    : selectedDevice === 'obs'
                      ? 'OBS'
                      : selectedDevice === 'resolume'
                        ? 'Resolume'
                        : selectedDevice.includes('grandma')
                          ? 'GrandMA'
                          : selectedDevice.includes('companion')
                            ? 'Companion'
                            : selectedDevice === 'ross_talk'
                              ? 'RossTalk'
                              : selectedDevice === 'ross_xpression'
                                ? 'XPression'
                                : selectedDevice.toUpperCase()}
              </span>
            </div>
          ) : null}

          {conn ? (
            <div className="flex flex-col" style={{ gap: 6 }}>
              <div
                style={{
                  fontSize: 12,
                  color: PURPLE_ACCENT_TEXT,
                  paddingLeft: 2,
                }}
              >
                {isWaitCommand
                  ? 'Wait Sequence Step'
                  : isVmixConnection
                    ? 'vMix Shortcut Builder'
                    : isRossTalkConnection
                      ? 'RossTalk Task Builder'
                      : isRossXpressionConnection
                        ? 'XPression Template Builder'
                        : isResolumeConnection
                          ? 'Resolume Sequence Control'
                          : manualBuilderSupported
                            ? 'Task Configuration'
                            : 'Task Arguments'}
              </div>
              <div
                className="flex flex-col"
                style={{
                  gap: 12,
                  padding: 12,
                  backgroundColor: P.surface900,
                  border: `0.5px solid ${P.surface700}`,
                  borderRadius: 0,
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
                      <div className="flex items-center gap-[8px]">
                        <input
                          style={{ ...INPUT_STYLE, flex: 1 }}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder="500"
                        />
                        {value &&
                        Number.isFinite(Number(value)) &&
                        Number(value) > 0 ? (
                          <span
                            style={{
                              fontSize: 11,
                              color: P.muted500,
                              flexShrink: 0,
                              minWidth: 36,
                              textAlign: 'right',
                            }}
                          >
                            ={' '}
                            {(Number(value) / 1000) % 1 === 0
                              ? (Number(value) / 1000).toFixed(0)
                              : (Number(value) / 1000)
                                  .toFixed(2)
                                  .replace(/0+$/, '')}
                            s
                          </span>
                        ) : null}
                      </div>
                    </Field>
                  </>
                ) : null}

                {isVmixConnection ? (
                  <>
                    <Field label="vMix Function">
                      <div className="relative" style={{ width: '100%' }}>
                        <select
                          className="appearance-none w-full outline-none cursor-pointer"
                          style={{ ...INPUT_STYLE, paddingRight: 24 }}
                          value={vmixFunctionName}
                          onChange={(e) => handleVmixFunction(e.target.value)}
                        >
                          <option value="">
                            {vmixCatalogReady
                              ? 'Choose a function'
                              : 'Loading vMix functions...'}
                          </option>
                          {vmixCategories.map((cat) => (
                            <optgroup
                              key={cat}
                              label={cat}
                              style={{
                                backgroundColor: P.ink950,
                                color: P.muted500,
                              }}
                            >
                              {getVmixFunctionsForCategory(
                                vmixCatalog,
                                cat
                              ).map((fn) => (
                                <option
                                  key={fn.name}
                                  value={fn.name}
                                  style={{
                                    backgroundColor: P.ink950,
                                    color: P.text50,
                                  }}
                                >
                                  {fn.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {/* Chevron */}
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ right: 4 }}
                        >
                          <path
                            d="M4 6L8 10L12 6"
                            stroke="#364153"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.33333"
                          />
                        </svg>
                      </div>
                    </Field>

                    {selectedVmixFunction?.paramKeys.map((key) => (
                      <Field key={key} label={key}>
                        <input
                          style={INPUT_STYLE}
                          value={vmixArgs[key] ?? ''}
                          onChange={(e) =>
                            handleVmixArgChange(key, e.target.value)
                          }
                          placeholder={key}
                        />
                      </Field>
                    ))}
                  </>
                ) : null}

                {!isWaitCommand && manualBuilderSupported ? (
                  <>
                    {isResolumeConnection ? (
                      <ResolumeFunctionStep
                        state={resolumeState}
                        ctx={sharedCtx}
                      />
                    ) : isAtemConnection ? (
                      <AtemFunctionStep state={atemState} ctx={sharedCtx} />
                    ) : isX32Connection ? (
                      <>
                        <Field label="X32/M32 Category">
                          <SelectField
                            value={category}
                            options={catOpts}
                            onChange={(nextCategory) => {
                              const nextFunc =
                                cat.categories[nextCategory]?.[0] ?? '';
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
                      <RossTalkFunctionStep
                        state={rossTalkState}
                        ctx={sharedCtx}
                      />
                    ) : isObsConnection ? (
                      <ObsFunctionStep state={obsState} ctx={sharedCtx} />
                    ) : (
                      <Field label="Function">
                        <SelectField
                          value={funcName}
                          options={genericFunctionOptions}
                          onChange={(next) => {
                            setFuncName(next);
                            const match = Object.entries(cat.categories).find(
                              ([, functions]) => functions.includes(next)
                            );
                            setCategory(match?.[0] ?? category);
                          }}
                          placeholder="Select function"
                        />
                      </Field>
                    )}

                    <div
                      className="rounded-none border"
                      style={{
                        borderColor: isRossTalkConnection
                          ? 'transparent'
                          : P.surface700,
                        backgroundColor: isRossTalkConnection
                          ? 'transparent'
                          : P.surface900,
                        padding: isRossTalkConnection ? 0 : 10,
                      }}
                    >
                      {!isRossTalkConnection ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: P.text50,
                            marginBottom: 10,
                          }}
                        >
                          {parameterSectionLabel}:{' '}
                          {funcName || 'Select a function'}
                        </div>
                      ) : null}
                      <div className="flex flex-col" style={{ gap: 10 }}>
                        {isResolumeConnection ? (
                          <ResolumeParamFields
                            state={resolumeState}
                            ctx={sharedCtx}
                          />
                        ) : isRossTalkConnection ? (
                          <RossTalkParamFields state={rossTalkState} ctx={sharedCtx} />
                        ) : isRossXpressionConnection ? (
                          <>
                            {isRossXpressionCustomCommand ? (
                              <>
                                <Field label="Command">
                                  <input
                                    style={INPUT_STYLE}
                                    value={xpressionCustomCommand}
                                    onChange={(e) =>
                                      setXpressionCustomCommand(e.target.value)
                                    }
                                    placeholder="TAKE 0000:0000:0"
                                  />
                                </Field>
                                <div
                                  className="rounded-none border px-[10px] py-[8px]"
                                  style={{
                                    borderColor: P.surface700,
                                    backgroundColor: P.surface900,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: PURPLE_ACCENT_TEXT,
                                      marginBottom: 6,
                                    }}
                                  >
                                    Ross XPression Custom Command Reference
                                  </div>
                                  <div
                                    className="grid grid-cols-1 gap-[6px] max-h-[220px] overflow-y-auto app-scrollbar pr-[2px]"
                                    style={{
                                      fontSize: 10,
                                      color: P.text300,
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    {ROSS_XPRESSION_CUSTOM_COMMAND_REFERENCE.map(
                                      (entry) => (
                                        <div
                                          key={entry.command + entry.syntax}
                                          className="rounded-none border px-[8px] py-[6px]"
                                          style={{
                                            borderColor: P.surface700,
                                            backgroundColor: P.ink950,
                                          }}
                                        >
                                          <div
                                            style={{
                                              color: P.text50,
                                              fontSize: 11,
                                            }}
                                          >
                                            {entry.command}
                                          </div>
                                          <div
                                            style={{
                                              color: P.text100,
                                              wordBreak: 'break-word',
                                            }}
                                          >
                                            {entry.syntax}
                                          </div>
                                          {entry.note ? (
                                            <div style={{ color: P.muted500 }}>
                                              {entry.note}
                                            </div>
                                          ) : null}
                                        </div>
                                      )
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      marginTop: 6,
                                      fontSize: 10,
                                      color: P.muted500,
                                    }}
                                  >
                                    Tip: for framebuffer-based commands, UI
                                    framebuffer `1` maps to RossTalk framebuffer
                                    `0`.
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
                                      onChange={(e) =>
                                        setXpressionTakeId(e.target.value)
                                      }
                                      placeholder="0000"
                                    />
                                  </Field>
                                ) : null}
                                {needsRossXpressionFramebufferField ? (
                                  <Field label="Framebuffer (UI index)">
                                    <input
                                      style={INPUT_STYLE}
                                      value={xpressionFramebuffer}
                                      onChange={(e) =>
                                        setXpressionFramebuffer(e.target.value)
                                      }
                                      placeholder="1"
                                    />
                                  </Field>
                                ) : null}
                                {needsRossXpressionLayerField ? (
                                  <Field label="Layer">
                                    <input
                                      style={INPUT_STYLE}
                                      value={xpressionLayer}
                                      onChange={(e) =>
                                        setXpressionLayer(e.target.value)
                                      }
                                      placeholder="0"
                                    />
                                  </Field>
                                ) : null}
                                {isRossXpressionGpi ? (
                                  <Field label="GPI">
                                    <input
                                      style={INPUT_STYLE}
                                      value={xpressionGpi}
                                      onChange={(e) =>
                                        setXpressionGpi(e.target.value)
                                      }
                                      placeholder="0"
                                    />
                                  </Field>
                                ) : null}
                              </>
                            )}
                          </>
                        ) : isSwp08Connection ? (
                          <Swp08ParamFields state={swp08State} ctx={sharedCtx} />
                        ) : isVideohubConnection ? (
                          <VideohubParamFields
                            state={videohubState}
                            ctx={sharedCtx}
                          />
                        ) : isHttpApiConnection ? (
                          <>
                            <Field
                              label={
                                (selectedConnection?.httpBaseUrl ?? '').trim()
                                  ? 'URI'
                                  : 'URL'
                              }
                            >
                              <input
                                style={INPUT_STYLE}
                                value={httpRequestUrl}
                                onChange={(e) =>
                                  setHttpRequestUrl(e.target.value)
                                }
                                placeholder=""
                              />
                            </Field>
                            {funcName !== 'GET' ? (
                              <Field label="Body">
                                <textarea
                                  style={{
                                    ...INPUT_STYLE,
                                    minHeight: 70,
                                    height: 70,
                                    paddingTop: 8,
                                    paddingBottom: 8,
                                    resize: 'vertical',
                                  }}
                                  value={httpRequestBody}
                                  onChange={(e) =>
                                    setHttpRequestBody(e.target.value)
                                  }
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
                                  resize: 'vertical',
                                }}
                                value={httpRequestHeader}
                                onChange={(e) =>
                                  setHttpRequestHeader(e.target.value)
                                }
                                placeholder=""
                              />
                            </Field>
                            {funcName !== 'GET' && funcName !== 'DELETE' ? (
                              <Field label="Content Type">
                                <SelectField
                                  value={httpRequestContentType}
                                  options={GENERIC_HTTP_CONTENT_TYPE_OPTIONS}
                                  onChange={(next) =>
                                    setHttpRequestContentType(
                                      next || 'application/json'
                                    )
                                  }
                                  includeEmptyOption={false}
                                />
                              </Field>
                            ) : null}
                            <Field label="JSON Response Data Variable">
                              <input
                                style={INPUT_STYLE}
                                value={httpRequestJsonResultVariable}
                                onChange={(e) =>
                                  setHttpRequestJsonResultVariable(
                                    e.target.value
                                  )
                                }
                                placeholder=""
                              />
                            </Field>
                            <Field label="JSON Stringify Result">
                              <BooleanCheckboxField
                                value={httpRequestResultStringify}
                                onChange={(next) =>
                                  setHttpRequestResultStringify(
                                    next === 'false' ? 'false' : 'true'
                                  )
                                }
                                label={
                                  httpRequestResultStringify === 'true'
                                    ? 'Enabled'
                                    : 'Disabled'
                                }
                              />
                            </Field>
                            {funcName !== 'DELETE' ? (
                              <Field label="Response Status Code Variable">
                                <input
                                  style={INPUT_STYLE}
                                  value={httpRequestStatusCodeVariable}
                                  onChange={(e) =>
                                    setHttpRequestStatusCodeVariable(
                                      e.target.value
                                    )
                                  }
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
                                onChange={(e) =>
                                  setGenericOscPath(e.target.value)
                                }
                                placeholder="/osc/path"
                              />
                            </Field>
                            {funcName === 'Send string' ? (
                              <Field label="String">
                                <input
                                  style={INPUT_STYLE}
                                  value={genericOscString}
                                  onChange={(e) =>
                                    setGenericOscString(e.target.value)
                                  }
                                  placeholder="text"
                                />
                              </Field>
                            ) : null}
                            {funcName === 'Send int' ? (
                              <Field label="Int">
                                <input
                                  style={INPUT_STYLE}
                                  value={genericOscInt}
                                  onChange={(e) =>
                                    setGenericOscInt(e.target.value)
                                  }
                                  placeholder="1"
                                />
                              </Field>
                            ) : null}
                            {funcName === 'Send float' ? (
                              <Field label="Float">
                                <input
                                  style={INPUT_STYLE}
                                  value={genericOscFloat}
                                  onChange={(e) =>
                                    setGenericOscFloat(e.target.value)
                                  }
                                  placeholder="1"
                                />
                              </Field>
                            ) : null}
                            {funcName === 'Send boolean' ? (
                              <Field label="Boolean value">
                                <BooleanCheckboxField
                                  value={genericOscBoolean}
                                  onChange={(next) =>
                                    setGenericOscBoolean(
                                      next === 'true' ? 'true' : 'false'
                                    )
                                  }
                                  label={
                                    genericOscBoolean === 'true'
                                      ? 'True'
                                      : 'False'
                                  }
                                />
                              </Field>
                            ) : null}
                            {funcName === 'Send multiple' ? (
                              <Field label="Arguments">
                                <input
                                  style={INPUT_STYLE}
                                  value={genericOscArguments}
                                  onChange={(e) =>
                                    setGenericOscArguments(e.target.value)
                                  }
                                  placeholder={'1 "Let\'s go" 2.5'}
                                />
                              </Field>
                            ) : null}
                            {funcName === 'Send blob' ? (
                              <>
                                <Field label="Use hex blob">
                                  <BooleanCheckboxField
                                    value={genericOscBlobHexSwitch}
                                    onChange={(next) =>
                                      setGenericOscBlobHexSwitch(
                                        next === 'true' ? 'true' : 'false'
                                      )
                                    }
                                    label={
                                      genericOscBlobHexSwitch === 'true'
                                        ? 'Enabled'
                                        : 'Disabled'
                                    }
                                  />
                                </Field>
                                {genericOscBlobHexSwitch === 'true' ? (
                                  <Field label="Blob hex">
                                    <input
                                      style={INPUT_STYLE}
                                      value={genericOscBlobHex}
                                      onChange={(e) =>
                                        setGenericOscBlobHex(e.target.value)
                                      }
                                      placeholder="0A0B0C"
                                    />
                                  </Field>
                                ) : (
                                  <Field label="Blob (base64/text)">
                                    <input
                                      style={INPUT_STYLE}
                                      value={genericOscBlob}
                                      onChange={(e) =>
                                        setGenericOscBlob(e.target.value)
                                      }
                                      placeholder=""
                                    />
                                  </Field>
                                )}
                              </>
                            ) : null}
                            {funcName === 'Send midi' ? (
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
                                    onChange={(e) =>
                                      setGenericOscMidiPortId(e.target.value)
                                    }
                                    placeholder="0"
                                  />
                                </Field>
                                <Field label="Channel">
                                  <input
                                    style={INPUT_STYLE}
                                    value={genericOscMidiChannel}
                                    onChange={(e) =>
                                      setGenericOscMidiChannel(e.target.value)
                                    }
                                    placeholder="1"
                                  />
                                </Field>
                                <Field label="Data 1">
                                  <input
                                    style={INPUT_STYLE}
                                    value={genericOscMidiData1}
                                    onChange={(e) =>
                                      setGenericOscMidiData1(e.target.value)
                                    }
                                    placeholder="69"
                                  />
                                </Field>
                                <Field label="Data 2">
                                  <input
                                    style={INPUT_STYLE}
                                    value={genericOscMidiData2}
                                    onChange={(e) =>
                                      setGenericOscMidiData2(e.target.value)
                                    }
                                    placeholder="100"
                                  />
                                </Field>
                                <Field label="Pitch">
                                  <input
                                    style={INPUT_STYLE}
                                    value={genericOscMidiPitch}
                                    onChange={(e) =>
                                      setGenericOscMidiPitch(e.target.value)
                                    }
                                    placeholder="0"
                                  />
                                </Field>
                                <Field label="Raw hex">
                                  <input
                                    style={INPUT_STYLE}
                                    value={genericOscMidiRawHex}
                                    onChange={(e) =>
                                      setGenericOscMidiRawHex(e.target.value)
                                    }
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
                                onChange={(e) =>
                                  setCompanionSatellitePage(e.target.value)
                                }
                                placeholder="1"
                              />
                            </Field>
                            <Field label="Location (row/column)">
                              <div className="grid grid-cols-2 gap-[8px]">
                                <input
                                  style={INPUT_STYLE}
                                  value={companionSatelliteRow}
                                  onChange={(e) =>
                                    setCompanionSatelliteRow(e.target.value)
                                  }
                                  placeholder="0"
                                />
                                <input
                                  style={INPUT_STYLE}
                                  value={companionSatelliteColumn}
                                  onChange={(e) =>
                                    setCompanionSatelliteColumn(e.target.value)
                                  }
                                  placeholder="0"
                                />
                              </div>
                            </Field>
                            <Field label="Event Type">
                              <SelectField
                                value={companionSatelliteEventType}
                                options={COMPANION_SATELLITE_EVENT_OPTIONS}
                                onChange={(next) =>
                                  setCompanionSatelliteEventType(next)
                                }
                              />
                            </Field>
                            <Field label="Request Path">
                              <input
                                style={{ ...INPUT_STYLE, color: P.muted500 }}
                                value={`/api/location/${parsePositiveIntegerValue(companionSatellitePage) ?? 1}/${parseNonNegativeIntegerValue(companionSatelliteRow) ?? 0}/${parseNonNegativeIntegerValue(companionSatelliteColumn) ?? 0}/${companionSatelliteEventType === 'release' ? 'up' : companionSatelliteEventType === 'rotate_left' ? 'rotate-left' : companionSatelliteEventType === 'rotate_right' ? 'rotate-right' : 'press'}`}
                                readOnly
                              />
                            </Field>
                            <div className="flex items-center gap-[8px]">
                              <button
                                className={`flex items-center justify-center transition-colors rounded-none ${ACTION_HOVER_OUTLINE_CLASS}`}
                                style={{
                                  height: 30,
                                  padding: '0 12px',
                                  backgroundColor: companionSatelliteTesting
                                    ? P.surface600
                                    : ACTION_UPDATE_BG_SOFT,
                                  border: `1px solid ${companionSatelliteTesting ? P.surface700 : ACTION_UPDATE_BORDER}`,
                                  color: ACTION_CLOSE_TEXT,
                                  fontSize: 12,
                                  cursor: companionSatelliteTesting
                                    ? 'not-allowed'
                                    : 'pointer',
                                }}
                                disabled={companionSatelliteTesting}
                                onClick={() => {
                                  void handleCompanionSatelliteTest();
                                }}
                              >
                                {companionSatelliteTesting
                                  ? 'Testing...'
                                  : 'Test Trigger'}
                              </button>
                              {companionSatelliteTestResult ? (
                                <span
                                  style={{ fontSize: 11, color: P.muted500 }}
                                >
                                  {companionSatelliteTestResult}
                                </span>
                              ) : null}
                            </div>
                          </>
                        ) : isGenericTcpUdpConnection ? (
                          <>
                            {funcName === 'Send Command' ? (
                              <Field label="Command">
                                <input
                                  style={INPUT_STYLE}
                                  value={genericTcpUdpCommand}
                                  onChange={(e) =>
                                    setGenericTcpUdpCommand(e.target.value)
                                  }
                                  placeholder=""
                                />
                              </Field>
                            ) : null}
                            {funcName === 'Send HEX encoded Command' ? (
                              <Field label="Hex Command">
                                <input
                                  style={INPUT_STYLE}
                                  value={genericTcpUdpHexCommand}
                                  onChange={(e) =>
                                    setGenericTcpUdpHexCommand(e.target.value)
                                  }
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
                        ) : isAtemConnection ? (
                          <AtemParamFields state={atemState} />
                        ) : isGrandMA2Connection ? (
                          <Grandma2ParamFields
                            state={grandma2State}
                            ctx={sharedCtx}
                          />
                        ) : isGrandMA3Connection && grandMA3FunctionSpec ? (
                          <>
                            {grandMA3FunctionSpec.fields.map((field) => {
                              const fieldValue =
                                grandMA3FieldValues[field.key] ?? '';
                              if (field.type === 'select') {
                                const options = (field.options ?? []).map(
                                  (option) => ({ value: option, label: option })
                                );
                                const isBooleanField =
                                  isBooleanSelectOptions(options);
                                return (
                                  <Field key={field.key} label={field.label}>
                                    {isBooleanField ? (
                                      <BooleanCheckboxField
                                        value={fieldValue}
                                        onChange={(next) =>
                                          setGrandMA3FieldValue(field.key, next)
                                        }
                                      />
                                    ) : (
                                      <SelectField
                                        value={fieldValue}
                                        options={options}
                                        onChange={(next) =>
                                          setGrandMA3FieldValue(field.key, next)
                                        }
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
                                    onChange={(e) =>
                                      setGrandMA3FieldValue(
                                        field.key,
                                        e.target.value
                                      )
                                    }
                                    placeholder={field.placeholder ?? ''}
                                  />
                                </Field>
                              );
                            })}
                          </>
                        ) : isObsConnection ? (
                          <ObsParamFields state={obsState} ctx={sharedCtx} />
                        ) : isX32Connection ? (
                          <>
                            <Field label="Input">
                              <input
                                style={INPUT_STYLE}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder=""
                              />
                            </Field>

                            <Field label="Value (if required)">
                              <input
                                style={INPUT_STYLE}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder=""
                              />
                            </Field>

                            {funcName ===
                              'Channel, AuxIn, FxReturn, Bus, Matrix, Main Stereo, Mono fader' ||
                            funcName ===
                              'Channel, AuxIn, FxReturn Send level' ||
                            funcName === 'Bus, Main Stereo, Mono Send level' ? (
                              <div
                                className="rounded-none border px-[10px] py-[8px]"
                                style={{
                                  borderColor: P.surface700,
                                  backgroundColor: P.surface900,
                                  fontSize: 11,
                                  color: P.text300,
                                  lineHeight: 1.45,
                                }}
                              >
                                If setting a fade duration, running another
                                action for that value cancels the first and runs
                                the new one from the current level. To cancel a
                                fade, run an &quot;Adjust fader level&quot; with offset 0.
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <Field label="Input">
                              <input
                                style={INPUT_STYLE}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder=""
                              />
                            </Field>

                            <Field label="Value (if required)">
                              <input
                                style={INPUT_STYLE}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
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
          ) : null}
        </div>

        {/* Help text removed to reduce clutter */}
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex flex-col border-t"
        style={{ borderColor: P.surface700 }}
      >
        {isWorkspace ? (
          <div
            className="flex items-center justify-between px-[14px] py-[12px]"
            style={{ backgroundColor: P.surface900 }}
          >
            <div className="flex items-center gap-[6px]">
              {showWorkspaceTaskActions ? (
                <>
                  <button
                    className={`flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded-none ${ACTION_HOVER_OUTLINE_CLASS}`}
                    data-haptic="strong"
                    style={{
                      height: PANEL_BUTTON_HEIGHT,
                      padding: '0 14px',
                      backgroundColor: canBuildWorkspaceTask
                        ? ACTION_ADD_BG_SOFT
                        : P.surface600,
                      border: `1px solid ${canBuildWorkspaceTask ? ACTION_ADD_BORDER : 'transparent'}`,
                      fontSize: 12,
                      color: canBuildWorkspaceTask
                        ? ACTION_CLOSE_TEXT
                        : P.muted500,
                      cursor: canBuildWorkspaceTask ? 'pointer' : 'not-allowed',
                    }}
                    disabled={!canBuildWorkspaceTask}
                    onClick={handleWorkspaceAdd}
                  >
                    Add
                  </button>
                  <button
                    className={`flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded-none ${ACTION_HOVER_OUTLINE_CLASS}`}
                    data-haptic="strong"
                    style={{
                      height: PANEL_BUTTON_HEIGHT,
                      padding: '0 14px',
                      backgroundColor:
                        selectedTaskId && canBuildWorkspaceTask
                          ? ACTION_UPDATE_BG_SOFT
                          : P.surface700,
                      fontSize: 12,
                      color:
                        selectedTaskId && canBuildWorkspaceTask
                          ? ACTION_CLOSE_TEXT
                          : P.muted500,
                      cursor:
                        selectedTaskId && canBuildWorkspaceTask
                          ? 'pointer'
                          : 'not-allowed',
                      border: `1px solid ${selectedTaskId && canBuildWorkspaceTask ? ACTION_UPDATE_BORDER : 'transparent'}`,
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
                className={`flex items-center justify-center transition-colors rounded-none ${ACTION_HOVER_OUTLINE_CLASS}`}
                data-haptic="strong"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  padding: '0 14px',
                  backgroundColor: '#1e1248',
                  border: '1px solid #6d28d9',
                  fontSize: 12,
                  color: '#ede9fe',
                  fontWeight: 500,
                }}
                onClick={handleApplyAndClose}
              >
                Apply + Close
              </button>
              <button
                className={`flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded-none ${ACTION_HOVER_OUTLINE_CLASS}`}
                data-haptic="strong"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  padding: '0 14px',
                  backgroundColor: ACTION_APPLY_BG_SOFT,
                  border: `1px solid ${ACTION_APPLY_BORDER}`,
                  fontSize: 12,
                  color: ACTION_CLOSE_TEXT,
                }}
                onClick={handleSave}
              >
                Apply
              </button>
              <button
                className={`flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded-none ${ACTION_HOVER_OUTLINE_CLASS}`}
                data-haptic="strong"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  padding: '0 14px',
                  backgroundColor: ACTION_CLOSE_BG,
                  border: `1px solid ${ACTION_CLOSE_BORDER}`,
                  fontSize: 12,
                  color: P.muted500,
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
            <div className="flex border-b" style={{ borderColor: '#364153' }}>
              {/* Cancel */}
              <button
                className={`flex-1 flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors ${ACTION_HOVER_OUTLINE_CLASS}`}
                data-haptic="strong"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  backgroundColor: ACTION_CLOSE_BG,
                  border: `1px solid ${ACTION_CLOSE_BORDER}`,
                  borderRight: '1px solid #364153',
                  fontSize: 12,
                  color: ACTION_CLOSE_TEXT,
                }}
                onClick={onClose}
              >
                {isWorkspace ? 'Back' : 'Cancel'}
              </button>

              {/* Add (to list) */}
              <button
                className={`flex-1 flex items-center justify-center transition-colors ${ACTION_HOVER_OUTLINE_CLASS}`}
                data-haptic="strong"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  backgroundColor: canAdd ? ACTION_ADD_BG_SOFT : '#101828',
                  fontSize: 12,
                  color: canAdd ? ACTION_CLOSE_TEXT : P.muted500,
                  cursor: canAdd ? 'pointer' : 'not-allowed',
                  borderLeft: canAdd
                    ? `1px solid ${ACTION_ADD_BORDER}`
                    : 'none',
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
                  height: PANEL_BUTTON_HEIGHT,
                  backgroundColor: ACTION_UPDATE_BG_SOFT,
                  fontSize: 12,
                  color: ACTION_CLOSE_TEXT,
                  cursor: testing ? 'wait' : 'pointer',
                  borderLeft: `1px solid ${ACTION_UPDATE_BORDER}`,
                }}
                disabled={testing}
                onClick={handleTest}
                title="Send this task now without saving"
              >
                {testing ? 'Testing...' : 'Test Action'}
              </button>
            </div>

            {/* Row 2 — Save (prominent) */}
            <button
              className={`flex items-center justify-center transition-colors hover:brightness-110 ${ACTION_HOVER_OUTLINE_CLASS}`}
              data-haptic="strong"
              style={{
                height: PANEL_BUTTON_HEIGHT,
                backgroundColor: ACTION_APPLY_BG,
                fontSize: 13,
                color: ACTION_CLOSE_TEXT,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                border: `1px solid ${ACTION_APPLY_BORDER}`,
              }}
              onClick={handleSave}
            >
              {isWorkspace ? 'Apply to Button' : 'Save Changes'}
            </button>
          </>
        )}
        {!isWorkspace && testMessage ? (
          <div
            className="mt-[6px] text-[11px]"
            style={{
              color: testMessage.toLowerCase().includes('fail')
                ? '#f87171'
                : P.muted500,
            }}
          >
            {testMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
