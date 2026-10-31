import { LocalStorageBackend } from './storage';

export const LANGUAGE_KEY = 'fooplan.language';

export const TABBABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export const modalDialogs = new WeakSet<HTMLDialogElement>();

// jsdom has no showModal() or close(). These follow the browser as far as the tests need: opening
// focuses the dialog's autofocus element, else its first focusable one; closing puts the focus back
// on the element focused before opening (none when the button opening it was clicked without
// focusing it, as Safari does on a click) and fires "close". The page behind isn't made inert here;
// jsdom can't tell a modal dialog, so modalDialogs records the dialogs opened with showModal().
// Returns what puts jsdom's own back
export function installDialog(): () => void {
  const prototype = HTMLDialogElement.prototype;
  const names = ['showModal', 'close'] as const;
  const originals = names.map((name) => Object.getOwnPropertyDescriptor(prototype, name));
  const focusedBefore = new WeakMap<HTMLDialogElement, Element | null>();
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    if (this.open) {
      return;
    }
    focusedBefore.set(this, document.activeElement);
    this.setAttribute('open', '');
    modalDialogs.add(this);
    const target =
      this.querySelector<HTMLElement>('[autofocus]') ?? this.querySelector<HTMLElement>(TABBABLE);
    target?.focus();
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.open) {
      return;
    }
    this.removeAttribute('open');
    modalDialogs.delete(this);
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.contains(active)) {
      active.blur();
    }
    const previous = focusedBefore.get(this);
    if (previous instanceof HTMLElement && previous.isConnected) {
      previous.focus();
    }
    this.dispatchEvent(new Event('close'));
  };
  return () => {
    names.forEach((name, i) => {
      const original = originals[i];
      if (original) {
        Object.defineProperty(prototype, name, original);
      } else {
        Reflect.deleteProperty(prototype, name);
      }
    });
  };
}

// Stands in for navigator.wakeLock, which jsdom lacks: records every request and the sentinel each
// one resolved with. `throwWith` makes request() throw before it returns a promise, `rejectWith`
// makes it reject (read when request() is called, not when beforeAnswer lets the answer through),
// and beforeAnswer holds it before it answers; `releaseRejects` makes the sentinels' release()
// reject, and beforeRelease holds it
export class FakeWakeLock {
  readonly requests: string[] = [];
  readonly sentinels: FakeSentinel[] = [];
  throwWith: Error | null = null;
  rejectWith: DOMException | null = null;
  beforeAnswer: () => Promise<void> = () => Promise.resolve();
  releaseRejects = false;
  beforeRelease: () => Promise<void> = () => Promise.resolve();

  request(type: string): Promise<FakeSentinel> {
    this.requests.push(type);
    if (this.throwWith) {
      throw this.throwWith;
    }
    const rejection = this.rejectWith;
    return this.beforeAnswer().then(() => {
      if (rejection) {
        throw rejection;
      }
      const sentinel = new FakeSentinel(this);
      this.sentinels.push(sentinel);
      return sentinel;
    });
  }

  releases(): number {
    return this.sentinels.reduce((count, sentinel) => count + sentinel.releases, 0);
  }
}

export class FakeSentinel extends EventTarget {
  readonly type = 'screen';
  released = false;
  releases = 0;

  constructor(private readonly lock: FakeWakeLock) {
    super();
  }

  async release(): Promise<void> {
    this.releases++;
    await this.lock.beforeRelease();
    if (this.lock.releaseRejects) {
      throw new DOMException('release failed', 'AbortError');
    }
    this.browserRelease();
  }

  // As the browser does when the document is hidden, and on release()
  browserRelease(): void {
    if (!this.released) {
      this.released = true;
      this.dispatchEvent(new Event('release'));
    }
  }
}

// Puts `lock` in place of navigator.wakeLock, or none at all when it is null, as in a browser
// without the API. Returns what puts jsdom's own back
export function installWakeLock(lock: FakeWakeLock | null): () => void {
  const original = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');
  if (lock) {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: lock });
  } else {
    Reflect.deleteProperty(navigator, 'wakeLock');
  }
  return () => {
    if (original) {
      Object.defineProperty(navigator, 'wakeLock', original);
    } else {
      Reflect.deleteProperty(navigator, 'wakeLock');
    }
  };
}

export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

// A slow backend: reads wait until release(), and from then on answer at once. Reads and writes go
// to localStorage, as with the default
export class HeldBackend extends LocalStorageBackend {
  private released = false;
  private readonly waiting: (() => void)[] = [];

  override async read(key: string): Promise<unknown> {
    if (!this.released) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    return super.read(key);
  }

  release(): void {
    this.released = true;
    this.waiting.splice(0).forEach((resolve) => resolve());
  }
}

// Every write rejects, as with a backend that can't reach its server; reads go to localStorage
export class RejectingBackend extends LocalStorageBackend {
  readonly writes: [string, unknown][] = [];

  override write(key: string, value: unknown): Promise<void> {
    this.writes.push([key, value]);
    return Promise.reject(new Error('not saved'));
  }
}

// The first read throws before it returns a promise, as a backend failing at once would; the reads
// after it go to localStorage
export class ThrowingOnceBackend extends LocalStorageBackend {
  private thrown = false;

  override read(key: string): Promise<unknown> {
    if (!this.thrown) {
      this.thrown = true;
      throw new Error('not read');
    }
    return super.read(key);
  }
}

// The rejections nothing handled while `run`, the promise it returned and the tasks it queued ran.
// The specs run in Node, which reports them as an event of its own. A promise `run` returns that
// rejects makes this throw rather than list the reason
export async function unhandledRejections(run: () => unknown): Promise<unknown[]> {
  const { process } = globalThis as unknown as { process: NodeEvents };
  const reasons: unknown[] = [];
  const listener = (reason: unknown) => reasons.push(reason);
  process.on('unhandledRejection', listener);
  try {
    await run();
    await new Promise((resolve) => setTimeout(resolve));
  } finally {
    process.off('unhandledRejection', listener);
  }
  return reasons;
}

interface NodeEvents {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
  off(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
}
