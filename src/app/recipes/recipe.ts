import type { MessageId } from '../i18n';

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

export function servingsMessage(servings: number): {
  id: MessageId;
  params: { servings: number };
} {
  return { id: servings === 1 ? 'servings.one' : 'servings.other', params: { servings } };
}
