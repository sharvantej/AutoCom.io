import { useState } from 'react';
import type { TaskEntry } from '../../../types';
import {
  asTaskParams,
  parseIntegerValue,
  parseNonNegativeIntegerValue,
  parsePositiveIntegerValue,
} from '../sharedUtils';
import {
  MA2_BUTTON_OPTIONS,
  MA2_DIRECTION_OPTIONS,
  MA2_DOWN_UP_OPTIONS,
  MA2_ENCODER_SELECT_OPTIONS,
  MA2_FUNCTIONS,
  MA2_ROTATE_DIRECTION_OPTIONS,
  type MA2Direction,
  type MA2DownUpDirection,
  type MA2RotateDirection,
} from '../deviceFunctionSets';
import {
  BooleanCheckboxField,
  Field,
  INPUT_STYLE,
  SelectField,
} from '../fields';
import type { DeviceParamsResult, SharedFormCtx } from '../deviceRegistry';

export interface Grandma2State {
  ma2ButtonNumber: string;
  setMa2ButtonNumber: (v: string) => void;
  ma2ButtonDirection: MA2Direction;
  setMa2ButtonDirection: (v: MA2Direction) => void;
  ma2EncoderPressNumber: string;
  setMa2EncoderPressNumber: (v: string) => void;
  ma2EncoderPressUseVariable: 'false' | 'true';
  setMa2EncoderPressUseVariable: (v: 'false' | 'true') => void;
  ma2EncoderPressVariable: string;
  setMa2EncoderPressVariable: (v: string) => void;
  ma2EncoderPressDirection: MA2DownUpDirection;
  setMa2EncoderPressDirection: (v: MA2DownUpDirection) => void;
  ma2WheelSteps: string;
  setMa2WheelSteps: (v: string) => void;
  ma2RotateEncoderNumber: string;
  setMa2RotateEncoderNumber: (v: string) => void;
  ma2RotateUseVariable: 'false' | 'true';
  setMa2RotateUseVariable: (v: 'false' | 'true') => void;
  ma2RotateEncoderVariable: string;
  setMa2RotateEncoderVariable: (v: string) => void;
  ma2RotateDirection: MA2RotateDirection;
  setMa2RotateDirection: (v: MA2RotateDirection) => void;
  ma2RotateSteps: string;
  setMa2RotateSteps: (v: string) => void;
  ma2CustomCommand: string;
  setMa2CustomCommand: (v: string) => void;
}

export function useGrandma2State(): Grandma2State {
  const [ma2ButtonNumber, setMa2ButtonNumber] = useState('11');
  const [ma2ButtonDirection, setMa2ButtonDirection] =
    useState<MA2Direction>('press');
  const [ma2EncoderPressNumber, setMa2EncoderPressNumber] = useState('1');
  const [ma2EncoderPressUseVariable, setMa2EncoderPressUseVariable] = useState<
    'false' | 'true'
  >('false');
  const [ma2EncoderPressVariable, setMa2EncoderPressVariable] = useState('1');
  const [ma2EncoderPressDirection, setMa2EncoderPressDirection] =
    useState<MA2DownUpDirection>('true');
  const [ma2WheelSteps, setMa2WheelSteps] = useState('1');
  const [ma2RotateEncoderNumber, setMa2RotateEncoderNumber] = useState('1');
  const [ma2RotateUseVariable, setMa2RotateUseVariable] = useState<
    'false' | 'true'
  >('false');
  const [ma2RotateEncoderVariable, setMa2RotateEncoderVariable] = useState('1');
  const [ma2RotateDirection, setMa2RotateDirection] =
    useState<MA2RotateDirection>('1');
  const [ma2RotateSteps, setMa2RotateSteps] = useState('1');
  const [ma2CustomCommand, setMa2CustomCommand] = useState('');

  return {
    ma2ButtonNumber,
    setMa2ButtonNumber,
    ma2ButtonDirection,
    setMa2ButtonDirection,
    ma2EncoderPressNumber,
    setMa2EncoderPressNumber,
    ma2EncoderPressUseVariable,
    setMa2EncoderPressUseVariable,
    ma2EncoderPressVariable,
    setMa2EncoderPressVariable,
    ma2EncoderPressDirection,
    setMa2EncoderPressDirection,
    ma2WheelSteps,
    setMa2WheelSteps,
    ma2RotateEncoderNumber,
    setMa2RotateEncoderNumber,
    ma2RotateUseVariable,
    setMa2RotateUseVariable,
    ma2RotateEncoderVariable,
    setMa2RotateEncoderVariable,
    ma2RotateDirection,
    setMa2RotateDirection,
    ma2RotateSteps,
    setMa2RotateSteps,
    ma2CustomCommand,
    setMa2CustomCommand,
  };
}

/** Matches the setMa2* reset lines duplicated at AddTaskPanel's two handleConn branches. */
export function resetGrandma2Fields(state: Grandma2State) {
  state.setMa2ButtonNumber('1');
  state.setMa2ButtonDirection('press');
  state.setMa2EncoderPressNumber('1');
  state.setMa2WheelSteps('1');
  state.setMa2RotateEncoderNumber('1');
  state.setMa2RotateSteps('1');
  state.setMa2CustomCommand('');
}

export function hydrateGrandma2(
  state: Grandma2State,
  selectedTask: TaskEntry,
  params: Record<string, unknown>,
  ctx: SharedFormCtx
) {
  const options = asTaskParams(params.options);
  const definitionId =
    typeof params.definitionId === 'string' ? params.definitionId.trim() : '';
  const normalizedFunc = MA2_FUNCTIONS.has(selectedTask.funcName)
    ? selectedTask.funcName
    : 'Run Custom Command';
  const button =
    parsePositiveIntegerValue(options.button) ??
    parsePositiveIntegerValue(selectedTask.input) ??
    1;
  const encoder =
    parseNonNegativeIntegerValue(options.enc) ??
    parseNonNegativeIntegerValue(selectedTask.input) ??
    1;
  const encoderVariable =
    parsePositiveIntegerValue(options.encoder_variable) ?? 1;
  const encoderFromVariable =
    String(options.encoder_from_variable ?? '')
      .trim()
      .toLowerCase() === 'true';
  const wheelSteps =
    parseIntegerValue(options.steps) ?? parseIntegerValue(selectedTask.value) ?? 1;
  const rotateSteps =
    parseIntegerValue(options.steps) ?? parseIntegerValue(selectedTask.value) ?? 1;
  const dirRaw = String(options.dir ?? '')
    .trim()
    .toLowerCase();
  const direction: MA2Direction =
    dirRaw === 'false' || dirRaw === 'release' ? 'release' : 'press';
  const encoderPressDirection: MA2DownUpDirection =
    dirRaw === 'false' ? 'false' : 'true';
  const rotateDirection: MA2RotateDirection = dirRaw === '-1' ? '-1' : '1';
  const command =
    String(params.command ?? '').trim() ||
    (selectedTask.input ?? '').trim() ||
    (selectedTask.value ?? '').trim();

  ctx.setFuncName(normalizedFunc);
  if (definitionId === 'button' || normalizedFunc === 'Button Press/Release') {
    state.setMa2ButtonNumber(String(button));
    state.setMa2ButtonDirection(direction);
  }
  if (
    definitionId === 'encoder_p' ||
    normalizedFunc === 'Encoder Press/Release'
  ) {
    state.setMa2EncoderPressNumber(String(encoder));
    state.setMa2EncoderPressUseVariable(encoderFromVariable ? 'true' : 'false');
    state.setMa2EncoderPressVariable(String(encoderVariable));
    state.setMa2EncoderPressDirection(encoderPressDirection);
  }
  if (definitionId === 'wheel' || normalizedFunc === 'Move wheel up/down') {
    state.setMa2WheelSteps(String(wheelSteps));
  }
  if (definitionId === 'encoder' || normalizedFunc === 'Rotate Encoder') {
    state.setMa2RotateEncoderNumber(String(encoder));
    state.setMa2RotateUseVariable(encoderFromVariable ? 'true' : 'false');
    state.setMa2RotateEncoderVariable(String(encoderVariable));
    state.setMa2RotateDirection(rotateDirection);
    state.setMa2RotateSteps(String(rotateSteps));
  }
  if (definitionId === 'command' || normalizedFunc === 'Run Custom Command') {
    state.setMa2CustomCommand(command);
  }
}

export function buildGrandma2Params(
  state: Grandma2State,
  ctx: SharedFormCtx
): DeviceParamsResult | null {
  if (!MA2_FUNCTIONS.has(ctx.funcName)) return null;
  let definitionId = '';
  let command = '';
  let summary = '';
  let options: Record<string, unknown> = {};

  if (ctx.funcName === 'Button Press/Release') {
    const button = parsePositiveIntegerValue(state.ma2ButtonNumber);
    if (button === null) return null;
    definitionId = 'button';
    options = {
      button,
      dir: state.ma2ButtonDirection === 'press' ? 'true' : 'false',
    };
    command = `Button ${button} ${state.ma2ButtonDirection}`;
    summary = `Button ${button} (${state.ma2ButtonDirection})`;
  } else if (ctx.funcName === 'Encoder Press/Release') {
    const useVariable = state.ma2EncoderPressUseVariable === 'true';
    const encoder = parseNonNegativeIntegerValue(state.ma2EncoderPressNumber);
    const encoderVariable = parsePositiveIntegerValue(
      state.ma2EncoderPressVariable
    );
    if (
      (!useVariable && encoder === null) ||
      (useVariable && encoderVariable === null)
    )
      return null;
    definitionId = 'encoder_p';
    options = {
      encoder_from_variable: useVariable,
      enc: encoder ?? 1,
      encoder_variable: encoderVariable ?? 1,
      dir: state.ma2EncoderPressDirection,
    };
    command = useVariable
      ? `Encoder ${encoderVariable} Press/Release (${state.ma2EncoderPressDirection === 'true' ? 'press' : 'release'})`
      : `Encoder ${encoder} Press/Release (${state.ma2EncoderPressDirection === 'true' ? 'press' : 'release'})`;
    summary = useVariable
      ? `Variable encoder ${encoderVariable}, ${state.ma2EncoderPressDirection === 'true' ? 'press' : 'release'}`
      : `Encoder ${encoder}, ${state.ma2EncoderPressDirection === 'true' ? 'press' : 'release'}`;
  } else if (ctx.funcName === 'Move wheel up/down') {
    const steps = parseIntegerValue(state.ma2WheelSteps);
    if (steps === null || steps === 0) return null;
    definitionId = 'wheel';
    options = { steps };
    command = `Wheel ${steps}`;
    summary = `Steps ${steps}`;
  } else if (ctx.funcName === 'Rotate Encoder') {
    const useVariable = state.ma2RotateUseVariable === 'true';
    const encoder = parseNonNegativeIntegerValue(state.ma2RotateEncoderNumber);
    const encoderVariable = parsePositiveIntegerValue(
      state.ma2RotateEncoderVariable
    );
    const steps = parseIntegerValue(state.ma2RotateSteps);
    if (
      (!useVariable && encoder === null) ||
      (useVariable && encoderVariable === null) ||
      steps === null ||
      steps === 0
    )
      return null;
    definitionId = 'encoder';
    options = {
      encoder_from_variable: useVariable,
      enc: encoder ?? 1,
      encoder_variable: encoderVariable ?? 1,
      dir: state.ma2RotateDirection,
      steps: Math.abs(steps),
    };
    const directionLabel = state.ma2RotateDirection === '-1' ? 'CCW' : 'CW';
    command = useVariable
      ? `Encoder ${encoderVariable} Rotate ${directionLabel} x${Math.abs(steps)}`
      : `Encoder ${encoder} Rotate ${directionLabel} x${Math.abs(steps)}`;
    summary = useVariable
      ? `Variable encoder ${encoderVariable}, ${directionLabel}, steps ${Math.abs(steps)}`
      : `Encoder ${encoder}, ${directionLabel}, steps ${Math.abs(steps)}`;
  } else if (ctx.funcName === 'Run Custom Command') {
    const custom = state.ma2CustomCommand.trim();
    if (!custom) return null;
    definitionId = 'command';
    options = {};
    command = custom;
    summary = custom;
  }

  return {
    label: summary
      ? `GrandMA2: ${ctx.funcName} (${summary})`
      : `GrandMA2: ${ctx.funcName}`,
    input: command,
    value: '',
    params: {
      action: 'command',
      protocol: 'tcp',
      command,
      lineEnd: 'crlf',
      definitionId,
      options,
      grandma2Function: ctx.funcName,
    },
  };
}

export function Grandma2ParamFields({
  state,
  ctx,
}: {
  state: Grandma2State;
  ctx: SharedFormCtx;
}) {
  return (
    <>
      {ctx.funcName === 'Button Press/Release' ? (
        <>
          <Field label="Button">
            <SelectField
              value={state.ma2ButtonNumber}
              options={MA2_BUTTON_OPTIONS}
              onChange={(next) => state.setMa2ButtonNumber(next)}
            />
          </Field>
          <Field label="Action">
            <SelectField
              value={state.ma2ButtonDirection}
              options={MA2_DIRECTION_OPTIONS}
              onChange={(next) =>
                state.setMa2ButtonDirection(
                  next === 'release' ? 'release' : 'press'
                )
              }
            />
          </Field>
        </>
      ) : null}
      {ctx.funcName === 'Encoder Press/Release' ? (
        <>
          <Field label="Use variable for encoder">
            <BooleanCheckboxField
              value={state.ma2EncoderPressUseVariable}
              onChange={(next) =>
                state.setMa2EncoderPressUseVariable(
                  next === 'true' ? 'true' : 'false'
                )
              }
              label={
                state.ma2EncoderPressUseVariable === 'true'
                  ? 'Enabled'
                  : 'Disabled'
              }
            />
          </Field>
          {state.ma2EncoderPressUseVariable === 'true' ? (
            <Field label="Encoder Number (1-8)">
              <input
                style={INPUT_STYLE}
                value={state.ma2EncoderPressVariable}
                onChange={(e) => state.setMa2EncoderPressVariable(e.target.value)}
                placeholder="1"
              />
            </Field>
          ) : (
            <Field label="Select Encoder">
              <SelectField
                value={state.ma2EncoderPressNumber}
                options={MA2_ENCODER_SELECT_OPTIONS}
                onChange={(next) => state.setMa2EncoderPressNumber(next)}
              />
            </Field>
          )}
          <Field label="Direction">
            <SelectField
              value={state.ma2EncoderPressDirection}
              options={MA2_DOWN_UP_OPTIONS}
              onChange={(next) =>
                state.setMa2EncoderPressDirection(
                  next === 'false' ? 'false' : 'true'
                )
              }
            />
          </Field>
        </>
      ) : null}
      {ctx.funcName === 'Move wheel up/down' ? (
        <Field label="Steps (+/-)">
          <input
            style={INPUT_STYLE}
            value={state.ma2WheelSteps}
            onChange={(e) => state.setMa2WheelSteps(e.target.value)}
            placeholder="1"
          />
        </Field>
      ) : null}
      {ctx.funcName === 'Rotate Encoder' ? (
        <>
          <Field label="Use variable for encoder">
            <BooleanCheckboxField
              value={state.ma2RotateUseVariable}
              onChange={(next) =>
                state.setMa2RotateUseVariable(next === 'true' ? 'true' : 'false')
              }
              label={
                state.ma2RotateUseVariable === 'true' ? 'Enabled' : 'Disabled'
              }
            />
          </Field>
          {state.ma2RotateUseVariable === 'true' ? (
            <Field label="Encoder Number (1-8)">
              <input
                style={INPUT_STYLE}
                value={state.ma2RotateEncoderVariable}
                onChange={(e) =>
                  state.setMa2RotateEncoderVariable(e.target.value)
                }
                placeholder="1"
              />
            </Field>
          ) : (
            <Field label="Select Encoder">
              <SelectField
                value={state.ma2RotateEncoderNumber}
                options={MA2_ENCODER_SELECT_OPTIONS}
                onChange={(next) => state.setMa2RotateEncoderNumber(next)}
              />
            </Field>
          )}
          <Field label="Direction">
            <SelectField
              value={state.ma2RotateDirection}
              options={MA2_ROTATE_DIRECTION_OPTIONS}
              onChange={(next) =>
                state.setMa2RotateDirection(next === '-1' ? '-1' : '1')
              }
            />
          </Field>
          <Field label="Steps (+/-)">
            <input
              style={INPUT_STYLE}
              value={state.ma2RotateSteps}
              onChange={(e) => state.setMa2RotateSteps(e.target.value)}
              placeholder="1"
            />
          </Field>
        </>
      ) : null}
      {ctx.funcName === 'Run Custom Command' ? (
        <Field label="Command">
          <input
            style={INPUT_STYLE}
            value={state.ma2CustomCommand}
            onChange={(e) => state.setMa2CustomCommand(e.target.value)}
            placeholder="Go+ Executor 1.1"
          />
        </Field>
      ) : null}
    </>
  );
}
