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
