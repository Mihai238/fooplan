import type { Language } from '../language-store';
import { addedKey, Plan, sameItem } from '../plan/plan';
import { englishIngredient } from '../recipes/german-names';
import { Recipe, Unit } from '../recipes/recipe';
import { PANTRY_STAPLES, Section, SECTIONS, sectionOf } from './sections';

export interface GroceryItem {
  name: string;
  amount: number;
  unit: Unit;
  section: Section;
}

export interface AddedItem {
  name: string;
  section: Section;
  added: true;
}

export type ListItem = GroceryItem | AddedItem;

export interface SectionItems<T extends ListItem = ListItem> {
  section: Section;
  items: T[];
}

export interface ShoppingView {
  sections: SectionItems[];
  inCart: ListItem[];
}

export type ItemOrder = (a: ListItem, b: ListItem) => number;

export type AddFeedback =
  | { id: 'groceries.added'; params: { item: string; section: Section } }
  | { id: 'groceries.alreadyInCart' | 'groceries.alreadyOnList'; params: { item: string } };

export function listItems(
  plan: Plan,
  recipes: readonly Recipe[],
  language: Language = 'en',
): ListItem[] {
  return [...groceryList(plan, recipes), ...addedItems(plan, language)];
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

export function addedItems(plan: Plan, language: Language = 'en'): AddedItem[] {
  if (!plan.accepted) {
    return [];
  }
  return plan.added.map((name) => ({ name, section: addedSection(name, language), added: true }));
}

// Takes the plan as it is before addItem, and finds an item already added the way addItem does
export function addFeedback(
  plan: Plan,
  text: string,
  language: Language = 'en',
): AddFeedback | null {
  const item = text.trim();
  if (!plan.accepted || item === '') {
    return null;
  }
  const stored = plan.added.find((other) => sameItem(other, item));
  if (stored === undefined) {
    return { id: 'groceries.added', params: { item, section: addedSection(item, language) } };
  }
  return plan.ticked.includes(addedKey(stored))
    ? { id: 'groceries.alreadyInCart', params: { item: stored } }
    : { id: 'groceries.alreadyOnList', params: { item: stored } };
}

// Ticks whose key isn't on the list, e.g. after a deploy changed the recipes, are ignored
export function shoppingView(
  items: readonly ListItem[],
  ticked: readonly string[],
  order: ItemOrder = byName,
): ShoppingView {
  const tickedKeys = new Set(ticked);
  const toBuy: ListItem[] = [];
  const inCart: ListItem[] = [];
  for (const item of items) {
    (tickedKeys.has(itemKey(item)) ? inCart : toBuy).push(item);
  }
  return { sections: bySection(toBuy.sort(order)), inCart: inCart.sort(order) };
}

export function bySection<T extends ListItem>(items: readonly T[]): SectionItems<T>[] {
  return SECTIONS.map((section) => ({
    section,
    items: items.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0);
}

export const byName: ItemOrder = byShownName((item) => item.name, 'en');

// The shown name may be a translation, while the item keeps its English name for its key and
// section. For the same name the plan's lines, which have an amount, come before an added one
export function byShownName(nameOf: (item: ListItem) => string, locale: string): ItemOrder {
  return (a, b) =>
    nameOf(a).localeCompare(nameOf(b), locale) ||
    Number('added' in a) - Number('added' in b) ||
    unitOf(a).localeCompare(unitOf(b), 'en');
}

export function itemKey(item: { name: string; unit: Unit } | AddedItem): string {
  return 'added' in item ? addedKey(item.name) : JSON.stringify([item.name, item.unit]);
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

// Recipes spell English ingredient names in lowercase, and englishIngredient ignores case, so the
// whole text matches an English name, or in German a German one, ignoring case ("LEMON", "ZITRONE",
// "Rote zwiebel"), while the item still reads as typed
export function addedSection(name: string, language: Language = 'en'): Section {
  const typed = name.trim();
  const english = (language === 'de' && englishIngredient(typed)) || typed.toLowerCase();
  return sectionOf(english);
}

function unitOf(item: ListItem): string {
  return 'added' in item ? '' : item.unit;
}
