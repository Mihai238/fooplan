import { Recipe } from './recipe';

export function searchRecipes(recipes: readonly Recipe[], query: string): Recipe[] {
  const text = normalize(query.trim());
  return recipes.filter(
    (recipe) =>
      normalize(recipe.name).includes(text) ||
      recipe.ingredients.some((ingredient) => normalize(ingredient.name).includes(text)),
  );
}

// NFD splits a letter like "ä" or "ç" into its base letter and a combining mark, which is dropped
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
