import { Injectable } from '@angular/core';

// Where the stores keep the user's data: a JSON value under each key. Reads and writes are
// asynchronous, so a store loads its data before it is used, and either may reject when it fails.
// The default is the browser's localStorage
@Injectable({ providedIn: 'root', useFactory: () => new LocalStorageBackend() })
export abstract class StorageBackend {
  // Resolves with the parsed JSON saved under the key, or null when there is none or it isn't JSON
  abstract read(key: string): Promise<unknown>;

  // Saves the value as JSON under the key
  abstract write(key: string, value: unknown): Promise<void>;
}

// Blocked or full storage never rejects: reads find nothing, and a change then lives until the page
// is reloaded
export class LocalStorageBackend extends StorageBackend {
  read(key: string): Promise<unknown> {
    return Promise.resolve(readStored(key));
  }

  write(key: string, value: unknown): Promise<void> {
    writeStored(key, value);
    return Promise.resolve();
  }
}

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
