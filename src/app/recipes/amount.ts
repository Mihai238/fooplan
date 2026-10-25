import { LOCALES, MESSAGES } from '../i18n';
import type { Language } from '../language-store';
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

// Not formatNumber or DecimalPipe: they always group thousands, and amounts are plain digits
// ("2000 g") apart from the decimal separator. Intl writes the shortest digits, as String() does
const NUMBERS: Record<Language, Intl.NumberFormat> = {
  en: new Intl.NumberFormat(LOCALES.en, { useGrouping: false, maximumFractionDigits: 20 }),
  de: new Intl.NumberFormat(LOCALES.de, { useGrouping: false, maximumFractionDigits: 20 }),
};

export function formatAmount(item: Amount, language: Language): string {
  const shown = displayAmount(item);
  return `${NUMBERS[language].format(shown.amount)} ${MESSAGES[language][`unit.${shown.unit}`]}`;
}

export function displayAmount(item: Amount): Readonly<Amount> {
  const spoons = item.unit === 'ml' ? SPOONS.get(item.amount) : undefined;
  return spoons ?? { amount: item.amount, unit: item.unit };
}
