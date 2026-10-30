export function readStored(key: string): unknown {
  try {
    return JSON.parse(readStoredText(key) ?? 'null');
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown): void {
  writeStoredText(key, JSON.stringify(value));
}

export function readStoredText(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredText(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked or full; the change then lives until the page is reloaded
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
