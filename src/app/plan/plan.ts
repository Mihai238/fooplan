export type MealKind = 'lunch' | 'dinner';

export interface Meal {
  recipe: string | null;
  suggestions: string[];
}

export interface PlanDay {
  date: string;
  lunch: Meal;
  dinner: Meal;
}

export interface Plan {
  days: PlanDay[];
  people: number;
  accepted: boolean;
}

export interface MealRef {
  day: number;
  kind: MealKind;
}

export type Random = () => number;

export const MIN_DAYS = 1;
export const MAX_DAYS = 5;
export const DEFAULT_DAYS = 5;
export const DEFAULT_PEOPLE = 2;

export function createPlan(startDate: string, recipes: readonly string[], random: Random): Plan {
  const plan: Plan = { days: [], people: DEFAULT_PEOPLE, accepted: false };
  return { ...plan, days: openDays(plan, startDate, DEFAULT_DAYS, recipes, random) };
}

export function setDays(
  plan: Plan,
  days: number,
  recipes: readonly string[],
  random: Random,
): Plan {
  if (
    plan.accepted ||
    days === plan.days.length ||
    !Number.isInteger(days) ||
    days < MIN_DAYS ||
    days > MAX_DAYS
  ) {
    return plan;
  }
  if (days < plan.days.length) {
    return { ...plan, days: plan.days.slice(0, days) };
  }
  const nextDate = addDays(plan.days[plan.days.length - 1].date, 1);
  const added = openDays(plan, nextDate, days - plan.days.length, recipes, random);
  return { ...plan, days: [...plan.days, ...added] };
}

export function setPeople(plan: Plan, people: number): Plan {
  if (plan.accepted || people === plan.people || !Number.isInteger(people) || people < 1) {
    return plan;
  }
  return { ...plan, people };
}

export function pickRecipe(
  plan: Plan,
  meal: MealRef,
  recipe: string,
  recipes: readonly string[],
  random: Random,
): Plan {
  const current = mealAt(plan, meal);
  if (plan.accepted || current?.recipe !== null || !current.suggestions.includes(recipe)) {
    return plan;
  }
  const withPick = withMeal(plan, meal, { recipe, suggestions: [] });
  return {
    ...withPick,
    days: withPick.days.map((day) => ({
      ...day,
      lunch: withoutSuggestion(day.lunch, recipe, withPick, recipes, random),
      dinner: withoutSuggestion(day.dinner, recipe, withPick, recipes, random),
    })),
  };
}

export function clearMeal(
  plan: Plan,
  meal: MealRef,
  recipes: readonly string[],
  random: Random,
): Plan {
  const current = mealAt(plan, meal);
  if (plan.accepted || current === undefined || current.recipe === null) {
    return plan;
  }
  const cleared = withMeal(plan, meal, { recipe: null, suggestions: [] });
  return withMeal(cleared, meal, openMeal(cleared, recipes, random));
}

export function otherSuggestions(
  plan: Plan,
  meal: MealRef,
  recipes: readonly string[],
  random: Random,
): Plan {
  const current = mealAt(plan, meal);
  if (plan.accepted || current?.recipe !== null) {
    return plan;
  }
  return withMeal(plan, meal, {
    recipe: null,
    suggestions: drawUnpicked(plan, 2, current.suggestions, recipes, random),
  });
}

export function acceptPlan(plan: Plan): Plan {
  if (plan.accepted || !isComplete(plan)) {
    return plan;
  }
  return { ...plan, accepted: true };
}

export function parsePlan(value: unknown, recipes: readonly string[]): Plan | null {
  if (!isRecord(value)) {
    return null;
  }
  const { days, people, accepted } = value;
  if (!Array.isArray(days) || days.length < MIN_DAYS || days.length > MAX_DAYS) {
    return null;
  }
  if (typeof people !== 'number' || !Number.isInteger(people) || people < 1) {
    return null;
  }
  if (typeof accepted !== 'boolean') {
    return null;
  }
  const parsedDays = days.map((day) => parseDay(day, recipes));
  if (parsedDays.some((day) => day === null)) {
    return null;
  }
  const plan: Plan = { days: parsedDays as PlanDay[], people, accepted };
  const valid =
    hasConsecutiveDates(plan) && usesRecipesOnce(plan) && (!accepted || isComplete(plan));
  return valid ? plan : null;
}

export function isComplete(plan: Plan): boolean {
  return mealsOf(plan).every((meal) => meal.recipe !== null);
}

function parseDay(value: unknown, recipes: readonly string[]): PlanDay | null {
  if (!isRecord(value)) {
    return null;
  }
  const { date } = value;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const lunch = parseMeal(value['lunch'], recipes);
  const dinner = parseMeal(value['dinner'], recipes);
  return lunch && dinner && { date, lunch, dinner };
}

function parseMeal(value: unknown, recipes: readonly string[]): Meal | null {
  if (!isRecord(value) || !Array.isArray(value['suggestions'])) {
    return null;
  }
  const { recipe } = value;
  const suggestions: unknown[] = value['suggestions'];
  if (!suggestions.every((name) => typeof name === 'string' && recipes.includes(name))) {
    return null;
  }
  if (recipe === null) {
    const isPair = suggestions.length === 2 && suggestions[0] !== suggestions[1];
    return isPair ? { recipe, suggestions: suggestions as string[] } : null;
  }
  if (typeof recipe !== 'string' || !recipes.includes(recipe) || suggestions.length > 0) {
    return null;
  }
  return { recipe, suggestions: [] };
}

// Comparing each date with the one computed from the first also rejects dates like 2026-02-31
function hasConsecutiveDates(plan: Plan): boolean {
  return plan.days.every((day, i) => day.date === addDays(plan.days[0].date, i));
}

function usesRecipesOnce(plan: Plan): boolean {
  const picked = pickedRecipes(plan);
  return (
    picked.size === picksOf(plan).length &&
    mealsOf(plan).every((meal) => meal.suggestions.every((name) => !picked.has(name)))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function openDays(
  plan: Plan,
  startDate: string,
  count: number,
  recipes: readonly string[],
  random: Random,
): PlanDay[] {
  return Array.from({ length: count }, (_, i) => ({
    date: addDays(startDate, i),
    lunch: openMeal(plan, recipes, random),
    dinner: openMeal(plan, recipes, random),
  }));
}

function addDays(date: string, days: number): string {
  // Computed in UTC so a daylight saving change can't shift the date
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function openMeal(plan: Plan, recipes: readonly string[], random: Random): Meal {
  return { recipe: null, suggestions: drawUnpicked(plan, 2, [], recipes, random) };
}

function mealAt(plan: Plan, meal: MealRef): Meal | undefined {
  return plan.days[meal.day]?.[meal.kind];
}

function withMeal(plan: Plan, ref: MealRef, meal: Meal): Plan {
  return {
    ...plan,
    days: plan.days.map((day, i) => (i === ref.day ? { ...day, [ref.kind]: meal } : day)),
  };
}

function withoutSuggestion(
  meal: Meal,
  recipe: string,
  plan: Plan,
  recipes: readonly string[],
  random: Random,
): Meal {
  if (!meal.suggestions.includes(recipe)) {
    return meal;
  }
  const others = meal.suggestions.filter((name) => name !== recipe);
  const [replacement] = drawUnpicked(plan, 1, others, recipes, random);
  return {
    ...meal,
    suggestions: meal.suggestions.map((name) => (name === recipe ? replacement : name)),
  };
}

function drawUnpicked(
  plan: Plan,
  count: number,
  excluded: readonly string[],
  recipes: readonly string[],
  random: Random,
): string[] {
  const picked = pickedRecipes(plan);
  const candidates = recipes.filter((name) => !picked.has(name) && !excluded.includes(name));
  const drawn: string[] = [];
  for (let i = 0; i < count; i++) {
    const [name] = candidates.splice(Math.floor(random() * candidates.length), 1);
    drawn.push(name);
  }
  return drawn;
}

function pickedRecipes(plan: Plan): Set<string> {
  return new Set(picksOf(plan));
}

function picksOf(plan: Plan): string[] {
  return mealsOf(plan).flatMap((meal) => (meal.recipe === null ? [] : [meal.recipe]));
}

function mealsOf(plan: Plan): Meal[] {
  return plan.days.flatMap((day) => [day.lunch, day.dinner]);
}
