import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { RecipeStore } from '../recipes/recipe-store';
import { readStored, writeStored } from '../storage';
import {
  acceptPlan,
  addItem,
  clearMeal,
  createPlan,
  dropSuggestion,
  MealRef,
  MIN_SUGGESTED,
  otherSuggestions,
  parsePlan,
  pickRecipe,
  Plan,
  Random,
  removeItem,
  setCookExtra,
  setDays,
  setPeople,
  toggleTicked,
} from './plan';

export const RANDOM = new InjectionToken<Random>('RANDOM', {
  providedIn: 'root',
  factory: () => Math.random,
});

export const TODAY = new InjectionToken<() => string>('TODAY', {
  providedIn: 'root',
  factory: () => () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  },
});

const STORAGE_KEY = 'fooplan.plan';
const REMOVED_KEY = 'fooplan.removed';

@Injectable({ providedIn: 'root' })
export class PlanStore {
  private readonly random = inject(RANDOM);
  private readonly today = inject(TODAY);
  private readonly recipes = inject(RecipeStore);
  // Declared before the plan, since a new plan is drawn from the recipes not removed
  private readonly removedState = signal<string[]>(
    parseRemoved(readStored(REMOVED_KEY), this.recipeNames()),
  );
  readonly removed = this.removedState.asReadonly();
  private readonly suggested = computed(() => {
    const removed = this.removed();
    return this.recipeNames().filter((name) => !removed.includes(name));
  });
  readonly canRemove = computed(() => this.suggested().length > MIN_SUGGESTED);
  private readonly state = signal<Plan>(this.load());
  readonly plan = this.state.asReadonly();

  setDays(days: number): void {
    this.update((plan) => setDays(plan, days, this.suggested(), this.random));
  }

  setPeople(people: number): void {
    this.update((plan) => setPeople(plan, people));
  }

  pick(meal: MealRef, recipe: string): void {
    this.update((plan) => pickRecipe(plan, meal, recipe, this.suggested(), this.random));
  }

  clear(meal: MealRef): void {
    this.update((plan) => clearMeal(plan, meal, this.suggested(), this.random));
  }

  otherSuggestions(meal: MealRef): void {
    this.update((plan) => otherSuggestions(plan, meal, this.suggested(), this.random));
  }

  setCookExtra(day: number, on: boolean): void {
    this.update((plan) => setCookExtra(plan, day, on, this.suggested(), this.random));
  }

  accept(): void {
    this.update(acceptPlan);
  }

  toggleTicked(key: string): void {
    this.update((plan) => toggleTicked(plan, key));
  }

  addItem(text: string): void {
    this.update((plan) => addItem(plan, text));
  }

  removeItem(text: string): void {
    this.update((plan) => removeItem(plan, text));
  }

  removeRecipe(name: string): void {
    if (!this.recipeNames().includes(name) || this.removed().includes(name) || !this.canRemove()) {
      return;
    }
    this.setRemoved([...this.removed(), name]);
    this.update((plan) => dropSuggestion(plan, name, this.suggested(), this.random));
  }

  restoreRecipe(name: string): void {
    if (!this.removed().includes(name)) {
      return;
    }
    this.setRemoved(this.removed().filter((other) => other !== name));
  }

  newPlan(): void {
    this.update((plan) => setPeople(this.createPlan(), plan.people));
  }

  private load(): Plan {
    // A plan can hold recipes picked or suggested before they were removed
    const stored = parsePlan(readStored(STORAGE_KEY), this.recipeNames());
    if (stored) {
      // A saved plan can still suggest a removed recipe, e.g. one another tab saved, or when saving
      // the plan failed after the removal was saved
      const plan = this.removed().reduce(
        (next, name) => dropSuggestion(next, name, this.suggested(), this.random),
        stored,
      );
      if (plan !== stored) {
        writeStored(STORAGE_KEY, plan);
      }
      return plan;
    }
    const plan = this.createPlan();
    writeStored(STORAGE_KEY, plan);
    return plan;
  }

  private createPlan(): Plan {
    return createPlan(this.today(), this.suggested(), this.random);
  }

  private update(change: (plan: Plan) => Plan): void {
    const plan = change(this.state());
    if (plan !== this.state()) {
      this.state.set(plan);
      writeStored(STORAGE_KEY, plan);
    }
  }

  private setRemoved(removed: string[]): void {
    this.removedState.set(removed);
    writeStored(REMOVED_KEY, removed);
  }

  private recipeNames(): string[] {
    return this.recipes.all().map((recipe) => recipe.name);
  }
}

function parseRemoved(value: unknown, names: readonly string[]): string[] {
  if (!Array.isArray(value) || !value.every((name) => typeof name === 'string')) {
    return [];
  }
  const removed = [...new Set(value.filter((name) => names.includes(name)))];
  return names.length - removed.length >= MIN_SUGGESTED ? removed : [];
}
