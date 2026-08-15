import { useEffect, useMemo, useState } from 'react';
import type { Connection, TaskEntry } from '../../../types';
import { isTauri } from '../../../services/tauri';
import { loadSwp08RouterNames } from '../../../services/runtimeState';
import {
  asTaskParams,
  parsePositiveIntegerValue,
} from '../sharedUtils';
import { SWP08_CLEAR_OPTIONS, SWP08_FUNCTIONS, type SelectOption } from '../deviceFunctionSets';
import { P, SWP08_NAMES_CACHE, type Swp08NameOption } from '../constants';
import {
  BooleanCheckboxField,
  Field,
  INPUT_STYLE,
  SelectField,
  ACTION_HOVER_OUTLINE_CLASS,
} from '../fields';
import type { DeviceParamsResult, SharedFormCtx } from '../deviceRegistry';

export interface Swp08State {
  swp08Levels: string[];
  setSwp08Levels: React.Dispatch<React.SetStateAction<string[]>>;
  swp08Destination: string;
  setSwp08Destination: (v: string) => void;
  swp08Source: string;
  setSwp08Source: (v: string) => void;
  swp08ClearType: string;
  setSwp08ClearType: (v: string) => void;
  swp08ClearEnableLevels: 'true' | 'false';
  setSwp08ClearEnableLevels: (v: 'true' | 'false') => void;
  swp08NamesLoading: boolean;
  swp08NamesError: string;
  refreshSwp08Names: () => void;
  swp08LevelOptions: SelectOption[];
  swp08SourceNameOptions: SelectOption[];
  swp08DestinationNameOptions: SelectOption[];
}

export function useSwp08State(
  isActive: boolean,
  selectedConnection: Connection | undefined
): Swp08State {
  const [swp08Levels, setSwp08Levels] = useState<string[]>(['1']);
  const [swp08Destination, setSwp08Destination] = useState('1');
  const [swp08Source, setSwp08Source] = useState('1');
  const [swp08ClearType, setSwp08ClearType] = useState('all');
  const [swp08ClearEnableLevels, setSwp08ClearEnableLevels] = useState<
    'true' | 'false'
  >('true');
  const [swp08SourceNameOptionsState, setSwp08SourceNameOptionsState] =
    useState<Swp08NameOption[]>([]);
  const [
    swp08DestinationNameOptionsState,
    setSwp08DestinationNameOptionsState,
  ] = useState<Swp08NameOption[]>([]);
  const [swp08NamesLoading, setSwp08NamesLoading] = useState(false);
  const [swp08NamesError, setSwp08NamesError] = useState('');
  const [swp08NamesReloadKey, setSwp08NamesReloadKey] = useState(0);

  const swp08LevelCount = useMemo(
    () =>
      Math.max(
        1,
        parsePositiveIntegerValue(selectedConnection?.swp08LevelCount) ?? 3
      ),
    [selectedConnection?.swp08LevelCount]
  );
  const swp08LevelOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: swp08LevelCount }, (_, index) => {
        const level = String(index + 1);
        return { value: level, label: `Level ${level}` };
      }),
    [swp08LevelCount]
  );
  const swp08NameNumberOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: 256 }, (_, index) => {
        const value = String(index + 1);
        return { value, label: value };
      }),
    []
  );
  const swp08SourceNameOptions = useMemo<SelectOption[]>(
    () =>
      swp08SourceNameOptionsState.length
        ? swp08SourceNameOptionsState
        : swp08NameNumberOptions,
    [swp08NameNumberOptions, swp08SourceNameOptionsState]
  );
  const swp08DestinationNameOptions = useMemo<SelectOption[]>(
    () =>
      swp08DestinationNameOptionsState.length
        ? swp08DestinationNameOptionsState
        : swp08NameNumberOptions,
    [swp08DestinationNameOptionsState, swp08NameNumberOptions]
  );

  const swp08NamesCacheKey = useMemo(() => {
    if (!selectedConnection || !isActive) return '';
    return [
      selectedConnection.id ?? '',
      selectedConnection.ip ?? '',
      selectedConnection.port ?? '',
      selectedConnection.swp08Matrix ?? 1,
      selectedConnection.swp08ExtendedCommands ? 1 : 0,
      selectedConnection.swp08RequestNameLength ?? 8,
    ].join('|');
  }, [selectedConnection, isActive]);

  const refreshSwp08Names = () => setSwp08NamesReloadKey((prev) => prev + 1);

  useEffect(() => {
    if (!isActive || !selectedConnection) {
      setSwp08SourceNameOptionsState([]);
      setSwp08DestinationNameOptionsState([]);
      setSwp08NamesLoading(false);
      setSwp08NamesError('');
      return;
    }
    if (!isTauri()) {
      setSwp08SourceNameOptionsState([]);
      setSwp08DestinationNameOptionsState([]);
      setSwp08NamesLoading(false);
      setSwp08NamesError('');
      return;
    }

    const cached = swp08NamesCacheKey
      ? SWP08_NAMES_CACHE.get(swp08NamesCacheKey)
      : undefined;
    if (cached) {
      setSwp08SourceNameOptionsState(cached.sourceOptions);
      setSwp08DestinationNameOptionsState(cached.destinationOptions);
      setSwp08NamesError('');
      setSwp08NamesLoading(false);
      if (swp08NamesReloadKey === 0) return;
    }

    const host = String(selectedConnection.ip ?? '').trim();
    if (!host) {
      setSwp08NamesError('Router host/IP is missing.');
      return;
    }

    let cancelled = false;
    setSwp08NamesLoading(true);
    setSwp08NamesError('');

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
            const labelText = `${entry.id}${entry.label?.trim() ? ` - ${entry.label.trim()}` : ''}`;
            return { value, label: labelText };
          })
          .sort((a, b) => Number(a.value) - Number(b.value));
        const destinationOptions = result.destinationNames
          .map((entry) => {
            const value = String(entry.id);
            const labelText = `${entry.id}${entry.label?.trim() ? ` - ${entry.label.trim()}` : ''}`;
            return { value, label: labelText };
          })
          .sort((a, b) => Number(a.value) - Number(b.value));

        setSwp08SourceNameOptionsState(sourceOptions);
        setSwp08DestinationNameOptionsState(destinationOptions);
        setSwp08NamesError('');
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
          error instanceof Error
            ? error.message
            : 'Failed to fetch source/destination names from router.'
        );
      })
      .finally(() => {
        if (cancelled) return;
        setSwp08NamesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, selectedConnection, swp08NamesCacheKey, swp08NamesReloadKey]);

  return {
    swp08Levels,
    setSwp08Levels,
    swp08Destination,
    setSwp08Destination,
    swp08Source,
    setSwp08Source,
    swp08ClearType,
    setSwp08ClearType,
    swp08ClearEnableLevels,
    setSwp08ClearEnableLevels,
    swp08NamesLoading,
    swp08NamesError,
    refreshSwp08Names,
    swp08LevelOptions,
    swp08SourceNameOptions,
    swp08DestinationNameOptions,
  };
}

/** Matches the setSwp08* reset lines duplicated at handleConn's two branches and resetDraftFields. */
export function resetSwp08Fields(state: Swp08State) {
  state.setSwp08Levels(['1']);
  state.setSwp08Destination('1');
  state.setSwp08Source('1');
  state.setSwp08ClearType('all');
  state.setSwp08ClearEnableLevels('true');
}

export function hydrateSwp08(
  state: Swp08State,
  selectedTask: TaskEntry,
  params: Record<string, unknown>,
  ctx: SharedFormCtx
) {
  const options = asTaskParams(params.options);
  const definitionId =
    typeof params.definitionId === 'string' ? params.definitionId.trim() : '';
  const normalizedFunc = SWP08_FUNCTIONS.has(selectedTask.funcName)
    ? selectedTask.funcName
    : definitionId === 'select_level'
      ? 'Select Levels'
      : definitionId === 'deselect_level'
        ? 'De-Select Levels'
        : definitionId === 'toggle_level'
          ? 'Toggle Levels'
          : definitionId === 'select_dest'
            ? 'Select Destination'
            : definitionId === 'select_dest_name'
              ? 'Select Destination name'
              : definitionId === 'select_source'
                ? 'Select Source'
                : definitionId === 'select_source_name'
                  ? 'Select Source name'
                  : definitionId === 'route_source'
                    ? 'Route Source to selected Levels and Destination'
                    : definitionId === 'route_source_name'
                      ? 'Route Source name to selected Levels and Destination'
                      : definitionId === 'take'
                        ? 'Take'
                        : definitionId === 'clear'
                          ? 'Clear'
                          : definitionId === 'set_crosspoint'
                            ? 'Set crosspoint'
                            : definitionId === 'set_crosspoint_name'
                              ? 'Set crosspoint by name'
                              : definitionId === 'get_names'
                                ? 'Refresh Source and Destination names'
                                : 'Select Destination';
  const levelsValue = Array.isArray(options.level)
    ? options.level
    : typeof options.level === 'string'
      ? options.level.split(',')
      : [];
  const normalizedLevels = levelsValue
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
  ctx.setFuncName(normalizedFunc);
  state.setSwp08Levels(normalizedLevels.length ? normalizedLevels : ['1']);
  state.setSwp08Destination(String(options.dest ?? '1'));
  state.setSwp08Source(String(options.source ?? '1'));
  state.setSwp08ClearType(String(options.clear ?? 'all'));
  state.setSwp08ClearEnableLevels(
    String(options.clear_enable_levels ?? 'true')
      .trim()
      .toLowerCase() === 'false'
      ? 'false'
      : 'true'
  );
}

export function buildSwp08Params(
  state: Swp08State,
  ctx: SharedFormCtx
): DeviceParamsResult | null {
  if (!SWP08_FUNCTIONS.has(ctx.funcName)) return null;

  const levels = state.swp08Levels
    .map((value) => parsePositiveIntegerValue(value))
    .filter((value): value is number => value !== null);
  const destination = parsePositiveIntegerValue(state.swp08Destination) ?? 1;
  const source = parsePositiveIntegerValue(state.swp08Source) ?? 1;
  const options: Record<string, unknown> = {};
  let definitionId = '';
  let inputValue = '';
  let valueValue = '';

  if (ctx.funcName === 'Select Levels') {
    definitionId = 'select_level';
    options.level = levels;
    inputValue = levels.join(',');
  } else if (ctx.funcName === 'De-Select Levels') {
    definitionId = 'deselect_level';
    options.level = levels;
    inputValue = levels.join(',');
  } else if (ctx.funcName === 'Toggle Levels') {
    definitionId = 'toggle_level';
    options.level = levels;
    inputValue = levels.join(',');
  } else if (ctx.funcName === 'Select Destination') {
    definitionId = 'select_dest';
    options.dest = destination;
    inputValue = String(destination);
  } else if (ctx.funcName === 'Select Destination name') {
    definitionId = 'select_dest_name';
    options.dest = destination;
    inputValue = String(destination);
  } else if (ctx.funcName === 'Select Source') {
    definitionId = 'select_source';
    options.source = source;
    inputValue = String(source);
  } else if (ctx.funcName === 'Select Source name') {
    definitionId = 'select_source_name';
    options.source = source;
    inputValue = String(source);
  } else if (
    ctx.funcName === 'Route Source to selected Levels and Destination'
  ) {
    definitionId = 'route_source';
    options.source = source;
    inputValue = String(source);
  } else if (
    ctx.funcName === 'Route Source name to selected Levels and Destination'
  ) {
    definitionId = 'route_source_name';
    options.source = source;
    inputValue = String(source);
  } else if (ctx.funcName === 'Take') {
    definitionId = 'take';
  } else if (ctx.funcName === 'Clear') {
    definitionId = 'clear';
    options.clear = state.swp08ClearType;
    options.clear_enable_levels = state.swp08ClearEnableLevels === 'true';
    inputValue = state.swp08ClearType;
    valueValue = state.swp08ClearEnableLevels === 'true' ? 'enabled' : 'disabled';
  } else if (ctx.funcName === 'Set crosspoint') {
    definitionId = 'set_crosspoint';
    options.level = levels;
    options.source = source;
    options.dest = destination;
    inputValue = String(destination);
    valueValue = String(source);
  } else if (ctx.funcName === 'Set crosspoint by name') {
    definitionId = 'set_crosspoint_name';
    options.level = levels;
    options.source = source;
    options.dest = destination;
    inputValue = String(destination);
    valueValue = String(source);
  } else if (ctx.funcName === 'Refresh Source and Destination names') {
    definitionId = 'get_names';
  }

  return {
    label: `SWP08: ${ctx.funcName}`,
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

export function Swp08ParamFields({
  state,
  ctx,
}: {
  state: Swp08State;
  ctx: SharedFormCtx;
}) {
  const funcName = ctx.funcName;
  return (
    <>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 11, color: P.muted500 }}>
          {state.swp08NamesLoading
            ? 'Loading router names...'
            : state.swp08NamesError
              ? state.swp08NamesError
              : 'Router names are used for Source name / Destination name actions.'}
        </span>
        <button
          type="button"
          className={`rounded-none border px-[8px] py-[4px] text-[11px] ${ACTION_HOVER_OUTLINE_CLASS}`}
          style={{
            borderColor: P.surface600,
            backgroundColor: P.ink950,
            color: P.text100,
            opacity: state.swp08NamesLoading ? 0.7 : 1,
          }}
          onClick={state.refreshSwp08Names}
          disabled={state.swp08NamesLoading}
        >
          {state.swp08NamesLoading ? 'Refreshing...' : 'Refresh Names'}
        </button>
      </div>
      {funcName === 'Select Levels' ||
      funcName === 'De-Select Levels' ||
      funcName === 'Toggle Levels' ||
      funcName === 'Set crosspoint' ||
      funcName === 'Set crosspoint by name' ? (
        <Field label="Levels">
          <div className="flex flex-wrap gap-[6px]">
            {state.swp08LevelOptions.map((levelOption) => {
              const levelValue =
                typeof levelOption === 'string'
                  ? levelOption
                  : levelOption.value;
              const levelLabel =
                typeof levelOption === 'string'
                  ? levelOption
                  : levelOption.label;
              const checked = state.swp08Levels.includes(levelValue);
              return (
                <button
                  key={levelValue}
                  type="button"
                  className="rounded-none border px-[8px] py-[4px] text-[11px] transition-colors"
                  style={{
                    borderColor: checked ? '#8E51FF' : P.surface600,
                    backgroundColor: checked
                      ? 'rgba(142,81,255,0.2)'
                      : P.ink950,
                    color: P.text50,
                  }}
                  onClick={() => {
                    state.setSwp08Levels((prev) => {
                      const hasLevel = prev.includes(levelValue);
                      if (hasLevel) {
                        const next = prev.filter(
                          (entry) => entry !== levelValue
                        );
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

      {funcName === 'Select Destination' ||
      funcName === 'Select Destination name' ||
      funcName === 'Set crosspoint' ||
      funcName === 'Set crosspoint by name' ? (
        <Field
          label={funcName.includes('name') ? 'Destination name' : 'Destination'}
        >
          {funcName.includes('name') ? (
            <SelectField
              value={state.swp08Destination}
              options={state.swp08DestinationNameOptions}
              onChange={(next) => state.setSwp08Destination(next || '1')}
              includeEmptyOption={false}
            />
          ) : (
            <input
              style={INPUT_STYLE}
              value={state.swp08Destination}
              onChange={(e) => state.setSwp08Destination(e.target.value)}
              placeholder="1"
            />
          )}
        </Field>
      ) : null}

      {funcName === 'Select Source' ||
      funcName === 'Select Source name' ||
      funcName === 'Route Source to selected Levels and Destination' ||
      funcName === 'Route Source name to selected Levels and Destination' ||
      funcName === 'Set crosspoint' ||
      funcName === 'Set crosspoint by name' ? (
        <Field label={funcName.includes('name') ? 'Source name' : 'Source'}>
          {funcName.includes('name') ? (
            <SelectField
              value={state.swp08Source}
              options={state.swp08SourceNameOptions}
              onChange={(next) => state.setSwp08Source(next || '1')}
              includeEmptyOption={false}
            />
          ) : (
            <input
              style={INPUT_STYLE}
              value={state.swp08Source}
              onChange={(e) => state.setSwp08Source(e.target.value)}
              placeholder="1"
            />
          )}
        </Field>
      ) : null}

      {funcName === 'Clear' ? (
        <>
          <Field label="Clear">
            <SelectField
              value={state.swp08ClearType}
              options={SWP08_CLEAR_OPTIONS}
              onChange={(next) => state.setSwp08ClearType(next || 'all')}
              includeEmptyOption={false}
            />
          </Field>
          <Field label="Clear enable levels">
            <BooleanCheckboxField
              value={state.swp08ClearEnableLevels}
              onChange={(next) =>
                state.setSwp08ClearEnableLevels(
                  next === 'false' ? 'false' : 'true'
                )
              }
              label={
                state.swp08ClearEnableLevels === 'true' ? 'Enabled' : 'Disabled'
              }
            />
          </Field>
        </>
      ) : null}
    </>
  );
}
