import { useState } from 'react';
import type { TaskEntry } from '../../../types';
import {
  normalizeOscAddress,
  parsePositiveIntegerValue,
  parseResolvableNumber,
} from '../sharedUtils';
import {
  type ResolumeMasterAction,
  type ResolumeToggleAction,
  isResolumeCompositionChangeFunction,
  isResolumeClipChangeFunction,
  isResolumeClipSelectionFunction,
  isResolumeColumnActionFunction,
  isResolumeLayerColumnStepFunction,
  isResolumeLayerGroupColumnStepFunction,
  isResolumeToggleFunction,
  isResolumeLayerChangeFunction,
  isResolumeLayerGroupChangeFunction,
  isResolumeLayerSelectFunction,
  isResolumeLayerClearFunction,
  isResolumeCompositionColumnStepFunction,
  isResolumeDeckSelectFunction,
  isResolumeDeckStepFunction,
  isResolumeCustomOscFunction,
  isLayerGroupSelectFunction,
  isLayerGroupClearFunction,
  isLayerGroupToggleFunction,
  resolveToggleAddress,
  resolveToggleArgs,
  resolveLayerChangeAddress,
  resolveLayerGroupChangeAddress,
  resolveLayerSelectAddress,
  resolveLayerClearAddress,
  resolveCompositionColumnStepAddress,
  resolveDeckSelectAddress,
  resolveDeckStepAddress,
  parseCustomOscArgs,
  isLayerGroupColumnAction,
  resolveColumnActionAddress,
  resolveLayerColumnStepAddress,
  resolveLayerGroupColumnStepAddress,
  resolveCompositionChangeAddress,
  resolveClipChangeAddress,
  resolveClipSelectionAddress,
  extractLayerClipFromAddress,
  detectColumnActionFromAddress,
  detectDeltaActionFromAddress,
  detectDeckActionFromAddress,
  extractDeckValueFromAddress,
  extractColumnValueFromAddress,
  extractLayerGroupFromAddress,
  extractLayerFromAddress,
  parseToggleActionFromAddressAndArgs,
} from '../resolumeHelpers';
import { Field, INPUT_STYLE, SelectField } from '../fields';
import type { DeviceParamsResult, SharedFormCtx } from '../deviceRegistry';
import type { SelectOption } from '../deviceFunctionSets';

export interface ResolumeState {
  resolumeMasterAction: ResolumeMasterAction;
  setResolumeMasterAction: (v: ResolumeMasterAction) => void;
  resolumeMasterValue: string;
  setResolumeMasterValue: (v: string) => void;
  resolumeLayer: string;
  setResolumeLayer: (v: string) => void;
  resolumeClip: string;
  setResolumeClip: (v: string) => void;
  resolumeColumnAction: ResolumeMasterAction;
  setResolumeColumnAction: (v: ResolumeMasterAction) => void;
  resolumeColumnValue: string;
  setResolumeColumnValue: (v: string) => void;
  resolumeLayerNumber: string;
  setResolumeLayerNumber: (v: string) => void;
  resolumeLayerGroupNumber: string;
  setResolumeLayerGroupNumber: (v: string) => void;
  resolumeLastColumn: string;
  setResolumeLastColumn: (v: string) => void;
  resolumeToggleAction: ResolumeToggleAction;
  setResolumeToggleAction: (v: ResolumeToggleAction) => void;
  resolumeDeckAction: ResolumeMasterAction;
  setResolumeDeckAction: (v: ResolumeMasterAction) => void;
  resolumeDeckValue: string;
  setResolumeDeckValue: (v: string) => void;
  resolumeCustomOscAddress: string;
  setResolumeCustomOscAddress: (v: string) => void;
  resolumeCustomOscArgs: string;
  setResolumeCustomOscArgs: (v: string) => void;
}

export function useResolumeState(): ResolumeState {
  const [resolumeMasterAction, setResolumeMasterAction] =
    useState<ResolumeMasterAction>('=');
  const [resolumeMasterValue, setResolumeMasterValue] = useState('');
  const [resolumeLayer, setResolumeLayer] = useState('1');
  const [resolumeClip, setResolumeClip] = useState('1');
  const [resolumeColumnAction, setResolumeColumnAction] =
    useState<ResolumeMasterAction>('=');
  const [resolumeColumnValue, setResolumeColumnValue] = useState('');
  const [resolumeLayerNumber, setResolumeLayerNumber] = useState('1');
  const [resolumeLayerGroupNumber, setResolumeLayerGroupNumber] = useState('1');
  const [resolumeLastColumn, setResolumeLastColumn] = useState('4');
  const [resolumeToggleAction, setResolumeToggleAction] =
    useState<ResolumeToggleAction>('toggle');
  const [resolumeDeckAction, setResolumeDeckAction] =
    useState<ResolumeMasterAction>('=');
  const [resolumeDeckValue, setResolumeDeckValue] = useState('');
  const [resolumeCustomOscAddress, setResolumeCustomOscAddress] = useState('');
  const [resolumeCustomOscArgs, setResolumeCustomOscArgs] = useState('');

  return {
    resolumeMasterAction,
    setResolumeMasterAction,
    resolumeMasterValue,
    setResolumeMasterValue,
    resolumeLayer,
    setResolumeLayer,
    resolumeClip,
    setResolumeClip,
    resolumeColumnAction,
    setResolumeColumnAction,
    resolumeColumnValue,
    setResolumeColumnValue,
    resolumeLayerNumber,
    setResolumeLayerNumber,
    resolumeLayerGroupNumber,
    setResolumeLayerGroupNumber,
    resolumeLastColumn,
    setResolumeLastColumn,
    resolumeToggleAction,
    setResolumeToggleAction,
    resolumeDeckAction,
    setResolumeDeckAction,
    resolumeDeckValue,
    setResolumeDeckValue,
    resolumeCustomOscAddress,
    setResolumeCustomOscAddress,
    resolumeCustomOscArgs,
    setResolumeCustomOscArgs,
  };
}

export function resetResolumeFields(state: ResolumeState) {
  state.setResolumeMasterAction('=');
  state.setResolumeMasterValue('');
  state.setResolumeLayer('1');
  state.setResolumeClip('1');
  state.setResolumeColumnAction('=');
  state.setResolumeColumnValue('');
  state.setResolumeLayerNumber('1');
  state.setResolumeLayerGroupNumber('1');
  state.setResolumeLastColumn('4');
  state.setResolumeToggleAction('toggle');
  state.setResolumeDeckAction('=');
  state.setResolumeDeckValue('');
  state.setResolumeCustomOscAddress('');
  state.setResolumeCustomOscArgs('');
}

export function handleResolumeAction(
  state: ResolumeState,
  ctx: SharedFormCtx,
  nextFuncName: string
) {
  ctx.setFuncName(nextFuncName);
  const match = Object.entries(ctx.cat.categories).find(([, functions]) =>
    functions.includes(nextFuncName)
  );
  ctx.setCategory(match?.[0] ?? '');
  if (
    isResolumeCompositionChangeFunction(nextFuncName) ||
    isResolumeClipChangeFunction(nextFuncName) ||
    isResolumeLayerChangeFunction(nextFuncName) ||
    isResolumeLayerGroupChangeFunction(nextFuncName)
  ) {
    state.setResolumeMasterAction('=');
    state.setResolumeMasterValue('');
  }
  if (
    isResolumeClipChangeFunction(nextFuncName) ||
    isResolumeClipSelectionFunction(nextFuncName)
  ) {
    state.setResolumeLayer('1');
    state.setResolumeClip('1');
  }
  if (isResolumeColumnActionFunction(nextFuncName)) {
    state.setResolumeColumnAction('=');
    state.setResolumeColumnValue('');
    state.setResolumeLayerGroupNumber('1');
  }
  if (isResolumeLayerColumnStepFunction(nextFuncName)) {
    state.setResolumeLayerNumber('1');
  }
  if (isResolumeLayerGroupColumnStepFunction(nextFuncName)) {
    state.setResolumeLayerGroupNumber('1');
    state.setResolumeLastColumn('4');
  }
  if (isResolumeLayerSelectFunction(nextFuncName)) {
    if (isLayerGroupSelectFunction(nextFuncName)) {
      state.setResolumeLayerGroupNumber('1');
    } else {
      state.setResolumeLayerNumber('1');
    }
  }
  if (isResolumeLayerClearFunction(nextFuncName)) {
    if (isLayerGroupClearFunction(nextFuncName)) {
      state.setResolumeLayerGroupNumber('1');
    } else {
      state.setResolumeLayerNumber('1');
    }
  }
  if (isResolumeLayerChangeFunction(nextFuncName)) {
    state.setResolumeLayerNumber('1');
  }
  if (isResolumeLayerGroupChangeFunction(nextFuncName)) {
    state.setResolumeLayerGroupNumber('1');
  }
  if (isResolumeToggleFunction(nextFuncName)) {
    state.setResolumeToggleAction('toggle');
    if (isLayerGroupToggleFunction(nextFuncName)) {
      state.setResolumeLayerGroupNumber('1');
    } else {
      state.setResolumeLayerNumber('1');
    }
  }
  if (isResolumeDeckSelectFunction(nextFuncName)) {
    state.setResolumeDeckAction('=');
    state.setResolumeDeckValue('');
  }
  if (isResolumeCustomOscFunction(nextFuncName)) {
    state.setResolumeCustomOscAddress('');
    state.setResolumeCustomOscArgs('');
  }
}

export function hydrateResolume(
  state: ResolumeState,
  selectedTask: TaskEntry,
  params: Record<string, unknown>,
  nextDevice: string
) {
  if (
    nextDevice === 'resolume' &&
    isResolumeCompositionChangeFunction(selectedTask.funcName)
  ) {
    const rawAction =
      typeof params.resolumeCompositionAction === 'string'
        ? params.resolumeCompositionAction
        : typeof params.resolumeMasterAction === 'string'
          ? params.resolumeMasterAction
          : selectedTask.input;
    const parsedAction: ResolumeMasterAction =
      rawAction === '+' || rawAction === '-' || rawAction === '='
        ? rawAction
        : '=';
    const rawValue =
      typeof params.resolumeCompositionValue === 'number'
        ? params.resolumeCompositionValue
        : typeof params.resolumeMasterPercent === 'number'
          ? params.resolumeMasterPercent
          : selectedTask.value;
    const parsedPercent =
      typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? String(rawValue)
        : String(rawValue ?? '');
    state.setResolumeMasterAction(parsedAction);
    state.setResolumeMasterValue(parsedPercent);
  } else if (
    nextDevice === 'resolume' &&
    isResolumeClipChangeFunction(selectedTask.funcName)
  ) {
    const rawAction =
      typeof params.resolumeClipAction === 'string'
        ? params.resolumeClipAction
        : selectedTask.input;
    const parsedAction: ResolumeMasterAction =
      rawAction === '+' || rawAction === '-' || rawAction === '='
        ? rawAction
        : '=';
    const rawValue =
      typeof params.resolumeClipValue === 'number'
        ? params.resolumeClipValue
        : selectedTask.value;
    const parsedValue =
      typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? String(rawValue)
        : String(rawValue ?? '');
    const fromAddress = extractLayerClipFromAddress(
      typeof params.address === 'string' ? params.address : undefined
    );
    const parsedLayer =
      parsePositiveIntegerValue(params.resolumeClipLayer) ??
      parsePositiveIntegerValue(params.layer) ??
      fromAddress?.layer ??
      1;
    const parsedClip =
      parsePositiveIntegerValue(params.resolumeClipColumn) ??
      parsePositiveIntegerValue(params.clip) ??
      parsePositiveIntegerValue(params.column) ??
      fromAddress?.clip ??
      1;

    state.setResolumeMasterAction(parsedAction);
    state.setResolumeMasterValue(parsedValue);
    state.setResolumeLayer(String(parsedLayer));
    state.setResolumeClip(String(parsedClip));
  } else if (
    nextDevice === 'resolume' &&
    isResolumeClipSelectionFunction(selectedTask.funcName)
  ) {
    const fromAddress = extractLayerClipFromAddress(
      typeof params.address === 'string' ? params.address : undefined
    );
    const parsedLayer =
      parsePositiveIntegerValue(params.resolumeClipLayer) ??
      parsePositiveIntegerValue(params.layer) ??
      parsePositiveIntegerValue(selectedTask.input) ??
      fromAddress?.layer ??
      1;
    const parsedClip =
      parsePositiveIntegerValue(params.resolumeClipColumn) ??
      parsePositiveIntegerValue(params.clip) ??
      parsePositiveIntegerValue(params.column) ??
      parsePositiveIntegerValue(selectedTask.value) ??
      fromAddress?.clip ??
      1;
    state.setResolumeLayer(String(parsedLayer));
    state.setResolumeClip(String(parsedClip));
  } else if (
    nextDevice === 'resolume' &&
    isResolumeColumnActionFunction(selectedTask.funcName)
  ) {
    const address =
      typeof params.address === 'string' ? params.address : undefined;
    const parsedAction =
      typeof params.resolumeColumnAction === 'string' &&
      (params.resolumeColumnAction === '+' ||
        params.resolumeColumnAction === '-' ||
        params.resolumeColumnAction === '=')
        ? params.resolumeColumnAction
        : selectedTask.input === '+' ||
            selectedTask.input === '-' ||
            selectedTask.input === '='
          ? selectedTask.input
          : (detectColumnActionFromAddress(address) ?? '=');
    const parsedColumn =
      parsePositiveIntegerValue(params.resolumeColumnValue) ??
      parsePositiveIntegerValue(selectedTask.value) ??
      extractColumnValueFromAddress(address) ??
      1;
    const parsedLayerGroup =
      parsePositiveIntegerValue(params.resolumeLayerGroup) ??
      parsePositiveIntegerValue(params.layerGroup) ??
      extractLayerGroupFromAddress(address) ??
      1;
    state.setResolumeColumnAction(parsedAction);
    state.setResolumeColumnValue(String(parsedColumn));
    state.setResolumeLayerGroupNumber(String(parsedLayerGroup));
  } else if (
    nextDevice === 'resolume' &&
    isResolumeLayerColumnStepFunction(selectedTask.funcName)
  ) {
    const address =
      typeof params.address === 'string' ? params.address : undefined;
    const parsedLayer =
      parsePositiveIntegerValue(params.resolumeLayerNumber) ??
      parsePositiveIntegerValue(params.layer) ??
      parsePositiveIntegerValue(selectedTask.input) ??
      extractLayerFromAddress(address) ??
      1;
    state.setResolumeLayerNumber(String(parsedLayer));
  } else if (
    nextDevice === 'resolume' &&
    isResolumeLayerGroupColumnStepFunction(selectedTask.funcName)
  ) {
    const address =
      typeof params.address === 'string' ? params.address : undefined;
    const parsedLayerGroup =
      parsePositiveIntegerValue(params.resolumeLayerGroup) ??
      parsePositiveIntegerValue(params.layerGroup) ??
      parsePositiveIntegerValue(selectedTask.input) ??
      extractLayerGroupFromAddress(address) ??
      1;
    const parsedLastColumn =
      parsePositiveIntegerValue(params.resolumeLastColumn) ??
      parsePositiveIntegerValue(selectedTask.value) ??
      4;
    state.setResolumeLayerGroupNumber(String(parsedLayerGroup));
    state.setResolumeLastColumn(String(parsedLastColumn));
  } else if (
    nextDevice === 'resolume' &&
    isResolumeToggleFunction(selectedTask.funcName)
  ) {
    const address =
      typeof params.address === 'string' ? params.address : undefined;
    const parsedAction =
      typeof params.resolumeToggleAction === 'string' &&
      ['toggle', 'on', 'off'].includes(
        params.resolumeToggleAction.toLowerCase()
      )
        ? (params.resolumeToggleAction.toLowerCase() as ResolumeToggleAction)
        : typeof selectedTask.value === 'string' &&
            ['toggle', 'on', 'off'].includes(selectedTask.value.toLowerCase())
          ? (selectedTask.value.toLowerCase() as ResolumeToggleAction)
          : parseToggleActionFromAddressAndArgs(address, params.args);
    const nextToggleAction: ResolumeToggleAction = parsedAction ?? 'toggle';

    if (isLayerGroupToggleFunction(selectedTask.funcName)) {
      const parsedGroup =
        parsePositiveIntegerValue(params.resolumeLayerGroup) ??
        parsePositiveIntegerValue(params.layerGroup) ??
        parsePositiveIntegerValue(selectedTask.input) ??
        extractLayerGroupFromAddress(address) ??
        1;
      state.setResolumeLayerGroupNumber(String(parsedGroup));
    } else {
      const parsedLayer =
        parsePositiveIntegerValue(params.resolumeLayerNumber) ??
        parsePositiveIntegerValue(params.layer) ??
        parsePositiveIntegerValue(selectedTask.input) ??
        extractLayerFromAddress(address) ??
        1;
      state.setResolumeLayerNumber(String(parsedLayer));
    }

    state.setResolumeToggleAction(nextToggleAction);
  } else if (
    nextDevice === 'resolume' &&
    isResolumeLayerChangeFunction(selectedTask.funcName)
  ) {
    const address =
      typeof params.address === 'string' ? params.address : undefined;
    const rawAction =
      typeof params.resolumeLayerAction === 'string'
        ? params.resolumeLayerAction
        : selectedTask.input;
    const parsedAction: ResolumeMasterAction =
      rawAction === '+' || rawAction === '-' || rawAction === '='
        ? rawAction
        : (detectDeltaActionFromAddress(address) ?? '=');
    const rawValue =
      typeof params.resolumeLayerValue === 'number'
        ? params.resolumeLayerValue
        : selectedTask.value;
    const parsedValue =
      typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? String(rawValue)
        : String(rawValue ?? '');
    const parsedLayer =
      parsePositiveIntegerValue(params.resolumeLayerNumber) ??
      parsePositiveIntegerValue(params.layer) ??
      parsePositiveIntegerValue(selectedTask.input) ??
      extractLayerFromAddress(address) ??
      1;
    state.setResolumeMasterAction(parsedAction);
    state.setResolumeMasterValue(parsedValue);
    state.setResolumeLayerNumber(String(parsedLayer));
  } else if (
    nextDevice === 'resolume' &&
    isResolumeLayerGroupChangeFunction(selectedTask.funcName)
  ) {
    const address =
      typeof params.address === 'string' ? params.address : undefined;
    const rawAction =
      typeof params.resolumeLayerGroupAction === 'string'
        ? params.resolumeLayerGroupAction
        : selectedTask.input;
    const parsedAction: ResolumeMasterAction =
      rawAction === '+' || rawAction === '-' || rawAction === '='
        ? rawAction
        : (detectDeltaActionFromAddress(address) ?? '=');
    const rawValue =
      typeof params.resolumeLayerGroupValue === 'number'
        ? params.resolumeLayerGroupValue
        : selectedTask.value;
    const parsedValue =
      typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? String(rawValue)
        : String(rawValue ?? '');
    const parsedLayerGroup =
      parsePositiveIntegerValue(params.resolumeLayerGroup) ??
      parsePositiveIntegerValue(params.layerGroup) ??
      parsePositiveIntegerValue(selectedTask.input) ??
      extractLayerGroupFromAddress(address) ??
      1;
    state.setResolumeMasterAction(parsedAction);
    state.setResolumeMasterValue(parsedValue);
    state.setResolumeLayerGroupNumber(String(parsedLayerGroup));
  } else if (
    nextDevice === 'resolume' &&
    isResolumeLayerSelectFunction(selectedTask.funcName)
  ) {
    const address =
      typeof params.address === 'string' ? params.address : undefined;
    if (isLayerGroupSelectFunction(selectedTask.funcName)) {
      const parsedLayerGroup =
        parsePositiveIntegerValue(params.resolumeLayerGroup) ??
        parsePositiveIntegerValue(params.layerGroup) ??
        parsePositiveIntegerValue(selectedTask.input) ??
        extractLayerGroupFromAddress(address) ??
        1;
      state.setResolumeLayerGroupNumber(String(parsedLayerGroup));
    } else {
      const parsedLayer =
        parsePositiveIntegerValue(params.resolumeLayerNumber) ??
        parsePositiveIntegerValue(params.layer) ??
        parsePositiveIntegerValue(selectedTask.input) ??
        extractLayerFromAddress(address) ??
        1;
      state.setResolumeLayerNumber(String(parsedLayer));
    }
  } else if (
    nextDevice === 'resolume' &&
    isResolumeLayerClearFunction(selectedTask.funcName)
  ) {
    const address =
      typeof params.address === 'string' ? params.address : undefined;
    if (selectedTask.funcName === 'Clear All Layers') {
      state.setResolumeLayerNumber('1');
    } else if (isLayerGroupClearFunction(selectedTask.funcName)) {
      const parsedLayerGroup =
        parsePositiveIntegerValue(params.resolumeLayerGroup) ??
        parsePositiveIntegerValue(params.layerGroup) ??
        parsePositiveIntegerValue(selectedTask.input) ??
        extractLayerGroupFromAddress(address) ??
        1;
      state.setResolumeLayerGroupNumber(String(parsedLayerGroup));
    } else {
      const parsedLayer =
        parsePositiveIntegerValue(params.resolumeLayerNumber) ??
        parsePositiveIntegerValue(params.layer) ??
        parsePositiveIntegerValue(selectedTask.input) ??
        extractLayerFromAddress(address) ??
        1;
      state.setResolumeLayerNumber(String(parsedLayer));
    }
  } else if (
    nextDevice === 'resolume' &&
    isResolumeDeckSelectFunction(selectedTask.funcName)
  ) {
    const address =
      typeof params.address === 'string' ? params.address : undefined;
    const rawAction =
      typeof params.resolumeDeckAction === 'string'
        ? params.resolumeDeckAction
        : selectedTask.input;
    const parsedAction: ResolumeMasterAction =
      rawAction === '+' || rawAction === '-' || rawAction === '='
        ? rawAction
        : (detectDeckActionFromAddress(address) ?? '=');
    const parsedDeck =
      parsePositiveIntegerValue(params.resolumeDeckValue) ??
      parsePositiveIntegerValue(selectedTask.value) ??
      extractDeckValueFromAddress(address) ??
      1;
    state.setResolumeDeckAction(parsedAction);
    state.setResolumeDeckValue(String(parsedDeck));
  } else if (
    nextDevice === 'resolume' &&
    isResolumeDeckStepFunction(selectedTask.funcName)
  ) {
    // no extra fields, action fully encoded by function choice
    state.setResolumeDeckAction(
      selectedTask.funcName === 'Select Next Deck' ? '+' : '-'
    );
    state.setResolumeDeckValue('');
  } else if (
    nextDevice === 'resolume' &&
    isResolumeCustomOscFunction(selectedTask.funcName)
  ) {
    const address =
      typeof params.address === 'string' ? params.address : selectedTask.input;
    const argsText =
      typeof params.argsText === 'string'
        ? params.argsText
        : Array.isArray(params.args)
          ? JSON.stringify(params.args)
          : selectedTask.value;
    state.setResolumeCustomOscAddress(String(address ?? ''));
    state.setResolumeCustomOscArgs(String(argsText ?? ''));
  } else if (
    nextDevice === 'resolume' &&
    isResolumeCompositionColumnStepFunction(selectedTask.funcName)
  ) {
    // no extra fields
  }
}

export function buildResolumeParams(
  state: ResolumeState,
  ctx: SharedFormCtx
): DeviceParamsResult | null {
  const { funcName } = ctx;
  const isResolumeCompositionChange =
    isResolumeCompositionChangeFunction(funcName);
  const isResolumeClipChange = isResolumeClipChangeFunction(funcName);
  const isResolumeClipSelection = isResolumeClipSelectionFunction(funcName);
  const isResolumeColumnAction = isResolumeColumnActionFunction(funcName);
  const isResolumeLayerColumnStep = isResolumeLayerColumnStepFunction(funcName);
  const isResolumeLayerGroupColumnStep =
    isResolumeLayerGroupColumnStepFunction(funcName);
  const isResolumeToggleActionFunction = isResolumeToggleFunction(funcName);
  const isResolumeLayerChange = isResolumeLayerChangeFunction(funcName);
  const isResolumeLayerGroupChange =
    isResolumeLayerGroupChangeFunction(funcName);
  const isResolumeLayerSelect = isResolumeLayerSelectFunction(funcName);
  const isResolumeLayerClear = isResolumeLayerClearFunction(funcName);
  const isResolumeDeckSelect = isResolumeDeckSelectFunction(funcName);
  const isResolumeDeckStep = isResolumeDeckStepFunction(funcName);
  const isResolumeCompositionColumnStep =
    isResolumeCompositionColumnStepFunction(funcName);
  const isResolumeCustomOsc = isResolumeCustomOscFunction(funcName);
  const isResolumeDbValueFunction =
    funcName === 'Composition Volume Change' ||
    funcName === 'Clip Volume Change' ||
    funcName === 'Layer Volume Change' ||
    funcName === 'Layer Group Volume Change';

  const {
    resolumeMasterAction,
    resolumeMasterValue,
    resolumeLayer,
    resolumeClip,
    resolumeColumnAction,
    resolumeColumnValue,
    resolumeLayerNumber,
    resolumeLayerGroupNumber,
    resolumeLastColumn,
    resolumeToggleAction,
    resolumeDeckAction,
    resolumeDeckValue,
    resolumeCustomOscAddress,
    resolumeCustomOscArgs,
  } = state;

  if (isResolumeCompositionChange) {
    const parsedPercent = parseResolvableNumber(resolumeMasterValue);
    if (parsedPercent === null || parsedPercent < 0) {
      return null;
    }

    const normalized = isResolumeDbValueFunction
      ? parsedPercent
      : parsedPercent / 100;
    return {
      input: resolumeMasterAction,
      value: resolumeMasterValue,
      label: `Resolume: ${funcName} (${resolumeMasterAction}${parsedPercent}${isResolumeDbValueFunction ? 'dB' : '%'})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveCompositionChangeAddress(funcName, resolumeMasterAction),
        args: [normalized],
        resolumeCompositionFunction: funcName,
        resolumeCompositionAction: resolumeMasterAction,
        resolumeCompositionValue: parsedPercent,
        resolumeValueUnit:
          funcName === 'Composition Volume Change' ? 'db' : 'percent',
        // Backward compatibility for tasks created before this refactor.
        resolumeMasterAction:
          funcName === 'Composition Master Change'
            ? resolumeMasterAction
            : undefined,
        resolumeMasterPercent:
          funcName === 'Composition Master Change' ? parsedPercent : undefined,
      },
    };
  }

  if (isResolumeClipChange) {
    const parsedValue = parseResolvableNumber(resolumeMasterValue);
    const parsedLayer = parsePositiveIntegerValue(resolumeLayer);
    const parsedClip = parsePositiveIntegerValue(resolumeClip);
    if (
      parsedValue === null ||
      parsedValue < 0 ||
      parsedLayer === null ||
      parsedClip === null
    ) {
      return null;
    }

    const normalized =
      funcName === 'Clip Volume Change' ? parsedValue : parsedValue / 100;
    return {
      input: resolumeMasterAction,
      value: resolumeMasterValue,
      label: `Resolume: ${funcName} (L${parsedLayer} C${parsedClip}, ${resolumeMasterAction}${parsedValue}${funcName === 'Clip Volume Change' ? 'dB' : '%'})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveClipChangeAddress(
          funcName,
          parsedLayer,
          parsedClip,
          resolumeMasterAction
        ),
        args: [normalized],
        resolumeClipFunction: funcName,
        resolumeClipAction: resolumeMasterAction,
        resolumeClipValue: parsedValue,
        resolumeClipLayer: parsedLayer,
        resolumeClipColumn: parsedClip,
        resolumeValueUnit: funcName === 'Clip Volume Change' ? 'db' : 'percent',
      },
    };
  }

  if (isResolumeClipSelection) {
    const parsedLayer = parsePositiveIntegerValue(resolumeLayer);
    const parsedClip = parsePositiveIntegerValue(resolumeClip);
    if (parsedLayer === null || parsedClip === null) {
      return null;
    }

    return {
      input: String(parsedLayer),
      value: String(parsedClip),
      label: `Resolume: ${funcName} (L${parsedLayer} C${parsedClip})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveClipSelectionAddress(funcName, parsedLayer, parsedClip),
        args: [],
        resolumeClipFunction: funcName,
        resolumeClipLayer: parsedLayer,
        resolumeClipColumn: parsedClip,
      },
    };
  }

  if (isResolumeColumnAction) {
    const parsedValue = parsePositiveIntegerValue(resolumeColumnValue);
    const parsedLayerGroup = parsePositiveIntegerValue(
      resolumeLayerGroupNumber
    );
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
      input: resolumeColumnAction,
      value: resolumeColumnValue,
      label: isLayerGroupColumnAction(funcName)
        ? `Resolume: ${funcName} (Group ${layerGroup}, ${resolumeColumnAction}${parsedValue})`
        : `Resolume: ${funcName} (${resolumeColumnAction}${parsedValue})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveColumnActionAddress(
          funcName,
          resolumeColumnAction,
          parsedValue,
          layerGroup
        ),
        args: [],
        resolumeColumnFunction: funcName,
        resolumeColumnAction,
        resolumeColumnValue: parsedValue,
        resolumeLayerGroup: layerGroup ?? undefined,
      },
    };
  }

  if (isResolumeLayerColumnStep) {
    const parsedLayer = parsePositiveIntegerValue(resolumeLayerNumber);
    if (parsedLayer === null) {
      return null;
    }

    return {
      input: String(parsedLayer),
      value: '',
      label: `Resolume: ${funcName} (Layer ${parsedLayer})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveLayerColumnStepAddress(funcName, parsedLayer),
        args: [],
        resolumeLayerColumnFunction: funcName,
        resolumeLayerNumber: parsedLayer,
      },
    };
  }

  if (isResolumeLayerGroupColumnStep) {
    const parsedLayerGroup = parsePositiveIntegerValue(
      resolumeLayerGroupNumber
    );
    const parsedLastColumn = parsePositiveIntegerValue(resolumeLastColumn);
    if (parsedLayerGroup === null || parsedLastColumn === null) {
      return null;
    }

    return {
      input: String(parsedLayerGroup),
      value: String(parsedLastColumn),
      label: `Resolume: ${funcName} (Group ${parsedLayerGroup}, last ${parsedLastColumn})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveLayerGroupColumnStepAddress(funcName, parsedLayerGroup),
        args: [],
        resolumeLayerGroupColumnFunction: funcName,
        resolumeLayerGroup: parsedLayerGroup,
        resolumeLastColumn: parsedLastColumn,
      },
    };
  }

  if (isResolumeToggleActionFunction) {
    const target = isLayerGroupToggleFunction(funcName)
      ? parsePositiveIntegerValue(resolumeLayerGroupNumber)
      : parsePositiveIntegerValue(resolumeLayerNumber);
    if (target === null) {
      return null;
    }

    return {
      input: String(target),
      value: resolumeToggleAction,
      label: isLayerGroupToggleFunction(funcName)
        ? `Resolume: ${funcName} (Group ${target}, ${resolumeToggleAction})`
        : `Resolume: ${funcName} (Layer ${target}, ${resolumeToggleAction})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveToggleAddress(funcName, target, resolumeToggleAction),
        args: resolveToggleArgs(resolumeToggleAction),
        resolumeToggleFunction: funcName,
        resolumeToggleAction,
        resolumeLayerNumber: isLayerGroupToggleFunction(funcName)
          ? undefined
          : target,
        resolumeLayerGroup: isLayerGroupToggleFunction(funcName)
          ? target
          : undefined,
      },
    };
  }

  if (isResolumeLayerChange) {
    const parsedLayer = parsePositiveIntegerValue(resolumeLayerNumber);
    const parsedValue = parseResolvableNumber(resolumeMasterValue);
    if (parsedLayer === null || parsedValue === null || parsedValue < 0) {
      return null;
    }

    const normalized =
      funcName === 'Layer Volume Change' ||
      funcName === 'Layer Transition Duration Change'
        ? parsedValue
        : parsedValue / 100;
    const valueUnit =
      funcName === 'Layer Volume Change'
        ? 'db'
        : funcName === 'Layer Transition Duration Change'
          ? 'seconds'
          : 'percent';
    const valueSuffix =
      valueUnit === 'db' ? 'dB' : valueUnit === 'seconds' ? 's' : '%';

    return {
      input: resolumeMasterAction,
      value: resolumeMasterValue,
      label: `Resolume: ${funcName} (Layer ${parsedLayer}, ${resolumeMasterAction}${parsedValue}${valueSuffix})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveLayerChangeAddress(
          funcName,
          parsedLayer,
          resolumeMasterAction
        ),
        args: [normalized],
        resolumeLayerFunction: funcName,
        resolumeLayerAction: resolumeMasterAction,
        resolumeLayerValue: parsedValue,
        resolumeLayerNumber: parsedLayer,
        resolumeValueUnit: valueUnit,
      },
    };
  }

  if (isResolumeLayerGroupChange) {
    const parsedLayerGroup = parsePositiveIntegerValue(
      resolumeLayerGroupNumber
    );
    const parsedValue = parseResolvableNumber(resolumeMasterValue);
    if (parsedLayerGroup === null || parsedValue === null || parsedValue < 0) {
      return null;
    }

    const normalized =
      funcName === 'Layer Group Volume Change' ? parsedValue : parsedValue / 100;
    const valueUnit = funcName === 'Layer Group Volume Change' ? 'db' : 'percent';
    const valueSuffix = valueUnit === 'db' ? 'dB' : '%';

    return {
      input: resolumeMasterAction,
      value: resolumeMasterValue,
      label: `Resolume: ${funcName} (Group ${parsedLayerGroup}, ${resolumeMasterAction}${parsedValue}${valueSuffix})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveLayerGroupChangeAddress(
          funcName,
          parsedLayerGroup,
          resolumeMasterAction
        ),
        args: [normalized],
        resolumeLayerGroupFunction: funcName,
        resolumeLayerGroupAction: resolumeMasterAction,
        resolumeLayerGroupValue: parsedValue,
        resolumeLayerGroup: parsedLayerGroup,
        resolumeValueUnit: valueUnit,
      },
    };
  }

  if (isResolumeLayerSelect) {
    const parsedTarget = isLayerGroupSelectFunction(funcName)
      ? parsePositiveIntegerValue(resolumeLayerGroupNumber)
      : parsePositiveIntegerValue(resolumeLayerNumber);
    if (parsedTarget === null) {
      return null;
    }

    return {
      input: String(parsedTarget),
      value: '',
      label: isLayerGroupSelectFunction(funcName)
        ? `Resolume: ${funcName} (Group ${parsedTarget})`
        : `Resolume: ${funcName} (Layer ${parsedTarget})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveLayerSelectAddress(funcName, parsedTarget),
        args: [],
        resolumeLayerSelectFunction: funcName,
        resolumeLayerNumber: isLayerGroupSelectFunction(funcName)
          ? undefined
          : parsedTarget,
        resolumeLayerGroup: isLayerGroupSelectFunction(funcName)
          ? parsedTarget
          : undefined,
      },
    };
  }

  if (isResolumeLayerClear) {
    const parsedTarget =
      funcName === 'Clear All Layers'
        ? null
        : isLayerGroupClearFunction(funcName)
          ? parsePositiveIntegerValue(resolumeLayerGroupNumber)
          : parsePositiveIntegerValue(resolumeLayerNumber);
    if (funcName !== 'Clear All Layers' && parsedTarget === null) {
      return null;
    }

    return {
      input: parsedTarget === null ? '' : String(parsedTarget),
      value: '',
      label:
        funcName === 'Clear All Layers'
          ? 'Resolume: Clear All Layers'
          : isLayerGroupClearFunction(funcName)
            ? `Resolume: ${funcName} (Group ${parsedTarget})`
            : `Resolume: ${funcName} (Layer ${parsedTarget})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveLayerClearAddress(funcName, parsedTarget),
        args: [],
        resolumeLayerClearFunction: funcName,
        resolumeLayerNumber:
          funcName === 'Clear Layer' ? (parsedTarget ?? undefined) : undefined,
        resolumeLayerGroup:
          funcName === 'Clear Layer Group'
            ? (parsedTarget ?? undefined)
            : undefined,
      },
    };
  }

  if (isResolumeDeckSelect) {
    const parsedDeck = parsePositiveIntegerValue(resolumeDeckValue);
    if (parsedDeck === null) {
      return null;
    }

    return {
      input: resolumeDeckAction,
      value: resolumeDeckValue,
      label: `Resolume: ${funcName} (${resolumeDeckAction}${parsedDeck})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveDeckSelectAddress(resolumeDeckAction, parsedDeck),
        args: [],
        resolumeDeckFunction: funcName,
        resolumeDeckAction,
        resolumeDeckValue: parsedDeck,
      },
    };
  }

  if (isResolumeDeckStep) {
    return {
      input: '',
      value: '',
      label: `Resolume: ${funcName}`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveDeckStepAddress(funcName),
        args: [],
        resolumeDeckFunction: funcName,
      },
    };
  }

  if (isResolumeCompositionColumnStep) {
    return {
      input: '',
      value: '',
      label: `Resolume: ${funcName}`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address: resolveCompositionColumnStepAddress(funcName),
        args: [],
        resolumeCompositionColumnFunction: funcName,
      },
    };
  }

  if (isResolumeCustomOsc) {
    const address = normalizeOscAddress(resolumeCustomOscAddress);
    if (!address) {
      return null;
    }
    const args = parseCustomOscArgs(resolumeCustomOscArgs);
    return {
      input: address,
      value: resolumeCustomOscArgs,
      label: `Resolume: Custom OSC (${address})`,
      params: {
        protocol: 'osc',
        action: 'osc',
        address,
        args,
        argsText: resolumeCustomOscArgs,
        resolumeCustomOsc: true,
      },
    };
  }

  return null;
}

export function ResolumeFunctionStep({
  state,
  ctx,
}: {
  state: ResolumeState;
  ctx: SharedFormCtx;
}) {
  const resolumeActionOptions: SelectOption[] = Object.entries(
    ctx.cat.categories
  ).flatMap(([group, functions]) =>
    functions.map((fn) => ({
      value: fn,
      label: `${group} | ${fn}`,
    }))
  );
  return (
    <Field label="Resolume Action">
      <SelectField
        value={ctx.funcName}
        options={resolumeActionOptions}
        onChange={(next) => handleResolumeAction(state, ctx, next)}
        placeholder="Select an action"
      />
    </Field>
  );
}

export function ResolumeParamFields({
  state,
  ctx,
}: {
  state: ResolumeState;
  ctx: SharedFormCtx;
}) {
  const { funcName } = ctx;
  const {
    resolumeMasterAction,
    setResolumeMasterAction,
    resolumeMasterValue,
    setResolumeMasterValue,
    resolumeLayer,
    setResolumeLayer,
    resolumeClip,
    setResolumeClip,
    resolumeColumnAction,
    setResolumeColumnAction,
    resolumeColumnValue,
    setResolumeColumnValue,
    resolumeLayerNumber,
    setResolumeLayerNumber,
    resolumeLayerGroupNumber,
    setResolumeLayerGroupNumber,
    resolumeLastColumn,
    setResolumeLastColumn,
    resolumeToggleAction,
    setResolumeToggleAction,
    resolumeDeckAction,
    setResolumeDeckAction,
    resolumeDeckValue,
    setResolumeDeckValue,
    resolumeCustomOscAddress,
    setResolumeCustomOscAddress,
    resolumeCustomOscArgs,
    setResolumeCustomOscArgs,
  } = state;

  const isResolumeCompositionChange =
    isResolumeCompositionChangeFunction(funcName);
  const isResolumeClipChange = isResolumeClipChangeFunction(funcName);
  const isResolumeClipSelection = isResolumeClipSelectionFunction(funcName);
  const isResolumeColumnActionActive = isResolumeColumnActionFunction(funcName);
  const isResolumeLayerColumnStep = isResolumeLayerColumnStepFunction(funcName);
  const isResolumeLayerGroupColumnStep =
    isResolumeLayerGroupColumnStepFunction(funcName);
  const isResolumeToggleActionFunction = isResolumeToggleFunction(funcName);
  const isResolumeLayerGroupChange =
    isResolumeLayerGroupChangeFunction(funcName);
  const isResolumeLayerChange = isResolumeLayerChangeFunction(funcName);
  const isResolumeLayerSelect = isResolumeLayerSelectFunction(funcName);
  const isResolumeLayerClear = isResolumeLayerClearFunction(funcName);
  const isResolumeDeckSelect = isResolumeDeckSelectFunction(funcName);
  const isResolumeDeckStep = isResolumeDeckStepFunction(funcName);
  const isResolumeCompositionColumnStep =
    isResolumeCompositionColumnStepFunction(funcName);
  const isResolumeCustomOsc = isResolumeCustomOscFunction(funcName);

  const resolumeValueLabel =
    funcName === 'Layer Transition Duration Change'
      ? 'Value in seconds (e.g. 1 or 0.1)'
      : funcName === 'Composition Volume Change' ||
          funcName === 'Clip Volume Change' ||
          funcName === 'Layer Volume Change' ||
          funcName === 'Layer Group Volume Change'
        ? 'Value in db (e.g. 100 or 10)'
        : 'Value in percentage (e.g. 100 or 10)';
  const resolumeDeltaActionOptions: SelectOption[] =
    funcName === 'Clip Speed Change'
      ? [{ value: '+', label: '+ (not in OSC)' }, '-', '=']
      : ['+', '-', '='];
  const resolumeColumnActionOptions: SelectOption[] = ['+', '-', '='];
  const resolumeToggleOptions: SelectOption[] = [
    { value: 'toggle', label: 'Toggle' },
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
  ];
  const isResolumeLayerGroupToggleAction =
    isResolumeToggleActionFunction && isLayerGroupToggleFunction(funcName);
  const isResolumeLayerGroupSelectAction =
    isResolumeLayerSelect && isLayerGroupSelectFunction(funcName);
  const isResolumeLayerGroupClearAction =
    isResolumeLayerClear && isLayerGroupClearFunction(funcName);
  const isResolumeLayerGroupColumnAction =
    isResolumeColumnActionActive && isLayerGroupColumnAction(funcName);

  if (isResolumeCompositionChange) {
    return (
      <>
        <Field label="Action">
          <SelectField
            value={resolumeMasterAction}
            options={resolumeDeltaActionOptions}
            onChange={(next) =>
              setResolumeMasterAction(
                next === '+' || next === '-' || next === '=' ? next : '='
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
    );
  }
  if (isResolumeClipChange) {
    return (
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
                next === '+' || next === '-' || next === '=' ? next : '='
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
    );
  }
  if (isResolumeClipSelection) {
    return (
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
    );
  }
  if (isResolumeColumnActionActive) {
    return (
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
                next === '+' || next === '-' || next === '=' ? next : '='
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
    );
  }
  if (isResolumeLayerColumnStep) {
    return (
      <Field label="Layer Number">
        <input
          style={INPUT_STYLE}
          value={resolumeLayerNumber}
          onChange={(e) => setResolumeLayerNumber(e.target.value)}
          placeholder="1"
        />
      </Field>
    );
  }
  if (isResolumeLayerGroupColumnStep) {
    return (
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
    );
  }
  if (isResolumeToggleActionFunction) {
    return (
      <>
        <Field label={isResolumeLayerGroupToggleAction ? 'Layer Group' : 'Layer'}>
          <input
            style={INPUT_STYLE}
            value={
              isResolumeLayerGroupToggleAction
                ? resolumeLayerGroupNumber
                : resolumeLayerNumber
            }
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

        <Field label={funcName.includes('Bypass') ? 'Bypass' : 'Solo'}>
          <SelectField
            value={resolumeToggleAction}
            options={resolumeToggleOptions}
            onChange={(next) =>
              setResolumeToggleAction(
                next === 'on' || next === 'off' ? next : 'toggle'
              )
            }
          />
        </Field>
      </>
    );
  }
  if (isResolumeLayerGroupChange) {
    return (
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
                next === '+' || next === '-' || next === '=' ? next : '='
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
    );
  }
  if (isResolumeLayerChange) {
    return (
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
                next === '+' || next === '-' || next === '=' ? next : '='
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
    );
  }
  if (isResolumeLayerSelect) {
    return (
      <Field label={isResolumeLayerGroupSelectAction ? 'Layer Group' : 'Layer'}>
        <input
          style={INPUT_STYLE}
          value={
            isResolumeLayerGroupSelectAction
              ? resolumeLayerGroupNumber
              : resolumeLayerNumber
          }
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
    );
  }
  if (isResolumeLayerClear) {
    if (funcName === 'Clear All Layers') return null;
    return (
      <Field label={isResolumeLayerGroupClearAction ? 'Layer Group' : 'Layer'}>
        <input
          style={INPUT_STYLE}
          value={
            isResolumeLayerGroupClearAction
              ? resolumeLayerGroupNumber
              : resolumeLayerNumber
          }
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
    );
  }
  if (isResolumeDeckSelect) {
    return (
      <>
        <Field label="Action">
          <SelectField
            value={resolumeDeckAction}
            options={resolumeColumnActionOptions}
            onChange={(next) =>
              setResolumeDeckAction(
                next === '+' || next === '-' || next === '=' ? next : '='
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
    );
  }
  if (isResolumeDeckStep) return null;
  if (isResolumeCompositionColumnStep) return null;
  if (isResolumeCustomOsc) {
    return (
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
    );
  }
  return null;
}
