export const ROSS_TALK_CUSTOM_COMMAND_FUNCTIONS = new Set<string>([
  'Send Custom Command',
  'Send a custom command',
]);
export const ROSS_TALK_FUNCTIONS_WITHOUT_EXTRA_FIELDS = new Set<string>([
  'Fade to Black',
]);
export const ROSS_TALK_FUNCTION_ORDER: string[] = [
  'Auto Transition',
  'Change Multiviewer Box',
  'Cut',
  'Fade to Black',
  'Fire Custom Control',
  'Load Set',
  'MEM',
  'Send a custom command',
  'Send Custom Command',
  'SEQI',
  'SEQO',
  'Transition Keyer',
  'Trigger GPI',
  'Trigger GPI by Name',
  'Ultrix Timer',
  'XPT',
];
export const ROSS_TALK_CUSTOM_COMMAND_REFERENCE: Array<{
  command: string;
  syntax: string;
}> = [
  { command: 'AUTO', syntax: 'AUTO <ME:1>' },
  { command: 'CUT', syntax: 'CUT <ME:1>' },
  { command: 'MVO', syntax: 'MVO <multiviewer>:<box> <source>' },
  { command: 'CC', syntax: 'CC <bank>:<number>' },
  { command: 'LOADSET', syntax: 'LOADSET <setName> [location]' },
  { command: 'MEM', syntax: 'MEM <memoryId>' },
  { command: 'SEQI', syntax: 'SEQI <takeId> <layer>' },
  { command: 'SEQO', syntax: 'SEQO <takeId>' },
  {
    command: 'TRANSKEY',
    syntax: 'TRANSKEY <ME:1:keyer> <CUT|AUTO|CUTON|CUTOFF|AUTOON|AUTOOFF>',
  },
  { command: 'GPI', syntax: 'GPI <number>' },
  { command: 'GPINAME', syntax: 'GPINAME <name> [parameter]' },
  { command: 'XPT', syntax: 'XPT <destination> <source>' },
];

export function isRossTalkCustomCommandFunction(funcName: string): boolean {
  return ROSS_TALK_CUSTOM_COMMAND_FUNCTIONS.has(funcName);
}

export function parseRossTalkMleKeyerReference(
  value: string
): { mle: string; keyer: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed
    .split(':')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0].toUpperCase() === 'ME' && parts.length >= 3) {
    return { mle: `ME:${parts[1]}`, keyer: parts[2] };
  }
  return { mle: `${parts[0]}:${parts[1]}`, keyer: parts[2] ?? '1' };
}

export function buildRossTalkMleKeyerReference(mle: string, keyer: string): string {
  const mleToken = mle.trim();
  const keyerToken = keyer.trim();
  if (!mleToken || !keyerToken) return '';
  return `${mleToken}:${keyerToken}`;
}

export function parseRossTalkMultiviewerBox(
  value: string
): { multiviewer: string; box: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed
    .split(':')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return { multiviewer: parts[0], box: parts[1] };
}

export function buildRossTalkTransitionToken(
  onOff: string,
  transitionType: string
): string {
  const type = transitionType.trim().toUpperCase() === 'AUTO' ? 'AUTO' : 'CUT';
  const mode = onOff.trim().toLowerCase();
  if (mode === 'on') return type === 'AUTO' ? 'AUTOON' : 'CUTON';
  if (mode === 'off') return type === 'AUTO' ? 'AUTOOFF' : 'CUTOFF';
  return type;
}

export function parseRossTalkTransitionToken(value: string): {
  onOff: 'toggle' | 'on' | 'off';
  transitionType: 'CUT' | 'AUTO';
} {
  const token = value.trim().toUpperCase();
  if (token === 'AUTOON') return { onOff: 'on', transitionType: 'AUTO' };
  if (token === 'AUTOOFF') return { onOff: 'off', transitionType: 'AUTO' };
  if (token === 'AUTO') return { onOff: 'toggle', transitionType: 'AUTO' };
  if (token === 'CUTON') return { onOff: 'on', transitionType: 'CUT' };
  if (token === 'CUTOFF') return { onOff: 'off', transitionType: 'CUT' };
  return { onOff: 'toggle', transitionType: 'CUT' };
}

