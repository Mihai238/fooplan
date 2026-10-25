import { Ingredient } from './recipe';

export type Amount = Pick<Ingredient, 'amount' | 'unit'>;

// Only the amounts a cook measures with a spoon: 50 ml is 10 tsp on paper but reads better in ml
const SPOONS = new Map<number, Readonly<Amount>>([
  [5, { amount: 1, unit: 'tsp' }],
  [10, { amount: 2, unit: 'tsp' }],
  [15, { amount: 1, unit: 'tbsp' }],
  [30, { amount: 2, unit: 'tbsp' }],
  [45, { amount: 3, unit: 'tbsp' }],
]);

export function displayAmount(item: Amount): Readonly<Amount> {
  const spoons = item.unit === 'ml' ? SPOONS.get(item.amount) : undefined;
  return spoons ?? { amount: item.amount, unit: item.unit };
}
