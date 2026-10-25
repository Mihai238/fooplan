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
