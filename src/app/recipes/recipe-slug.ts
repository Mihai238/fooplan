import { normalize } from './recipe-search';

export function recipeSlug(name: string): string {
  return normalize(name)
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/[ -]+/g, '-')
    .replace(/^-|-$/g, '');
}
