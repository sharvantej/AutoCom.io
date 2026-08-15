import { useEffect, useMemo, useState } from 'react';
import type { Connection, TaskEntry } from '../../../types';
import { isTauri } from '../../../services/tauri';
import { loadVideohubRouterLabels } from '../../../services/runtimeState';
import {
  asTaskParams,
  parseNonNegativeIntegerValue,
  parsePositiveIntegerValue,
} from '../sharedUtils';
import {
  VIDEOHUB_FUNCTIONS,
  VIDEOHUB_LOCK_STATE_DYNAMIC_OPTIONS,
  VIDEOHUB_LOCK_STATE_OPTIONS,
  type SelectOption,
} from '../deviceFunctionSets';
import { P, VIDEOHUB_NAMES_CACHE, type VideohubNameOption } from '../constants';
import {
  ACTION_HOVER_OUTLINE_CLASS,
  BooleanCheckboxField,
  Field,
  INPUT_STYLE,
  SelectField,
} from '../fields';
import type { DeviceParamsResult, SharedFormCtx } from '../deviceRegistry';

export interface VideohubState {
  videohubDestination: string;
  setVideohubDestination: (v: string) => void;
  videohubDestinationDynamic: string;
  setVideohubDestinationDynamic: (v: string) => void;
  videohubSource: string;
  setVideohubSource: (v: string) => void;
  videohubSourceDynamic: string;
  setVideohubSourceDynamic: (v: string) => void;
  videohubSourceRoutedDestination: string;
  setVideohubSourceRoutedDestination: (v: string) => void;
  videohubSourceRoutedDestinationDynamic: string;
  setVideohubSourceRoutedDestinationDynamic: (v: string) => void;
  videohubOutput: string;
  setVideohubOutput: (v: string) => void;
  videohubOutputDynamic: string;
  setVideohubOutputDynamic: (v: string) => void;
  videohubLockState: string;
  setVideohubLockState: (v: string) => void;
  videohubLockStateDynamic: string;
  setVideohubLockStateDynamic: (v: string) => void;
  videohubIgnoreLock: 'true' | 'false';
  setVideohubIgnoreLock: (v: 'true' | 'false') => void;
  videohubLabel: string;
  setVideohubLabel: (v: string) => void;
  videohubSourceFile: string;
  setVideohubSourceFile: (v: string) => void;
  videohubDestinationFile: string;
  setVideohubDestinationFile: (v: string) => void;
  videohubNamesLoading: boolean;
  videohubNamesError: string;
  refreshVideohubNames: () => void;
  videohubSourceOptions: SelectOption[];
  videohubDestinationOptions: SelectOption[];
}

export function useVideohubState(
  isActive: boolean,
  selectedConnection: Connection | undefined
): VideohubState {
  const [videohubDestination, setVideohubDestination] = useState('0');
  const [videohubDestinationDynamic, setVideohubDestinationDynamic] =
    useState('');
  const [videohubSource, setVideohubSource] = useState('0');
  const [videohubSourceDynamic, setVideohubSourceDynamic] = useState('');
  const [videohubSourceRoutedDestination, setVideohubSourceRoutedDestination] =
    useState('0');
  const [
    videohubSourceRoutedDestinationDynamic,
    setVideohubSourceRoutedDestinationDynamic,
  ] = useState('');
  const [videohubOutput, setVideohubOutput] = useState('0');
  const [videohubOutputDynamic, setVideohubOutputDynamic] = useState('');
  const [videohubLockState, setVideohubLockState] = useState('T');
  const [videohubLockStateDynamic, setVideohubLockStateDynamic] =
    useState('toggle');
  const [videohubIgnoreLock, setVideohubIgnoreLock] = useState<
    'true' | 'false'
  >('false');
  const [videohubLabel, setVideohubLabel] = useState('');
  const [videohubSourceFile, setVideohubSourceFile] =
    useState('C:\\VideoHub.txt');
  const [videohubDestinationFile, setVideohubDestinationFile] =
    useState('C:\\VideoHub.txt');
  const [videohubSourceOptionsState, setVideohubSourceOptionsState] = useState<
    VideohubNameOption[]
  >([]);
  const [videohubDestinationOptionsState, setVideohubDestinationOptionsState] =
    useState<VideohubNameOption[]>([]);
  const [videohubNamesLoading, setVideohubNamesLoading] = useState(false);
  const [videohubNamesError, setVideohubNamesError] = useState('');
  const [videohubNamesReloadKey, setVideohubNamesReloadKey] = useState(0);

  const videohubInputCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(selectedConnection?.inputCount) ?? 12
      ),
    [selectedConnection?.inputCount]
  );
  const videohubOutputCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(selectedConnection?.outputCount) ?? 12
      ),
    [selectedConnection?.outputCount]
  );
  const videohubSourceNumberOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: videohubInputCount }, (_, index) => {
        const value = String(index);
        return { value, label: value };
      }),
    [videohubInputCount]
  );
  const videohubDestinationNumberOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: videohubOutputCount }, (_, index) => {
        const value = String(index);
        return { value, label: value };
      }),
    [videohubOutputCount]
  );
  const videohubSourceOptions = useMemo<SelectOption[]>(
    () =>
      videohubSourceOptionsState.length
        ? videohubSourceOptionsState
        : videohubSourceNumberOptions,
    [videohubSourceNumberOptions, videohubSourceOptionsState]
  );
  const videohubDestinationOptions = useMemo<SelectOption[]>(
    () =>
      videohubDestinationOptionsState.length
        ? videohubDestinationOptionsState
        : videohubDestinationNumberOptions,
    [videohubDestinationNumberOptions, videohubDestinationOptionsState]
  );

  const videohubNamesCacheKey = useMemo(() => {
    if (!selectedConnection || !isActive) return '';
    return [
      selectedConnection.id ?? '',
      selectedConnection.ip ?? '',
      selectedConnection.port ?? '',
      selectedConnection.inputCount ?? 12,
      selectedConnection.outputCount ?? 12,
    ].join('|');
  }, [selectedConnection, isActive]);

  const refreshVideohubNames = () =>
    setVideohubNamesReloadKey((prev) => prev + 1);

  useEffect(() => {
    if (!isActive || !selectedConnection) {
      setVideohubSourceOptionsState([]);
      setVideohubDestinationOptionsState([]);
      setVideohubNamesLoading(false);
      setVideohubNamesError('');
      return;
    }
    if (!isTauri()) {
      setVideohubSourceOptionsState([]);
      setVideohubDestinationOptionsState([]);
      setVideohubNamesLoading(false);
      setVideohubNamesError('');
      return;
    }

    const cached = videohubNamesCacheKey
      ? VIDEOHUB_NAMES_CACHE.get(videohubNamesCacheKey)
      : undefined;
    if (cached) {
      setVideohubSourceOptionsState(cached.sourceOptions);
      setVideohubDestinationOptionsState(cached.destinationOptions);
      setVideohubNamesError('');
      setVideohubNamesLoading(false);
      if (videohubNamesReloadKey === 0) return;
    }

    const host = String(selectedConnection.ip ?? '').trim();
    if (!host) {
      setVideohubNamesError('Router host/IP is missing.');
      return;
    }

    let cancelled = false;
    setVideohubNamesLoading(true);
    setVideohubNamesError('');

    void loadVideohubRouterLabels({
      host,
      port: parsePositiveIntegerValue(selectedConnection.port) ?? 9990,
    })
      .then((result) => {
        if (cancelled) return;
        const sourceOptions = result.inputLabels
          .map((entry) => {
            const value = String(entry.id);
            const labelText = `${entry.id}${entry.label?.trim() ? ` - ${entry.label.trim()}` : ''}`;
            return { value, label: labelText };
          })
          .sort((a, b) => Number(a.value) - Number(b.value));
        const destinationOptions = result.outputLabels
          .map((entry) => {
            const value = String(entry.id);
            const labelText = `${entry.id}${entry.label?.trim() ? ` - ${entry.label.trim()}` : ''}`;
            return { value, label: labelText };
          })
          .sort((a, b) => Number(a.value) - Number(b.value));

        setVideohubSourceOptionsState(sourceOptions);
        setVideohubDestinationOptionsState(destinationOptions);
        setVideohubNamesError('');
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
          error instanceof Error
            ? error.message
            : 'Failed to fetch VideoHub labels from router.'
        );
      })
      .finally(() => {
        if (cancelled) return;
        setVideohubNamesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, selectedConnection, videohubNamesCacheKey, videohubNamesReloadKey]);

  return {
    videohubDestination,
    setVideohubDestination,
    videohubDestinationDynamic,
    setVideohubDestinationDynamic,
    videohubSource,
    setVideohubSource,
    videohubSourceDynamic,
    setVideohubSourceDynamic,
    videohubSourceRoutedDestination,
    setVideohubSourceRoutedDestination,
    videohubSourceRoutedDestinationDynamic,
    setVideohubSourceRoutedDestinationDynamic,
    videohubOutput,
    setVideohubOutput,
    videohubOutputDynamic,
    setVideohubOutputDynamic,
    videohubLockState,
    setVideohubLockState,
    videohubLockStateDynamic,
    setVideohubLockStateDynamic,
    videohubIgnoreLock,
    setVideohubIgnoreLock,
    videohubLabel,
    setVideohubLabel,
    videohubSourceFile,
    setVideohubSourceFile,
    videohubDestinationFile,
    setVideohubDestinationFile,
    videohubNamesLoading,
    videohubNamesError,
    refreshVideohubNames,
    videohubSourceOptions,
    videohubDestinationOptions,
  };
}

/** Matches the setVideohub* reset lines duplicated at handleConn's two branches (resetDraftFields has no videohub lines). */
export function resetVideohubFields(state: VideohubState) {
  state.setVideohubDestination('0');
  state.setVideohubDestinationDynamic('');
  state.setVideohubSource('0');
  state.setVideohubSourceDynamic('');
  state.setVideohubSourceRoutedDestination('0');
  state.setVideohubSourceRoutedDestinationDynamic('');
  state.setVideohubOutput('0');
  state.setVideohubOutputDynamic('');
  state.setVideohubLockState('T');
  state.setVideohubLockStateDynamic('toggle');
  state.setVideohubIgnoreLock('false');
  state.setVideohubLabel('');
  state.setVideohubSourceFile('C:\\VideoHub.txt');
  state.setVideohubDestinationFile('C:\\VideoHub.txt');
}

export function hydrateVideohub(
  state: VideohubState,
  selectedTask: TaskEntry,
  params: Record<string, unknown>,
  ctx: SharedFormCtx
) {
  const options = asTaskParams(params.options);
  const definitionId =
    typeof params.definitionId === 'string' ? params.definitionId.trim() : '';
  const normalizedFunc = VIDEOHUB_FUNCTIONS.has(selectedTask.funcName)
    ? selectedTask.funcName
    : definitionId === 'lock_output'
      ? 'Lock: Change destination lock state'
      : definitionId === 'lock_output_dyn'
        ? 'Lock: Change destination lock state (dynamic)'
        : definitionId === 'load_route_from_file'
          ? 'Route File: Load file'
          : definitionId === 'store_route_in_file'
            ? 'Route File: Save file'
            : definitionId === 'clear'
              ? 'Video: Clear queued route'
              : definitionId === 'rename_destination'
                ? 'Video: Rename destination'
                : definitionId === 'rename_source'
                  ? 'Video: Rename source'
                  : definitionId === 'route_to_previous'
                    ? 'Video: Return to previous route'
                    : definitionId === 'route_to_previous_dyn'
                      ? 'Video: Return to previous route (dynamic)'
                      : definitionId === 'route'
                        ? 'Video: Route source to destination'
                        : definitionId === 'route_dyn'
                          ? 'Video: Route source to destination (dynamic)'
                          : definitionId === 'route_routed'
                            ? 'Video: Route source to destination, based on another destination'
                            : definitionId === 'route_routed_dyn'
                              ? 'Video: Route source to destination, based on another destination (dynamic)'
                              : definitionId === 'route_source'
                                ? 'Video: Route source to selected destination'
                                : definitionId === 'route_source_dyn'
                                  ? 'Video: Route source to selected destination (dynamic)'
                                  : definitionId === 'select_destination'
                                    ? 'Video: Select destination'
                                    : definitionId === 'select_destination_dyn'
                                      ? 'Video: Select destination (dynamic)'
                                      : definitionId === 'take'
                                        ? 'Video: Take queued route'
                                        : 'Video: Select destination';
  ctx.setFuncName(normalizedFunc);
  state.setVideohubDestination(String(options.destination ?? '0'));
  state.setVideohubDestinationDynamic(String(options.destination ?? ''));
  state.setVideohubSource(String(options.source ?? '0'));
  state.setVideohubSourceDynamic(String(options.source ?? ''));
  state.setVideohubSourceRoutedDestination(
    String(options.source_routed_to_destination ?? '0')
  );
  state.setVideohubSourceRoutedDestinationDynamic(
    String(options.source_routed_to_destination ?? '')
  );
  state.setVideohubOutput(String(options.output ?? '0'));
  state.setVideohubOutputDynamic(String(options.output ?? ''));
  state.setVideohubLabel(String(options.label ?? ''));
  state.setVideohubSourceFile(
    String(options.source_file ?? 'C:\\VideoHub.txt')
  );
  state.setVideohubDestinationFile(
    String(options.destination_file ?? 'C:\\VideoHub.txt')
  );
  const lockRaw = String(options.lock_state ?? '').trim();
  const lockStatic =
    lockRaw === 'L' || lockRaw.toLowerCase() === 'lock'
      ? 'L'
      : lockRaw === 'U' || lockRaw.toLowerCase() === 'unlock'
        ? 'U'
        : 'T';
  const lockDynamic =
    lockRaw.toLowerCase() === 'lock'
      ? 'lock'
      : lockRaw.toLowerCase() === 'unlock'
        ? 'unlock'
        : 'toggle';
  state.setVideohubLockState(lockStatic);
  state.setVideohubLockStateDynamic(lockDynamic);
  state.setVideohubIgnoreLock(
    String(options.ignore_lock ?? 'false')
      .trim()
      .toLowerCase() === 'true'
      ? 'true'
      : 'false'
  );
}

export function buildVideohubParams(
  state: VideohubState,
  ctx: SharedFormCtx
): DeviceParamsResult | null {
  if (!VIDEOHUB_FUNCTIONS.has(ctx.funcName)) return null;
  const options: Record<string, unknown> = {};
  let definitionId = '';
  let inputValue = '';
  let valueValue = '';
  const funcName = ctx.funcName;

  if (funcName === 'Lock: Change destination lock state') {
    definitionId = 'lock_output';
    options.output = parseNonNegativeIntegerValue(state.videohubOutput) ?? 0;
    options.lock_state = state.videohubLockState;
    options.ignore_lock = state.videohubIgnoreLock === 'true';
    inputValue = String(options.output);
    valueValue = String(options.lock_state);
  } else if (funcName === 'Lock: Change destination lock state (dynamic)') {
    definitionId = 'lock_output_dyn';
    options.output = state.videohubOutputDynamic.trim();
    options.lock_state = state.videohubLockStateDynamic;
    options.ignore_lock = state.videohubIgnoreLock === 'true';
    inputValue = String(options.output);
    valueValue = String(options.lock_state);
  } else if (funcName === 'Route File: Load file') {
    definitionId = 'load_route_from_file';
    options.source_file = state.videohubSourceFile.trim();
    inputValue = String(options.source_file);
  } else if (funcName === 'Route File: Save file') {
    definitionId = 'store_route_in_file';
    options.destination_file = state.videohubDestinationFile.trim();
    inputValue = String(options.destination_file);
  } else if (funcName === 'Video: Clear queued route') {
    definitionId = 'clear';
  } else if (funcName === 'Video: Rename destination') {
    definitionId = 'rename_destination';
    options.destination =
      parseNonNegativeIntegerValue(state.videohubDestination) ?? 0;
    options.label = state.videohubLabel;
    inputValue = String(options.destination);
    valueValue = String(options.label);
  } else if (funcName === 'Video: Rename source') {
    definitionId = 'rename_source';
    options.source = parseNonNegativeIntegerValue(state.videohubSource) ?? 0;
    options.label = state.videohubLabel;
    inputValue = String(options.source);
    valueValue = String(options.label);
  } else if (funcName === 'Video: Return to previous route') {
    definitionId = 'route_to_previous';
    options.destination =
      parseNonNegativeIntegerValue(state.videohubDestination) ?? 0;
    options.ignore_lock = state.videohubIgnoreLock === 'true';
    inputValue = String(options.destination);
  } else if (funcName === 'Video: Return to previous route (dynamic)') {
    definitionId = 'route_to_previous_dyn';
    options.destination = state.videohubDestinationDynamic.trim();
    options.ignore_lock = state.videohubIgnoreLock === 'true';
    inputValue = String(options.destination);
  } else if (funcName === 'Video: Route source to destination') {
    definitionId = 'route';
    options.source = parseNonNegativeIntegerValue(state.videohubSource) ?? 0;
    options.destination =
      parseNonNegativeIntegerValue(state.videohubDestination) ?? 0;
    options.ignore_lock = state.videohubIgnoreLock === 'true';
    inputValue = String(options.destination);
    valueValue = String(options.source);
  } else if (funcName === 'Video: Route source to destination (dynamic)') {
    definitionId = 'route_dyn';
    options.source = state.videohubSourceDynamic.trim();
    options.destination = state.videohubDestinationDynamic.trim();
    options.ignore_lock = state.videohubIgnoreLock === 'true';
    inputValue = String(options.destination);
    valueValue = String(options.source);
  } else if (
    funcName ===
    'Video: Route source to destination, based on another destination'
  ) {
    definitionId = 'route_routed';
    options.source_routed_to_destination =
      parseNonNegativeIntegerValue(state.videohubSourceRoutedDestination) ?? 0;
    options.destination =
      parseNonNegativeIntegerValue(state.videohubDestination) ?? 0;
    options.ignore_lock = state.videohubIgnoreLock === 'true';
    inputValue = String(options.destination);
    valueValue = String(options.source_routed_to_destination);
  } else if (
    funcName ===
    'Video: Route source to destination, based on another destination (dynamic)'
  ) {
    definitionId = 'route_routed_dyn';
    options.source_routed_to_destination =
      state.videohubSourceRoutedDestinationDynamic.trim();
    options.destination = state.videohubDestinationDynamic.trim();
    options.ignore_lock = state.videohubIgnoreLock === 'true';
    inputValue = String(options.destination);
    valueValue = String(options.source_routed_to_destination);
  } else if (funcName === 'Video: Route source to selected destination') {
    definitionId = 'route_source';
    options.source = parseNonNegativeIntegerValue(state.videohubSource) ?? 0;
    options.ignore_lock = state.videohubIgnoreLock === 'true';
    inputValue = String(options.source);
  } else if (
    funcName === 'Video: Route source to selected destination (dynamic)'
  ) {
    definitionId = 'route_source_dyn';
    options.source = state.videohubSourceDynamic.trim();
    options.ignore_lock = state.videohubIgnoreLock === 'true';
    inputValue = String(options.source);
  } else if (funcName === 'Video: Select destination') {
    definitionId = 'select_destination';
    options.destination =
      parseNonNegativeIntegerValue(state.videohubDestination) ?? 0;
    inputValue = String(options.destination);
  } else if (funcName === 'Video: Select destination (dynamic)') {
    definitionId = 'select_destination_dyn';
    options.destination = state.videohubDestinationDynamic.trim();
    inputValue = String(options.destination);
  } else if (funcName === 'Video: Take queued route') {
    definitionId = 'take';
    options.ignore_lock = state.videohubIgnoreLock === 'true';
  }

  return {
    label: `VideoHub: ${funcName}`,
    input: inputValue,
    value: valueValue,
    params: {
      action: 'command',
      protocol: 'tcp',
      definitionId,
      options,
    },
  };
}

export function VideohubParamFields({
  state,
  ctx,
}: {
  state: VideohubState;
  ctx: SharedFormCtx;
}) {
  const funcName = ctx.funcName;
  return (
    <>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 11, color: P.muted500 }}>
          {state.videohubNamesLoading
            ? 'Loading router labels...'
            : state.videohubNamesError
              ? state.videohubNamesError
              : 'Router labels are used for Source / Destination / Output dropdowns.'}
        </span>
        <button
          type="button"
          className={`rounded-none border px-[8px] py-[4px] text-[11px] ${ACTION_HOVER_OUTLINE_CLASS}`}
          style={{
            borderColor: P.surface600,
            backgroundColor: P.ink950,
            color: P.text100,
            opacity: state.videohubNamesLoading ? 0.7 : 1,
          }}
          onClick={state.refreshVideohubNames}
          disabled={state.videohubNamesLoading}
        >
          {state.videohubNamesLoading ? 'Refreshing...' : 'Refresh Labels'}
        </button>
      </div>
      {funcName === 'Lock: Change destination lock state' ||
      funcName === 'Lock: Change destination lock state (dynamic)' ? (
        <>
          <Field label="Output">
            {funcName.includes('(dynamic)') ? (
              <input
                style={INPUT_STYLE}
                value={state.videohubOutputDynamic}
                onChange={(e) => state.setVideohubOutputDynamic(e.target.value)}
                placeholder=""
              />
            ) : (
              <SelectField
                value={state.videohubOutput}
                options={state.videohubDestinationOptions}
                onChange={(next) => state.setVideohubOutput(next || '0')}
                includeEmptyOption={false}
              />
            )}
          </Field>
          <Field label="Lock State">
            <SelectField
              value={
                funcName.includes('(dynamic)')
                  ? state.videohubLockStateDynamic
                  : state.videohubLockState
              }
              options={
                funcName.includes('(dynamic)')
                  ? VIDEOHUB_LOCK_STATE_DYNAMIC_OPTIONS
                  : VIDEOHUB_LOCK_STATE_OPTIONS
              }
              onChange={(next) => {
                if (funcName.includes('(dynamic)')) {
                  state.setVideohubLockStateDynamic(next || 'toggle');
                } else {
                  state.setVideohubLockState(next || 'T');
                }
              }}
              includeEmptyOption={false}
            />
          </Field>
        </>
      ) : null}

      {funcName === 'Video: Return to previous route' ||
      funcName === 'Video: Route source to destination' ||
      funcName ===
        'Video: Route source to destination, based on another destination' ||
      funcName === 'Video: Select destination' ||
      funcName === 'Video: Rename destination' ? (
        <Field label="Destination">
          <SelectField
            value={state.videohubDestination}
            options={state.videohubDestinationOptions}
            onChange={(next) => state.setVideohubDestination(next || '0')}
            includeEmptyOption={false}
          />
        </Field>
      ) : null}

      {funcName === 'Video: Return to previous route (dynamic)' ||
      funcName === 'Video: Route source to destination (dynamic)' ||
      funcName ===
        'Video: Route source to destination, based on another destination (dynamic)' ||
      funcName === 'Video: Select destination (dynamic)' ? (
        <Field label="Destination">
          <input
            style={INPUT_STYLE}
            value={state.videohubDestinationDynamic}
            onChange={(e) =>
              state.setVideohubDestinationDynamic(e.target.value)
            }
            placeholder=""
          />
        </Field>
      ) : null}

      {funcName === 'Video: Route source to destination' ||
      funcName === 'Video: Route source to selected destination' ||
      funcName === 'Video: Rename source' ? (
        <Field label="Source">
          <SelectField
            value={state.videohubSource}
            options={state.videohubSourceOptions}
            onChange={(next) => state.setVideohubSource(next || '0')}
            includeEmptyOption={false}
          />
        </Field>
      ) : null}

      {funcName === 'Video: Route source to destination (dynamic)' ||
      funcName === 'Video: Route source to selected destination (dynamic)' ? (
        <Field label="Source">
          <input
            style={INPUT_STYLE}
            value={state.videohubSourceDynamic}
            onChange={(e) => state.setVideohubSourceDynamic(e.target.value)}
            placeholder=""
          />
        </Field>
      ) : null}

      {funcName ===
      'Video: Route source to destination, based on another destination' ? (
        <Field label="Source routed to destination">
          <SelectField
            value={state.videohubSourceRoutedDestination}
            options={state.videohubDestinationOptions}
            onChange={(next) =>
              state.setVideohubSourceRoutedDestination(next || '0')
            }
            includeEmptyOption={false}
          />
        </Field>
      ) : null}

      {funcName ===
      'Video: Route source to destination, based on another destination (dynamic)' ? (
        <Field label="Source routed to destination">
          <input
            style={INPUT_STYLE}
            value={state.videohubSourceRoutedDestinationDynamic}
            onChange={(e) =>
              state.setVideohubSourceRoutedDestinationDynamic(e.target.value)
            }
            placeholder=""
          />
        </Field>
      ) : null}

      {funcName === 'Video: Rename destination' ||
      funcName === 'Video: Rename source' ? (
        <Field label="Label">
          <input
            style={INPUT_STYLE}
            value={state.videohubLabel}
            onChange={(e) => state.setVideohubLabel(e.target.value)}
            placeholder=""
          />
        </Field>
      ) : null}

      {funcName === 'Route File: Load file' ? (
        <Field label="Source File">
          <input
            style={INPUT_STYLE}
            value={state.videohubSourceFile}
            onChange={(e) => state.setVideohubSourceFile(e.target.value)}
            placeholder="C:\\VideoHub.txt"
          />
        </Field>
      ) : null}

      {funcName === 'Route File: Save file' ? (
        <Field label="Destination File">
          <input
            style={INPUT_STYLE}
            value={state.videohubDestinationFile}
            onChange={(e) => state.setVideohubDestinationFile(e.target.value)}
            placeholder="C:\\VideoHub.txt"
          />
        </Field>
      ) : null}

      {funcName === 'Lock: Change destination lock state' ||
      funcName === 'Lock: Change destination lock state (dynamic)' ||
      funcName === 'Video: Return to previous route' ||
      funcName === 'Video: Return to previous route (dynamic)' ||
      funcName === 'Video: Route source to destination' ||
      funcName === 'Video: Route source to destination (dynamic)' ||
      funcName ===
        'Video: Route source to destination, based on another destination' ||
      funcName ===
        'Video: Route source to destination, based on another destination (dynamic)' ||
      funcName === 'Video: Route source to selected destination' ||
      funcName === 'Video: Route source to selected destination (dynamic)' ||
      funcName === 'Video: Take queued route' ? (
        <Field label="Ignore Lock">
          <BooleanCheckboxField
            value={state.videohubIgnoreLock}
            onChange={(next) =>
              state.setVideohubIgnoreLock(next === 'true' ? 'true' : 'false')
            }
            label={state.videohubIgnoreLock === 'true' ? 'Enabled' : 'Disabled'}
          />
        </Field>
      ) : null}
    </>
  );
}
