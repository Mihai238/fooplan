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

// The rejections nothing handled while `run` and the tasks it queued ran. The specs run in Node,
// which reports them as an event of its own
export async function unhandledRejections(run: () => void): Promise<unknown[]> {
  const { process } = globalThis as unknown as { process: NodeEvents };
  const reasons: unknown[] = [];
  const listener = (reason: unknown) => reasons.push(reason);
  process.on('unhandledRejection', listener);
  try {
    run();
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
