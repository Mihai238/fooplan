import { Recipe } from './recipe';
import { normalize } from './recipe-search';
import { RECIPES } from './recipes';

export function recipeBySlug(slug: string): Recipe | undefined {
  return RECIPES_BY_SLUG.get(slug);
}

export function recipeSlug(name: string): string {
  return normalize(name)
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/[ -]+/g, '-')
    .replace(/^-|-$/g, '');
}

const RECIPES_BY_SLUG = new Map(RECIPES.map((recipe) => [recipeSlug(recipe.name), recipe]));
