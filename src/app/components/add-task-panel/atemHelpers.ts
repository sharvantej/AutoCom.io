import type { SelectOption } from './deviceFunctionSets';

export type AtemFieldSpec = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: SelectOption[];
  placeholder?: string;
  defaultValue?: string;
};
export type AtemFunctionSpec = {
  definitionId: string;
  fields: AtemFieldSpec[];
};

export const ATEM_BOOLEAN_OPTIONS: SelectOption[] = [
  { value: 'true', label: 'On' },
  { value: 'false', label: 'Off' },
];
export const ATEM_TOGGLE_OPTIONS: SelectOption[] = [
  { value: 'toggle', label: 'Toggle' },
  { value: 'on', label: 'On Air' },
  { value: 'off', label: 'Off' },
];
export const ATEM_TRANSITION_STYLE_OPTIONS: SelectOption[] = [
  { value: 'mix', label: 'Mix' },
  { value: 'dip', label: 'Dip' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'dve', label: 'DVE' },
  { value: 'sting', label: 'Sting' },
];
export const ATEM_USK_TYPE_OPTIONS: SelectOption[] = [
  { value: 'luma', label: 'Luma' },
  { value: 'chroma', label: 'Chroma' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'dve', label: 'DVE' },
];
export const ATEM_MEDIA_DIRECTION_OPTIONS: SelectOption[] = [
  { value: 'next', label: 'Next' },
  { value: 'previous', label: 'Previous' },
];
export const ATEM_MACRO_LOOP_OPTIONS: SelectOption[] = [
  { value: 'toggle', label: 'Toggle' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];
export const ATEM_MEDIA_SOURCE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'still', label: 'Still' },
  { value: 'clip', label: 'Clip' },
];
export const ATEM_FUNCTION_SPECS: Record<string, AtemFunctionSpec> = {
  'Aux/Output: Set source': {
    definitionId: 'aux',
    fields: [
      { key: 'aux', label: 'Aux/Output', type: 'select', defaultValue: '1' },
      { key: 'input', label: 'Input', type: 'select', defaultValue: '1' },
    ],
  },
  'Downstream key: Run AUTO Transition': {
    definitionId: 'dskAuto',
    fields: [
      {
        key: 'downstreamKeyerId',
        label: 'Key',
        type: 'select',
        defaultValue: '1',
      },
      {
        key: 'onair',
        label: 'Mode',
        type: 'select',
        options: ATEM_TOGGLE_OPTIONS,
        defaultValue: 'toggle',
      },
    ],
  },
  'Downstream key: Set inputs': {
    definitionId: 'dskSource',
    fields: [
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      { key: 'fill', label: 'Fill Source', type: 'select', defaultValue: '1' },
      { key: 'cut', label: 'Key Source', type: 'select', defaultValue: '1' },
    ],
  },
  'Downstream key: Set Mask': {
    definitionId: 'dskMask',
    fields: [
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      {
        key: 'maskEnabled',
        label: 'Mask enabled',
        type: 'select',
        options: ATEM_BOOLEAN_OPTIONS,
        defaultValue: 'true',
      },
      { key: 'maskTop', label: 'Mask top', type: 'number', defaultValue: '9' },
      {
        key: 'maskBottom',
        label: 'Mask bottom',
        type: 'number',
        defaultValue: '-9',
      },
      {
        key: 'maskLeft',
        label: 'Mask left',
        type: 'number',
        defaultValue: '-16',
      },
      {
        key: 'maskRight',
        label: 'Mask right',
        type: 'number',
        defaultValue: '16',
      },
    ],
  },
  'Downstream key: Set OnAir': {
    definitionId: 'dsk',
    fields: [
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      {
        key: 'onair',
        label: 'On Air',
        type: 'select',
        options: ATEM_TOGGLE_OPTIONS,
        defaultValue: 'toggle',
      },
    ],
  },
  'Downstream key: Set Pre Multiplied Key': {
    definitionId: 'dskPreMultipliedKey',
    fields: [
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      {
        key: 'preMultiply',
        label: 'Premultiplied',
        type: 'select',
        options: ATEM_BOOLEAN_OPTIONS,
        defaultValue: 'true',
      },
      { key: 'clip', label: 'Clip', type: 'number', defaultValue: '100' },
      { key: 'gain', label: 'Gain', type: 'number', defaultValue: '0' },
      {
        key: 'invert',
        label: 'Invert',
        type: 'select',
        options: ATEM_BOOLEAN_OPTIONS,
        defaultValue: 'false',
      },
    ],
  },
  'Downstream key: Set Rate': {
    definitionId: 'dskRate',
    fields: [
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      { key: 'rate', label: 'Rate', type: 'number', defaultValue: '25' },
    ],
  },
  'Downstream key: Set Tied': {
    definitionId: 'dskTie',
    fields: [
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      {
        key: 'state',
        label: 'Tied state',
        type: 'select',
        options: ATEM_TOGGLE_OPTIONS,
        defaultValue: 'on',
      },
    ],
  },
  'Fade to black: Change rate': {
    definitionId: 'fadeToBlackRate',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      { key: 'rate', label: 'Rate', type: 'number', defaultValue: '25' },
    ],
  },
  'Fade to black: Run AUTO Transition': {
    definitionId: 'fadeToBlackAuto',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
    ],
  },
  'Input: Set name': {
    definitionId: 'inputName',
    fields: [
      { key: 'source', label: 'Input', type: 'select', defaultValue: '1' },
      {
        key: 'short_enable',
        label: 'Enable short name',
        type: 'select',
        options: ATEM_BOOLEAN_OPTIONS,
        defaultValue: 'true',
      },
      {
        key: 'short_value',
        label: 'Short name',
        type: 'text',
        defaultValue: '',
      },
      {
        key: 'long_enable',
        label: 'Enable long name',
        type: 'select',
        options: ATEM_BOOLEAN_OPTIONS,
        defaultValue: 'true',
      },
      { key: 'long_value', label: 'Long name', type: 'text', defaultValue: '' },
    ],
  },
  'Macro: Continue': { definitionId: 'macrocontinue', fields: [] },
  'Macro: Loop': {
    definitionId: 'macroloop',
    fields: [
      {
        key: 'loop',
        label: 'Loop',
        type: 'select',
        options: ATEM_MACRO_LOOP_OPTIONS,
        defaultValue: 'toggle',
      },
    ],
  },
  'Macro: Run': {
    definitionId: 'macrorun',
    fields: [
      { key: 'macro', label: 'Macro', type: 'number', defaultValue: '1' },
      {
        key: 'action',
        label: 'Action',
        type: 'select',
        options: ['run', 'start'],
        defaultValue: 'run',
      },
    ],
  },
  'Macro: Stop': { definitionId: 'macrostop', fields: [] },
  'ME: Perform AUTO transition': {
    definitionId: 'auto',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
    ],
  },
  'ME: Perform CUT transition': {
    definitionId: 'cut',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
    ],
  },
  'ME: Set Preview input': {
    definitionId: 'preview',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      { key: 'input', label: 'Input', type: 'select', defaultValue: '1' },
    ],
  },
  'ME: Set Program input': {
    definitionId: 'program',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      { key: 'input', label: 'Input', type: 'select', defaultValue: '1' },
    ],
  },
  'ME: Set TBar position': {
    definitionId: 'tBar',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      { key: 'position', label: 'Position', type: 'number', defaultValue: '0' },
      {
        key: 'fadeDuration',
        label: 'Fade duration',
        type: 'number',
        defaultValue: '0',
      },
      {
        key: 'fadeAlgorithm',
        label: 'Fade algorithm',
        type: 'select',
        options: ['linear'],
        defaultValue: 'linear',
      },
      {
        key: 'fadeCurve',
        label: 'Fade curve',
        type: 'select',
        options: ['ease-in'],
        defaultValue: 'ease-in',
      },
    ],
  },
  'Media player: Capture still': {
    definitionId: 'mediaCaptureStill',
    fields: [],
  },
  'Media player: Cycle source': {
    definitionId: 'mediaPlayerCycle',
    fields: [
      {
        key: 'mediaplayer',
        label: 'Media player',
        type: 'select',
        defaultValue: '1',
      },
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        options: ATEM_MEDIA_DIRECTION_OPTIONS,
        defaultValue: 'next',
      },
    ],
  },
  'Media player: Delete still': {
    definitionId: 'mediaDeleteStill',
    fields: [
      { key: 'slot', label: 'Still slot', type: 'number', defaultValue: '1' },
    ],
  },
  'Media player: Set source': {
    definitionId: 'mediaPlayerSource',
    fields: [
      {
        key: 'mediaplayer',
        label: 'Media player',
        type: 'select',
        defaultValue: '1',
      },
      {
        key: 'sourceType',
        label: 'Source type',
        type: 'select',
        options: ATEM_MEDIA_SOURCE_TYPE_OPTIONS,
        defaultValue: 'still',
      },
      { key: 'source', label: 'Source', type: 'select', defaultValue: '1' },
    ],
  },
  'Multiviewer: Change layout': {
    definitionId: 'multiviewerLayout',
    fields: [
      {
        key: 'multiViewerId',
        label: 'Multiviewer',
        type: 'select',
        defaultValue: '1',
      },
      { key: 'layout', label: 'Layout', type: 'number', defaultValue: '1' },
      {
        key: 'topLeft',
        label: 'Top Left',
        type: 'select',
        options: ['ignore', 'program', 'preview'],
        defaultValue: 'ignore',
      },
      {
        key: 'topRight',
        label: 'Top Right',
        type: 'select',
        options: ['ignore', 'program', 'preview'],
        defaultValue: 'ignore',
      },
      {
        key: 'bottomLeft',
        label: 'Bottom Left',
        type: 'select',
        options: ['ignore', 'program', 'preview'],
        defaultValue: 'ignore',
      },
      {
        key: 'bottomRight',
        label: 'Bottom Right',
        type: 'select',
        options: ['ignore', 'program', 'preview'],
        defaultValue: 'ignore',
      },
    ],
  },
  'Multiviewer: Change window source': {
    definitionId: 'setMvSource',
    fields: [
      {
        key: 'multiViewerId',
        label: 'Multiviewer',
        type: 'select',
        defaultValue: '1',
      },
      {
        key: 'windowIndex',
        label: 'Window',
        type: 'number',
        defaultValue: '1',
      },
      { key: 'source', label: 'Source', type: 'select', defaultValue: '1' },
    ],
  },
  'Startup State: Clear': { definitionId: 'clearStartupState', fields: [] },
  'Startup State: Save': { definitionId: 'saveStartupState', fields: [] },
  'Transition: Change rate': {
    definitionId: 'transitionRate',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      {
        key: 'style',
        label: 'Style',
        type: 'select',
        options: ATEM_TRANSITION_STYLE_OPTIONS,
        defaultValue: 'mix',
      },
      { key: 'rate', label: 'Rate', type: 'number', defaultValue: '25' },
    ],
  },
  'Transition: Change selection': {
    definitionId: 'transitionSelection',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      {
        key: 'selection',
        label: 'Selection',
        type: 'select',
        defaultValue: 'background',
      },
    ],
  },
  'Transition: Change selection component': {
    definitionId: 'transitionSelectionComponent',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      {
        key: 'component',
        label: 'Component',
        type: 'select',
        defaultValue: 'key0',
      },
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        options: ATEM_TOGGLE_OPTIONS,
        defaultValue: 'on',
      },
    ],
  },
  'Transition: Preview': {
    definitionId: 'previewTransition',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      {
        key: 'state',
        label: 'State',
        type: 'select',
        options: ATEM_TOGGLE_OPTIONS,
        defaultValue: 'toggle',
      },
    ],
  },
  'Transition: Select components in transition': {
    definitionId: 'transitionSelectComponents',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      {
        key: 'background',
        label: 'Background',
        type: 'select',
        options: ['no-change', 'true', 'false'],
        defaultValue: 'no-change',
      },
      {
        key: 'key0',
        label: 'Key 1',
        type: 'select',
        options: ['no-change', 'true', 'false'],
        defaultValue: 'no-change',
      },
      {
        key: 'key1',
        label: 'Key 2',
        type: 'select',
        options: ['no-change', 'true', 'false'],
        defaultValue: 'no-change',
      },
      {
        key: 'key2',
        label: 'Key 3',
        type: 'select',
        options: ['no-change', 'true', 'false'],
        defaultValue: 'no-change',
      },
      {
        key: 'key3',
        label: 'Key 4',
        type: 'select',
        options: ['no-change', 'true', 'false'],
        defaultValue: 'no-change',
      },
      {
        key: 'key4',
        label: 'Key 5',
        type: 'select',
        options: ['no-change', 'true', 'false'],
        defaultValue: 'no-change',
      },
    ],
  },
  'Transition: Set style/pattern': {
    definitionId: 'transitionStyle',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      {
        key: 'style',
        label: 'Style',
        type: 'select',
        options: ATEM_TRANSITION_STYLE_OPTIONS,
        defaultValue: 'mix',
      },
    ],
  },
  'Upstream key: Set Flying Key (Luma, Chroma, Pattern)': {
    definitionId: 'uskFlyKeyLumaChromaPattern',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      {
        key: 'flyEnabled',
        label: 'Flying key',
        type: 'select',
        options: ATEM_BOOLEAN_OPTIONS,
        defaultValue: 'true',
      },
      {
        key: 'positionX',
        label: 'Position X',
        type: 'number',
        defaultValue: '0',
      },
      {
        key: 'positionY',
        label: 'Position Y',
        type: 'number',
        defaultValue: '0',
      },
      { key: 'sizeX', label: 'Size X', type: 'number', defaultValue: '1.0' },
      { key: 'sizeY', label: 'Size Y', type: 'number', defaultValue: '1.0' },
    ],
  },
  'Upstream key: Set inputs': {
    definitionId: 'uskSource',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      { key: 'fill', label: 'Fill Source', type: 'select', defaultValue: '1' },
      { key: 'cut', label: 'Key Source', type: 'select', defaultValue: '1' },
    ],
  },
  'Upstream key: Set Mask (Luma, Chroma, Pattern)': {
    definitionId: 'uskMaskLumaChromaPattern',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      {
        key: 'maskEnabled',
        label: 'Mask enabled',
        type: 'select',
        options: ATEM_BOOLEAN_OPTIONS,
        defaultValue: 'true',
      },
      { key: 'maskTop', label: 'Mask top', type: 'number', defaultValue: '9' },
      {
        key: 'maskBottom',
        label: 'Mask bottom',
        type: 'number',
        defaultValue: '-9',
      },
      {
        key: 'maskLeft',
        label: 'Mask left',
        type: 'number',
        defaultValue: '-16',
      },
      {
        key: 'maskRight',
        label: 'Mask right',
        type: 'number',
        defaultValue: '16',
      },
    ],
  },
  'Upstream key: Set OnAir': {
    definitionId: 'usk',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      {
        key: 'onair',
        label: 'On Air',
        type: 'select',
        options: ATEM_TOGGLE_OPTIONS,
        defaultValue: 'toggle',
      },
    ],
  },
  'Upstream key: Set type': {
    definitionId: 'uskType',
    fields: [
      { key: 'mixeffect', label: 'M/E', type: 'select', defaultValue: '1' },
      { key: 'key', label: 'Key', type: 'select', defaultValue: '1' },
      {
        key: 'type',
        label: 'Key type',
        type: 'select',
        options: ATEM_USK_TYPE_OPTIONS,
        defaultValue: 'luma',
      },
    ],
  },
};
export const ATEM_FUNCTIONS = new Set<string>(Object.keys(ATEM_FUNCTION_SPECS));
export const ATEM_DEFINITION_TO_FUNCTION = Object.fromEntries(
  Object.entries(ATEM_FUNCTION_SPECS).map(([func, spec]) => [
    spec.definitionId,
    func,
  ])
) as Record<string, string>;


export function atemParseNumber(rawValue: string, fallback: number): number {
  const parsed = Number.parseFloat(rawValue.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function atemParseIndex(rawValue: string, fallback = 1): number {
  const parsed = Number.parseInt(rawValue.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return 1;
  return parsed;
}

export function atemOnOffToggle(
  rawValue: string,
  fallback: 'TOGGLE' | 'ON' | 'OFF' = 'TOGGLE'
): 'TOGGLE' | 'ON' | 'OFF' {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'true' || normalized === 'on' || normalized === 'on air')
    return 'ON';
  if (normalized === 'false' || normalized === 'off') return 'OFF';
  if (normalized === 'toggle') return 'TOGGLE';
  return fallback;
}

export function atemBoolean(rawValue: string, fallback = false): boolean {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

export function atemBuildCommand(
  definitionId: string,
  fields: Record<string, string>
): string {
  const n = (key: string, fallback = 1) =>
    atemParseIndex(fields[key] ?? '', fallback);
  const x = (key: string, fallback = 0) =>
    atemParseNumber(fields[key] ?? '', fallback);
  const t = (key: string, fallback = '') => (fields[key] ?? fallback).trim();
  const onOff = (key: string, fallback: 'TOGGLE' | 'ON' | 'OFF' = 'TOGGLE') =>
    atemOnOffToggle(fields[key] ?? '', fallback);

  switch (definitionId) {
    case 'aux':
    case 'auxVariables':
      return `AUX ${n('aux', 1)} ${n('input', 1)}`;
    case 'dskAuto': {
      const mode = onOff('onair', 'TOGGLE');
      if (mode === 'ON' || mode === 'OFF')
        return `DSK ${n('downstreamKeyerId', 1)} ${mode}`;
      return `DSK ${n('downstreamKeyerId', 1)} AUTO`;
    }
    case 'dskSource':
    case 'dskSourceVariables':
      return `DSK ${n('key', 1)} SOURCE ${n('fill', 1)} ${n('cut', n('fill', 1))}`;
    case 'dskMask':
      return `DSK ${n('key', 1)} MASK ${x('maskTop', 9)} ${x('maskBottom', -9)} ${x('maskLeft', -16)} ${x('maskRight', 16)}`;
    case 'dsk':
      return `DSK ${n('key', 1)} ${onOff('onair', 'TOGGLE')}`;
    case 'dskPreMultipliedKey':
      return `DSK ${n('key', 1)} PREMULT ${atemBoolean(t('preMultiply'), true) ? 'ON' : 'OFF'}`;
    case 'dskRate':
      return `DSK ${n('key', 1)} RATE ${n('rate', 25)}`;
    case 'dskTie': {
      const state = t('state', 'on').toLowerCase();
      if (state === 'toggle') return `DSK ${n('key', 1)} TIE`;
      return `DSK ${n('key', 1)} ${state === 'off' || state === 'false' ? 'OFF' : 'ON'}`;
    }
    case 'fadeToBlackRate':
      return `FTB ${n('mixeffect', 1)} RATE ${n('rate', 25)}`;
    case 'fadeToBlackAuto':
      return `FTB ${n('mixeffect', 1)} AUTO`;
    case 'inputName': {
      const label = (
        t('long_value') ||
        t('short_value') ||
        `Input ${n('source', 1)}`
      ).trim();
      return `INPUT ${n('source', 1)} NAME ${label}`;
    }
    case 'macrocontinue':
      return 'MACRO CONTINUE';
    case 'macroloop': {
      const loop = t('loop', 'toggle').toLowerCase();
      if (loop === 'off' || loop === 'false') return 'MACRO STOP';
      if (loop === 'toggle') return 'MACRO CONTINUE';
      return 'MACRO LOOP 1';
    }
    case 'macrorun':
      return `MACRO RUN ${n('macro', 1)}`;
    case 'macrostop':
      return 'MACRO STOP';
    case 'auto':
      return 'AUTO';
    case 'cut':
      return 'CUT';
    case 'preview':
    case 'previewVariables':
      return `PREVIEW ${n('input', 1)} ${n('mixeffect', 1)}`;
    case 'program':
    case 'programVariables':
      return `PROGRAM ${n('input', 1)} ${n('mixeffect', 1)}`;
    case 'tBar':
      return `ME ${n('mixeffect', 1)} TBAR ${n('position', 0)}`;
    case 'mediaCaptureStill':
      return 'MEDIAPLAYER 1 CAPTURE 1';
    case 'mediaPlayerCycle':
      return `MEDIAPLAYER ${n('mediaplayer', 1)} ${t('direction', 'next').toLowerCase() === 'previous' ? 'PREV' : 'NEXT'}`;
    case 'mediaDeleteStill':
      return `MEDIAPLAYER 1 DELETE STILL ${n('slot', 1)}`;
    case 'mediaPlayerSource': {
      const sourceType =
        t('sourceType', 'still').toUpperCase() === 'CLIP' ? 'CLIP' : 'STILL';
      return `MEDIAPLAYER ${n('mediaplayer', 1)} ${sourceType} ${n('source', 1)}`;
    }
    case 'mediaPlayerSourceVariables2': {
      const sourceType =
        t('sourceType', 'still').toUpperCase() === 'CLIP' ? 'CLIP' : 'STILL';
      return `MEDIAPLAYER ${n('mediaplayer', 1)} ${sourceType} ${n('slot', 1)}`;
    }
    case 'multiviewerLayout':
      return `MV ${n('multiViewerId', 1)} LAYOUT ${n('layout', 1)}`;
    case 'setMvSource':
    case 'setMvSourceVariables':
      return `MV ${n('multiViewerId', 1)} WINDOW ${n('windowIndex', 1)} SOURCE ${n('source', 1)}`;
    case 'clearStartupState':
      return 'STARTUP CLEAR';
    case 'saveStartupState':
      return 'STARTUP SAVE';
    case 'transitionRate':
      return `TRANSITION ${n('mixeffect', 1)} RATE ${n('rate', 25)}`;
    case 'transitionSelection':
      return `TRANSITION ${n('mixeffect', 1)} SELECTION ${t('selection', 'background').toUpperCase()}`;
    case 'transitionSelectionComponent': {
      const comp = t('component', 'key0').toLowerCase();
      const compToken =
        comp === 'background'
          ? 'BKGD'
          : comp.toUpperCase().replace('KEY0', 'KEY1');
      return `TRANSITION ${n('mixeffect', 1)} COMPONENT ${compToken} ${onOff('mode', 'TOGGLE')}`;
    }
    case 'previewTransition':
      return `TRANSITION ${n('mixeffect', 1)} PREVIEW ${onOff('state', 'TOGGLE')}`;
    case 'transitionSelectComponents': {
      const components: string[] = [];
      if (t('background', 'no-change') === 'true') components.push('BKGD');
      if (t('key0', 'no-change') === 'true') components.push('KEY1');
      if (t('key1', 'no-change') === 'true') components.push('KEY2');
      if (t('key2', 'no-change') === 'true') components.push('KEY3');
      if (t('key3', 'no-change') === 'true') components.push('KEY4');
      if (t('key4', 'no-change') === 'true') components.push('KEY5');
      return `TRANSITION ${n('mixeffect', 1)} SELECT ${components.length ? components.join('+') : 'BKGD'}`;
    }
    case 'transitionStyle':
      return `TRANSITION ${n('mixeffect', 1)} STYLE ${t('style', 'mix').toUpperCase()}`;
    case 'uskFlyKeyLumaChromaPattern':
    case 'uskFlyKeyLumaChromaPatternVariables': {
      if (!atemBoolean(t('flyEnabled'), true))
        return `USK ${n('mixeffect', 1)} ${n('key', 1)} FLY OFF`;
      return `USK ${n('mixeffect', 1)} ${n('key', 1)} FLY RUN`;
    }
    case 'uskSource':
    case 'uskSourceVariables':
      return `USK ${n('mixeffect', 1)} ${n('key', 1)} SOURCE ${n('fill', 1)} ${n('cut', n('fill', 1))}`;
    case 'uskMaskLumaChromaPattern':
      return `USK ${n('mixeffect', 1)} ${n('key', 1)} MASK ${x('maskTop', 9)} ${x('maskBottom', -9)} ${x('maskLeft', -16)} ${x('maskRight', 16)}`;
    case 'usk':
      return `USK ${n('mixeffect', 1)} ${n('key', 1)} ${onOff('onair', 'TOGGLE')}`;
    case 'uskType':
      return `USK ${n('mixeffect', 1)} ${n('key', 1)} TYPE ${t('type', 'luma').toUpperCase()}`;
    default:
      return '';
  }
}

