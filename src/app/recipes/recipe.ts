export const UNITS = ['g', 'ml', 'pc', 'tbsp', 'tsp'] as const;

export type Unit = (typeof UNITS)[number];

export interface Ingredient {
  name: string;
  amount: number;
  unit: Unit;
}

export interface Recipe {
  name: string;
  servings: number;
  minutes?: number;
  workMinutes?: number;
  ingredients: Ingredient[];
  steps?: string[];
  own?: true;
}

export function servingsText(servings: number): string {
  return servings === 1 ? '1 serving' : `${servings} servings`;
}
