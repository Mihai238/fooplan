import { Ingredient, Recipe } from './recipe';
import { stepParts } from './step-amounts';

export const RECIPES_KEY = 'fooplan.recipes';
export const STEPS_VIEW_KEY = 'fooplan.stepsView';

export const QUICK_DAL: Recipe = {
  name: 'Quick Dal',
  servings: 4,
  ingredients: [
    { name: 'canned chickpeas', amount: 200, unit: 'g' },
    { name: 'onion', amount: 2, unit: 'pc' },
    { name: 'mystery spice', amount: 1, unit: 'pc' },
  ],
  own: true,
};

export const PLAIN_RICE: Recipe = {
  name: 'Plain Rice',
  servings: 4,
  ingredients: [{ name: 'rice', amount: 300, unit: 'g' }],
  own: true,
};

export function ownRecipe(name: string, servings = 4): Recipe {
  return { name, servings, ingredients: [{ name: 'onion', amount: 1, unit: 'pc' }], own: true };
}

// Saved the way RecipeStore saves them, without `own`, so the next load of the store reads them
export function storeOwnRecipes(...recipes: Recipe[]): void {
  const stored = recipes.map(({ name, servings, ingredients }) => ({
    name,
    servings,
    ingredients,
  }));
  localStorage.setItem(RECIPES_KEY, JSON.stringify(stored));
}

// The space before an amount is the page's: the template puts it outside span.amount
export function shownStep(step: string, ingredients: readonly Ingredient[]): string {
  return stepParts(step, ingredients)
    .map((part) => ('text' in part ? part.text : ` ${part.amount}`))
    .join('');
}

// The list the specs stub RECIPE_IMAGES with: two built-in recipes with a picture
export const LISTED_IMAGES: readonly string[] = ['pizza-toast', 'spaghetti-pomodoro'];

export const PLACEHOLDER = { placeholder: ['svg aria-hidden="true"'], text: '' };

// A recipe's picture as the specs compare it in one expect: an img.picture by its attributes, a
// div.picture.placeholder by its child elements and its text, anything else by its tag and classes
export function pictureShape(element: Element | null): object {
  if (element === null) {
    return { none: true };
  }
  if (element.matches('img.picture')) {
    return {
      src: element.getAttribute('src'),
      alt: element.getAttribute('alt'),
      width: element.getAttribute('width'),
      height: element.getAttribute('height'),
      loading: element.getAttribute('loading'),
    };
  }
  if (element.matches('div.picture.placeholder')) {
    return {
      placeholder: Array.from(element.children).map(
        (child) =>
          `${child.tagName.toLowerCase()} aria-hidden="${child.getAttribute('aria-hidden')}"`,
      ),
      text: element.textContent ?? '',
    };
  }
  return { element: [element.tagName.toLowerCase(), ...Array.from(element.classList)].join('.') };
}

export function picture(slug: string, loading: 'lazy' | null): object {
  return {
    src: `images/recipes/${slug}.webp`,
    alt: '',
    width: '800',
    height: '534',
    loading,
  };
}
