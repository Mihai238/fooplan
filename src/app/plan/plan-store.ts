import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { RECIPES } from '../recipes/recipes';
import {
  acceptPlan,
  clearMeal,
  createPlan,
  MealRef,
  otherSuggestions,
  parsePlan,
  pickRecipe,
  Plan,
  Random,
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
const RECIPE_NAMES = RECIPES.map((recipe) => recipe.name);

@Injectable({ providedIn: 'root' })
export class PlanStore {
  private readonly random = inject(RANDOM);
  private readonly today = inject(TODAY);
  private readonly state = signal<Plan>(this.load());
  readonly plan = this.state.asReadonly();

  setDays(days: number): void {
    this.update((plan) => setDays(plan, days, RECIPE_NAMES, this.random));
  }

  setPeople(people: number): void {
    this.update((plan) => setPeople(plan, people));
  }

  pick(meal: MealRef, recipe: string): void {
    this.update((plan) => pickRecipe(plan, meal, recipe, RECIPE_NAMES, this.random));
  }

  clear(meal: MealRef): void {
    this.update((plan) => clearMeal(plan, meal, RECIPE_NAMES, this.random));
  }

  otherSuggestions(meal: MealRef): void {
    this.update((plan) => otherSuggestions(plan, meal, RECIPE_NAMES, this.random));
  }

  setCookExtra(day: number, on: boolean): void {
    this.update((plan) => setCookExtra(plan, day, on, RECIPE_NAMES, this.random));
  }

  accept(): void {
    this.update(acceptPlan);
  }

  toggleTicked(key: string): void {
    this.update((plan) => toggleTicked(plan, key));
  }

  newPlan(): void {
    this.update((plan) => setPeople(this.createPlan(), plan.people));
  }

  private load(): Plan {
    const stored = parsePlan(readStoredPlan(), RECIPE_NAMES);
    if (stored) {
      return stored;
    }
    const plan = this.createPlan();
    storePlan(plan);
    return plan;
  }

  private createPlan(): Plan {
    return createPlan(this.today(), RECIPE_NAMES, this.random);
  }

  private update(change: (plan: Plan) => Plan): void {
    const plan = change(this.state());
    if (plan !== this.state()) {
      this.state.set(plan);
      storePlan(plan);
    }
  }
}

function readStoredPlan(): unknown {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function storePlan(plan: Plan): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Storage can be blocked or full; the plan then lives until the page is reloaded
  }
}
