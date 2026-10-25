import { afterNextRender, Component, computed, ElementRef, inject, Injector } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlanStore } from '../../plan/plan-store';
import { displayAmount } from '../../recipes/amount';
import { RECIPES } from '../../recipes/recipes';
import { GroceryItem, groceryList, itemKey, shoppingView } from '../groceries';

@Component({
  imports: [RouterLink],
  selector: 'app-grocery-list',
  styleUrl: './grocery-list.css',
  templateUrl: './grocery-list.html',
})
export class GroceryList {
  private readonly store = inject(PlanStore);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  protected readonly plan = this.store.plan;
  protected readonly key = itemKey;
  protected readonly displayAmount = displayAmount;
  protected readonly view = computed(() =>
    shoppingView(groceryList(this.plan(), RECIPES), this.plan().ticked),
  );

  // Toggling moves the item's row to the other list, which drops the focus to <body> and sends
  // keyboard and screen-reader users back to the top of the page
  protected toggle(item: GroceryItem, checkbox: HTMLInputElement): void {
    const key = itemKey(item);
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
    const fromCart = checkbox.closest('.cart') !== null;
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

  private firstCheckboxIn(element: Element | null | undefined): HTMLInputElement | null {
    return element?.querySelector('input') ?? null;
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
