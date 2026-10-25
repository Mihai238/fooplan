import { TestBed } from '@angular/core/testing';
import { RecipeStore } from '../recipes/recipe-store';
import { Meal, MealRef, Plan, PlanDay, Random } from './plan';
import { PlanStore } from './plan-store';

export const LUNCH: MealRef = { day: 0, kind: 'lunch' };
export const DINNER: MealRef = { day: 0, kind: 'dinner' };

export function suggestionsOf(plan: Plan): string[] {
  return plan.days.flatMap((day) => [...day.lunch.suggestions, ...day.dinner.suggestions]);
}

// A linear congruential generator, so every run draws the same numbers
export function seededRandom(seed: number): Random {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

export function acceptOneDayPlan(store: PlanStore): void {
  store.setDays(1);
  for (const meal of [LUNCH, DINNER]) {
    store.pick(meal, store.plan().days[0][meal.kind].suggestions[0]);
  }
  store.accept();
  // A throw, not expect(): this file is also type-checked by the app build, which has no test globals
  if (!store.plan().accepted) {
    throw new Error('plan not accepted');
  }
}

// Removes recipes until exactly `count` stay suggested: the given ones and the first others in the
// order of all recipes, built-in and own, which it returns in that order
export function leaveSuggested(store: PlanStore, count: number, ...kept: string[]): string[] {
  const names = TestBed.inject(RecipeStore)
    .all()
    .map((recipe) => recipe.name);
  const suggested = [...kept, ...names.filter((name) => !kept.includes(name))].slice(0, count);
  const removals = names.filter((name) => !suggested.includes(name));
  removals.forEach((name) => store.removeRecipe(name));
  if (store.removed().length !== removals.length) {
    throw new Error(`${store.removed().length} of ${removals.length} recipes removed`);
  }
  return names.filter((name) => suggested.includes(name));
}

// Lists every recipe of the days as shown, as loading the plan would
export function planOf(planDays: PlanDay[], { people = 2, accepted = false } = {}): Plan {
  const shown = planDays.flatMap((planDay) =>
    [planDay.lunch, planDay.dinner].flatMap((meal) => [
      ...(meal.recipe === null ? [] : [meal.recipe]),
      ...meal.suggestions,
      ...(meal.offered ?? []),
    ]),
  );
  return {
    days: planDays,
    people,
    accepted,
    ticked: [],
    added: [],
    shown: [...new Set(shown)],
  };
}

export function day(date: string, lunch: Meal, dinner: Meal, cookExtra = false): PlanDay {
  return { date, lunch, dinner, cookExtra };
}

export function open(...suggestions: string[]): Meal {
  return { recipe: null, suggestions };
}

export function covered(): Meal {
  return empty();
}

export function empty(): Meal {
  return { recipe: null, suggestions: [] };
}

export function picked(recipe: string, offered?: string[]): Meal {
  return offered === undefined ? { recipe, suggestions: [] } : { recipe, suggestions: [], offered };
}

export function eatingOut(offered?: string[]): Meal {
  return offered === undefined
    ? { recipe: null, suggestions: [], eatOut: true }
    : { recipe: null, suggestions: [], offered, eatOut: true };
}
