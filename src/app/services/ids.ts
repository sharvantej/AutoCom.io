let lastNumericId = 0;

function parseValidId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  return null;
}

export function createNumericId(existing: ReadonlyArray<{ id: number } | number> = []): number {
  const now = Date.now();
  const maxExisting = existing.reduce<number>((maxId, item) => {
    const value = typeof item === "number" ? parseValidId(item) : parseValidId(item.id);
    if (value === null) return maxId;
    return Math.max(maxId, value);
  }, 0);

  const candidate = Math.max(now, maxExisting + 1, lastNumericId + 1);
  lastNumericId = candidate;
  return candidate;
}

export function createEntityId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  const entropy = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${createNumericId()}-${entropy}`;
}
