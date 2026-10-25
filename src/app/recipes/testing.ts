import { Recipe } from './recipe';

export const RECIPES_KEY = 'fooplan.recipes';

export const QUICK_DAL: Recipe = {
  name: 'Quick Dal',
  servings: 4,
  ingredients: [
    { name: 'canned chickpeas', amount: 200, unit: 'g' },
    { name: 'onion', amount: 2, unit: 'pc' },
    { name: 'mystery spice', amount: 1, unit: 'pc' },
  ],
  own: true,
};

export const PLAIN_RICE: Recipe = {
  name: 'Plain Rice',
  servings: 4,
  ingredients: [{ name: 'rice', amount: 300, unit: 'g' }],
  own: true,
};

export function ownRecipe(name: string, servings = 4): Recipe {
  return { name, servings, ingredients: [{ name: 'onion', amount: 1, unit: 'pc' }], own: true };
}

// Saved the way RecipeStore saves them, without `own`, so a store created afterwards loads them
export function storeOwnRecipes(...recipes: Recipe[]): void {
  const stored = recipes.map(({ name, servings, ingredients }) => ({
    name,
    servings,
    ingredients,
  }));
  localStorage.setItem(RECIPES_KEY, JSON.stringify(stored));
}
