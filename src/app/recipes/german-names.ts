import type { Language } from '../language-store';
import german from './recipes.de.json';

export interface GermanRecipe {
  name: string;
  steps: string[];
}

const RECIPES = new Map<string, GermanRecipe>(Object.entries(german.recipes));
const INGREDIENTS = new Map<string, string>(Object.entries(german.ingredients));
const ENGLISH_INGREDIENTS = new Map<string, string>(
  Object.entries(german.ingredients).map(([english, name]) => [name.toLowerCase(), english]),
);

export function germanRecipe(name: string): GermanRecipe | undefined {
  return RECIPES.get(name);
}

export function ingredientNameIn(name: string, language: Language): string {
  return (language === 'de' && INGREDIENTS.get(name)) || name;
}

export function englishIngredient(germanName: string): string | undefined {
  return ENGLISH_INGREDIENTS.get(germanName.toLowerCase());
}
