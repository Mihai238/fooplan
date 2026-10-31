import { isRecord, isStringList } from '../storage';

export type MealKind = 'lunch' | 'dinner';

export interface Meal {
  recipe: string | null;
  suggestions: string[];
  // The suggestions a meal showed when it was picked or eaten out, in their order, its recipe among
  // them only for a pick; absent on an open meal and when not known (saved before they were kept,
  // or naming an own recipe deleted since)
  offered?: string[];
  // Present only on a meal eaten out, which has no recipe and no suggestions
  eatOut?: true;
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
  kidFriendly: boolean;
}

export interface MealRef {
  day: number;
  kind: MealKind;
}

export interface PlanSettings {
  days: number;
  people: number;
  kidFriendly: boolean;
}

export type Random = () => number;

export interface ScoreContext {
  plan: Plan;
  meal: MealRef;
  alongside: readonly string[];
}

export type Score = (recipe: string, context: ScoreContext) => number;

export const NO_SCORE: Score = () => 0;

export const MIN_DAYS = 1;
export const MAX_DAYS = 5;
export const MIN_PEOPLE = 1;
export const MIN_SUGGESTED = 15;
const SUGGESTIONS = 3;

export const DEFAULT_SETTINGS: Readonly<PlanSettings> = { days: 5, people: 2, kidFriendly: false };

export function createPlan(
  startDate: string,
  settings: PlanSettings,
  recipes: readonly string[],
  random: Random,
  score: Score = NO_SCORE,
): Plan {
  const plan: Plan = {
    days: [],
    people: settings.people,
    accepted: false,
    ticked: [],
    added: [],
    shown: [],
    kidFriendly: settings.kidFriendly,
  };
  return openDays(plan, startDate, settings.days, recipes, random, score);
}

export function pickRecipe(
  plan: Plan,
  meal: MealRef,
  recipe: string,
  recipes: readonly string[],
  random: Random,
  score: Score = NO_SCORE,
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
    (next, ref) => withoutSuggestion(next, ref, recipe, recipes, random, score),
    withPick,
  );
}

export function eatOut(plan: Plan, meal: MealRef): Plan {
  const current = mealAt(plan, meal);
  if (plan.accepted || isCovered(plan, meal) || current === undefined || isFilled(current)) {
    return plan;
  }
  return withMeal(plan, meal, {
    recipe: null,
    suggestions: [],
    offered: current.suggestions,
    eatOut: true,
  });
}

export function clearMeal(
  plan: Plan,
  meal: MealRef,
  recipes: readonly string[],
  random: Random,
  score: Score = NO_SCORE,
): Plan {
  const current = mealAt(plan, meal);
  if (plan.accepted || isCovered(plan, meal) || current === undefined || !isFilled(current)) {
    return plan;
  }
  const cleared = markUnpicked(withMeal(plan, meal, { recipe: null, suggestions: [] }), [
    current.recipe,
  ]);
  const opened =
    current.offered === undefined
      ? openMeal(cleared, meal, recipes, random, score)
      : reopenMeal(cleared, meal, current.offered, recipes, random, score);
  return meal.kind === 'dinner' && plan.days[meal.day].cookExtra
    ? turnCookExtraOff(opened, meal.day, recipes, random, score)
    : opened;
}

export function otherSuggestions(
  plan: Plan,
  meal: MealRef,
  recipes: readonly string[],
  random: Random,
  score: Score = NO_SCORE,
): Plan {
  const current = mealAt(plan, meal);
  if (plan.accepted || isCovered(plan, meal) || current === undefined || isFilled(current)) {
    return plan;
  }
  return openMeal(plan, meal, recipes, random, score, current.suggestions);
}

export function setCookExtra(
  plan: Plan,
  day: number,
  on: boolean,
  recipes: readonly string[],
  random: Random,
  score: Score = NO_SCORE,
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
    return turnCookExtraOff(plan, day, recipes, random, score);
  }
  const unpicked = markUnpicked(plan, [plan.days[day + 1].lunch.recipe]);
  return withDay(withDay(unpicked, day, { cookExtra: true }), day + 1, {
    lunch: { recipe: null, suggestions: [] },
  });
}

// The recipes are the candidates with the new value
export function setKidFriendly(
  plan: Plan,
  on: boolean,
  recipes: readonly string[],
  random: Random,
  score: Score = NO_SCORE,
): Plan {
  if (plan.accepted || plan.kidFriendly === on) {
    return plan;
  }
  const set = { ...plan, kidFriendly: on };
  return on ? dropSuggestionsOutside(set, recipes, random, score) : set;
}

export function renameRecipe(plan: Plan, from: string, to: string): Plan {
  if (from === to || !holdsRecipe(plan, from)) {
    return plan;
  }
  const rename = (name: string) => (name === from ? to : name);
  const renamed = withMeals(plan, (meal) => {
    const recipe = meal.recipe === null ? null : rename(meal.recipe);
    const changed = { ...meal, recipe, suggestions: meal.suggestions.map(rename) };
    return meal.offered === undefined ? changed : { ...changed, offered: meal.offered.map(rename) };
  });
  return { ...renamed, shown: plan.shown.map(rename) };
}

// The recipes are the ones still suggested, without the forgotten one
export function forgetRecipe(
  plan: Plan,
  name: string,
  recipes: readonly string[],
  random: Random,
  score: Score = NO_SCORE,
): Plan {
  if (isPicked(plan, name) || !holdsRecipe(plan, name)) {
    return plan;
  }
  // A meal that loses its remembered suggestions draws fresh ones when it is undone (a pick or
  // eating out), as one picked before they were kept
  const forgotten = withMeals(dropSuggestion(plan, name, recipes, random, score), (meal) => {
    if (!meal.offered?.includes(name)) {
      return meal;
    }
    const { offered, ...rest } = meal;
    return rest;
  });
  return { ...forgotten, shown: forgotten.shown.filter((other) => other !== name) };
}

export function dropSuggestionsOutside(
  plan: Plan,
  recipes: readonly string[],
  random: Random,
  score: Score = NO_SCORE,
): Plan {
  const outside = new Set(suggestionsOf(plan).filter((name) => !recipes.includes(name)));
  return [...outside].reduce(
    (next, name) => dropSuggestion(next, name, recipes, random, score),
    plan,
  );
}

export function dropSuggestion(
  plan: Plan,
  recipe: string,
  recipes: readonly string[],
  random: Random,
  score: Score = NO_SCORE,
): Plan {
  if (plan.accepted) {
    return plan;
  }
  const candidates = recipes.filter((name) => name !== recipe);
  return mealRefsOf(plan).reduce(
    (next, ref) => withoutSuggestion(next, ref, recipe, candidates, random, score),
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
  const ticked = plan.ticked.includes(key)
    ? plan.ticked.filter((other) => other !== key)
    : [...plan.ticked, key];
  return { ...plan, ticked };
}

export function addItem(plan: Plan, text: string): Plan {
  const item = text.trim();
  if (item === '' || plan.added.some((other) => sameItem(other, item))) {
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
  if (!plan.added.includes(text)) {
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
  // were recorded have no shown recipes, those saved before items could be added have none, and
  // those saved before kid-friendly plans aren't kid-friendly
  const {
    days,
    people,
    accepted,
    ticked = [],
    added = [],
    shown = [],
    kidFriendly = false,
  } = value;
  if (!Array.isArray(days) || days.length < MIN_DAYS || days.length > MAX_DAYS) {
    return null;
  }
  if (typeof people !== 'number' || !Number.isInteger(people) || people < MIN_PEOPLE) {
    return null;
  }
  if (typeof accepted !== 'boolean' || typeof kidFriendly !== 'boolean') {
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
    kidFriendly,
  };
  // A record missing what a meal shows or showed before its pick (an old or hand-edited save) still
  // counts it as shown
  const seen = mealsOf(parsed).flatMap((meal) => [...meal.suggestions, ...(meal.offered ?? [])]);
  const plan = { ...parsed, shown: [...new Set([...shown, ...seen])] };
  const valid =
    hasConsecutiveDates(plan) &&
    usesRecipesOnce(plan) &&
    hasValidLeftovers(plan) &&
    (!accepted || isComplete(plan));
  return valid ? plan : null;
}

export function isComplete(plan: Plan): boolean {
  return plan.days.every(
    (day, i) => isFilled(day.dinner) && (isFilled(day.lunch) || isLunchCovered(plan, i)),
  );
}

export function filledMeals(plan: Plan): number {
  return plan.days
    .flatMap((day, i) => [isFilled(day.lunch) || isLunchCovered(plan, i), isFilled(day.dinner)])
    .filter(Boolean).length;
}

export function leftoversOf(plan: Plan, day: number): string | null {
  if (plan.days[day] === undefined || !isLunchCovered(plan, day)) {
    return null;
  }
  return plan.days[day - 1].dinner.recipe;
}

export function isPicked(plan: Plan, recipe: string): boolean {
  return pickedRecipes(plan).has(recipe);
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
  const { recipe, offered, eatOut } = value;
  const suggestions: unknown[] = value['suggestions'];
  if (!suggestions.every((name) => typeof name === 'string' && recipes.includes(name))) {
    return null;
  }
  // Plans saved before meals could be eaten out have no such field
  if (eatOut !== undefined) {
    if (eatOut !== true || recipe !== null || suggestions.length > 0) {
      return null;
    }
    if (offered === undefined) {
      return { recipe, suggestions: [], eatOut };
    }
    return isOfferedSet(offered, recipes) ? { recipe, suggestions: [], offered, eatOut } : null;
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
  return isOfferedSet(offered, recipes) && offered.includes(recipe)
    ? { recipe, suggestions: [], offered }
    : null;
}

function isOfferedSet(value: unknown, recipes: readonly string[]): value is string[] {
  return isRecipeList(value, recipes) && value.length === SUGGESTIONS;
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
  return meal.recipe === null && meal.suggestions.length === 0 && !meal.eatOut;
}

function isFilled(meal: Meal): boolean {
  return meal.recipe !== null || meal.eatOut === true;
}

function openDays(
  plan: Plan,
  startDate: string,
  count: number,
  recipes: readonly string[],
  random: Random,
  score: Score,
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
    .reduce((next, ref) => openMeal(next, ref, recipes, random, score), withAdded);
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
  score: Score,
): Plan {
  const off = withDay(plan, day, { cookExtra: false });
  return openMeal(off, { day: day + 1, kind: 'lunch' }, recipes, random, score);
}

function openMeal(
  plan: Plan,
  ref: MealRef,
  recipes: readonly string[],
  random: Random,
  score: Score,
  excluded: readonly string[] = [],
): Plan {
  const [suggestions, drawn] = drawSuggestions(
    plan,
    ref,
    [],
    SUGGESTIONS,
    excluded,
    recipes,
    random,
    score,
  );
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
  score: Score,
): Plan {
  const reopened = withMeal(plan, ref, { recipe: null, suggestions: [...offered] });
  const picked = pickedRecipes(reopened);
  return offered
    .filter((name) => picked.has(name) || !recipes.includes(name))
    .reduce((next, name) => withoutSuggestion(next, ref, name, recipes, random, score), reopened);
}

function withoutSuggestion(
  plan: Plan,
  ref: MealRef,
  recipe: string,
  recipes: readonly string[],
  random: Random,
  score: Score,
): Plan {
  const meal = mealAt(plan, ref);
  if (!meal?.suggestions.includes(recipe)) {
    return plan;
  }
  const others = meal.suggestions.filter((name) => name !== recipe);
  const [[replacement], drawn] = drawSuggestions(
    plan,
    ref,
    others,
    1,
    others,
    recipes,
    random,
    score,
  );
  // With nothing left to draw the meal keeps the recipe: a gap would be saved as null, and the
  // saved plan thrown away when loaded
  if (replacement === undefined) {
    return plan;
  }
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

function holdsRecipe(plan: Plan, recipe: string): boolean {
  return (
    plan.shown.includes(recipe) ||
    mealsOf(plan).some(
      (meal) =>
        meal.recipe === recipe ||
        meal.suggestions.includes(recipe) ||
        meal.offered?.includes(recipe) === true,
    )
  );
}

function withMeals(plan: Plan, change: (meal: Meal) => Meal): Plan {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      lunch: change(day.lunch),
      dinner: change(day.dinner),
    })),
  };
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
  meal: MealRef,
  alongside: readonly string[],
  count: number,
  excluded: readonly string[],
  recipes: readonly string[],
  random: Random,
  score: Score,
): [string[], Plan] {
  const picked = pickedRecipes(plan);
  const candidates = recipes.filter((name) => !picked.has(name) && !excluded.includes(name));
  const fresh = candidates.filter((name) => !plan.shown.includes(name));
  const drawn: string[] = [];
  while (drawn.length < count && fresh.length > 0) {
    const context = { plan, meal, alongside: [...alongside, ...drawn] };
    const scores = fresh.map((name) => score(name, context));
    const best = Math.max(...scores);
    const ties = fresh.filter((_, i) => scores[i] === best);
    const chosen = ties[Math.floor(random() * ties.length)];
    fresh.splice(fresh.indexOf(chosen), 1);
    drawn.push(chosen);
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
