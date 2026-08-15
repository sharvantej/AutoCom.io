import type { Connection, TaskEntry } from '../../types';
import type { SelectOption } from './deviceFunctionSets';
import { createEntityId } from '../../services/ids';

export function asTaskParams(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseConnectionId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function findConnectionForTask(
  connections: Connection[],
  task: Pick<TaskEntry, 'connection' | 'connectionId'>
): Connection | undefined {
  const connectionId = parseConnectionId(task.connectionId);
  if (connectionId !== null) {
    const byId = connections.find(
      (connection) => connection.id === connectionId
    );
    if (byId) return byId;
  }
  return connections.find((connection) => connection.name === task.connection);
}

export function parseResolvableNumber(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePositiveIntegerValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}


export function normalizeOscAddress(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}


export function parseCompanionOscMultipleArgs(input: string): unknown[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const tokens = trimmed.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return tokens.map((token) => {
    const unquoted =
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
        ? token.slice(1, -1)
        : token;
    if (/^(true|false)$/i.test(unquoted))
      return unquoted.toLowerCase() === 'true';
    const asNumber = Number.parseFloat(unquoted);
    if (!Number.isNaN(asNumber) && /^[-+]?\d+(\.\d+)?$/.test(unquoted))
      return asNumber;
    return unquoted;
  });
}

export function parseHexBytes(input: string): number[] {
  const cleaned = input.replace(/[^0-9a-fA-F]/g, '');
  if (!cleaned) return [];
  const normalized = cleaned.length % 2 === 0 ? cleaned : `0${cleaned}`;
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i += 2) {
    const value = Number.parseInt(normalized.slice(i, i + 2), 16);
    if (Number.isFinite(value)) bytes.push(Math.max(0, Math.min(255, value)));
  }
  return bytes;
}

export function buildOscMidiBytes(options: {
  mode: string;
  channel: number;
  data1: number;
  data2: number;
  pitch: number;
  rawHex: string;
}): number[] {
  const mode = options.mode.trim().toLowerCase();
  if (mode === 'raw') {
    return parseHexBytes(options.rawHex).slice(0, 4);
  }
  const channel = Math.max(1, Math.min(16, options.channel)) - 1;
  if (mode === 'pitchbend') {
    const bend = Math.max(-8192, Math.min(8191, Math.trunc(options.pitch)));
    const value = bend + 8192;
    const lsb = value & 0x7f;
    const msb = (value >> 7) & 0x7f;
    return [0xe0 | channel, lsb, msb, 0x00];
  }
  if (mode === 'cc') {
    return [
      0xb0 | channel,
      Math.max(0, Math.min(127, Math.trunc(options.data1))),
      Math.max(0, Math.min(127, Math.trunc(options.data2))),
      0x00,
    ];
  }
  if (mode === 'noteoff') {
    return [
      0x80 | channel,
      Math.max(0, Math.min(127, Math.trunc(options.data1))),
      Math.max(0, Math.min(127, Math.trunc(options.data2))),
      0x00,
    ];
  }
  return [
    0x90 | channel,
    Math.max(0, Math.min(127, Math.trunc(options.data1))),
    Math.max(0, Math.min(127, Math.trunc(options.data2))),
    0x00,
  ];
}


export function ensureUniqueTaskIds(source: TaskEntry[]): TaskEntry[] {
  const seen = new Set<string>();
  let changed = false;

  const next = source.map((task) => {
    const id = task.id?.trim();
    if (!id || seen.has(id)) {
      changed = true;
      const nextId = createEntityId('task');
      seen.add(nextId);
      return { ...task, id: nextId };
    }
    seen.add(id);
    return task;
  });

  return changed ? next : source;
}

export function selectOptionValue(option: SelectOption | undefined): string {
  if (!option) return '';
  return typeof option === 'string' ? option : option.value;
}

export function parseNonNegativeIntegerValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

export function readValueByPath(
  source: Record<string, unknown>,
  path: string
): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current))
      return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

export function setValueByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const segments = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    if (isLast) {
      cursor[segment] = value;
      return;
    }
    const next = cursor[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
}

export function normalizeObsFieldValue(
  rawValue: string,
  type: 'text' | 'number' | 'select' | 'json'
): unknown {
  const token = rawValue.trim();
  if (!token) return undefined;
  if (type === 'number') {
    const parsed = Number.parseFloat(token);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (type === 'json') {
    try {
      return JSON.parse(token) as unknown;
    } catch {
      return undefined;
    }
  }
  if (token === 'true') return true;
  if (token === 'false') return false;
  return token;
}

export function parseIntegerValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function parseLooseValue(value: string): unknown {
  const raw = value.trim();
  if (!raw) return '';
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && raw !== '') return numeric;
  return raw;
}

