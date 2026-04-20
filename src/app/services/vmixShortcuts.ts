import type { Connection, TaskEntry } from "../types";
import { createEntityId } from "./ids";

export type VmixShortcutCategory = {
  name: string;
  count: number;
};

export type VmixShortcutFunction = {
  name: string;
  category: string;
  description: string;
  parameters: string;
  paramKeys: string[];
};

export type VmixShortcutCatalog = {
  source: string;
  generatedAt?: string;
  versionHint?: string;
  transitionsNote?: string;
  totalFunctions: number;
  categories: VmixShortcutCategory[];
  functions: VmixShortcutFunction[];
};

let vmixShortcutCatalogPromise: Promise<VmixShortcutCatalog | null> | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sanitizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeCategory(value: unknown): VmixShortcutCategory | null {
  const record = asRecord(value);
  if (!record) return null;

  const name = sanitizeString(record.name);
  if (!name) return null;

  return {
    name,
    count: Number(record.count) || 0,
  };
}

function sanitizeFunction(value: unknown): VmixShortcutFunction | null {
  const record = asRecord(value);
  if (!record) return null;

  const name = sanitizeString(record.name);
  if (!name) return null;

  const paramKeys = Array.isArray(record.paramKeys)
    ? record.paramKeys
        .map((key) => sanitizeString(key))
        .filter(Boolean)
    : [];

  return {
    name,
    category: sanitizeString(record.category) || "General",
    description: sanitizeString(record.description),
    parameters: sanitizeString(record.parameters),
    paramKeys,
  };
}

function sanitizeCatalog(value: unknown): VmixShortcutCatalog | null {
  const record = asRecord(value);
  if (!record) return null;

  const functions = Array.isArray(record.functions)
    ? record.functions
        .map(sanitizeFunction)
        .filter((item): item is VmixShortcutFunction => item !== null)
    : [];

  if (!functions.length) return null;

  const categories = Array.isArray(record.categories)
    ? record.categories
        .map(sanitizeCategory)
        .filter((item): item is VmixShortcutCategory => item !== null)
    : [];

  const fallbackCategories = Array.from(
    functions.reduce((map, item) => {
      const current = map.get(item.category) ?? 0;
      map.set(item.category, current + 1);
      return map;
    }, new Map<string, number>()),
    ([name, count]) => ({ name, count }),
  );

  return {
    source: sanitizeString(record.source),
    generatedAt: sanitizeString(record.generatedAt) || undefined,
    versionHint: sanitizeString(record.versionHint) || undefined,
    transitionsNote: sanitizeString(record.transitionsNote) || undefined,
    totalFunctions: Number(record.totalFunctions) || functions.length,
    categories: categories.length ? categories : fallbackCategories,
    functions,
  };
}

async function fetchVmixShortcutCatalog(): Promise<VmixShortcutCatalog | null> {
  try {
    const response = await fetch("/vmix-shortcuts.json", { cache: "no-cache" });
    if (!response.ok) return null;
    const raw = await response.json() as unknown;
    return sanitizeCatalog(raw);
  } catch {
    return null;
  }
}

export async function loadVmixShortcutCatalog(): Promise<VmixShortcutCatalog | null> {
  if (!vmixShortcutCatalogPromise) {
    vmixShortcutCatalogPromise = fetchVmixShortcutCatalog();
  }
  return vmixShortcutCatalogPromise;
}

export function getVmixCategories(catalog: VmixShortcutCatalog | null): string[] {
  if (!catalog) return [];

  const names = catalog.categories
    .map((category) => sanitizeString(category.name))
    .filter(Boolean);

  return names.length
    ? names
    : Array.from(new Set(catalog.functions.map((item) => item.category))).sort((left, right) => left.localeCompare(right));
}

export function getVmixFunctionsForCategory(
  catalog: VmixShortcutCatalog | null,
  category: string,
): VmixShortcutFunction[] {
  if (!catalog) return [];
  const target = sanitizeString(category).toLowerCase();
  return catalog.functions
    .filter((item) => item.category.toLowerCase() === target)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getVmixFunctionByName(
  catalog: VmixShortcutCatalog | null,
  functionName: string,
): VmixShortcutFunction | null {
  if (!catalog) return null;
  const target = sanitizeString(functionName).toLowerCase();
  return catalog.functions.find((item) => item.name.toLowerCase() === target) ?? null;
}

export function buildVmixCommand(
  functionName: string,
  args: Record<string, unknown> = {},
): string {
  const fn = sanitizeString(functionName);
  if (!fn) return "";

  const query = Object.entries(args)
    .map(([key, value]) => [sanitizeString(key), sanitizeString(value)])
    .filter(([key, value]) => key && value)
    .map(([key, value]) => {
      const encodedKey = encodeURIComponent(key);
      // Preserve commas in values (vMix accepts comma-delimited params like SetVolumeFade "50,1500")
      const encodedValue = encodeURIComponent(value).replace(/%2C/gi, ",");
      return `${encodedKey}=${encodedValue}`;
    })
    .join("&");

  return query ? `FUNCTION ${fn} ${query}` : `FUNCTION ${fn}`;
}

function summarizeArgs(
  shortcut: VmixShortcutFunction,
  args: Record<string, unknown>,
): string {
  const parts = shortcut.paramKeys
    .map((key) => {
      const value = sanitizeString(args[key]);
      return value ? `${key}=${value}` : "";
    })
    .filter(Boolean);

  if (!parts.length) return "";

  const summary = parts.join(", ");
  return summary.length > 48 ? `${summary.slice(0, 45)}...` : summary;
}

export function buildVmixTask(
  connection: Connection,
  shortcut: VmixShortcutFunction,
  args: Record<string, unknown>,
): TaskEntry {
  const vmixArgs = shortcut.paramKeys.reduce<Record<string, string>>((acc, key) => {
    const value = sanitizeString(args[key]);
    if (value) acc[key] = value;
    return acc;
  }, {});

  const command = buildVmixCommand(shortcut.name, vmixArgs);
  const summary = summarizeArgs(shortcut, vmixArgs);

  return {
    id: createEntityId("task"),
    connection: connection.name,
    connectionId: connection.id,
    mode: "Shortcut",
    category: shortcut.category,
    funcName: shortcut.name,
    input: "",
    value: "",
    pause: "",
    label: summary ? `vMix: ${shortcut.name} (${summary})` : `vMix: ${shortcut.name}`,
    shortcutId: `vmix-catalog:${shortcut.name.toLowerCase()}`,
    presetId: `vmix-catalog:${shortcut.name.toLowerCase()}`,
    params: {
      protocol: "tcp",
      action: "command",
      command,
      lineEnd: "crlf",
      vmixMode: "builder",
      vmixCategory: shortcut.category,
      vmixFunction: shortcut.name,
      vmixArgs,
    },
  };
}
