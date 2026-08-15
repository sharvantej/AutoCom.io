import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Connection, TaskEntry } from '../../../types';
import { asTaskParams, parsePositiveIntegerValue, selectOptionValue } from '../sharedUtils';
import type { SelectOption } from '../deviceFunctionSets';
import {
  ATEM_DEFINITION_TO_FUNCTION,
  ATEM_FUNCTIONS,
  ATEM_FUNCTION_SPECS,
  atemBuildCommand,
  type AtemFieldSpec,
  type AtemFunctionSpec,
} from '../atemHelpers';
import {
  BooleanCheckboxField,
  Field,
  INPUT_STYLE,
  SelectField,
  isBooleanSelectOptions,
} from '../fields';
import type { DeviceParamsResult, SharedFormCtx } from '../deviceRegistry';

export interface AtemState {
  atemFieldValues: Record<string, string>;
  setAtemFieldValues: (v: Record<string, string>) => void;
  setAtemFieldValue: (key: string, nextValue: string) => void;
  atemFunctionSpec: AtemFunctionSpec | null;
  atemActionOptions: SelectOption[];
  atemResolveFieldOptions: (
    field: AtemFieldSpec,
    spec: AtemFunctionSpec | null
  ) => SelectOption[];
  atemUskCount: number;
}

export function useAtemState(
  isActive: boolean,
  selectedConnection: Connection | undefined,
  funcName: string,
  cat: SharedFormCtx['cat']
): AtemState {
  const [atemFieldValues, setAtemFieldValues] = useState<
    Record<string, string>
  >({});

  const atemMeta = (selectedConnection ?? null) as
    | (Connection & Record<string, unknown>)
    | null;
  const atemInputCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(atemMeta?.atemInputCount) ??
          parsePositiveIntegerValue(selectedConnection?.inputCount) ??
          20
      ),
    [atemMeta, selectedConnection?.inputCount]
  );
  const atemAuxCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(atemMeta?.atemAuxCount) ??
          parsePositiveIntegerValue(selectedConnection?.outputCount) ??
          4
      ),
    [atemMeta, selectedConnection?.outputCount]
  );
  const atemMeCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(atemMeta?.atemMeCount) ??
          parsePositiveIntegerValue(atemMeta?.mixEffects) ??
          1
      ),
    [atemMeta]
  );
  const atemDskCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(atemMeta?.atemDskCount) ??
          parsePositiveIntegerValue(atemMeta?.downstreamKeyers) ??
          2
      ),
    [atemMeta]
  );
  const atemUskCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(atemMeta?.atemUskCount) ??
          parsePositiveIntegerValue(atemMeta?.upstreamKeyers) ??
          4
      ),
    [atemMeta]
  );
  const atemMultiviewerCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(atemMeta?.atemMultiviewerCount) ??
          parsePositiveIntegerValue(atemMeta?.multiviewers) ??
          1
      ),
    [atemMeta]
  );
  const atemMediaPlayerCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(atemMeta?.atemMediaPlayerCount) ??
          parsePositiveIntegerValue(atemMeta?.mediaPlayers) ??
          2
      ),
    [atemMeta]
  );
  const atemMvWindowCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(atemMeta?.atemMultiviewerWindowCount) ??
          parsePositiveIntegerValue(atemMeta?.multiviewerWindows) ??
          10
      ),
    [atemMeta]
  );
  const atemNamedInputs = useMemo<SelectOption[]>(() => {
    const sourceNames = atemMeta?.atemSourceNames;
    if (!Array.isArray(sourceNames) || !sourceNames.length) return [];
    return sourceNames
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') return null;
        const item = entry as Record<string, unknown>;
        const id = parsePositiveIntegerValue(item.id) ?? index + 1;
        const name =
          typeof item.label === 'string'
            ? item.label.trim()
            : typeof item.name === 'string'
              ? item.name.trim()
              : '';
        return {
          value: String(id),
          label: name ? `${id} - ${name}` : `Input ${id}`,
        };
      })
      .filter(
        (entry): entry is { value: string; label: string } => entry !== null
      );
  }, [atemMeta]);
  const atemNamedAux = useMemo<SelectOption[]>(() => {
    const auxNames = atemMeta?.atemAuxNames;
    if (!Array.isArray(auxNames) || !auxNames.length) return [];
    return auxNames
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') return null;
        const item = entry as Record<string, unknown>;
        const id = parsePositiveIntegerValue(item.id) ?? index + 1;
        const name =
          typeof item.label === 'string'
            ? item.label.trim()
            : typeof item.name === 'string'
              ? item.name.trim()
              : '';
        return {
          value: String(id),
          label: name ? `${id} - ${name}` : `Aux/Output ${id}`,
        };
      })
      .filter(
        (entry): entry is { value: string; label: string } => entry !== null
      );
  }, [atemMeta]);
  const atemInputOptions = useMemo<SelectOption[]>(
    () =>
      atemNamedInputs.length
        ? atemNamedInputs
        : Array.from({ length: atemInputCount }, (_, index) => {
            const value = String(index + 1);
            return { value, label: `Input ${value}` };
          }),
    [atemInputCount, atemNamedInputs]
  );
  const atemAuxOptions = useMemo<SelectOption[]>(
    () =>
      atemNamedAux.length
        ? atemNamedAux
        : Array.from({ length: atemAuxCount }, (_, index) => {
            const value = String(index + 1);
            return { value, label: `Aux/Output ${value}` };
          }),
    [atemAuxCount, atemNamedAux]
  );
  const atemMeOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: atemMeCount }, (_, index) => {
        const value = String(index + 1);
        return { value, label: `M/E ${value}` };
      }),
    [atemMeCount]
  );
  const atemDskOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: atemDskCount }, (_, index) => {
        const value = String(index + 1);
        return { value, label: `Key ${value}` };
      }),
    [atemDskCount]
  );
  const atemUskOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: atemUskCount }, (_, index) => {
        const value = String(index + 1);
        return { value, label: `Key ${value}` };
      }),
    [atemUskCount]
  );
  const atemMultiviewerOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: atemMultiviewerCount }, (_, index) => {
        const value = String(index + 1);
        return { value, label: `MV ${value}` };
      }),
    [atemMultiviewerCount]
  );
  const atemMediaPlayerOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: atemMediaPlayerCount }, (_, index) => {
        const value = String(index + 1);
        return { value, label: `Media Player ${value}` };
      }),
    [atemMediaPlayerCount]
  );
  const atemMvWindowOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: atemMvWindowCount }, (_, index) => {
        const value = String(index + 1);
        return { value, label: `Window ${value}` };
      }),
    [atemMvWindowCount]
  );
  const atemTransitionComponentOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'background', label: 'Background' },
      ...Array.from({ length: atemUskCount }, (_, index) => ({
        value: `key${index}`,
        label: `Key ${index + 1}`,
      })),
    ],
    [atemUskCount]
  );
  const atemActionOptions = useMemo<SelectOption[]>(() => {
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
  }, [cat.categories]);
  const atemResolveFieldOptions = useCallback(
    (field: AtemFieldSpec, spec: AtemFunctionSpec | null): SelectOption[] => {
      if (field.options?.length) return field.options;
      switch (field.key) {
        case 'mixeffect':
          return atemMeOptions;
        case 'downstreamKeyerId':
          return atemDskOptions;
        case 'key':
          return spec?.definitionId.startsWith('dsk')
            ? atemDskOptions
            : atemUskOptions;
        case 'aux':
          return atemAuxOptions;
        case 'input':
        case 'fill':
        case 'cut':
        case 'source':
          return atemInputOptions;
        case 'mediaplayer':
          return atemMediaPlayerOptions;
        case 'multiViewerId':
          return atemMultiviewerOptions;
        case 'windowIndex':
          return atemMvWindowOptions;
        case 'selection':
        case 'component':
          return atemTransitionComponentOptions;
        default:
          return [];
      }
    },
    [
      atemAuxOptions,
      atemDskOptions,
      atemInputOptions,
      atemMeOptions,
      atemMediaPlayerOptions,
      atemMultiviewerOptions,
      atemMvWindowOptions,
      atemTransitionComponentOptions,
      atemUskOptions,
    ]
  );

  const atemFunctionSpec = isActive
    ? (ATEM_FUNCTION_SPECS[funcName] ?? null)
    : null;

  const setAtemFieldValue = (key: string, nextValue: string) => {
    setAtemFieldValues((prev) => ({ ...prev, [key]: nextValue }));
  };

  useEffect(() => {
    if (!isActive) {
      setAtemFieldValues({});
      return;
    }
    const fields = atemFunctionSpec?.fields ?? [];
    setAtemFieldValues((prev) => {
      const next: Record<string, string> = {};
      for (const field of fields) {
        const existing = prev[field.key] ?? '';
        if (existing.trim()) {
          next[field.key] = existing;
        } else if (field.defaultValue !== undefined) {
          next[field.key] = field.defaultValue;
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atemFunctionSpec, isActive]);

  return {
    atemFieldValues,
    setAtemFieldValues,
    setAtemFieldValue,
    atemFunctionSpec,
    atemActionOptions,
    atemResolveFieldOptions,
    atemUskCount,
  };
}

/** Matches the `setAtemFieldValues({})` reset lines duplicated across AddTaskPanel. */
export function resetAtemFields(state: AtemState) {
  state.setAtemFieldValues({});
}

export function hydrateAtem(
  state: AtemState,
  selectedTask: TaskEntry,
  params: Record<string, unknown>,
  ctx: SharedFormCtx
) {
  const options = asTaskParams(params.options);
  const atemFieldsFromParams = asTaskParams(params.atemFields);
  const definitionId =
    typeof params.definitionId === 'string' ? params.definitionId.trim() : '';
  const normalizedFunc = ATEM_FUNCTIONS.has(selectedTask.funcName)
    ? selectedTask.funcName
    : (ATEM_DEFINITION_TO_FUNCTION[definitionId] ?? selectedTask.funcName ?? '');
  ctx.setFuncName(normalizedFunc);
  const spec = ATEM_FUNCTION_SPECS[normalizedFunc];
  if (spec) {
    const nextValues: Record<string, string> = {};
    for (const field of spec.fields) {
      const raw = atemFieldsFromParams[field.key] ?? options[field.key];
      if (typeof raw === 'string' && raw.trim().length > 0) {
        const token = raw.trim().toLowerCase();
        const fieldOptions = field.options ?? [];
        const optionValues = new Set(
          fieldOptions.map((option) =>
            selectOptionValue(option).trim().toLowerCase()
          )
        );
        if (
          (token === 'true' || token === 'false') &&
          optionValues.has('on') &&
          optionValues.has('off')
        ) {
          nextValues[field.key] = token === 'true' ? 'on' : 'off';
        } else {
          nextValues[field.key] = raw;
        }
      } else if (typeof raw === 'number' && Number.isFinite(raw)) {
        nextValues[field.key] = String(raw);
      } else if (typeof raw === 'boolean') {
        const fieldOptions = field.options ?? [];
        const optionValues = new Set(
          fieldOptions.map((option) =>
            selectOptionValue(option).trim().toLowerCase()
          )
        );
        if (optionValues.has('on') && optionValues.has('off')) {
          nextValues[field.key] = raw ? 'on' : 'off';
        } else {
          nextValues[field.key] = raw ? 'true' : 'false';
        }
      } else if (field.defaultValue !== undefined) {
        nextValues[field.key] = field.defaultValue;
      }
    }
    state.setAtemFieldValues(nextValues);
  } else {
    state.setAtemFieldValues({});
  }
}

export function buildAtemParams(
  state: AtemState,
  ctx: SharedFormCtx
): DeviceParamsResult | null {
  const spec = ATEM_FUNCTION_SPECS[ctx.funcName] ?? null;
  if (!spec) return null;

  const nextFieldValues: Record<string, string> = {};
  for (const field of spec.fields) {
    const raw = (state.atemFieldValues[field.key] ?? '').trim();
    if (raw) {
      nextFieldValues[field.key] = raw;
    } else if (field.defaultValue !== undefined) {
      nextFieldValues[field.key] = field.defaultValue;
    } else {
      nextFieldValues[field.key] = '';
    }
  }

  const options: Record<string, unknown> = {};
  for (const field of spec.fields) {
    const raw = nextFieldValues[field.key] ?? '';
    if (!raw && field.defaultValue === undefined) continue;
    if (field.type === 'number') {
      const parsed = Number.parseFloat(raw);
      options[field.key] = Number.isFinite(parsed) ? parsed : raw;
    } else if (field.type === 'select' && (raw === 'true' || raw === 'false')) {
      options[field.key] = raw === 'true';
    } else {
      options[field.key] = raw;
    }
  }

  const command = atemBuildCommand(spec.definitionId, nextFieldValues).trim();
  if (!command) return null;

  return {
    label: `ATEM: ${ctx.funcName}`,
    input: '',
    value: '',
    params: {
      protocol: 'udp',
      action: 'command',
      command,
      lineEnd: 'none',
      definitionId: spec.definitionId,
      options,
      atemFields: nextFieldValues,
    },
  };
}

export function AtemFunctionStep({
  state,
  ctx,
}: {
  state: AtemState;
  ctx: SharedFormCtx;
}) {
  return (
    <Field label="ATEM Action">
      <SelectField
        value={ctx.funcName}
        options={state.atemActionOptions}
        onChange={(nextFuncName) => {
          ctx.setFuncName(nextFuncName);
          const match = Object.entries(ctx.cat.categories).find(([, functions]) =>
            functions.includes(nextFuncName)
          );
          ctx.setCategory(match?.[0] ?? '');
        }}
        placeholder="Select an action"
      />
    </Field>
  );
}

export function AtemParamFields({ state }: { state: AtemState }) {
  const spec = state.atemFunctionSpec;
  if (!spec) return null;
  return (
    <>
      {spec.fields.map((field) => {
        if (/^key\d+$/i.test(field.key)) {
          const numericKey = Number.parseInt(field.key.slice(3), 10);
          if (Number.isFinite(numericKey) && numericKey >= state.atemUskCount) {
            return null;
          }
        }
        const fieldValue = state.atemFieldValues[field.key] ?? '';
        if (field.type === 'select') {
          const options = state.atemResolveFieldOptions(field, spec);
          const isBooleanField = isBooleanSelectOptions(options);
          return (
            <Field key={field.key} label={field.label}>
              {isBooleanField ? (
                <BooleanCheckboxField
                  value={fieldValue}
                  onChange={(next) => state.setAtemFieldValue(field.key, next)}
                />
              ) : (
                <SelectField
                  value={fieldValue}
                  options={options}
                  onChange={(next) => state.setAtemFieldValue(field.key, next)}
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
              onChange={(e) => state.setAtemFieldValue(field.key, e.target.value)}
              placeholder={field.placeholder ?? ''}
            />
          </Field>
        );
      })}
    </>
  );
}
