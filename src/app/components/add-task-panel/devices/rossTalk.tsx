import { useMemo, useState } from 'react';
import type { TaskEntry } from '../../../types';
import {
  ROSS_TALK_CUSTOM_COMMAND_REFERENCE,
  ROSS_TALK_FUNCTIONS_WITHOUT_EXTRA_FIELDS,
  ROSS_TALK_FUNCTION_ORDER,
  buildRossTalkMleKeyerReference,
  buildRossTalkTransitionToken,
  isRossTalkCustomCommandFunction,
  parseRossTalkMleKeyerReference,
  parseRossTalkMultiviewerBox,
  parseRossTalkTransitionToken,
} from '../rossTalkHelpers';
import type { SelectOption } from '../deviceFunctionSets';
import { P } from '../constants';
import {
  Field,
  INPUT_STYLE,
  InlineField,
  PURPLE_ACCENT_TEXT,
  SelectField,
} from '../fields';
import type { DeviceParamsResult, SharedFormCtx } from '../deviceRegistry';

export interface RossTalkState {
  rossTalkMle: string;
  setRossTalkMle: (v: string) => void;
  rossTalkMultiviewerNumber: string;
  setRossTalkMultiviewerNumber: (v: string) => void;
  rossTalkBoxNumber: string;
  setRossTalkBoxNumber: (v: string) => void;
  rossTalkSource: string;
  setRossTalkSource: (v: string) => void;
  rossTalkCcBank: string;
  setRossTalkCcBank: (v: string) => void;
  rossTalkCcNumber: string;
  setRossTalkCcNumber: (v: string) => void;
  rossTalkSetName: string;
  setRossTalkSetName: (v: string) => void;
  rossTalkSetLocation: string;
  setRossTalkSetLocation: (v: string) => void;
  rossTalkMemoryId: string;
  setRossTalkMemoryId: (v: string) => void;
  rossTalkCommand: string;
  setRossTalkCommand: (v: string) => void;
  rossTalkTakeId: string;
  setRossTalkTakeId: (v: string) => void;
  rossTalkLayer: string;
  setRossTalkLayer: (v: string) => void;
  rossTalkKeyer: string;
  setRossTalkKeyer: (v: string) => void;
  rossTalkTransitionOnOff: 'toggle' | 'on' | 'off';
  setRossTalkTransitionOnOff: (v: 'toggle' | 'on' | 'off') => void;
  rossTalkTransitionType: 'CUT' | 'AUTO';
  setRossTalkTransitionType: (v: 'CUT' | 'AUTO') => void;
  rossTalkGpiNumber: string;
  setRossTalkGpiNumber: (v: string) => void;
  rossTalkGpiName: string;
  setRossTalkGpiName: (v: string) => void;
  rossTalkGpiParameter: string;
  setRossTalkGpiParameter: (v: string) => void;
  rossTalkXptDestination: string;
  setRossTalkXptDestination: (v: string) => void;
  rossTalkXptSource: string;
  setRossTalkXptSource: (v: string) => void;
  rossTalkTimerId: string;
  setRossTalkTimerId: (v: string) => void;
  rossTalkTimerAction: string;
  setRossTalkTimerAction: (v: string) => void;
  rossTalkFunctionOptions: SelectOption[];
  rossTalkOrderedFunctionOptions: Array<{ value: string; label: string }>;
  rossTalkTransitionOnOffOptions: SelectOption[];
  rossTalkTransitionTypeOptions: SelectOption[];
  rossTalkTimerActionOptions: SelectOption[];
}

export function useRossTalkState(cat: SharedFormCtx['cat']): RossTalkState {
  const [rossTalkMle, setRossTalkMle] = useState('ME:1');
  const [rossTalkMultiviewerNumber, setRossTalkMultiviewerNumber] =
    useState('1');
  const [rossTalkBoxNumber, setRossTalkBoxNumber] = useState('1');
  const [rossTalkSource, setRossTalkSource] = useState('IN:5');
  const [rossTalkCcBank, setRossTalkCcBank] = useState('1');
  const [rossTalkCcNumber, setRossTalkCcNumber] = useState('1');
  const [rossTalkSetName, setRossTalkSetName] = useState('set1');
  const [rossTalkSetLocation, setRossTalkSetLocation] = useState('');
  const [rossTalkMemoryId, setRossTalkMemoryId] = useState('1:1');
  const [rossTalkCommand, setRossTalkCommand] = useState('');
  const [rossTalkTakeId, setRossTalkTakeId] = useState('0');
  const [rossTalkLayer, setRossTalkLayer] = useState('0');
  const [rossTalkKeyer, setRossTalkKeyer] = useState('1');
  const [rossTalkTransitionOnOff, setRossTalkTransitionOnOff] = useState<
    'toggle' | 'on' | 'off'
  >('toggle');
  const [rossTalkTransitionType, setRossTalkTransitionType] = useState<
    'CUT' | 'AUTO'
  >('CUT');
  const [rossTalkGpiNumber, setRossTalkGpiNumber] = useState('1');
  const [rossTalkGpiName, setRossTalkGpiName] = useState('');
  const [rossTalkGpiParameter, setRossTalkGpiParameter] = useState('');
  const [rossTalkXptDestination, setRossTalkXptDestination] =
    useState('ME:1:PGM');
  const [rossTalkXptSource, setRossTalkXptSource] = useState('IN:20');
  const [rossTalkTimerId, setRossTalkTimerId] = useState('1');
  const [rossTalkTimerAction, setRossTalkTimerAction] = useState('RUN');

  const rossTalkFunctionOptions = useMemo<SelectOption[]>(
    () =>
      Object.entries(cat.categories).flatMap(([, functions]) =>
        functions.map((fn) => ({ value: fn, label: fn }))
      ),
    [cat.categories]
  );
  const rossTalkOrderedFunctionOptions = useMemo<
    Array<{ value: string; label: string }>
  >(() => {
    const normalized = rossTalkFunctionOptions.map((option) =>
      typeof option === 'string'
        ? { value: option, label: option }
        : { value: option.value, label: option.label }
    );
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
  }, [rossTalkFunctionOptions]);
  const rossTalkTransitionOnOffOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'toggle', label: 'Toggle Keyer' },
      { value: 'on', label: 'Take Keyer On Air' },
      { value: 'off', label: 'Take Keyer Off Air' },
    ],
    []
  );
  const rossTalkTransitionTypeOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'CUT', label: 'Cut Transition' },
      { value: 'AUTO', label: 'Auto Transition' },
    ],
    []
  );
  const rossTalkTimerActionOptions = useMemo<SelectOption[]>(
    () => ['RUN', 'PAUSE', 'STOP', 'END'],
    []
  );

  return {
    rossTalkMle,
    setRossTalkMle,
    rossTalkMultiviewerNumber,
    setRossTalkMultiviewerNumber,
    rossTalkBoxNumber,
    setRossTalkBoxNumber,
    rossTalkSource,
    setRossTalkSource,
    rossTalkCcBank,
    setRossTalkCcBank,
    rossTalkCcNumber,
    setRossTalkCcNumber,
    rossTalkSetName,
    setRossTalkSetName,
    rossTalkSetLocation,
    setRossTalkSetLocation,
    rossTalkMemoryId,
    setRossTalkMemoryId,
    rossTalkCommand,
    setRossTalkCommand,
    rossTalkTakeId,
    setRossTalkTakeId,
    rossTalkLayer,
    setRossTalkLayer,
    rossTalkKeyer,
    setRossTalkKeyer,
    rossTalkTransitionOnOff,
    setRossTalkTransitionOnOff,
    rossTalkTransitionType,
    setRossTalkTransitionType,
    rossTalkGpiNumber,
    setRossTalkGpiNumber,
    rossTalkGpiName,
    setRossTalkGpiName,
    rossTalkGpiParameter,
    setRossTalkGpiParameter,
    rossTalkXptDestination,
    setRossTalkXptDestination,
    rossTalkXptSource,
    setRossTalkXptSource,
    rossTalkTimerId,
    setRossTalkTimerId,
    rossTalkTimerAction,
    setRossTalkTimerAction,
    rossTalkFunctionOptions,
    rossTalkOrderedFunctionOptions,
    rossTalkTransitionOnOffOptions,
    rossTalkTransitionTypeOptions,
    rossTalkTimerActionOptions,
  };
}

/** Sets mode/category the same way selecting any rossTalk function does. */
export function handleRossTalkFunction(
  nextFuncName: string,
  ctx: SharedFormCtx
) {
  ctx.setMode('Direct');
  ctx.setFuncName(nextFuncName);
  const match = Object.entries(ctx.cat.categories).find(([, functions]) =>
    functions.includes(nextFuncName)
  );
  ctx.setCategory(match?.[0] ?? 'General');
}

export function resetRossTalkFields(state: RossTalkState) {
  state.setRossTalkMle('ME:1');
  state.setRossTalkMultiviewerNumber('1');
  state.setRossTalkBoxNumber('1');
  state.setRossTalkSource('IN:5');
  state.setRossTalkCcBank('1');
  state.setRossTalkCcNumber('1');
  state.setRossTalkSetName('set1');
  state.setRossTalkSetLocation('');
  state.setRossTalkMemoryId('1:1');
  state.setRossTalkCommand('');
  state.setRossTalkTakeId('0');
  state.setRossTalkLayer('0');
  state.setRossTalkKeyer('1');
  state.setRossTalkTransitionOnOff('toggle');
  state.setRossTalkTransitionType('CUT');
  state.setRossTalkGpiNumber('1');
  state.setRossTalkGpiName('');
  state.setRossTalkGpiParameter('');
  state.setRossTalkXptDestination('ME:1:PGM');
  state.setRossTalkXptSource('IN:20');
  state.setRossTalkTimerId('1');
  state.setRossTalkTimerAction('RUN');
}

export function hydrateRossTalk(
  state: RossTalkState,
  selectedTask: TaskEntry,
  params: Record<string, unknown>
) {
  const taskInput = (selectedTask.input ?? '').trim();
  const taskValue = (selectedTask.value ?? '').trim();
  const keyerRef =
    (typeof params.keyerRef === 'string' ? params.keyerRef : null) ??
    taskInput;
  const parsedKeyerRef = parseRossTalkMleKeyerReference(keyerRef);
  const parsedTransition = parseRossTalkTransitionToken(
    typeof params.transition === 'string' ? params.transition : taskValue
  );
  const parsedMvBox = parseRossTalkMultiviewerBox(taskInput);

  state.setRossTalkMle(
    (typeof params.mle === 'string' ? params.mle : null) ??
      parsedKeyerRef?.mle ??
      (taskInput || 'ME:1')
  );
  state.setRossTalkKeyer(
    (typeof params.keyer === 'string' ? params.keyer : null) ??
      parsedKeyerRef?.keyer ??
      '1'
  );
  state.setRossTalkTransitionOnOff(parsedTransition.onOff);
  state.setRossTalkTransitionType(parsedTransition.transitionType);

  state.setRossTalkMultiviewerNumber(
    (typeof params.multiviewer === 'string' ? params.multiviewer : null) ??
      parsedMvBox?.multiviewer ??
      '1'
  );
  state.setRossTalkBoxNumber(
    (typeof params.box === 'string' ? params.box : null) ??
      parsedMvBox?.box ??
      '1'
  );
  state.setRossTalkSource(
    (typeof params.source === 'string' ? params.source : null) ??
      (taskValue || 'IN:5')
  );
  state.setRossTalkCcBank(
    (typeof params.bank === 'string' ? params.bank : null) ?? taskInput ?? '1'
  );
  state.setRossTalkCcNumber(
    (typeof params.cc === 'string' ? params.cc : null) ?? taskValue ?? '1'
  );
  state.setRossTalkSetName(
    (typeof params.set === 'string' ? params.set : null) ?? taskInput ?? 'set1'
  );
  state.setRossTalkSetLocation(
    (typeof params.location === 'string' ? params.location : null) ??
      taskValue ??
      ''
  );
  state.setRossTalkMemoryId(
    (typeof params.memId === 'string' ? params.memId : null) ??
      taskInput ??
      '1:1'
  );
  state.setRossTalkCommand(
    (typeof params.command === 'string' ? params.command : null) ??
      (taskInput || taskValue)
  );
  state.setRossTalkTakeId(
    (typeof params.takeId === 'string' ? params.takeId : null) ??
      taskInput ??
      '0'
  );
  state.setRossTalkLayer(
    (typeof params.layer === 'string' ? params.layer : null) ??
      taskValue ??
      '0'
  );
  state.setRossTalkGpiNumber(
    (typeof params.gpi === 'string' ? params.gpi : null) ?? taskInput ?? '1'
  );
  state.setRossTalkGpiName(
    (typeof params.gpiName === 'string' ? params.gpiName : null) ??
      taskInput ??
      ''
  );
  state.setRossTalkGpiParameter(
    (typeof params.parameter === 'string' ? params.parameter : null) ??
      taskValue ??
      ''
  );
  state.setRossTalkXptDestination(
    (typeof params.destination === 'string' ? params.destination : null) ??
      taskInput ??
      'ME:1:PGM'
  );
  state.setRossTalkXptSource(
    (typeof params.source === 'string' ? params.source : null) ??
      taskValue ??
      'IN:20'
  );
  state.setRossTalkTimerId(
    (typeof params.timerId === 'string' ? params.timerId : null) ??
      taskInput ??
      '1'
  );
  state.setRossTalkTimerAction(
    (typeof params.timerAction === 'string' ? params.timerAction : null) ??
      (taskValue || 'RUN')
  );
}

export function buildRossTalkParams(
  state: RossTalkState,
  ctx: SharedFormCtx
): DeviceParamsResult | null {
  const funcName = ctx.funcName;
  let nextInput = ctx.input;
  let nextValue = ctx.value;
  let summary = '';

  switch (funcName) {
    case 'Auto Transition':
    case 'Cut': {
      const mleToken = state.rossTalkMle.trim();
      if (!mleToken) return null;
      nextInput = mleToken;
      nextValue = '';
      summary = mleToken;
      break;
    }
    case 'Change Multiviewer Box': {
      const multiviewerToken = state.rossTalkMultiviewerNumber.trim();
      const boxToken = state.rossTalkBoxNumber.trim();
      const sourceToken = state.rossTalkSource.trim();
      if (!multiviewerToken || !boxToken || !sourceToken) return null;
      nextInput = `${multiviewerToken}:${boxToken}`;
      nextValue = sourceToken;
      summary = `MV ${multiviewerToken}, Box ${boxToken}, ${sourceToken}`;
      break;
    }
    case 'Fire Custom Control': {
      const bankToken = state.rossTalkCcBank.trim();
      const ccToken = state.rossTalkCcNumber.trim();
      if (!bankToken || !ccToken) return null;
      nextInput = bankToken;
      nextValue = ccToken;
      summary = `Bank ${bankToken}, CC ${ccToken}`;
      break;
    }
    case 'Load Set': {
      const setToken = state.rossTalkSetName.trim();
      if (!setToken) return null;
      nextInput = setToken;
      nextValue = state.rossTalkSetLocation.trim();
      summary = nextValue ? `${setToken} (${nextValue})` : setToken;
      break;
    }
    case 'MEM': {
      const memToken = state.rossTalkMemoryId.trim();
      if (!memToken) return null;
      nextInput = memToken;
      nextValue = '';
      summary = memToken;
      break;
    }
    case 'SEQI': {
      const takeIdToken = state.rossTalkTakeId.trim();
      const layerToken = state.rossTalkLayer.trim();
      if (!takeIdToken || !layerToken) return null;
      nextInput = takeIdToken;
      nextValue = layerToken;
      summary = `Take ${takeIdToken}, Layer ${layerToken}`;
      break;
    }
    case 'SEQO': {
      const takeIdToken = state.rossTalkTakeId.trim();
      if (!takeIdToken) return null;
      nextInput = takeIdToken;
      nextValue = '';
      summary = `Take ${takeIdToken}`;
      break;
    }
    case 'Transition Keyer': {
      const keyerRef = buildRossTalkMleKeyerReference(
        state.rossTalkMle,
        state.rossTalkKeyer
      );
      if (!keyerRef) return null;
      nextInput = keyerRef;
      nextValue = buildRossTalkTransitionToken(
        state.rossTalkTransitionOnOff,
        state.rossTalkTransitionType
      );
      summary = `${keyerRef}, ${nextValue}`;
      break;
    }
    case 'Trigger GPI': {
      const gpiToken = state.rossTalkGpiNumber.trim();
      if (!gpiToken) return null;
      nextInput = gpiToken;
      nextValue = '';
      summary = `GPI ${gpiToken}`;
      break;
    }
    case 'Trigger GPI by Name': {
      const nameToken = state.rossTalkGpiName.trim();
      if (!nameToken) return null;
      nextInput = nameToken;
      nextValue = state.rossTalkGpiParameter.trim();
      summary = nextValue ? `${nameToken} (${nextValue})` : nameToken;
      break;
    }
    case 'XPT': {
      const destinationToken = state.rossTalkXptDestination.trim();
      const sourceToken = state.rossTalkXptSource.trim();
      if (!destinationToken || !sourceToken) return null;
      nextInput = destinationToken;
      nextValue = sourceToken;
      summary = `${destinationToken} -> ${sourceToken}`;
      break;
    }
    case 'Ultrix Timer': {
      const timerToken = state.rossTalkTimerId.trim();
      const actionToken = state.rossTalkTimerAction.trim().toUpperCase();
      if (!timerToken || !actionToken) return null;
      nextInput = timerToken;
      nextValue = actionToken;
      summary = `Timer ${timerToken}, ${actionToken}`;
      break;
    }
    default: {
      if (isRossTalkCustomCommandFunction(funcName)) {
        const commandToken =
          state.rossTalkCommand.trim() || ctx.input.trim() || ctx.value.trim();
        if (!commandToken) return null;
        nextInput = commandToken;
        nextValue = '';
        summary = commandToken;
      } else if (ROSS_TALK_FUNCTIONS_WITHOUT_EXTRA_FIELDS.has(funcName)) {
        nextInput = '';
        nextValue = '';
        summary = '';
      }
      break;
    }
  }

  return {
    label: summary
      ? `RossTalk: ${funcName} (${summary})`
      : `RossTalk: ${funcName}`,
    input: nextInput,
    value: nextValue,
    params: {
      action: 'command',
      mle: state.rossTalkMle.trim() || undefined,
      multiviewer: state.rossTalkMultiviewerNumber.trim() || undefined,
      box: state.rossTalkBoxNumber.trim() || undefined,
      source:
        (funcName === 'XPT'
          ? state.rossTalkXptSource
          : state.rossTalkSource
        ).trim() || undefined,
      bank: state.rossTalkCcBank.trim() || undefined,
      cc: state.rossTalkCcNumber.trim() || undefined,
      set: state.rossTalkSetName.trim() || undefined,
      location: state.rossTalkSetLocation.trim() || undefined,
      memId: state.rossTalkMemoryId.trim() || undefined,
      command: state.rossTalkCommand.trim() || undefined,
      takeId: state.rossTalkTakeId.trim() || undefined,
      layer: state.rossTalkLayer.trim() || undefined,
      keyer: state.rossTalkKeyer.trim() || undefined,
      keyerRef:
        buildRossTalkMleKeyerReference(state.rossTalkMle, state.rossTalkKeyer) ||
        undefined,
      transition: buildRossTalkTransitionToken(
        state.rossTalkTransitionOnOff,
        state.rossTalkTransitionType
      ),
      gpi: state.rossTalkGpiNumber.trim() || undefined,
      gpiName: state.rossTalkGpiName.trim() || undefined,
      parameter: state.rossTalkGpiParameter.trim() || undefined,
      destination: state.rossTalkXptDestination.trim() || undefined,
      timerId: state.rossTalkTimerId.trim() || undefined,
      timerAction: state.rossTalkTimerAction.trim().toUpperCase() || undefined,
    },
  };
}

export function RossTalkFunctionStep({
  state,
  ctx,
}: {
  state: RossTalkState;
  ctx: SharedFormCtx;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <Field label="Function">
        <SelectField
          value={ctx.funcName}
          options={state.rossTalkOrderedFunctionOptions}
          onChange={(next) => handleRossTalkFunction(next, ctx)}
          placeholder="Select a function"
        />
      </Field>
    </div>
  );
}

export function RossTalkParamFields({
  state,
  ctx,
}: {
  state: RossTalkState;
  ctx: SharedFormCtx;
}) {
  const funcName = ctx.funcName;
  return (
    <div
      className="rounded-none border px-[10px] py-[10px]"
      style={{
        borderColor: P.surface700,
        backgroundColor: P.surface900,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: P.text50,
          marginBottom: 10,
        }}
      >
        rosstalk: {funcName || 'Select a function'}
      </div>
      <div className="flex flex-col" style={{ gap: 10 }}>
        {isRossTalkCustomCommandFunction(funcName) ? (
          <>
            <InlineField label="Command">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkCommand}
                onChange={(e) => state.setRossTalkCommand(e.target.value)}
                placeholder="XPT ME:1:PGM IN:20"
              />
            </InlineField>
            <div
              className="rounded-none border px-[10px] py-[8px]"
              style={{
                borderColor: P.surface700,
                backgroundColor: P.ink950,
                marginLeft: 0,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: PURPLE_ACCENT_TEXT,
                  marginBottom: 6,
                }}
              >
                RossTalk Custom Command Reference
              </div>
              <div
                className="grid grid-cols-1 gap-[6px] max-h-[170px] overflow-y-auto app-scrollbar pr-[2px]"
                style={{
                  fontSize: 10,
                  color: P.text300,
                  lineHeight: 1.45,
                }}
              >
                {ROSS_TALK_CUSTOM_COMMAND_REFERENCE.map((entry) => (
                  <div
                    key={`${entry.command}-${entry.syntax}`}
                    className="rounded-none border px-[8px] py-[6px]"
                    style={{
                      borderColor: P.surface700,
                      backgroundColor: P.surface900,
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
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : funcName === 'Auto Transition' || funcName === 'Cut' ? (
          <InlineField label="MLE">
            <input
              style={INPUT_STYLE}
              value={state.rossTalkMle}
              onChange={(e) => state.setRossTalkMle(e.target.value)}
              placeholder="ME:1"
            />
          </InlineField>
        ) : funcName === 'Change Multiviewer Box' ? (
          <>
            <InlineField label="Multiviewer Number">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkMultiviewerNumber}
                onChange={(e) =>
                  state.setRossTalkMultiviewerNumber(e.target.value)
                }
                placeholder="1"
              />
            </InlineField>
            <InlineField label="Box Number">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkBoxNumber}
                onChange={(e) => state.setRossTalkBoxNumber(e.target.value)}
                placeholder="1"
              />
            </InlineField>
            <InlineField label="Source">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkSource}
                onChange={(e) => state.setRossTalkSource(e.target.value)}
                placeholder="IN:5"
              />
            </InlineField>
          </>
        ) : funcName === 'Fire Custom Control' ? (
          <>
            <InlineField label="CC Bank">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkCcBank}
                onChange={(e) => state.setRossTalkCcBank(e.target.value)}
                placeholder="1"
              />
            </InlineField>
            <InlineField label="CC Number">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkCcNumber}
                onChange={(e) => state.setRossTalkCcNumber(e.target.value)}
                placeholder="1"
              />
            </InlineField>
          </>
        ) : funcName === 'Load Set' ? (
          <>
            <InlineField label="Set name">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkSetName}
                onChange={(e) => state.setRossTalkSetName(e.target.value)}
                placeholder="set1"
              />
            </InlineField>
            <InlineField label="Location (optional)">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkSetLocation}
                onChange={(e) => state.setRossTalkSetLocation(e.target.value)}
                placeholder="USB"
              />
            </InlineField>
          </>
        ) : funcName === 'MEM' ? (
          <InlineField label="Memory ID">
            <input
              style={INPUT_STYLE}
              value={state.rossTalkMemoryId}
              onChange={(e) => state.setRossTalkMemoryId(e.target.value)}
              placeholder="1:1"
            />
          </InlineField>
        ) : funcName === 'SEQI' ? (
          <>
            <InlineField label="take ID">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkTakeId}
                onChange={(e) => state.setRossTalkTakeId(e.target.value)}
                placeholder="0"
              />
            </InlineField>
            <InlineField label="Layer">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkLayer}
                onChange={(e) => state.setRossTalkLayer(e.target.value)}
                placeholder="0"
              />
            </InlineField>
          </>
        ) : funcName === 'SEQO' ? (
          <InlineField label="take ID">
            <input
              style={INPUT_STYLE}
              value={state.rossTalkTakeId}
              onChange={(e) => state.setRossTalkTakeId(e.target.value)}
              placeholder="0"
            />
          </InlineField>
        ) : funcName === 'Transition Keyer' ? (
          <>
            <InlineField label="MLE">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkMle}
                onChange={(e) => state.setRossTalkMle(e.target.value)}
                placeholder="ME:1"
              />
            </InlineField>
            <InlineField label="Keyer">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkKeyer}
                onChange={(e) => state.setRossTalkKeyer(e.target.value)}
                placeholder="1"
              />
            </InlineField>
            <InlineField label="Transition On/Off Air">
              <SelectField
                value={state.rossTalkTransitionOnOff}
                options={state.rossTalkTransitionOnOffOptions}
                onChange={(next) =>
                  state.setRossTalkTransitionOnOff(
                    next === 'on' || next === 'off' ? next : 'toggle'
                  )
                }
              />
            </InlineField>
            <InlineField label="Transition type">
              <SelectField
                value={state.rossTalkTransitionType}
                options={state.rossTalkTransitionTypeOptions}
                onChange={(next) =>
                  state.setRossTalkTransitionType(next === 'AUTO' ? 'AUTO' : 'CUT')
                }
              />
            </InlineField>
          </>
        ) : funcName === 'Trigger GPI' ? (
          <InlineField label="Number">
            <input
              style={INPUT_STYLE}
              value={state.rossTalkGpiNumber}
              onChange={(e) => state.setRossTalkGpiNumber(e.target.value)}
              placeholder="1"
            />
          </InlineField>
        ) : funcName === 'Trigger GPI by Name' ? (
          <>
            <InlineField label="Name">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkGpiName}
                onChange={(e) => state.setRossTalkGpiName(e.target.value)}
                placeholder=""
              />
            </InlineField>
            <InlineField label="Parameter">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkGpiParameter}
                onChange={(e) => state.setRossTalkGpiParameter(e.target.value)}
                placeholder=""
              />
            </InlineField>
          </>
        ) : funcName === 'XPT' ? (
          <>
            <InlineField label="Destination">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkXptDestination}
                onChange={(e) =>
                  state.setRossTalkXptDestination(e.target.value)
                }
                placeholder="ME:1:PGM"
              />
            </InlineField>
            <InlineField label="Source">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkXptSource}
                onChange={(e) => state.setRossTalkXptSource(e.target.value)}
                placeholder="IN:20"
              />
            </InlineField>
          </>
        ) : funcName === 'Ultrix Timer' ? (
          <>
            <InlineField label="Timer Number">
              <input
                style={INPUT_STYLE}
                value={state.rossTalkTimerId}
                onChange={(e) => state.setRossTalkTimerId(e.target.value)}
                placeholder="1"
              />
            </InlineField>
            <InlineField label="Action">
              <SelectField
                value={state.rossTalkTimerAction}
                options={state.rossTalkTimerActionOptions}
                onChange={(next) => state.setRossTalkTimerAction(next || 'RUN')}
              />
            </InlineField>
          </>
        ) : ROSS_TALK_FUNCTIONS_WITHOUT_EXTRA_FIELDS.has(funcName) ? null : (
          <>
            <InlineField label="Input">
              <input
                style={INPUT_STYLE}
                value={ctx.input}
                onChange={(e) => ctx.setInput(e.target.value)}
                placeholder=""
              />
            </InlineField>
            <InlineField label="Value (if required)">
              <input
                style={INPUT_STYLE}
                value={ctx.value}
                onChange={(e) => ctx.setValue(e.target.value)}
                placeholder=""
              />
            </InlineField>
          </>
        )}
      </div>
    </div>
  );
}
