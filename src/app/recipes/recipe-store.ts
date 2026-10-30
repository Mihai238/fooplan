import { computed, inject, Injectable, signal } from '@angular/core';
import { LanguageStore } from '../language-store';
import { isRecord, StorageBackend } from '../storage';
import { GermanRecipe, germanRecipe, ingredientNameIn } from './german-names';
import { checkRecipe, MAX_INGREDIENTS } from './own-recipe';
import { Ingredient, Recipe, UNITS } from './recipe';
import { recipeSlug } from './recipe-slug';
import { RECIPES } from './recipes';

const STORAGE_KEY = 'fooplan.recipes';

@Injectable({ providedIn: 'root' })
export class RecipeStore {
  private readonly language = inject(LanguageStore);
  private readonly backend = inject(StorageBackend);
  private readonly ownState = signal<readonly Recipe[]>([]);
  readonly own = this.ownState.asReadonly();
  private readonly readyState = signal(false);
  readonly ready = this.readyState.asReadonly();
  private loading: Promise<void> | undefined;
  readonly all = computed<readonly Recipe[]>(() => [...RECIPES, ...this.own()]);
  private readonly bySlugMap = computed(
    () => new Map(this.all().map((recipe) => [recipeSlug(recipe.name), recipe])),
  );

  load(): Promise<void> {
    if (!this.loading) {
      this.readyState.set(false);
      // Read from a promise, so that a read failing at once ends the load after it is stored here
      this.loading = Promise.resolve().then(() => this.read());
    }
    return this.loading;
  }

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
    return ingredientNameIn(name, this.language.language());
  }

  // The caller checks the recipe first, with checkRecipe. Until a load is done, a change would be
  // made to recipes the load then replaces, or before the first load saved over the saved ones: it
  // is ignored, here and in replace and remove
  add(recipe: Recipe): void {
    if (!this.ready()) {
      return;
    }
    this.ownState.update((own) => [...own, { ...recipe, own: true }]);
    this.save();
  }

  // The caller checks the recipe first, with checkRecipe
  replace(oldName: string, recipe: Recipe): void {
    if (!this.ready() || !this.own().some((other) => other.name === oldName)) {
      return;
    }
    this.ownState.update((own) =>
      own.map((other) => (other.name === oldName ? { ...recipe, own: true } : other)),
    );
    this.save();
  }

  remove(name: string): void {
    if (!this.ready() || !this.own().some((other) => other.name === name)) {
      return;
    }
    this.ownState.update((own) => own.filter((other) => other.name !== name));
    this.save();
  }

  // The load ends in the step that makes the store ready, so a load() from then on reads again
  private async read(): Promise<void> {
    try {
      this.ownState.set(parseRecipes(await this.backend.read(STORAGE_KEY)));
      this.readyState.set(true);
    } finally {
      this.loading = undefined;
    }
  }

  private germanRecipe(recipe: Recipe): GermanRecipe | undefined {
    return this.german() && !recipe.own ? germanRecipe(recipe.name) : undefined;
  }

  private german(): boolean {
    return this.language.language() === 'de';
  }

  // A failed write is ignored: the change lives until the page is reloaded
  private save(): void {
    this.backend
      .write(
        STORAGE_KEY,
        this.own().map(({ name, servings, ingredients }) => ({ name, servings, ingredients })),
      )
      .catch(() => undefined);
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
