export const ROSS_XPRESSION_CUSTOM_COMMAND_REFERENCE: Array<{
  command: string;
  syntax: string;
  note?: string;
}> = [
  { command: 'CLRA', syntax: 'CLRA', note: 'Clear all framebuffers.' },
  {
    command: 'CLFB',
    syntax: 'CLFB <framebuffer>',
    note: 'Clear a framebuffer.',
  },
  {
    command: 'CLFB (layer)',
    syntax: 'CLFB <framebuffer>:<layer>',
    note: 'Clear one layer in a framebuffer.',
  },
  {
    command: 'SWAP',
    syntax: 'SWAP [framebuffer]',
    note: 'Swap all or one framebuffer.',
  },
  {
    command: 'SEQI',
    syntax: 'SEQI <takeId>:<layer>',
    note: 'Take item to air on layer.',
  },
  {
    command: 'TAKE',
    syntax: 'TAKE <takeId>:<framebuffer>:<layer>',
    note: 'Take item to framebuffer layer.',
  },
  {
    command: 'CUE',
    syntax: 'CUE <takeId>:<framebuffer>:<layer>',
    note: 'Ready item in framebuffer layer.',
  },
  {
    command: 'UNCUE',
    syntax: 'UNCUE <takeId>',
    note: 'Remove item from cue state.',
  },
  { command: 'UNCUEALL', syntax: 'UNCUEALL', note: 'Remove all cued items.' },
  {
    command: 'RESUME',
    syntax: 'RESUME <framebuffer>[:<layer>]',
    note: 'Resume framebuffer or layer.',
  },
  {
    command: 'LAYEROFF',
    syntax: 'LAYEROFF <framebuffer>:<layer>',
    note: 'Take layer off air.',
  },
  { command: 'UPNEXT', syntax: 'UPNEXT <takeId>', note: 'Set preview item.' },
  { command: 'FOCUS', syntax: 'FOCUS <takeId>', note: 'Set sequencer focus.' },
  {
    command: 'READ',
    syntax: 'READ',
    note: 'Take current sequencer item to air.',
  },
  { command: 'NEXT', syntax: 'NEXT', note: 'Take and advance sequencer.' },
  { command: 'UP / DOWN', syntax: 'UP | DOWN', note: 'Move sequencer focus.' },
  { command: 'SEQO', syntax: 'SEQO <takeId>', note: 'Take item off air.' },
  { command: 'GPI', syntax: 'GPI <number>', note: 'Trigger simulated GPI.' },
];
export const ROSS_XPRESSION_TAKE_ID_FUNCTIONS = new Set<string>([
  'Load take item to air on layer (SEQI)',
  'Load take item to framebuffer layer (TAKE)',
  'Ready item into a framebuffer layer (CUE)',
  'Remove take item from the cued state (UNCUE)',
  'Set preview to take item (UPNEXT)',
  'Set sequencer focus to take item (FOCUS)',
  'Take take item off air (SEQO)',
]);
export const ROSS_XPRESSION_FRAMEBUFFER_FUNCTIONS = new Set<string>([
  'Clear framebuffer (CLFB)',
  'Clear layer in framebuffer (CLFB)',
  'Load cued items in framebuffer (SWAP)',
  'Load take item to framebuffer layer (TAKE)',
  'Ready item into a framebuffer layer (CUE)',
  'Resume all layers in framebuffer (RESUME)',
  'Resume layer in framebuffer (RESUME)',
  'Take layer in framebuffer off air (LAYEROFF)',
]);
export const ROSS_XPRESSION_LAYER_FUNCTIONS = new Set<string>([
  'Clear layer in framebuffer (CLFB)',
  'Load take item to air on layer (SEQI)',
  'Load take item to framebuffer layer (TAKE)',
  'Ready item into a framebuffer layer (CUE)',
  'Resume layer in framebuffer (RESUME)',
  'Take layer in framebuffer off air (LAYEROFF)',
]);

export function isRossXpressionCustomCommandFunction(funcName: string): boolean {
  return funcName === 'Send a custom command';
}

export function isRossXpressionGpiFunction(funcName: string): boolean {
  return funcName === 'Trigger simulated GPI (GPI)';
}

export function needsRossXpressionTakeId(funcName: string): boolean {
  return ROSS_XPRESSION_TAKE_ID_FUNCTIONS.has(funcName);
}

export function needsRossXpressionFramebuffer(funcName: string): boolean {
  return ROSS_XPRESSION_FRAMEBUFFER_FUNCTIONS.has(funcName);
}

export function needsRossXpressionLayer(funcName: string): boolean {
  return ROSS_XPRESSION_LAYER_FUNCTIONS.has(funcName);
}

export function readRossXpressionToken(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return null;
}

export function parseRossXpressionTakeFramebuffer(
  input: string
): { takeId: string; framebuffer: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const [takeIdRaw, framebufferRaw] = trimmed.split(':');
  if (!takeIdRaw || !framebufferRaw) return null;
  const takeId = takeIdRaw.trim();
  const framebuffer = framebufferRaw.trim();
  if (!takeId || !framebuffer) return null;
  return { takeId, framebuffer };
}

