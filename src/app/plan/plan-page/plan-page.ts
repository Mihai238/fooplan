import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { recipeSlug } from '../../recipes/recipe-slug';
import { RecipeStore } from '../../recipes/recipe-store';
import {
  DEFAULT_DAYS,
  filledMeals,
  isComplete,
  leftoversOf,
  MAX_DAYS,
  MealKind,
  MIN_DAYS,
  MIN_PEOPLE,
} from '../plan';
import { PlanStore } from '../plan-store';

@Component({
  imports: [DatePipe, RouterLink],
  selector: 'app-plan-page',
  styleUrl: './plan-page.css',
  templateUrl: './plan-page.html',
})
export class PlanPage {
  protected readonly store = inject(PlanStore);
  private readonly recipes = inject(RecipeStore);
  protected readonly plan = this.store.plan;
  protected readonly complete = computed(() => isComplete(this.plan()));
  protected readonly filled = computed(() => filledMeals(this.plan()));
  protected readonly defaultDays = DEFAULT_DAYS;
  protected readonly minDays = MIN_DAYS;
  protected readonly maxDays = MAX_DAYS;
  protected readonly minPeople = MIN_PEOPLE;
  protected readonly fewestDays = computed(() => this.plan().days.length <= MIN_DAYS);
  protected readonly mostDays = computed(() => this.plan().days.length >= MAX_DAYS);
  protected readonly fewestPeople = computed(() => this.plan().people <= MIN_PEOPLE);
  protected readonly recipeSlug = recipeSlug;
  protected readonly meals: readonly { kind: MealKind; label: string }[] = [
    { kind: 'lunch', label: 'Lunch' },
    { kind: 'dinner', label: 'Dinner' },
  ];
  private readonly minutesByRecipe = computed(
    () => new Map(this.recipes.all().map((recipe) => [recipe.name, recipe.minutes])),
  );
  private pressedOnBackdrop = false;

  protected stepDays(delta: number): void {
    this.store.setDays(this.plan().days.length + delta);
  }

  protected stepPeople(delta: number): void {
    this.store.setPeople(this.plan().people + delta);
  }

  // A button disabled while it has the focus drops the focus to the page, so the focus moves on to
  // the value, where the arrow keys go on stepping it
  protected keepFocus(arrow: HTMLButtonElement, atLimit: boolean, value: HTMLElement): void {
    if (atLimit && document.activeElement === arrow) {
      value.focus();
    }
  }

  // The row keeps its elements when its recipe changes, so a focused "×" keeps the focus; only at
  // the limit, where the "×" buttons go away and would drop the focus to the page, does it move on
  // to the row's suggestion
  protected keepFocusInRow(dontSuggest: HTMLButtonElement, suggestion: HTMLButtonElement): void {
    if (!this.store.canRemove() && document.activeElement === dontSuggest) {
      suggestion.focus();
    }
  }

  protected leftovers(kind: MealKind, day: number): string | null {
    return kind === 'lunch' ? leftoversOf(this.plan(), day) : null;
  }

  protected minutes(recipe: string): number | undefined {
    return this.minutesByRecipe().get(recipe);
  }

  protected newPlan(dialog: HTMLDialogElement): void {
    if (this.filled() > 0 || this.plan().accepted) {
      // A leftover press from the last time would otherwise let a click without a press of its own
      // (element.click(), some assistive technology) close the dialog right after reopening
      this.pressedOnBackdrop = false;
      dialog.showModal();
    } else {
      this.store.newPlan();
    }
  }

  protected startNewPlan(dialog: HTMLDialogElement): void {
    this.store.newPlan();
    dialog.close();
  }

  // A click on the backdrop targets the dialog itself, as does one on its padding, which lies
  // inside its box. So does a press inside the dialog released on the backdrop (selecting its
  // text, say), so only a press that started on the backdrop too closes it
  protected pressBackdrop(event: PointerEvent, dialog: HTMLDialogElement): void {
    this.pressedOnBackdrop = this.isOnBackdrop(event, dialog);
  }

  protected closeOnBackdrop(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (this.pressedOnBackdrop && this.isOnBackdrop(event, dialog)) {
      dialog.close();
    }
    this.pressedOnBackdrop = false;
  }

  // A modal dialog keeps Tab off the page behind, but lets it leave for the browser's toolbar, and
  // Safari's Tab skips buttons by default; so every Tab moves between the two buttons here, with
  // the focus elsewhere in the dialog counting as before the first and after the last
  protected trapFocus(event: KeyboardEvent, first: HTMLElement, last: HTMLElement): void {
    if (event.key !== 'Tab') {
      return;
    }
    event.preventDefault();
    const [from, to] = event.shiftKey ? [last, first] : [first, last];
    (document.activeElement === from ? to : from).focus();
  }

  private isOnBackdrop(event: MouseEvent, dialog: HTMLDialogElement): boolean {
    if (event.target !== dialog) {
      return false;
    }
    const box = dialog.getBoundingClientRect();
    return (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    );
  }
}
