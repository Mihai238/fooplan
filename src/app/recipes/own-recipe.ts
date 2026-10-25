import type { MessageId } from '../i18n';
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
  name?: MessageId;
  servings?: MessageId;
  // form.atLeastOneIngredient, shown below the legend
  ingredients?: MessageId;
  // One entry per row of the draft, in its order; a row without problems, or ignored as empty, has
  // an empty one
  rows: RowProblems[];
}

export interface RowProblems {
  amount?: MessageId;
  name?: MessageId;
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
      ...(amountOk ? {} : { amount: 'form.amountAboveZero' }),
      ...(ingredientProblem ? { name: ingredientProblem } : {}),
    };
  });
  const problems: RecipeProblems = {
    ...(nameProblem ? { name: nameProblem } : {}),
    ...(servingsOk ? {} : { servings: 'form.servingsRange' }),
    ...(seen.length ? {} : { ingredients: 'form.atLeastOneIngredient' }),
    rows,
  };
  if (hasProblems(problems)) {
    return { problems };
  }
  return { recipe: { name, servings: +servings, ingredients } };
}

function checkName(name: string, recipes: readonly Recipe[]): MessageId | undefined {
  if (!name) {
    return 'form.enterName';
  }
  if (name.length > MAX_NAME) {
    return 'form.nameTooLong';
  }
  const slug = recipeSlug(name);
  if (!slug) {
    return 'form.nameNeedsLetter';
  }
  if (recipes.some((recipe) => recipeSlug(recipe.name) === slug)) {
    return 'form.nameExists';
  }
  return undefined;
}

function checkIngredient(name: string, earlier: readonly string[]): MessageId | undefined {
  if (!name) {
    return 'form.enterIngredient';
  }
  if (name.length > MAX_INGREDIENT) {
    return 'form.ingredientTooLong';
  }
  if (earlier.includes(name)) {
    return 'form.ingredientExists';
  }
  return undefined;
}

function hasProblems({ rows, ...fields }: RecipeProblems): boolean {
  return [fields, ...rows].some((problems) => Object.keys(problems).length > 0);
}

function collapseSpaces(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}
