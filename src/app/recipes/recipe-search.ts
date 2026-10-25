import { Ingredient, Recipe } from './recipe';

export interface RecipeTexts {
  displayName(recipe: Recipe): string;
  displayIngredients(recipe: Recipe): Ingredient[];
}

const AS_STORED: RecipeTexts = {
  displayName: (recipe) => recipe.name,
  displayIngredients: (recipe) => recipe.ingredients,
};

export function searchRecipes(
  recipes: readonly Recipe[],
  query: string,
  texts: RecipeTexts = AS_STORED,
): Recipe[] {
  const text = normalize(query.trim());
  return recipes.filter(
    (recipe) =>
      normalize(texts.displayName(recipe)).includes(text) ||
      texts
        .displayIngredients(recipe)
        .some((ingredient) => normalize(ingredient.name).includes(text)),
  );
}

// NFD splits a letter like "ä" or "ç" into its base letter and a combining mark, which is dropped
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
