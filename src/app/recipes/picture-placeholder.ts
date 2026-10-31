import { Component } from '@angular/core';

// On the div itself rather than a host element around it, so the placeholder stays the first child
// of the card or button it starts, in the img's place. Its size comes from the page's `.picture`.
@Component({
  host: { class: 'picture placeholder' },
  selector: 'div[appPicturePlaceholder]',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.25"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M7 6.5v3.5a1.5 1.5 0 0 0 3 0V6.5M8.5 6.5v11" />
      <path d="M16.5 17.5v-11c-1.4.8-2 2.7-2 5.5h2" />
    </svg>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--hover);
      color: var(--muted);
    }

    svg {
      height: 25%;
      aspect-ratio: 1;
    }
  `,
})
export class PicturePlaceholder {}
