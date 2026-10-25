import { Plan } from '../plan/plan';
import { Recipe, Unit } from '../recipes/recipe';
import { PANTRY_STAPLES, Section, SECTIONS, sectionOf } from './sections';

export interface GroceryItem {
  name: string;
  amount: number;
  unit: Unit;
  section: Section;
}

export interface SectionItems {
  section: Section;
  items: GroceryItem[];
}

export interface ShoppingView {
  sections: SectionItems[];
  inCart: GroceryItem[];
}

export function groceryList(plan: Plan, recipes: readonly Recipe[]): GroceryItem[] {
  if (!plan.accepted) {
    return [];
  }
  const merged = new Map<string, GroceryItem>();
  for (const { recipe, people } of cookedRecipes(plan, recipes)) {
    for (const { name, amount, unit } of recipe.ingredients) {
      if (PANTRY_STAPLES.includes(name)) {
        continue;
      }
      const key = itemKey({ name, unit });
      const scaled = (amount * people) / recipe.servings;
      const sum = (merged.get(key)?.amount ?? 0) + scaled;
      merged.set(key, { name, amount: sum, unit, section: sectionOf(name) });
    }
  }
  return [...merged.values()]
    .map((item) => ({ ...item, amount: roundUp(item.amount) }))
    .sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || byName(a, b));
}

// Ticks whose key isn't on the list, e.g. after a deploy changed the recipes, are ignored
export function shoppingView(
  items: readonly GroceryItem[],
  ticked: readonly string[],
): ShoppingView {
  const tickedKeys = new Set(ticked);
  const toBuy: GroceryItem[] = [];
  const inCart: GroceryItem[] = [];
  for (const item of items) {
    (tickedKeys.has(itemKey(item)) ? inCart : toBuy).push(item);
  }
  return { sections: bySection(toBuy), inCart: inCart.sort(byName) };
}

export function bySection(items: readonly GroceryItem[]): SectionItems[] {
  return SECTIONS.map((section) => ({
    section,
    items: items.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0);
}

export function byName(a: GroceryItem, b: GroceryItem): number {
  return a.name.localeCompare(b.name, 'en') || a.unit.localeCompare(b.unit, 'en');
}

export function itemKey(item: { name: string; unit: Unit }): string {
  return JSON.stringify([item.name, item.unit]);
}

// A lunch covered by leftovers has no recipe: the dinner before it is cooked for twice the people
function cookedRecipes(
  plan: Plan,
  recipes: readonly Recipe[],
): { recipe: Recipe; people: number }[] {
  return plan.days.flatMap((day) => {
    const meals = [
      { name: day.lunch.recipe, people: plan.people },
      { name: day.dinner.recipe, people: plan.people * (day.cookExtra ? 2 : 1) },
    ];
    return meals.flatMap(({ name, people }) => {
      const recipe = recipes.find((candidate) => candidate.name === name);
      return recipe ? [{ recipe, people }] : [];
    });
  });
}

// Float noise can push a sum that is whole on paper just above it, like 3.0000000000000004,
// which Math.ceil alone would turn into 4
function roundUp(amount: number): number {
  return Math.ceil(Number(amount.toFixed(6)));
}
