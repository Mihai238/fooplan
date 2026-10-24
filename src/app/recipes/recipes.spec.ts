import { UNITS, Unit } from './recipe';
import { RECIPES } from './recipes';

const SPEC_NAMES = [
  'Spaghetti pomodoro',
  'Spaghetti carbonara',
  'Pesto pasta with cherry tomatoes',
  'Lasagne',
  'Käsespätzle',
  'Chili con carne',
  'Goulash with bread',
  'Beef burgers with oven fries',
  'Stuffed peppers',
  'Schnitzel with potato salad',
  'Chicken curry with rice',
  'Teriyaki chicken with rice',
  'Chicken fajitas',
  'Chicken Caesar salad',
  'Oven-baked salmon with potatoes and green beans',
  'Fish tacos',
  'Chickpea and spinach curry',
  'Vegetable stir-fry with noodles',
  'Fried rice with egg and vegetables',
  'Ratatouille with rice',
  'Mushroom risotto',
  'Shakshuka with bread',
  'Spinach and feta quiche',
  'Baked potatoes with herb quark',
  'Couscous salad with halloumi',
  'Greek salad with feta and bread',
  'Lentil soup',
  'Minestrone',
  'Pumpkin soup',
  'Tomato soup with grilled cheese',
];

describe('RECIPES', () => {
  it('has a unique name, servings > 0 and at least one ingredient with amount > 0 and a known unit per recipe', () => {
    expectRecipesLoaded();
    const problems: string[] = [];
    const seenNames = new Set<string>();
    for (const recipe of RECIPES) {
      if (seenNames.has(recipe.name)) problems.push(`"${recipe.name}": duplicate name`);
      seenNames.add(recipe.name);
      if (!(recipe.servings > 0)) problems.push(`"${recipe.name}": servings ${recipe.servings}`);
      if (recipe.ingredients.length === 0) problems.push(`"${recipe.name}": no ingredients`);
      for (const ingredient of recipe.ingredients) {
        if (!(ingredient.amount > 0)) {
          problems.push(`"${recipe.name}" / "${ingredient.name}": amount ${ingredient.amount}`);
        }
        if (!UNITS.includes(ingredient.unit)) {
          problems.push(`"${recipe.name}" / "${ingredient.name}": unknown unit "${ingredient.unit}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('contains exactly the 30 recipes named in the spec, in the spec order', () => {
    expect(RECIPES.map((recipe) => recipe.name)).toEqual(SPEC_NAMES);
  });

  it('has whole-number servings', () => {
    expectRecipesLoaded();
    const problems = RECIPES.filter((recipe) => !Number.isInteger(recipe.servings)).map(
      (recipe) => `"${recipe.name}": servings ${recipe.servings}`,
    );
    expect(problems).toEqual([]);
  });

  it('lists no ingredient name twice within a recipe', () => {
    expectRecipesLoaded();
    const problems: string[] = [];
    for (const recipe of RECIPES) {
      const seen = new Set<string>();
      for (const ingredient of recipe.ingredients) {
        if (seen.has(ingredient.name)) problems.push(`"${recipe.name}": "${ingredient.name}" twice`);
        seen.add(ingredient.name);
      }
    }
    expect(problems).toEqual([]);
  });

  it('spells ingredient names in lowercase without leading or trailing whitespace', () => {
    expectRecipesLoaded();
    const problems = RECIPES.flatMap((recipe) =>
      recipe.ingredients
        .filter((ingredient) => ingredient.name !== ingredient.name.trim().toLowerCase())
        .map((ingredient) => `"${recipe.name}": "${ingredient.name}"`),
    );
    expect(problems).toEqual([]);
  });

  it('uses the same unit for an ingredient name in every recipe', () => {
    expectRecipesLoaded();
    const firstUse = new Map<string, { unit: Unit; recipe: string }>();
    const problems: string[] = [];
    for (const recipe of RECIPES) {
      for (const ingredient of recipe.ingredients) {
        const first = firstUse.get(ingredient.name);
        if (!first) {
          firstUse.set(ingredient.name, { unit: ingredient.unit, recipe: recipe.name });
        } else if (first.unit !== ingredient.unit) {
          problems.push(
            `"${ingredient.name}": ${first.unit} in "${first.recipe}", ${ingredient.unit} in "${recipe.name}"`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('has no ingredient name that is another ingredient name plus "s" or "es"', () => {
    expectRecipesLoaded();
    const names = new Set(
      RECIPES.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name)),
    );
    const problems = [...names].flatMap((name) =>
      ['s', 'es']
        .filter((suffix) => names.has(name + suffix))
        .map((suffix) => `"${name}" and "${name + suffix}"`),
    );
    expect(problems).toEqual([]);
  });

  // Without it, the invariant tests would pass vacuously on an empty list
  function expectRecipesLoaded() {
    expect(RECIPES.length, 'no recipes loaded').toBeGreaterThan(0);
  }
});
