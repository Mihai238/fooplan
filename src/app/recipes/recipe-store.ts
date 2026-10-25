import { computed, inject, Injectable, signal } from '@angular/core';
import { LanguageStore } from '../language-store';
import { isRecord, readStored, writeStored } from '../storage';
import { checkRecipe, MAX_INGREDIENTS } from './own-recipe';
import { Ingredient, Recipe, UNITS } from './recipe';
import { recipeSlug } from './recipe-slug';
import { RECIPES } from './recipes';
import german from './recipes.de.json';

const GERMAN_RECIPES = new Map<string, { name: string; steps: string[] }>(
  Object.entries(german.recipes),
);
const GERMAN_INGREDIENTS = new Map<string, string>(Object.entries(german.ingredients));

const STORAGE_KEY = 'fooplan.recipes';

@Injectable({ providedIn: 'root' })
export class RecipeStore {
  private readonly language = inject(LanguageStore);
  private readonly ownState = signal<readonly Recipe[]>(parseRecipes(readStored(STORAGE_KEY)));
  readonly own = this.ownState.asReadonly();
  readonly all = computed<readonly Recipe[]>(() => [...RECIPES, ...this.own()]);
  private readonly bySlugMap = computed(
    () => new Map(this.all().map((recipe) => [recipeSlug(recipe.name), recipe])),
  );

  bySlug(slug: string): Recipe | undefined {
    return this.bySlugMap().get(slug);
  }

  displayName(recipe: Recipe): string {
    return this.germanRecipe(recipe)?.name ?? recipe.name;
  }

  displaySteps(recipe: Recipe): string[] | undefined {
    return this.germanRecipe(recipe)?.steps ?? recipe.steps;
  }

  displayIngredients(recipe: Recipe): Ingredient[] {
    return recipe.own
      ? recipe.ingredients
      : recipe.ingredients.map((ingredient) => ({
          ...ingredient,
          name: this.displayIngredient(ingredient.name),
        }));
  }

  // By name only, unlike displayIngredients: a grocery line can stand for a built-in and an own
  // recipe's ingredient at once
  displayIngredient(name: string): string {
    return (this.german() && GERMAN_INGREDIENTS.get(name)) || name;
  }

  // The caller checks the recipe first, with checkRecipe
  add(recipe: Recipe): void {
    this.ownState.update((own) => [...own, { ...recipe, own: true }]);
    this.save();
  }

  // The caller checks the recipe first, with checkRecipe
  replace(oldName: string, recipe: Recipe): void {
    if (!this.own().some((other) => other.name === oldName)) {
      return;
    }
    this.ownState.update((own) =>
      own.map((other) => (other.name === oldName ? { ...recipe, own: true } : other)),
    );
    this.save();
  }

  remove(name: string): void {
    if (!this.own().some((other) => other.name === name)) {
      return;
    }
    this.ownState.update((own) => own.filter((other) => other.name !== name));
    this.save();
  }

  private germanRecipe(recipe: Recipe): { name: string; steps: string[] } | undefined {
    return this.german() && !recipe.own ? GERMAN_RECIPES.get(recipe.name) : undefined;
  }

  private german(): boolean {
    return this.language.language() === 'de';
  }

  private save(): void {
    writeStored(
      STORAGE_KEY,
      this.own().map(({ name, servings, ingredients }) => ({ name, servings, ingredients })),
    );
  }
}

// An entry must be stored exactly as checkRecipe normalizes it; its name is checked only against
// the entries kept before it
function parseRecipes(value: unknown): Recipe[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.reduce<Recipe[]>((kept, entry) => {
    const recipe = parseRecipe(entry, [...RECIPES, ...kept]);
    return recipe ? [...kept, recipe] : kept;
  }, []);
}

function parseRecipe(entry: unknown, recipes: readonly Recipe[]): Recipe | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }
  const { name, servings, ingredients } = entry;
  if (
    typeof name !== 'string' ||
    !Number.isInteger(servings) ||
    !Array.isArray(ingredients) ||
    ingredients.length > MAX_INGREDIENTS ||
    !ingredients.every(isStoredIngredient)
  ) {
    return undefined;
  }
  const check = checkRecipe(
    {
      name,
      servings: String(servings),
      ingredients: ingredients.map((ingredient) => ({
        amount: String(ingredient.amount),
        unit: ingredient.unit,
        name: ingredient.name,
      })),
    },
    recipes,
  );
  if (
    !('recipe' in check) ||
    check.recipe.name !== name ||
    check.recipe.ingredients.some((ingredient, i) => ingredient.name !== ingredients[i].name)
  ) {
    return undefined;
  }
  return { ...check.recipe, own: true };
}

function isStoredIngredient(value: unknown): value is Ingredient {
  return (
    isRecord(value) &&
    typeof value['name'] === 'string' &&
    typeof value['amount'] === 'number' &&
    (UNITS as readonly unknown[]).includes(value['unit'])
  );
}
