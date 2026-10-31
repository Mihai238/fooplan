import nutrition from './nutrition.json';
import { Ingredient, Recipe, Unit } from './recipe';

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionEntry extends Nutrition {
  grams?: Partial<Record<Exclude<Unit, 'g'>, number>>;
}

const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat'] as const;

// A Map rather than the object: an own recipe's ingredient may be named like an Object.prototype
// member ("constructor")
const TABLE: ReadonlyMap<string, NutritionEntry> = new Map(Object.entries(nutrition));

export function nutritionMessage(
  recipe: Recipe,
):
  | { id: 'nutrition.perServing'; params: Record<keyof Nutrition, number> }
  | { id: 'nutrition.missing'; params: { names: string } } {
  const nutrition = nutritionOf(recipe);
  return 'perServing' in nutrition
    ? { id: 'nutrition.perServing', params: { ...nutrition.perServing } }
    : { id: 'nutrition.missing', params: { names: nutrition.missing.join(', ') } };
}

export function nutritionOf(recipe: Recipe): { perServing: Nutrition } | { missing: string[] } {
  const total: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const missing = new Set<string>();
  for (const ingredient of recipe.ingredients) {
    const entry = TABLE.get(ingredient.name);
    const grams = entry && gramsOf(ingredient, entry);
    if (entry === undefined || grams === undefined) {
      missing.add(ingredient.name);
      continue;
    }
    for (const nutrient of NUTRIENTS) {
      total[nutrient] += (entry[nutrient] * grams) / 100;
    }
  }
  if (missing.size > 0) {
    return { missing: [...missing] };
  }
  const serving = (nutrient: keyof Nutrition) => Math.round(total[nutrient] / recipe.servings);
  return {
    perServing: {
      kcal: serving('kcal'),
      protein: serving('protein'),
      carbs: serving('carbs'),
      fat: serving('fat'),
    },
  };
}

function gramsOf({ amount, unit }: Ingredient, entry: NutritionEntry): number | undefined {
  if (unit === 'g') {
    return amount;
  }
  const factor = entry.grams?.[unit];
  return factor === undefined ? undefined : amount * factor;
}
