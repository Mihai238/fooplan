import { Ingredient, Recipe, Unit } from './recipe';
import { recipeSlug } from './recipe-slug';

export interface RecipeDraft {
  name: string;
  servings: string;
  ingredients: IngredientDraft[];
}

export interface IngredientDraft {
  amount: string;
  unit: Unit;
  name: string;
}

export type RecipeCheck = { recipe: Recipe } | { problems: RecipeProblems };

export interface RecipeProblems {
  name?: string;
  servings?: string;
  // "Add at least one ingredient.", shown below the legend
  ingredients?: string;
  // One entry per row of the draft, in its order; a row without problems, or ignored as empty, has
  // an empty one
  rows: RowProblems[];
}

export interface RowProblems {
  amount?: string;
  name?: string;
}

export const MAX_INGREDIENTS = 30;

const MAX_NAME = 60;
const MAX_SERVINGS = 12;
const MAX_AMOUNT = 10000;
const MAX_INGREDIENT = 40;

export function checkRecipe(draft: RecipeDraft, recipes: readonly Recipe[]): RecipeCheck {
  const name = collapseSpaces(draft.name);
  const nameProblem = checkName(name, recipes);
  const servings = draft.servings.trim();
  const servingsOk = /^[0-9]+$/.test(servings) && +servings >= 1 && +servings <= MAX_SERVINGS;
  const ingredients: Ingredient[] = [];
  const seen: string[] = [];
  const rows = draft.ingredients.map((row): RowProblems => {
    const amount = row.amount.trim();
    const ingredient = collapseSpaces(row.name).toLowerCase();
    if (!amount && !ingredient) {
      return {};
    }
    const value = Number(amount.replace(',', '.'));
    const amountOk = /^[0-9]+([.,][0-9]{1,2})?$/.test(amount) && value > 0 && value <= MAX_AMOUNT;
    const ingredientProblem = checkIngredient(ingredient, seen);
    seen.push(ingredient);
    ingredients.push({ name: ingredient, amount: value, unit: row.unit });
    return {
      ...(amountOk ? {} : { amount: 'Enter an amount above 0.' }),
      ...(ingredientProblem ? { name: ingredientProblem } : {}),
    };
  });
  const problems: RecipeProblems = {
    ...(nameProblem ? { name: nameProblem } : {}),
    ...(servingsOk ? {} : { servings: 'Enter a whole number from 1 to 12.' }),
    ...(seen.length ? {} : { ingredients: 'Add at least one ingredient.' }),
    rows,
  };
  if (hasProblems(problems)) {
    return { problems };
  }
  return { recipe: { name, servings: +servings, ingredients } };
}

function checkName(name: string, recipes: readonly Recipe[]): string | undefined {
  if (!name) {
    return 'Enter a name.';
  }
  if (name.length > MAX_NAME) {
    return 'Use at most 60 characters.';
  }
  const slug = recipeSlug(name);
  if (!slug) {
    return 'Use at least one letter or digit.';
  }
  if (recipes.some((recipe) => recipeSlug(recipe.name) === slug)) {
    return 'A recipe with this name already exists.';
  }
  return undefined;
}

function checkIngredient(name: string, earlier: readonly string[]): string | undefined {
  if (!name) {
    return 'Enter an ingredient.';
  }
  if (name.length > MAX_INGREDIENT) {
    return 'Use at most 40 characters.';
  }
  if (earlier.includes(name)) {
    return 'This ingredient is already in the list.';
  }
  return undefined;
}

function hasProblems({ rows, ...fields }: RecipeProblems): boolean {
  return [fields, ...rows].some((problems) => Object.keys(problems).length > 0);
}

function collapseSpaces(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}
