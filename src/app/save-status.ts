import { computed, Injectable, signal } from '@angular/core';

// Whether a change the stores made couldn't be saved: the last write of some key was refused. A key's
// next write holds its whole value, so it saves the refused change too; a write of another key
// doesn't. Writes can settle out of order, so only the last one started for a key counts
@Injectable({ providedIn: 'root' })
export class SaveStatus {
  private readonly failedKeys = signal<ReadonlySet<string>>(new Set());
  readonly failed = computed(() => this.failedKeys().size > 0);
  private readonly lastStarted = new Map<string, Promise<void>>();

  track(key: string, write: Promise<void>): void {
    this.lastStarted.set(key, write);
    write.then(
      () => this.settled(key, write, false),
      () => this.settled(key, write, true),
    );
  }

  // The stores hold other data from now on, e.g. after the session changed: the writes started
  // before no longer count
  reset(): void {
    this.lastStarted.clear();
    this.failedKeys.set(new Set());
  }

  private settled(key: string, write: Promise<void>, failed: boolean): void {
    if (this.lastStarted.get(key) !== write) {
      return;
    }
    const keys = new Set(this.failedKeys());
    if (failed) {
      keys.add(key);
    } else {
      keys.delete(key);
    }
    this.failedKeys.set(keys);
  }
}
