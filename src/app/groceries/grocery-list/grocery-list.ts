import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
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

const UNDO_SECONDS = 5;

interface UndoLine {
  key: string;
  item: ListItem;
}

@Component({
  imports: [RouterLink],
  selector: 'app-grocery-list',
  styleUrl: './grocery-list.css',
  templateUrl: './grocery-list.html',
  host: { '[class.accepted]': 'plan().accepted' },
})
export class GroceryList {
  private readonly store = inject(PlanStore);
  private readonly recipes = inject(RecipeStore);
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
  }

  // Without preventDefault the browser would submit the form and reload the page. The focus goes
  // back to the field after a click on "Add", so several items can be added in a row
  protected add(event: SubmitEvent, input: HTMLInputElement): void {
    event.preventDefault();
    this.feedback.set(addFeedback(this.plan(), input.value, this.language.language()));
    this.store.addItem(input.value);
    input.value = '';
    input.focus();
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
    const sibling =
      this.firstCheckboxIn(line?.nextElementSibling) ??
      this.firstCheckboxIn(line?.previousElementSibling);
    const nextSection = this.firstCheckboxIn(checkbox.closest('section')?.nextElementSibling);
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
    if (!button.matches(':focus-visible')) {
      return;
    }
    const line = button.closest('li');
    const sibling =
      this.firstCheckboxIn(line?.nextElementSibling) ??
      this.firstCheckboxIn(line?.previousElementSibling);
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

  private firstCheckboxIn(element: Element | null | undefined): HTMLInputElement | null {
    return element?.querySelector('input') ?? null;
  }

  private addField(): HTMLInputElement | null {
    return this.host.querySelector('#new-item');
  }

  private cartSummary(): HTMLElement | null {
    return this.host.querySelector('.cart summary');
  }

  private checkboxOf(key: string): HTMLInputElement | undefined {
    return Array.from(this.host.querySelectorAll('input')).find(
      (checkbox) => checkbox.dataset['key'] === key,
    );
  }
}
