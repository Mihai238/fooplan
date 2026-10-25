import { Recipe } from './recipe';

export const STRONG_FLAVOURS: readonly string[] = [
  'chili flakes',
  'chili powder',
  'green curry paste',
  'fish sauce',
  'anchovy',
  'tamarind paste',
];

export function isKidFriendly(recipe: Recipe): boolean {
  return !recipe.ingredients.some((ingredient) => STRONG_FLAVOURS.includes(ingredient.name));
}
