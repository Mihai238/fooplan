import { DestroyRef, inject, Injectable } from '@angular/core';

// Keeps the screen on with the Screen Wake Lock API where the browser has it. A lock the browser
// refuses or lacks is no error: the screen just turns off as usual
@Injectable({ providedIn: 'root' })
export class WakeLock {
  private inForce = false;
  private sentinel: WakeLockSentinel | null = null;
  private requesting = false;

  // The browser releases the lock itself whenever the document is hidden, so it is requested again
  // once the document is visible
  constructor() {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && this.inForce) {
        void this.request();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('visibilitychange', onVisibilityChange),
    );
  }

  hold(): Promise<void> {
    this.inForce = true;
    return this.sentinel ? Promise.resolve() : this.request();
  }

  async release(): Promise<void> {
    this.inForce = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel) {
      await releaseQuietly(sentinel);
    }
  }

  // A sentinel arriving after release() is released at once, as nothing holds the lock any more
  private async request(): Promise<void> {
    if (this.requesting) {
      return;
    }
    this.requesting = true;
    const sentinel = await requestQuietly();
    this.requesting = false;
    if (!sentinel) {
      return;
    }
    if (this.inForce) {
      await this.keep(sentinel);
    } else {
      await releaseQuietly(sentinel);
    }
  }

  // The browser releases a sentinel without being asked, e.g. when the document is hidden: one it
  // released no longer counts as held
  private async keep(sentinel: WakeLockSentinel): Promise<void> {
    const previous = this.sentinel;
    this.sentinel = sentinel;
    sentinel.addEventListener(
      'release',
      () => {
        if (this.sentinel === sentinel) {
          this.sentinel = null;
        }
      },
      { once: true },
    );
    if (previous) {
      await releaseQuietly(previous);
    }
  }
}

async function requestQuietly(): Promise<WakeLockSentinel | null> {
  if (!('wakeLock' in navigator)) {
    return null;
  }
  try {
    return await navigator.wakeLock.request('screen');
  } catch {
    return null;
  }
}

async function releaseQuietly(sentinel: WakeLockSentinel): Promise<void> {
  try {
    await sentinel.release();
  } catch {}
}
