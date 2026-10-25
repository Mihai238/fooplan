import { isRecord } from '../storage';

export type MealKind = 'lunch' | 'dinner';

export interface Meal {
  recipe: string | null;
  suggestions: string[];
  // The suggestions a picked meal showed when picked, its recipe among them, in their order; absent
  // on an open meal and when not known (a pick saved before they were kept)
  offered?: string[];
}

export interface PlanDay {
  date: string;
  lunch: Meal;
  dinner: Meal;
  // The dinner is cooked for twice the people and its leftovers cover the next day's lunch
  cookExtra: boolean;
}

export interface Plan {
  days: PlanDay[];
  people: number;
  accepted: boolean;
  // Keys of the grocery list items the user has ticked off, see itemKey
  ticked: string[];
  // Items the user added to the grocery list themselves, in the order added
  added: string[];
  // Recipe names, least recently shown first; a recipe drawn again, or whose pick is undone or
  // dropped, moves to the end
  shown: string[];
}

export interface MealRef {
  day: number;
  kind: MealKind;
}

export type Random = () => number;

export const MIN_DAYS = 1;
export const MAX_DAYS = 5;
export const MIN_PEOPLE = 1;
export const DEFAULT_DAYS = 5;
export const DEFAULT_PEOPLE = 2;
export const MIN_SUGGESTED = 15;
const SUGGESTIONS = 3;

export function createPlan(startDate: string, recipes: readonly string[], random: Random): Plan {
  const plan: Plan = {
    days: [],
    people: DEFAULT_PEOPLE,
    accepted: false,
    ticked: [],
    added: [],
    shown: [],
  };
  return openDays(plan, startDate, DEFAULT_DAYS, recipes, random);
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
    const dropped = picksOf({ ...plan, days: plan.days.slice(days) });
    const kept = markUnpicked({ ...plan, days: plan.days.slice(0, days) }, dropped);
    // The new last day has no next lunch left to cover
    return withDay(kept, days - 1, { cookExtra: false });
  }
  const nextDate = addDays(plan.days[plan.days.length - 1].date, 1);
  return openDays(plan, nextDate, days - plan.days.length, recipes, random);
}

export function setPeople(plan: Plan, people: number): Plan {
  if (plan.accepted || people === plan.people || !Number.isInteger(people) || people < MIN_PEOPLE) {
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
  if (
    plan.accepted ||
    isCovered(plan, meal) ||
    current?.recipe !== null ||
    !current.suggestions.includes(recipe)
  ) {
    return plan;
  }
  const withPick = withMeal(plan, meal, { recipe, suggestions: [], offered: current.suggestions });
  return mealRefsOf(withPick).reduce(
    (next, ref) => withoutSuggestion(next, ref, recipe, recipes, random),
    withPick,
  );
}

export function clearMeal(
  plan: Plan,
  meal: MealRef,
  recipes: readonly string[],
  random: Random,
): Plan {
  const current = mealAt(plan, meal);
  if (plan.accepted || isCovered(plan, meal) || current === undefined || current.recipe === null) {
    return plan;
  }
  const cleared = markUnpicked(withMeal(plan, meal, { recipe: null, suggestions: [] }), [
    current.recipe,
  ]);
  const opened =
    current.offered === undefined
      ? openMeal(cleared, meal, recipes, random)
      : reopenMeal(cleared, meal, current.offered, recipes, random);
  return meal.kind === 'dinner' && plan.days[meal.day].cookExtra
    ? turnCookExtraOff(opened, meal.day, recipes, random)
    : opened;
}

export function otherSuggestions(
  plan: Plan,
  meal: MealRef,
  recipes: readonly string[],
  random: Random,
): Plan {
  const current = mealAt(plan, meal);
  if (plan.accepted || isCovered(plan, meal) || current?.recipe !== null) {
    return plan;
  }
  return openMeal(plan, meal, recipes, random, current.suggestions);
}

export function setCookExtra(
  plan: Plan,
  day: number,
  on: boolean,
  recipes: readonly string[],
  random: Random,
): Plan {
  const current = plan.days[day];
  if (
    plan.accepted ||
    current === undefined ||
    day === plan.days.length - 1 ||
    current.dinner.recipe === null ||
    current.cookExtra === on
  ) {
    return plan;
  }
  if (!on) {
    return turnCookExtraOff(plan, day, recipes, random);
  }
  const unpicked = markUnpicked(plan, [plan.days[day + 1].lunch.recipe]);
  return withDay(withDay(unpicked, day, { cookExtra: true }), day + 1, {
    lunch: { recipe: null, suggestions: [] },
  });
}

export function dropSuggestion(
  plan: Plan,
  recipe: string,
  recipes: readonly string[],
  random: Random,
): Plan {
  if (plan.accepted) {
    return plan;
  }
  const candidates = recipes.filter((name) => name !== recipe);
  return mealRefsOf(plan).reduce(
    (next, ref) => withoutSuggestion(next, ref, recipe, candidates, random),
    plan,
  );
}

export function acceptPlan(plan: Plan): Plan {
  if (plan.accepted || !isComplete(plan)) {
    return plan;
  }
  return { ...plan, accepted: true };
}

export function toggleTicked(plan: Plan, key: string): Plan {
  if (!plan.accepted) {
    return plan;
  }
  const ticked = plan.ticked.includes(key)
    ? plan.ticked.filter((other) => other !== key)
    : [...plan.ticked, key];
  return { ...plan, ticked };
}

export function addItem(plan: Plan, text: string): Plan {
  const item = text.trim();
  if (!plan.accepted || item === '' || plan.added.some((other) => sameItem(other, item))) {
    return plan;
  }
  // A re-added item starts unticked even if a stale tick of it lingers, e.g. one edited into the
  // storage
  const key = addedKey(item);
  return {
    ...plan,
    added: [...plan.added, item],
    ticked: plan.ticked.filter((other) => other !== key),
  };
}

export function removeItem(plan: Plan, text: string): Plan {
  if (!plan.accepted || !plan.added.includes(text)) {
    return plan;
  }
  const key = addedKey(text);
  return {
    ...plan,
    added: plan.added.filter((other) => other !== text),
    ticked: plan.ticked.filter((other) => other !== key),
  };
}

// A list of one string can't equal a plan item's key, which lists a name and a unit
export function addedKey(text: string): string {
  return JSON.stringify([text]);
}

export function parsePlan(value: unknown, recipes: readonly string[]): Plan | null {
  if (!isRecord(value)) {
    return null;
  }
  // Plans saved before the grocery list existed have no ticks, those saved before shown recipes
  // were recorded have no shown recipes, and those saved before items could be added have none
  const { days, people, accepted, ticked = [], added = [], shown = [] } = value;
  if (!Array.isArray(days) || days.length < MIN_DAYS || days.length > MAX_DAYS) {
    return null;
  }
  if (typeof people !== 'number' || !Number.isInteger(people) || people < MIN_PEOPLE) {
    return null;
  }
  if (typeof accepted !== 'boolean') {
    return null;
  }
  if (!isStringList(ticked) || !isItemList(added)) {
    return null;
  }
  if (!isRecipeList(shown, recipes)) {
    return null;
  }
  const parsedDays = days.map((day) => parseDay(day, recipes));
  if (parsedDays.some((day) => day === null)) {
    return null;
  }
  const parsed: Plan = {
    days: parsedDays as PlanDay[],
    people,
    accepted,
    ticked,
    added,
    shown,
  };
  // A record missing what a meal shows or showed before its pick (an old or hand-edited save) still
  // counts it as shown
  const seen = mealsOf(parsed).flatMap((meal) => [...meal.suggestions, ...(meal.offered ?? [])]);
  const plan = { ...parsed, shown: [...new Set([...shown, ...seen])] };
  const valid =
    hasConsecutiveDates(plan) &&
    usesRecipesOnce(plan) &&
    hasValidLeftovers(plan) &&
    (!accepted || isComplete(plan)) &&
    (accepted || (ticked.length === 0 && added.length === 0));
  return valid ? plan : null;
}

export function isComplete(plan: Plan): boolean {
  return plan.days.every(
    (day, i) =>
      day.dinner.recipe !== null && (day.lunch.recipe !== null || isLunchCovered(plan, i)),
  );
}

export function filledMeals(plan: Plan): number {
  return mealRefsOf(plan).filter(
    (ref) => mealAt(plan, ref)?.recipe !== null || isCovered(plan, ref),
  ).length;
}

export function leftoversOf(plan: Plan, day: number): string | null {
  if (plan.days[day] === undefined || !isLunchCovered(plan, day)) {
    return null;
  }
  return plan.days[day - 1].dinner.recipe;
}

export function sameItem(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// addItem only keeps trimmed, non-blank text, once ignoring case
function isItemList(value: unknown): value is string[] {
  return (
    isStringList(value) &&
    value.every((item) => item !== '' && item === item.trim()) &&
    value.every((item, i) => value.findIndex((other) => sameItem(other, item)) === i)
  );
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecipeList(value: unknown, recipes: readonly string[]): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((name) => typeof name === 'string' && recipes.includes(name)) &&
    new Set(value).size === value.length
  );
}

function parseDay(value: unknown, recipes: readonly string[]): PlanDay | null {
  if (!isRecord(value)) {
    return null;
  }
  // Plans saved before "Cook extra" existed have no such field
  const { date, cookExtra = false } = value;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  if (typeof cookExtra !== 'boolean') {
    return null;
  }
  const lunch = parseMeal(value['lunch'], recipes);
  const dinner = parseMeal(value['dinner'], recipes);
  // Only a lunch can be covered by leftovers, so only a lunch can be empty
  if (lunch === null || dinner === null || isEmpty(dinner)) {
    return null;
  }
  return { date, lunch, dinner, cookExtra };
}

function parseMeal(value: unknown, recipes: readonly string[]): Meal | null {
  if (!isRecord(value) || !Array.isArray(value['suggestions'])) {
    return null;
  }
  const { recipe, offered } = value;
  const suggestions: unknown[] = value['suggestions'];
  if (!suggestions.every((name) => typeof name === 'string' && recipes.includes(name))) {
    return null;
  }
  if (recipe === null) {
    // An empty meal must be a covered lunch, which parseDay and hasValidLeftovers check
    const isFullSet =
      suggestions.length === SUGGESTIONS && new Set(suggestions).size === SUGGESTIONS;
    return (isFullSet || suggestions.length === 0) && offered === undefined
      ? { recipe, suggestions: suggestions as string[] }
      : null;
  }
  if (typeof recipe !== 'string' || !recipes.includes(recipe) || suggestions.length > 0) {
    return null;
  }
  // Picks saved before they remembered their suggestions have none
  if (offered === undefined) {
    return { recipe, suggestions: [] };
  }
  const isOfferedSet =
    isRecipeList(offered, recipes) && offered.length === SUGGESTIONS && offered.includes(recipe);
  return isOfferedSet ? { recipe, suggestions: [], offered } : null;
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

function hasValidLeftovers(plan: Plan): boolean {
  return plan.days.every(
    (day, i) =>
      isEmpty(day.lunch) === isLunchCovered(plan, i) &&
      (!day.cookExtra || (day.dinner.recipe !== null && i < plan.days.length - 1)),
  );
}

function isEmpty(meal: Meal): boolean {
  return meal.recipe === null && meal.suggestions.length === 0;
}

function openDays(
  plan: Plan,
  startDate: string,
  count: number,
  recipes: readonly string[],
  random: Random,
): Plan {
  const added: PlanDay[] = Array.from({ length: count }, (_, i) => ({
    date: addDays(startDate, i),
    lunch: { recipe: null, suggestions: [] },
    dinner: { recipe: null, suggestions: [] },
    cookExtra: false,
  }));
  const withAdded = { ...plan, days: [...plan.days, ...added] };
  return mealRefsOf(withAdded)
    .filter((ref) => ref.day >= plan.days.length)
    .reduce((next, ref) => openMeal(next, ref, recipes, random), withAdded);
}

function addDays(date: string, days: number): string {
  // Computed in UTC so a daylight saving change can't shift the date
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function turnCookExtraOff(
  plan: Plan,
  day: number,
  recipes: readonly string[],
  random: Random,
): Plan {
  const off = withDay(plan, day, { cookExtra: false });
  return openMeal(off, { day: day + 1, kind: 'lunch' }, recipes, random);
}

function openMeal(
  plan: Plan,
  ref: MealRef,
  recipes: readonly string[],
  random: Random,
  excluded: readonly string[] = [],
): Plan {
  const [suggestions, drawn] = drawSuggestions(plan, SUGGESTIONS, excluded, recipes, random);
  return withMeal(drawn, ref, { recipe: null, suggestions });
}

// Restoring a meal's own suggestions isn't suggesting them again, so only those picked for another
// meal since, or no longer among the recipes, are replaced
function reopenMeal(
  plan: Plan,
  ref: MealRef,
  offered: readonly string[],
  recipes: readonly string[],
  random: Random,
): Plan {
  const reopened = withMeal(plan, ref, { recipe: null, suggestions: [...offered] });
  const picked = pickedRecipes(reopened);
  return offered
    .filter((name) => picked.has(name) || !recipes.includes(name))
    .reduce((next, name) => withoutSuggestion(next, ref, name, recipes, random), reopened);
}

function withoutSuggestion(
  plan: Plan,
  ref: MealRef,
  recipe: string,
  recipes: readonly string[],
  random: Random,
): Plan {
  const meal = mealAt(plan, ref);
  if (!meal?.suggestions.includes(recipe)) {
    return plan;
  }
  const others = meal.suggestions.filter((name) => name !== recipe);
  const [[replacement], drawn] = drawSuggestions(plan, 1, others, recipes, random);
  return withMeal(drawn, ref, {
    ...meal,
    suggestions: meal.suggestions.map((name) => (name === recipe ? replacement : name)),
  });
}

function mealAt(plan: Plan, meal: MealRef): Meal | undefined {
  return plan.days[meal.day]?.[meal.kind];
}

function isCovered(plan: Plan, ref: MealRef): boolean {
  return ref.kind === 'lunch' && isLunchCovered(plan, ref.day);
}

function isLunchCovered(plan: Plan, day: number): boolean {
  return plan.days[day - 1]?.cookExtra === true;
}

function withMeal(plan: Plan, ref: MealRef, meal: Meal): Plan {
  return withDay(plan, ref.day, { [ref.kind]: meal });
}

function withDay(plan: Plan, index: number, patch: Partial<PlanDay>): Plan {
  return {
    ...plan,
    days: plan.days.map((day, i) => (i === index ? { ...day, ...patch } : day)),
  };
}

function drawSuggestions(
  plan: Plan,
  count: number,
  excluded: readonly string[],
  recipes: readonly string[],
  random: Random,
): [string[], Plan] {
  const picked = pickedRecipes(plan);
  const candidates = recipes.filter((name) => !picked.has(name) && !excluded.includes(name));
  const fresh = candidates.filter((name) => !plan.shown.includes(name));
  const drawn: string[] = [];
  while (drawn.length < count && fresh.length > 0) {
    drawn.push(...fresh.splice(Math.floor(random() * fresh.length), 1));
  }
  // Other meals' suggestions come last, so two meals share one only when nothing else is left
  const showing = new Set(suggestionsOf(plan));
  const old = plan.shown.filter((name) => candidates.includes(name));
  const suggestions = [
    ...drawn,
    ...old.filter((name) => !showing.has(name)),
    ...old.filter((name) => showing.has(name)),
  ].slice(0, count);
  return [suggestions, markShown(plan, suggestions)];
}

// A cleared or dropped pick was on screen until now, so it counts as shown just now
function markUnpicked(plan: Plan, picks: readonly (string | null)[]): Plan {
  return markShown(
    plan,
    picks.filter((name) => name !== null),
  );
}

function markShown(plan: Plan, names: readonly string[]): Plan {
  return { ...plan, shown: [...plan.shown.filter((name) => !names.includes(name)), ...names] };
}

function pickedRecipes(plan: Plan): Set<string> {
  return new Set(picksOf(plan));
}

function picksOf(plan: Plan): string[] {
  return mealsOf(plan).flatMap((meal) => (meal.recipe === null ? [] : [meal.recipe]));
}

function suggestionsOf(plan: Plan): string[] {
  return mealsOf(plan).flatMap((meal) => meal.suggestions);
}

function mealsOf(plan: Plan): Meal[] {
  return plan.days.flatMap((day) => [day.lunch, day.dinner]);
}

function mealRefsOf(plan: Plan): MealRef[] {
  return plan.days.flatMap((_, day): MealRef[] => [
    { day, kind: 'lunch' },
    { day, kind: 'dinner' },
  ]);
}
