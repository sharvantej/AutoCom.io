import { useEffect, useMemo, useState } from 'react';
import type { Connection, TaskEntry } from '../../../types';
import {
  fetchObsRuntimeCatalogue,
  type ObsRuntimeCatalogue,
} from '../../../services/obsDiscovery';
import {
  OBS_FUNCTION_SPECS,
  OBS_SCENE_FUNCTIONS,
  OBS_SCENE_FUNCTION_TO_REQUEST,
  type ObsFunctionSpec,
} from '../obsSpecs';
import {
  asTaskParams,
  normalizeObsFieldValue,
  readValueByPath,
  selectOptionValue,
  setValueByPath,
} from '../sharedUtils';
import type { SelectOption } from '../deviceFunctionSets';
import { P } from '../constants';
import {
  BooleanCheckboxField,
  Field,
  INPUT_STYLE,
  SelectField,
  isBooleanSelectOptions,
} from '../fields';
import type { DeviceParamsResult, SharedFormCtx } from '../deviceRegistry';

export interface ObsState {
  obsRuntimeCatalogue: ObsRuntimeCatalogue | null;
  obsCatalogueLoading: boolean;
  obsCatalogueError: string;
  obsSceneName: string;
  setObsSceneName: (v: string) => void;
  obsInputName: string;
  setObsInputName: (v: string) => void;
  obsTransitionName: string;
  setObsTransitionName: (v: string) => void;
  obsProfileName: string;
  setObsProfileName: (v: string) => void;
  obsSceneCollectionName: string;
  setObsSceneCollectionName: (v: string) => void;
  obsOutputName: string;
  setObsOutputName: (v: string) => void;
  obsHotkeyName: string;
  setObsHotkeyName: (v: string) => void;
  obsFieldValues: Record<string, string>;
  setObsFieldValues: (v: Record<string, string>) => void;
  obsFunctionOptions: SelectOption[];
  isObsSceneFunction: boolean;
  obsFunctionSpec: ObsFunctionSpec | null;
  obsSceneOptions: SelectOption[];
  obsSceneItemOptions: SelectOption[];
  obsCurrentParameterValue: string;
  obsCurrentParameterOptions: SelectOption[];
  setObsParameterValue: (
    kind: NonNullable<ObsFunctionSpec['parameterKind']>,
    nextValue: string
  ) => void;
  setObsFieldValue: (key: string, nextValue: string) => void;
  resolveObsFieldOptions: (
    field: NonNullable<ObsFunctionSpec['fields']>[number]
  ) => SelectOption[];
}

export function useObsState(
  isActive: boolean,
  selectedConnection: Connection | undefined,
  funcName: string,
  cat: SharedFormCtx['cat']
): ObsState {
  const [obsRuntimeCatalogue, setObsRuntimeCatalogue] =
    useState<ObsRuntimeCatalogue | null>(null);
  const [obsCatalogueLoading, setObsCatalogueLoading] = useState(false);
  const [obsCatalogueError, setObsCatalogueError] = useState('');
  const [obsSceneName, setObsSceneName] = useState('');
  const [obsInputName, setObsInputName] = useState('');
  const [obsTransitionName, setObsTransitionName] = useState('');
  const [obsProfileName, setObsProfileName] = useState('');
  const [obsSceneCollectionName, setObsSceneCollectionName] = useState('');
  const [obsOutputName, setObsOutputName] = useState('');
  const [obsHotkeyName, setObsHotkeyName] = useState('');
  const [obsFieldValues, setObsFieldValues] = useState<
    Record<string, string>
  >({});

  const obsFunctionOptions = useMemo<SelectOption[]>(
    () =>
      Object.entries(cat.categories).flatMap(([group, functions]) =>
        functions.map((fn) => ({
          value: fn,
          label: `${group} | ${fn}`,
        }))
      ),
    [cat.categories]
  );

  const isObsSceneFunction = isActive && OBS_SCENE_FUNCTIONS.has(funcName);
  const obsFunctionSpec = isActive ? (OBS_FUNCTION_SPECS[funcName] ?? null) : null;

  const obsSceneOptions = useMemo<SelectOption[]>(
    () =>
      (obsRuntimeCatalogue?.scenes ?? []).map((scene) => ({
        value: scene,
        label: scene,
      })),
    [obsRuntimeCatalogue]
  );
  const obsInputOptions = useMemo<SelectOption[]>(
    () =>
      (obsRuntimeCatalogue?.inputs ?? []).map((inputName) => ({
        value: inputName,
        label: inputName,
      })),
    [obsRuntimeCatalogue]
  );
  const obsTransitionOptions = useMemo<SelectOption[]>(
    () =>
      (obsRuntimeCatalogue?.transitions ?? []).map((name) => ({
        value: name,
        label: name,
      })),
    [obsRuntimeCatalogue]
  );
  const obsProfileOptions = useMemo<SelectOption[]>(
    () =>
      (obsRuntimeCatalogue?.profiles ?? []).map((name) => ({
        value: name,
        label: name,
      })),
    [obsRuntimeCatalogue]
  );
  const obsSceneCollectionOptions = useMemo<SelectOption[]>(
    () =>
      (obsRuntimeCatalogue?.sceneCollections ?? []).map((name) => ({
        value: name,
        label: name,
      })),
    [obsRuntimeCatalogue]
  );
  const obsOutputOptions = useMemo<SelectOption[]>(
    () =>
      (obsRuntimeCatalogue?.outputs ?? []).map((name) => ({
        value: name,
        label: name,
      })),
    [obsRuntimeCatalogue]
  );
  const obsHotkeyOptions = useMemo<SelectOption[]>(
    () =>
      (obsRuntimeCatalogue?.hotkeys ?? []).map((name) => ({
        value: name,
        label: name,
      })),
    [obsRuntimeCatalogue]
  );
  const obsSceneItemOptions = useMemo<SelectOption[]>(
    () =>
      (obsRuntimeCatalogue?.sceneItemsByScene?.[obsSceneName] ?? []).map(
        (item) => ({
          value: String(item.sceneItemId),
          label: `${item.sourceName} (${item.sceneItemId})`,
        })
      ),
    [obsRuntimeCatalogue, obsSceneName]
  );
  const obsCurrentParameterValue = useMemo(() => {
    const kind = obsFunctionSpec?.parameterKind;
    if (!kind) return '';
    if (kind === 'scenes') return obsSceneName;
    if (kind === 'inputs') return obsInputName;
    if (kind === 'transitions') return obsTransitionName;
    if (kind === 'profiles') return obsProfileName;
    if (kind === 'sceneCollections') return obsSceneCollectionName;
    if (kind === 'outputs') return obsOutputName;
    if (kind === 'hotkeys') return obsHotkeyName;
    return '';
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
    if (kind === 'scenes') return obsSceneOptions;
    if (kind === 'sceneItems') return obsSceneItemOptions;
    if (kind === 'inputs') return obsInputOptions;
    if (kind === 'transitions') return obsTransitionOptions;
    if (kind === 'profiles') return obsProfileOptions;
    if (kind === 'sceneCollections') return obsSceneCollectionOptions;
    if (kind === 'outputs') return obsOutputOptions;
    if (kind === 'hotkeys') return obsHotkeyOptions;
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

  const setObsParameterValue = (
    kind: NonNullable<ObsFunctionSpec['parameterKind']>,
    nextValue: string
  ) => {
    if (kind === 'scenes') setObsSceneName(nextValue);
    else if (kind === 'inputs') setObsInputName(nextValue);
    else if (kind === 'transitions') setObsTransitionName(nextValue);
    else if (kind === 'profiles') setObsProfileName(nextValue);
    else if (kind === 'sceneCollections') setObsSceneCollectionName(nextValue);
    else if (kind === 'outputs') setObsOutputName(nextValue);
    else if (kind === 'hotkeys') setObsHotkeyName(nextValue);
  };
  const setObsFieldValue = (key: string, nextValue: string) => {
    setObsFieldValues((prev) => ({ ...prev, [key]: nextValue }));
  };
  const resolveObsFieldOptions = (
    field: NonNullable<ObsFunctionSpec['fields']>[number]
  ): SelectOption[] => {
    if (field.options?.length) {
      return field.options.map((value) => ({ value, label: value }));
    }
    if (field.optionsKind === 'scenes') return obsSceneOptions;
    if (field.optionsKind === 'sceneItems') return obsSceneItemOptions;
    if (field.optionsKind === 'inputs') return obsInputOptions;
    if (field.optionsKind === 'transitions') return obsTransitionOptions;
    if (field.optionsKind === 'profiles') return obsProfileOptions;
    if (field.optionsKind === 'sceneCollections')
      return obsSceneCollectionOptions;
    if (field.optionsKind === 'outputs') return obsOutputOptions;
    if (field.optionsKind === 'hotkeys') return obsHotkeyOptions;
    return [];
  };

  useEffect(() => {
    if (!isActive || !selectedConnection) {
      setObsRuntimeCatalogue(null);
      setObsCatalogueLoading(false);
      setObsCatalogueError('');
      return;
    }

    let active = true;
    setObsCatalogueLoading(true);
    setObsCatalogueError('');

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
        setObsCatalogueError(
          error instanceof Error ? error.message : 'Unable to load OBS data'
        );
      });

    return () => {
      active = false;
    };
  }, [isActive, selectedConnection]);

  useEffect(() => {
    if (!isObsSceneFunction) return;
    if (obsSceneName.trim()) return;
    const firstScene = obsRuntimeCatalogue?.scenes?.[0] ?? '';
    if (!firstScene) return;
    setObsSceneName(firstScene);
  }, [isObsSceneFunction, obsRuntimeCatalogue, obsSceneName]);
  useEffect(() => {
    if (!isActive) return;
    const kind = obsFunctionSpec?.parameterKind;
    if (!kind) return;
    if (obsCurrentParameterValue.trim()) return;
    const firstValue = selectOptionValue(obsCurrentParameterOptions[0]);
    if (!firstValue) return;
    setObsParameterValue(kind, firstValue);
  }, [
    isActive,
    obsCurrentParameterOptions,
    obsCurrentParameterValue,
    obsFunctionSpec?.parameterKind,
  ]);
  useEffect(() => {
    if (!isActive) return;
    const fields = obsFunctionSpec?.fields ?? [];
    if (!fields.length) return;
    setObsFieldValues((prev) => {
      const next = { ...prev };
      for (const field of fields) {
        const current = (next[field.key] ?? '').trim();
        if (current) continue;
        let fallback = field.defaultValue ?? '';
        if (!fallback && field.key === 'sceneItemId') {
          fallback = selectOptionValue(obsSceneItemOptions[0]);
        } else if (!fallback && field.type === 'select') {
          fallback = selectOptionValue(resolveObsFieldOptions(field)[0]);
        }
        if (fallback) next[field.key] = fallback;
      }
      return next;
    });
  }, [isActive, obsFunctionSpec?.fields, obsSceneItemOptions]);

  return {
    obsRuntimeCatalogue,
    obsCatalogueLoading,
    obsCatalogueError,
    obsSceneName,
    setObsSceneName,
    obsInputName,
    setObsInputName,
    obsTransitionName,
    setObsTransitionName,
    obsProfileName,
    setObsProfileName,
    obsSceneCollectionName,
    setObsSceneCollectionName,
    obsOutputName,
    setObsOutputName,
    obsHotkeyName,
    setObsHotkeyName,
    obsFieldValues,
    setObsFieldValues,
    obsFunctionOptions,
    isObsSceneFunction,
    obsFunctionSpec,
    obsSceneOptions,
    obsSceneItemOptions,
    obsCurrentParameterValue,
    obsCurrentParameterOptions,
    setObsParameterValue,
    setObsFieldValue,
    resolveObsFieldOptions,
  };
}

export function resetObsFields(state: ObsState) {
  state.setObsSceneName('');
  state.setObsInputName('');
  state.setObsTransitionName('');
  state.setObsProfileName('');
  state.setObsSceneCollectionName('');
  state.setObsOutputName('');
  state.setObsHotkeyName('');
  state.setObsFieldValues({});
}

export function hydrateObs(
  state: ObsState,
  selectedTask: TaskEntry,
  params: Record<string, unknown>
) {
  const requestType = (selectedTask.input ?? '').trim();
  const requestDataFromParams = asTaskParams(params.requestData);
  const requestDataFromValue = (() => {
    const raw = (selectedTask.value ?? '').trim();
    if (!raw) return {} as Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw) as unknown;
      return asTaskParams(parsed);
    } catch {
      return {};
    }
  })();
  const sceneFromParams =
    typeof params.sceneName === 'string' ? params.sceneName : '';
  const sceneFromRequestData =
    typeof requestDataFromParams.sceneName === 'string'
      ? requestDataFromParams.sceneName
      : typeof requestDataFromValue.sceneName === 'string'
        ? requestDataFromValue.sceneName
        : '';
  if (
    OBS_SCENE_FUNCTIONS.has(selectedTask.funcName) ||
    requestType === 'SetCurrentProgramScene' ||
    requestType === 'SetCurrentPreviewScene'
  ) {
    state.setObsSceneName(
      (
        sceneFromParams ||
        sceneFromRequestData ||
        state.obsRuntimeCatalogue?.scenes?.[0] ||
        ''
      ).trim()
    );
  } else {
    state.setObsSceneName('');
  }
  const inputName =
    (typeof params.inputName === 'string' ? params.inputName : '') ||
    (typeof requestDataFromParams.inputName === 'string'
      ? requestDataFromParams.inputName
      : '') ||
    (typeof requestDataFromValue.inputName === 'string'
      ? requestDataFromValue.inputName
      : '');
  const transitionName =
    (typeof params.transitionName === 'string' ? params.transitionName : '') ||
    (typeof requestDataFromParams.transitionName === 'string'
      ? requestDataFromParams.transitionName
      : '') ||
    (typeof requestDataFromValue.transitionName === 'string'
      ? requestDataFromValue.transitionName
      : '');
  const profileName =
    (typeof params.profileName === 'string' ? params.profileName : '') ||
    (typeof requestDataFromParams.profileName === 'string'
      ? requestDataFromParams.profileName
      : '') ||
    (typeof requestDataFromValue.profileName === 'string'
      ? requestDataFromValue.profileName
      : '');
  const sceneCollectionName =
    (typeof params.sceneCollectionName === 'string'
      ? params.sceneCollectionName
      : '') ||
    (typeof requestDataFromParams.sceneCollectionName === 'string'
      ? requestDataFromParams.sceneCollectionName
      : '') ||
    (typeof requestDataFromValue.sceneCollectionName === 'string'
      ? requestDataFromValue.sceneCollectionName
      : '');
  const outputName =
    (typeof params.outputName === 'string' ? params.outputName : '') ||
    (typeof requestDataFromParams.outputName === 'string'
      ? requestDataFromParams.outputName
      : '') ||
    (typeof requestDataFromValue.outputName === 'string'
      ? requestDataFromValue.outputName
      : '');
  const hotkeyName =
    (typeof params.hotkeyName === 'string' ? params.hotkeyName : '') ||
    (typeof requestDataFromParams.hotkeyName === 'string'
      ? requestDataFromParams.hotkeyName
      : '') ||
    (typeof requestDataFromValue.hotkeyName === 'string'
      ? requestDataFromValue.hotkeyName
      : '');
  state.setObsInputName(inputName.trim());
  state.setObsTransitionName(transitionName.trim());
  state.setObsProfileName(profileName.trim());
  state.setObsSceneCollectionName(sceneCollectionName.trim());
  state.setObsOutputName(outputName.trim());
  state.setObsHotkeyName(hotkeyName.trim());
  const spec = OBS_FUNCTION_SPECS[selectedTask.funcName];
  if (spec?.fields?.length) {
    const nextFieldValues: Record<string, string> = {};
    for (const field of spec.fields) {
      const fromParams = readValueByPath(params, field.key);
      const fromReq = readValueByPath(requestDataFromParams, field.key);
      const fromReqValue = readValueByPath(requestDataFromValue, field.key);
      const chosen = fromParams ?? fromReq ?? fromReqValue;
      if (chosen !== undefined && chosen !== null) {
        nextFieldValues[field.key] =
          typeof chosen === 'string' ? chosen : JSON.stringify(chosen);
      }
    }
    state.setObsFieldValues(nextFieldValues);
  } else {
    state.setObsFieldValues({});
  }
}

export function buildObsSceneParams(
  state: ObsState,
  ctx: SharedFormCtx
): DeviceParamsResult | null {
  const requestType = OBS_SCENE_FUNCTION_TO_REQUEST[ctx.funcName] ?? '';
  const sceneName = state.obsSceneName.trim();
  if (!requestType || !sceneName) return null;
  const requestData = { sceneName };
  return {
    label: `OBS: ${ctx.funcName} (${sceneName})`,
    input: requestType,
    value: JSON.stringify(requestData),
    params: {
      action: 'command',
      protocol: 'ws',
      requestType,
      requestData,
      sceneName,
    },
  };
}

export function buildObsFunctionParams(
  state: ObsState,
  ctx: SharedFormCtx
): DeviceParamsResult | null {
  const spec = state.obsFunctionSpec;
  if (!spec) return null;
  let requestType = spec.requestType.trim();
  if (!requestType) return null;
  const requestData: Record<string, unknown> = {
    ...(spec.defaultRequestData ?? {}),
  };
  if (spec.parameterKind && spec.parameterKey) {
    const parameterValue = state.obsCurrentParameterValue.trim();
    if (!parameterValue) return null;
    requestData[spec.parameterKey] = parameterValue;
  }
  if (spec.fields?.length) {
    for (const field of spec.fields) {
      const raw = state.obsFieldValues[field.key] ?? '';
      const parsed = normalizeObsFieldValue(raw, field.type);
      if (parsed === undefined) continue;
      setValueByPath(requestData, field.key, parsed);
    }
  }
  const funcName = ctx.funcName;
  if (funcName === 'Set Source Mute') {
    const mode = String(requestData.inputMuted ?? '')
      .trim()
      .toLowerCase();
    if (mode === 'toggle') {
      requestType = 'ToggleInputMute';
      delete requestData.inputMuted;
    } else if (mode === 'on' || mode === 'off') {
      requestData.inputMuted = mode === 'on';
    }
  }
  if (funcName === 'Custom Command') {
    const customRequestType = String(requestData.customRequestType ?? '').trim();
    if (!customRequestType) return null;
    const customRequestData = requestData.customRequestData;
    requestType = customRequestType;
    Object.keys(requestData).forEach((key) => delete requestData[key]);
    if (
      customRequestData &&
      typeof customRequestData === 'object' &&
      !Array.isArray(customRequestData)
    ) {
      Object.assign(requestData, customRequestData as Record<string, unknown>);
    }
  }
  const valueToken = ctx.value.trim();
  if (valueToken) {
    if (
      funcName === 'Set Source Volume' ||
      funcName === 'Adjust Source Volume (dB)'
    ) {
      const parsed = Number.parseFloat(valueToken);
      if (Number.isFinite(parsed)) {
        requestData.inputVolumeDb = parsed;
      }
    } else if (
      funcName === 'Set Audio Sync Offset' ||
      funcName === 'Adjust Audio Sync Offset'
    ) {
      const parsed = Number.parseInt(valueToken, 10);
      if (Number.isFinite(parsed)) {
        requestData.inputAudioSyncOffset = parsed;
      }
    } else if (
      funcName === 'Set Audio Balance' ||
      funcName === 'Adjust Audio Balance'
    ) {
      const parsed = Number.parseFloat(valueToken);
      if (Number.isFinite(parsed)) {
        requestData.inputAudioBalance = parsed;
      }
    } else if (funcName === 'Set Audio Monitor') {
      requestData.monitorType = valueToken;
    } else if (funcName === 'Play / Pause Media') {
      requestData.mediaAction =
        valueToken || 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY_PAUSE';
    } else if (funcName === 'Set Media Time') {
      const seconds = Number.parseFloat(valueToken);
      if (Number.isFinite(seconds)) {
        requestData.mediaCursor = Math.trunc(seconds * 1000);
      }
    } else if (funcName === 'Scrub Media') {
      const seconds = Number.parseFloat(valueToken);
      if (Number.isFinite(seconds)) {
        requestData.mediaCursorOffset = Math.trunc(seconds * 1000);
      }
    } else if (funcName === 'Adjust Source Volume (Percentage)') {
      const parsed = Number.parseFloat(valueToken);
      if (Number.isFinite(parsed)) {
        requestData.inputVolumeMul = parsed / 100;
      }
    }
  }
  if (funcName === 'Set Source Visibility') {
    const mode = String(requestData.sceneItemEnabled ?? '')
      .trim()
      .toLowerCase();
    if (mode === 'toggle') {
      requestType = 'AUTOCOM_TOGGLE_SCENE_ITEM_ENABLED';
      delete requestData.sceneItemEnabled;
    } else if (mode === 'on' || mode === 'off') {
      requestType = 'SetSceneItemEnabled';
      requestData.sceneItemEnabled = mode === 'on';
    }
  }
  if (funcName === 'Set Filter Visibility') {
    const mode = String(requestData.filterEnabled ?? '')
      .trim()
      .toLowerCase();
    if (mode === 'toggle') {
      requestType = 'AUTOCOM_TOGGLE_FILTER_ENABLED';
      delete requestData.filterEnabled;
    } else if (mode === 'on' || mode === 'off') {
      requestType = 'SetSourceFilterEnabled';
      requestData.filterEnabled = mode === 'on';
    }
  }
  if (funcName === 'Set Source Visibility') {
    const sceneItemToken = String(requestData.sceneItemId ?? '').trim();
    const sceneItemId = Number.parseInt(sceneItemToken, 10);
    if (!Number.isFinite(sceneItemId) || sceneItemId <= 0) return null;
    requestData.sceneItemId = sceneItemId;
  }
  if (funcName === 'Set Source Transform') {
    const sceneItemToken = String(requestData.sceneItemId ?? '').trim();
    const sceneItemId = Number.parseInt(sceneItemToken, 10);
    if (!Number.isFinite(sceneItemId) || sceneItemId <= 0) return null;
    requestData.sceneItemId = sceneItemId;
    const transform = requestData.sceneItemTransform;
    if (!transform || typeof transform !== 'object' || Array.isArray(transform)) {
      delete requestData.sceneItemTransform;
    }
  }
  if (funcName === 'Restart Media')
    requestData.mediaAction = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART';
  if (funcName === 'Stop Media')
    requestData.mediaAction = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP';
  if (funcName === 'Next Media')
    requestData.mediaAction = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT';
  if (funcName === 'Previous Media')
    requestData.mediaAction = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS';
  const hasRequestData = Object.keys(requestData).length > 0;
  return {
    label: `OBS: ${funcName}`,
    input: requestType,
    value: hasRequestData ? JSON.stringify(requestData) : '',
    params: {
      action: 'command',
      protocol: 'ws',
      requestType,
      ...(hasRequestData ? { requestData } : {}),
    },
  };
}

export function ObsFunctionStep({
  state,
  ctx,
}: {
  state: ObsState;
  ctx: SharedFormCtx;
}) {
  return (
    <Field label="Function">
      <SelectField
        value={ctx.funcName}
        options={state.obsFunctionOptions}
        onChange={(next) => {
          ctx.setFuncName(next);
          const match = Object.entries(ctx.cat.categories).find(([, functions]) =>
            functions.includes(next)
          );
          ctx.setCategory(match?.[0] ?? ctx.category);
        }}
        placeholder="Select function"
      />
    </Field>
  );
}

export function ObsParamFields({
  state,
  ctx,
}: {
  state: ObsState;
  ctx: SharedFormCtx;
}) {
  if (state.isObsSceneFunction) {
    return (
      <>
        <Field label="Scene">
          {state.obsSceneOptions.length ? (
            <SelectField
              value={state.obsSceneName}
              options={state.obsSceneOptions}
              onChange={state.setObsSceneName}
              placeholder={
                state.obsCatalogueLoading ? 'Loading scenes...' : 'Select scene'
              }
            />
          ) : (
            <input
              style={INPUT_STYLE}
              value={state.obsSceneName}
              onChange={(e) => state.setObsSceneName(e.target.value)}
              placeholder={
                state.obsCatalogueLoading ? 'Loading scenes...' : 'Scene name'
              }
            />
          )}
        </Field>

        {state.obsCatalogueError ? (
          <div style={{ fontSize: 11, color: P.muted700, lineHeight: 1.5 }}>
            OBS scene list unavailable: {state.obsCatalogueError}
          </div>
        ) : null}
      </>
    );
  }

  const spec = state.obsFunctionSpec;
  if (!spec) return null;

  return (
    <>
      <Field label="Request Type">
        <input
          style={{ ...INPUT_STYLE, color: P.muted500 }}
          value={spec.requestType}
          readOnly
        />
      </Field>
      {spec.parameterKind && spec.parameterKey ? (
        <Field label={spec.parameterLabel || 'Parameter'}>
          {state.obsCurrentParameterOptions.length ? (
            <SelectField
              value={state.obsCurrentParameterValue}
              options={state.obsCurrentParameterOptions}
              onChange={(next) => state.setObsParameterValue(spec.parameterKind!, next)}
              placeholder={state.obsCatalogueLoading ? 'Loading...' : 'Select'}
            />
          ) : (
            <input
              style={INPUT_STYLE}
              value={state.obsCurrentParameterValue}
              onChange={(e) =>
                state.setObsParameterValue(spec.parameterKind!, e.target.value)
              }
              placeholder={state.obsCatalogueLoading ? 'Loading...' : ''}
            />
          )}
        </Field>
      ) : null}
      {spec.fields?.map((field) => {
        const fieldValue = state.obsFieldValues[field.key] ?? '';
        const options = state.resolveObsFieldOptions(field);
        if (field.type === 'select') {
          const isBooleanField = isBooleanSelectOptions(options);
          return (
            <Field key={field.key} label={field.label}>
              {isBooleanField ? (
                <BooleanCheckboxField
                  value={fieldValue}
                  onChange={(next) => state.setObsFieldValue(field.key, next)}
                />
              ) : options.length ? (
                <SelectField
                  value={fieldValue}
                  options={options}
                  onChange={(next) => state.setObsFieldValue(field.key, next)}
                  placeholder={state.obsCatalogueLoading ? 'Loading...' : 'Select'}
                />
              ) : (
                <input
                  style={INPUT_STYLE}
                  value={fieldValue}
                  onChange={(e) => state.setObsFieldValue(field.key, e.target.value)}
                  placeholder={field.placeholder ?? ''}
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
              onChange={(e) => state.setObsFieldValue(field.key, e.target.value)}
              placeholder={field.placeholder ?? ''}
            />
          </Field>
        );
      })}
      {spec.valueLabel ? (
        <Field label={spec.valueLabel}>
          <input
            style={INPUT_STYLE}
            value={ctx.value}
            onChange={(e) => ctx.setValue(e.target.value)}
            placeholder=""
          />
        </Field>
      ) : null}
      {spec.defaultRequestData ? (
        <Field label="Request Data">
          <input
            style={{ ...INPUT_STYLE, color: P.muted500 }}
            value={JSON.stringify(spec.defaultRequestData)}
            readOnly
          />
        </Field>
      ) : null}
      {state.obsCatalogueError && spec.parameterKind ? (
        <div style={{ fontSize: 11, color: P.muted700, lineHeight: 1.5 }}>
          OBS list unavailable: {state.obsCatalogueError}
        </div>
      ) : null}
    </>
  );
}
