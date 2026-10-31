import { PANTRY_STAPLES } from '../groceries/sections';
import { Recipe } from '../recipes/recipe';
import { Cooked, daysSinceCooked, leftoversOf, MealRef, Plan, Score } from './plan';

export type Base = 'pasta' | 'rice' | 'potato' | 'bread' | 'other';

export type Protein = 'chicken' | 'meat' | 'fish' | 'other';

export const PASTA: readonly string[] = [
  'spaghetti',
  'penne',
  'macaroni',
  'gnocchi',
  'egg noodle',
  'rice noodle',
];
export const RICE: readonly string[] = ['rice'];
export const POTATO: readonly string[] = ['potato', 'sweet potato'];
export const BREAD: readonly string[] = ['bread', 'burger bun', 'tortilla'];
export const CHICKEN: readonly string[] = ['chicken breast', 'chicken thigh'];
export const MEAT: readonly string[] = [
  'ground beef',
  'beef sirloin',
  'bratwurst',
  'frankfurter',
  'guanciale',
];
export const FISH: readonly string[] = ['salmon', 'cod', 'prawn', 'canned tuna', 'anchovy'];

// In order: a recipe of two kinds is of the first one listed
const BASES: readonly [Base, readonly string[]][] = [
  ['pasta', PASTA],
  ['rice', RICE],
  ['potato', POTATO],
  ['bread', BREAD],
];
const PROTEINS: readonly [Protein, readonly string[]][] = [
  ['chicken', CHICKEN],
  ['meat', MEAT],
  ['fish', FISH],
];

const MAX_OVERLAP = 3;
const RECENT_PENALTY_WEEK = -4;
const RECENT_PENALTY_FORTNIGHT = -2;
// getUTCDay of Friday, Saturday and Sunday
const WEEKEND = [5, 6, 0];

type Recipes = ReadonlyMap<string, Recipe>;

export function scoreWith(recipes: readonly Recipe[], cooked: Cooked, today: string): Score {
  const byName: Recipes = new Map(recipes.map((recipe) => [recipe.name, recipe]));
  return (name, { plan, meal, alongside }) => {
    const candidate = byName.get(name);
    if (candidate === undefined) {
      return 0;
    }
    return (
      neighbourTerm(candidate, plan, meal, byName) +
      alongsideTerm(candidate, alongside, byName) +
      overlapTerm(candidate, plan, byName) +
      fitTerm(candidate, plan, meal) +
      recentTerm(candidate, cooked, today)
    );
  };
}

export function baseOf(recipe: Recipe): Base {
  return kindOf(recipe, BASES) ?? 'other';
}

export function proteinOf(recipe: Recipe): Protein {
  return kindOf(recipe, PROTEINS) ?? 'other';
}

function neighbourTerm(candidate: Recipe, plan: Plan, meal: MealRef, byName: Recipes): number {
  const sameDay: MealRef = { day: meal.day, kind: meal.kind === 'lunch' ? 'dinner' : 'lunch' };
  const adjacent = [meal.day - 1, meal.day + 1].flatMap((day): MealRef[] => [
    { day, kind: 'lunch' },
    { day, kind: 'dinner' },
  ]);
  return (
    -clash(candidate, recipeAt(plan, sameDay, byName), 3, 3) -
    adjacent.reduce((sum, ref) => sum + clash(candidate, recipeAt(plan, ref, byName), 1, 2), 0)
  );
}

function alongsideTerm(candidate: Recipe, alongside: readonly string[], byName: Recipes): number {
  return -alongside.reduce((sum, name) => sum + clash(candidate, byName.get(name), 2, 2), 0);
}

function overlapTerm(candidate: Recipe, plan: Plan, byName: Recipes): number {
  // A lunch covered by leftovers has no pick of its own, and its dinner's ingredients are counted
  // with the dinner
  const picked = new Set(
    plan.days
      .flatMap((day) => [day.lunch.recipe, day.dinner.recipe])
      .flatMap((name) => (name === null ? [] : ingredientNames(byName.get(name)))),
  );
  const shared = new Set(
    ingredientNames(candidate).filter((name) => picked.has(name) && !PANTRY_STAPLES.includes(name)),
  );
  return Math.min(shared.size, MAX_OVERLAP);
}

function fitTerm(candidate: Recipe, plan: Plan, meal: MealRef): number {
  const minutes = candidate.minutes;
  if (minutes === undefined) {
    return 0;
  }
  if (meal.kind === 'lunch') {
    if (minutes <= 15) {
      return 2;
    }
    if (minutes <= 25) {
      return 1;
    }
    return minutes >= 35 ? -1 : 0;
  }
  const weekday = new Date(plan.days[meal.day].date + 'T00:00:00Z').getUTCDay();
  return (minutes >= 25 ? 1 : 0) + (WEEKEND.includes(weekday) && minutes >= 35 ? 1 : 0);
}

function recentTerm(candidate: Recipe, cooked: Cooked, today: string): number {
  const days = daysSinceCooked(cooked, candidate.name, today);
  if (days === null || days >= 14) {
    return 0;
  }
  return days < 7 ? RECENT_PENALTY_WEEK : RECENT_PENALTY_FORTNIGHT;
}

function clash(
  candidate: Recipe,
  other: Recipe | undefined,
  basePenalty: number,
  proteinPenalty: number,
): number {
  if (other === undefined) {
    return 0;
  }
  return (
    (isSameKind(baseOf(candidate), baseOf(other)) ? basePenalty : 0) +
    (isSameKind(proteinOf(candidate), proteinOf(other)) ? proteinPenalty : 0)
  );
}

function isSameKind(a: string, b: string): boolean {
  return a !== 'other' && a === b;
}

function recipeAt(plan: Plan, ref: MealRef, byName: Recipes): Recipe | undefined {
  const name =
    plan.days[ref.day]?.[ref.kind].recipe ??
    (ref.kind === 'lunch' ? leftoversOf(plan, ref.day) : null);
  return name === null ? undefined : byName.get(name);
}

function kindOf<K>(recipe: Recipe, lists: readonly [K, readonly string[]][]): K | undefined {
  const names = ingredientNames(recipe);
  return lists.find(([, list]) => names.some((name) => list.includes(name)))?.[0];
}

function ingredientNames(recipe: Recipe | undefined): string[] {
  return recipe?.ingredients.map((ingredient) => ingredient.name) ?? [];
}
