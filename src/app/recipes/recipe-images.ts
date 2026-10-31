import { InjectionToken } from '@angular/core';
import { Recipe } from './recipe';
import recipeImages from './recipe-images.json';
import { recipeSlug } from './recipe-slug';

// The slugs of the built-in recipes with a picture in public/images/recipes/, as
// `npm run recipe-images` lists them
export const RECIPE_IMAGES = new InjectionToken<readonly string[]>('RECIPE_IMAGES', {
  providedIn: 'root',
  factory: () => recipeImages,
});

// No src for a recipe that isn't listed, so the app never requests a file that doesn't exist. An own
// recipe never has one, even when it shares a listed built-in recipe's name.
export function pictureOf(
  recipe: Recipe | undefined,
  images: readonly string[],
): string | undefined {
  if (recipe === undefined || recipe.own) {
    return undefined;
  }
  const slug = recipeSlug(recipe.name);
  return images.includes(slug) ? `images/recipes/${slug}.webp` : undefined;
}
