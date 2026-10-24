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
  ingredients: Ingredient[];
}
