import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageStore } from '../../language-store';
import { PlanStore } from '../../plan/plan-store';
import { RecipeStore } from '../../recipes/recipe-store';
import {
  AddedItem,
  AddFeedback,
  addFeedback,
  byShownName,
  itemKey,
  ListItem,
  listItems,
  shoppingView,
} from '../groceries';
import { suggestions } from '../recent-items';
import { RecentItemsStore } from '../recent-items-store';

const UNDO_SECONDS = 5;
// A line leaving its list stays in the page until its fade ends, but is no longer on the list
const LISTED_CHECKBOX = 'li:not(.leaving) input[type="checkbox"]';

interface UndoLine {
  key: string;
  item: ListItem;
}

@Component({
  imports: [RouterLink],
  selector: 'app-grocery-list',
  styleUrl: './grocery-list.css',
  templateUrl: './grocery-list.html',
})
export class GroceryList {
  private readonly store = inject(PlanStore);
  private readonly recipes = inject(RecipeStore);
  private readonly recentItems = inject(RecentItemsStore);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  protected readonly language = inject(LanguageStore);
  protected readonly plan = this.store.plan;
  protected readonly key = itemKey;
  protected readonly view = computed(() =>
    shoppingView(
      listItems(this.plan(), this.recipes.all(), this.language.language()),
      this.plan().ticked,
      byShownName((item) => this.nameOf(item), this.language.language()),
    ),
  );
  private readonly typed = signal('');
  private readonly fieldFocused = signal(false);
  private readonly dismissed = signal(false);
  protected readonly suggested = computed(() =>
    this.fieldFocused() && !this.dismissed()
      ? suggestions(this.recentItems.items(), this.plan().added, this.typed())
      : [],
  );
  protected readonly highlight = linkedSignal({ source: this.suggested, computation: () => -1 });
  private readonly highlighted = computed(() => this.suggested()[this.highlight()] ?? null);
  protected readonly activeOption = computed(() =>
    this.highlighted() === null ? null : `new-item-suggestion-${this.highlight()}`,
  );
  private readonly feedback = signal<AddFeedback | null>(null);
  // Rendered from the message, so the status follows a change of language
  protected readonly feedbackText = computed(() => {
    const feedback = this.feedback();
    if (feedback === null) {
      return '';
    }
    return feedback.id === 'groceries.added'
      ? this.language.t(feedback.id, {
          ...feedback.params,
          section: this.language.section(feedback.params.section),
        })
      : this.language.t(feedback.id, feedback.params);
  });
  protected readonly undoHovered = signal(false);
  protected readonly undoFocused = signal(false);
  // The id of the pointer pressing on the bar, so another finger lifted elsewhere leaves the press on
  protected readonly undoPress = signal<number | null>(null);
  private readonly undoLine = signal<UndoLine | null>(null);
  private readonly undoExpired = signal(false);
  private undoTimer: ReturnType<typeof setTimeout> | undefined;
  // Derived from the cart, so the bar goes away however its line leaves it
  protected readonly undoBar = computed(() => {
    const line = this.undoLine();
    const held =
      !this.undoExpired() || this.undoHovered() || this.undoFocused() || this.undoPress() !== null;
    return held && line !== null && this.isInCart(line.key) ? line : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.undoTimer));
    // The focus stays, so the field suggests again once typed in
    effect(() => {
      this.store.started();
      this.clearField();
      this.feedback.set(null);
      this.undoLine.set(null);
      clearTimeout(this.undoTimer);
    });
  }

  // Without preventDefault the browser would submit the form and reload the page. Assistive
  // technology can submit it from elsewhere, so the focus goes back to the field for the next item
  protected add(event: SubmitEvent, input: HTMLInputElement): void {
    event.preventDefault();
    this.addFromField(input.value);
  }

  protected typeInField(input: HTMLInputElement): void {
    this.typed.set(input.value);
    this.dismissed.set(false);
  }

  protected focusField(): void {
    this.fieldFocused.set(true);
    this.dismissed.set(false);
  }

  protected blurField(): void {
    this.fieldFocused.set(false);
  }

  // Arrow keys would move the caret to the start or end of the text
  protected keyInField(event: KeyboardEvent): void {
    const count = this.suggested().length;
    // During an IME composition, Enter and the arrows pick from the IME's own candidates
    if (event.isComposing || count === 0) {
      return;
    }
    const highlighted = this.highlighted();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlight.update((index) => Math.min(index + 1, count - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlight.update((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Enter' && highlighted !== null) {
      // Else the form would submit the typed text as well
      event.preventDefault();
      this.addFromField(highlighted);
    } else if (event.key === 'Escape') {
      this.dismissed.set(true);
    }
  }

  // Without preventDefault the field would lose the focus, which closes a phone's keyboard; some
  // browsers move it on mousedown even after a prevented pointerdown. Any primary press counts, as
  // a ctrl+click is still a click outside macOS. The item is added on the click, not here, since a
  // swipe that starts on a row scrolls the page and ends with no click
  protected pressSuggestion(event: MouseEvent): void {
    if (event.button === 0) {
      event.preventDefault();
    }
  }

  // Toggling moves the item's row to the other list, which drops the focus to <body> and sends
  // keyboard and screen-reader users back to the top of the page
  protected toggle(item: ListItem, checkbox: HTMLInputElement): void {
    const key = itemKey(item);
    const fromCart = checkbox.closest('.cart') !== null;
    if (!fromCart) {
      this.offerUndo(item);
    }
    this.store.toggleTicked(key);
    // After a click or tap the user isn't lost, and moving the focus would scroll the page,
    // e.g. up to the cart on a phone
    if (!checkbox.matches(':focus-visible')) {
      return;
    }
    // Read before the render, which removes the toggled line from this list
    const line = checkbox.closest('li');
    const sibling = this.checkboxAfter(line, 'next') ?? this.checkboxAfter(line, 'previous');
    const nextSection = this.checkboxAfter(checkbox.closest('section'), 'next');
    afterNextRender(
      () => {
        const fallback = fromCart
          ? (this.cartSummary() ?? this.checkboxOf(key))
          : (nextSection ?? this.cartSummary());
        (sibling ?? fallback)?.focus();
      },
      { injector: this.injector },
    );
  }

  // Like toggle, but the line is gone for good, so without a line next to it the focus goes back to
  // the field the item came from
  protected remove(item: AddedItem, button: HTMLButtonElement): void {
    this.store.removeItem(item.name);
    this.recentItems.forget(item.name);
    if (!button.matches(':focus-visible')) {
      return;
    }
    const line = button.closest('li');
    const sibling = this.checkboxAfter(line, 'next') ?? this.checkboxAfter(line, 'previous');
    afterNextRender(() => (sibling ?? this.addField())?.focus(), { injector: this.injector });
  }

  // Like toggle: "Undo" takes the bar away, so from the keyboard the focus goes to the line back in
  // its section. It goes by the bar's line, not the shown bar, as a click can still reach the button
  // between the bar expiring and the render that removes it
  protected undo(button: HTMLButtonElement): void {
    const line = this.undoLine();
    this.undoLine.set(null);
    clearTimeout(this.undoTimer);
    if (line === null || !this.isInCart(line.key)) {
      return;
    }
    this.store.toggleTicked(line.key);
    if (!button.matches(':focus-visible')) {
      return;
    }
    afterNextRender(() => this.checkboxOf(line.key)?.focus(), { injector: this.injector });
  }

  // Only a primary press is followed by a click; a ctrl+click opens the context menu on macOS
  protected startPress(event: PointerEvent): void {
    if (event.button === 0 && !event.ctrlKey) {
      this.undoPress.set(event.pointerId);
    }
  }

  // A press released inside the bar is followed by a click on it, which ends the press there
  protected endPressOutside(event: PointerEvent, bar: HTMLElement): void {
    if (!bar.contains(event.target as Node)) {
      this.endPress(event);
    }
  }

  protected endPress(event: PointerEvent): void {
    if (event.pointerId === this.undoPress()) {
      this.undoPress.set(null);
    }
  }

  protected addFromField(text: string): void {
    this.addItem(text);
    this.clearField();
    this.addField()?.focus();
  }

  private addItem(text: string): void {
    const feedback = addFeedback(this.plan(), text, this.language.language());
    this.feedback.set(feedback);
    this.store.addItem(text);
    if (feedback?.id === 'groceries.added') {
      this.recentItems.remember(text);
    }
  }

  private clearField(): void {
    const field = this.addField();
    if (field !== null) {
      field.value = '';
    }
    this.typed.set('');
  }

  private offerUndo(item: ListItem): void {
    // A bar that is removed gets no pointerleave, focusout or end of a press, so a new one starts
    // unheld, while the pointer, a press or the focus on a bar that stays from one tick to the next
    // still holds it
    if (this.undoBar() === null) {
      this.undoHovered.set(false);
      this.undoFocused.set(false);
      this.undoPress.set(null);
    }
    this.undoLine.set({ key: itemKey(item), item });
    this.undoExpired.set(false);
    clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => this.undoExpired.set(true), UNDO_SECONDS * 1000);
  }

  protected labelOf(item: ListItem): string {
    if ('added' in item) {
      return item.name;
    }
    return `${this.language.amount(item)} ${this.nameOf(item)}`;
  }

  // Added items are the user's own words, so they stay as typed
  private nameOf(item: ListItem): string {
    return 'added' in item ? item.name : this.recipes.displayIngredient(item.name);
  }

  private isInCart(key: string): boolean {
    return this.view().inCart.some((item) => itemKey(item) === key);
  }

  // Past the siblings without one: a line or a section that is only still there for its fade
  private checkboxAfter(
    element: Element | null,
    direction: 'next' | 'previous',
  ): HTMLInputElement | null {
    const step = (from: Element) =>
      direction === 'next' ? from.nextElementSibling : from.previousElementSibling;
    for (let sibling = element && step(element); sibling; sibling = step(sibling)) {
      const checkbox = this.firstCheckboxIn(sibling);
      if (checkbox !== null) {
        return checkbox;
      }
    }
    return null;
  }

  private addField(): HTMLInputElement | null {
    return this.host.querySelector('#new-item');
  }

  private cartSummary(): HTMLElement | null {
    const cart = this.host.querySelector('.cart');
    return cart !== null && this.firstCheckboxIn(cart) !== null
      ? cart.querySelector('summary')
      : null;
  }

  private checkboxOf(key: string): HTMLInputElement | undefined {
    return Array.from(this.host.querySelectorAll<HTMLInputElement>(LISTED_CHECKBOX)).find(
      (checkbox) => checkbox.dataset['key'] === key,
    );
  }

  private firstCheckboxIn(element: Element): HTMLInputElement | null {
    return element.querySelector(LISTED_CHECKBOX);
  }
}
